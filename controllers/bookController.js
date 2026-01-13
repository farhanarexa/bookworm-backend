const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

// @desc    Get all books
// @route   GET /api/books
// @access  Public
const getBooks = async (req, res) => {
    const db = getDB();
    const pageSize = 12;
    const page = Number(req.query.pageNumber) || 1;

    let query = {};

    // Keyword Search (Title or Author)
    if (req.query.keyword) {
        query.$or = [
            { title: { $regex: req.query.keyword, $options: 'i' } },
            { author: { $regex: req.query.keyword, $options: 'i' } }
        ];
    }

    // Genre Filter (Multi-select)
    if (req.query.genre) {
        const genres = Array.isArray(req.query.genre)
            ? req.query.genre
            : req.query.genre.split(',').filter(g => g);
        if (genres.length > 0) {
            query.genre = { $in: genres };
        }
    }

    // Rating Filter
    if (req.query.minRating || req.query.maxRating) {
        query.averageRating = {};
        if (req.query.minRating) query.averageRating.$gte = Number(req.query.minRating);
        if (req.query.maxRating) query.averageRating.$lte = Number(req.query.maxRating);
    }

    // Sorting
    let sort = { createdAt: -1 }; // Default
    if (req.query.sortBy) {
        if (req.query.sortBy === 'rating') {
            sort = { averageRating: -1, ratingCount: -1 };
        } else if (req.query.sortBy === 'mostShelved') {
            sort = { shelvedCount: -1, createdAt: -1 };
        } else if (req.query.sortBy === 'newest') {
            sort = { createdAt: -1 };
        }
    }

    const count = await db.collection('books').countDocuments(query);
    const books = await db.collection('books')
        .find(query)
        .sort(sort)
        .limit(pageSize)
        .skip(pageSize * (page - 1))
        .toArray();

    res.json({ books, page, pages: Math.ceil(count / pageSize), count });
};

// @desc    Get single book
// @route   GET /api/books/:id
// @access  Public
const getBookById = async (req, res) => {
    const db = getDB();
    const book = await db.collection('books').findOne({ _id: new ObjectId(req.params.id) });

    if (book) {
        res.json(book);
    } else {
        res.status(404);
        throw new Error('Book not found');
    }
};

// @desc    Create a book
// @route   POST /api/books
// @access  Private/Admin
const createBook = async (req, res) => {
    const db = getDB();
    const { title, author, genre, description, coverImage } = req.body;

    const book = {
        title,
        author,
        genre,
        description,
        coverImage,
        addedBy: new ObjectId(req.user._id),
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await db.collection('books').insertOne(book);
    const createdBook = await db.collection('books').findOne({ _id: result.insertedId });
    res.status(201).json(createdBook);
};

// @desc    Update a book
// @route   PUT /api/books/:id
// @access  Private/Admin
const updateBook = async (req, res) => {
    const db = getDB();
    const { title, author, genre, description, coverImage } = req.body;

    const query = { _id: new ObjectId(req.params.id) };
    const book = await db.collection('books').findOne(query);

    if (book) {
        const updateDoc = {
            $set: {
                title: title || book.title,
                author: author || book.author,
                genre: genre || book.genre,
                description: description || book.description,
                coverImage: coverImage || book.coverImage,
                updatedAt: new Date()
            }
        };

        await db.collection('books').updateOne(query, updateDoc);
        const updatedBook = await db.collection('books').findOne(query);
        res.json(updatedBook);
    } else {
        res.status(404);
        throw new Error('Book not found');
    }
};

// @desc    Delete a book
// @route   DELETE /api/books/:id
// @access  Private/Admin
const deleteBook = async (req, res) => {
    const db = getDB();
    const result = await db.collection('books').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount > 0) {
        res.json({ message: 'Book removed' });
    } else {
        res.status(404);
        throw new Error('Book not found');
    }
};

