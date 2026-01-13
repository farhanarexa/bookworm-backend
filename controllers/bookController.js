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
    const readBooks = await db.collection('books').find({ _id: { $in: readBookIds.map(id => new ObjectId(id)) } }).toArray();

    // Count genre occurrences
    const genreCounts = {};
    readBooks.forEach(book => {
        if (book.genre) {
            genreCounts[book.genre] = (genreCounts[book.genre] || 0) + 1;
        }
    });

    // Genres with 3+ reads
    const favoriteGenres = Object.keys(genreCounts).filter(genre => genreCounts[genre] >= 3);
    const otherReadGenres = Object.keys(genreCounts).filter(genre => genreCounts[genre] < 3);

    let recommendations = [];

    // 1. Fetch from favorite genres first
    if (favoriteGenres.length > 0) {
        const topRecs = await db.collection('books').find({
            genre: { $in: favoriteGenres },
            _id: { $nin: readBookIds.map(id => new ObjectId(id)) }
        }).limit(10).toArray();
        recommendations = [...topRecs];
    }

    // 2. Supplement with other read genres if needed
    if (recommendations.length < 5 && otherReadGenres.length > 0) {
        const additionalRecs = await db.collection('books').find({
            genre: { $in: otherReadGenres },
            _id: { $nin: [...readBookIds.map(id => new ObjectId(id)), ...recommendations.map(r => r._id)] }
        }).limit(10 - recommendations.length).toArray();
        recommendations = [...recommendations, ...additionalRecs];
    }

    // 3. Fallback to popular books
    if (recommendations.length < 5) {
        const popularBooks = await db.collection('books')
            .find({ _id: { $nin: [...readBookIds.map(id => new ObjectId(id)), ...recommendations.map(r => r._id)] } })
            .sort({ averageRating: -1 })
            .limit(12 - recommendations.length)
            .toArray();
        recommendations = [...recommendations, ...popularBooks];
    }

    // Final deduplication (by ID just in case) and slicing
    const uniqueRecs = Array.from(new Map(recommendations.map(item => [item._id.toString(), item])).values());

    res.json(uniqueRecs.slice(0, 12));
};

module.exports = {
    getBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook,
    getRecommendations
};