// @desc    Get book recommendations
// @route   GET /api/books/recommendations
// @access  Private
const getRecommendations = async (req, res) => {
    const db = getDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user._id) });

    const readBookIds = user.read || [];
    const readBooks = await db.collection('books').find({
        _id: { $in: readBookIds.map(id => new ObjectId(id)) }
    }).toArray();

    // Get user's reviews to calculate average rating given
    const userReviews = await db.collection('reviews').find({
        user: new ObjectId(req.user._id)
    }).toArray();

    const userAvgRating = userReviews.length > 0
        ? userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length
        : 3.5; // Default to 3.5 if no reviews

    // FALLBACK LOGIC: If user has < 3 books in Read shelf
    if (readBooks.length < 3) {
        // Get top 10 popular books (by average rating and review count)
        const popularBooks = await db.collection('books')
            .find({
                _id: { $nin: readBookIds.map(id => new ObjectId(id)) },
                averageRating: { $gte: 3.5 },
                ratingCount: { $gte: 1 }
            })
            .sort({ averageRating: -1, ratingCount: -1 })
            .limit(10)
            .toArray();

        // Get 6-8 random books for discovery
        const allBooks = await db.collection('books')
            .find({
                _id: {
                    $nin: [
                        ...readBookIds.map(id => new ObjectId(id)),
                        ...popularBooks.map(b => b._id)
                    ]
                }
            })
            .toArray();

        const shuffled = allBooks.sort(() => 0.5 - Math.random());
        const randomBooks = shuffled.slice(0, 8);

        // Add reasons
        const popularWithReasons = popularBooks.map(book => ({
            ...book,
            reason: `Popular choice with ${book.ratingCount} reviews (${book.averageRating.toFixed(1)}★)`
        }));

        const randomWithReasons = randomBooks.map(book => ({
            ...book,
            reason: 'Discover something new'
        }));

        const combined = [...popularWithReasons, ...randomWithReasons];
        return res.json(combined.slice(0, 18));
    }

    // PERSONALIZED RECOMMENDATIONS: User has 3+ books

    // 1. Analyze genre preferences
    const genreCounts = {};
    readBooks.forEach(book => {
        if (book.genre) {
            genreCounts[book.genre] = (genreCounts[book.genre] || 0) + 1;
        }
    });

    // Sort genres by count (most read first)
    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([genre, count]) => ({ genre, count }));

    const topGenres = sortedGenres.slice(0, 3).map(g => g.genre);

    // 2. Get candidate books from user's genres
    const candidateBooks = await db.collection('books')
        .find({
            _id: { $nin: readBookIds.map(id => new ObjectId(id)) },
            genre: { $in: Object.keys(genreCounts) }
        })
        .toArray();

    // 3. Get review counts for each candidate book
    const bookReviewCounts = await db.collection('reviews').aggregate([
        {
            $match: {
                book: { $in: candidateBooks.map(b => b._id) },
                status: 'approved'
            }
        },
        {
            $group: {
                _id: '$book',
                reviewCount: { $sum: 1 }
            }
        }
    ]).toArray();

    const reviewCountMap = {};
    bookReviewCounts.forEach(item => {
        reviewCountMap[item._id.toString()] = item.reviewCount;
    });

    // 4. Score each candidate book
    const scoredBooks = candidateBooks.map(book => {
        let score = 0;
        let reasons = [];

        // Genre match score (higher for top genres)
        const genreIndex = topGenres.indexOf(book.genre);
        if (genreIndex !== -1) {
            const genreScore = (3 - genreIndex) * 10; // 30, 20, 10 points
            score += genreScore;
            const genreCount = genreCounts[book.genre];
            reasons.push(`Matches your preference for ${book.genre} (${genreCount} book${genreCount > 1 ? 's' : ''} read)`);
        } else if (genreCounts[book.genre]) {
            score += 5;
            reasons.push(`Similar to ${book.genre} books you've read`);
        }

        // Community rating score
        if (book.averageRating >= 4.0) {
            score += 15;
            reasons.push(`Highly rated (${book.averageRating.toFixed(1)}★)`);
        } else if (book.averageRating >= 3.5) {
            score += 8;
        }

        // Review count bonus (books with many approved reviews)
        const approvedReviews = reviewCountMap[book._id.toString()] || 0;
        if (approvedReviews >= 5) {
            score += 10;
            reasons.push(`${approvedReviews} community reviews`);
        } else if (approvedReviews >= 2) {
            score += 5;
        }

        // Shelved count bonus (popular books)
        if (book.shelvedCount >= 10) {
            score += 5;
        }

        // Combine reasons
        const reason = reasons.length > 0
            ? reasons.slice(0, 2).join(' • ')
            : `Recommended in ${book.genre}`;

        return {
            ...book,
            score,
            reason
        };
    });

    // 5. Sort by score and take top recommendations
    scoredBooks.sort((a, b) => b.score - a.score);
    let recommendations = scoredBooks.slice(0, 12);

    // 6. If we don't have enough, add some popular books
    if (recommendations.length < 12) {
        const popularBooks = await db.collection('books')
            .find({
                _id: {
                    $nin: [
                        ...readBookIds.map(id => new ObjectId(id)),
                        ...recommendations.map(r => r._id)
                    ]
                },
                averageRating: { $gte: 3.5 }
            })
            .sort({ averageRating: -1, ratingCount: -1 })
            .limit(12 - recommendations.length)
            .toArray();

        const popularWithReasons = popularBooks.map(book => ({
            ...book,
            reason: `Popular choice (${book.averageRating.toFixed(1)}★)`,
            score: 0
        }));

        recommendations = [...recommendations, ...popularWithReasons];
    }

    // 7. Add a few random discovery books to reach 15-18 total
    const discoveryCount = Math.min(6, 18 - recommendations.length);
    if (discoveryCount > 0) {
        const allOtherBooks = await db.collection('books')
            .find({
                _id: {
                    $nin: [
                        ...readBookIds.map(id => new ObjectId(id)),
                        ...recommendations.map(r => r._id)
                    ]
                }
            })
            .toArray();

        const shuffled = allOtherBooks.sort(() => 0.5 - Math.random());
        const discoveryBooks = shuffled.slice(0, discoveryCount).map(book => ({
            ...book,
            reason: 'Discover something new',
            score: -1
        }));

        recommendations = [...recommendations, ...discoveryBooks];
    }

    // Remove score field before sending
    const finalRecommendations = recommendations.map(({ score, ...book }) => book);

    res.json(finalRecommendations.slice(0, 18));
};

module.exports = {
    getBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook,
    getRecommendations
};
