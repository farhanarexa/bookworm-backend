const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');


// @desc    Create new review
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
    const db = getDB();
    const { rating, content, bookId } = req.body;

    const book = await db.collection('books').findOne({ _id: new ObjectId(bookId) });

    if (book) {
        // Check if user already reviewed
        const alreadyReviewed = await db.collection('reviews').findOne({
            user: new ObjectId(req.user._id),
            book: new ObjectId(bookId)
        });

        if (alreadyReviewed) {
            res.status(400);
            throw new Error('Product already reviewed');
        }

        const review = {
            user: new ObjectId(req.user._id),
            book: new ObjectId(bookId),
            rating: Number(rating),
            content,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('reviews').insertOne(review);
        const createdReview = await db.collection('reviews').findOne({ _id: result.insertedId });

        // Activity logging
        await db.collection('activities').insertOne({
            user: new ObjectId(req.user._id),
            type: 'new_review',
            book: new ObjectId(bookId),
            details: `rated it ${rating}/5`,
            timestamp: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json(createdReview);
    } else {
        res.status(404);
        throw new Error('Book not found');
    }
};

// @desc    Get reviews for a book
// @route   GET /api/reviews/book/:bookId
// @access  Public
const getBookReviews = async (req, res) => {
    const db = getDB();
    const reviews = await db.collection('reviews').aggregate([
        { $match: { book: new ObjectId(req.params.bookId), status: 'approved' } },
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: '$userDetails' },
        {
            $project: {
                user: { name: '$userDetails.name', photo: '$userDetails.photo' },
                rating: 1,
                content: 1,
                createdAt: 1
            }
        }
    ]).toArray();
    res.json(reviews);
};

// @desc    Get all pending reviews (Admin)
// @route   GET /api/reviews/pending
// @access  Private/Admin
const getPendingReviews = async (req, res) => {
    const db = getDB();
    const reviews = await db.collection('reviews').aggregate([
        { $match: { status: 'pending' } },
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        {
            $lookup: {
                from: 'books',
                localField: 'book',
                foreignField: '_id',
                as: 'bookDetails'
            }
        },
        { $unwind: '$userDetails' },
        { $unwind: '$bookDetails' },
        {
            $project: {
                user: { name: '$userDetails.name' },
                book: { title: '$bookDetails.title' },
                rating: 1,
                content: 1,
                createdAt: 1
            }
        }
    ]).toArray();
    res.json(reviews);
};

// @desc    Approve review
// @route   PUT /api/reviews/:id/approve
// @access  Private/Admin
const approveReview = async (req, res) => {
    const db = getDB();
    const query = { _id: new ObjectId(req.params.id) };
    const review = await db.collection('reviews').findOne(query);

    if (review) {
        await db.collection('reviews').updateOne(query, { $set: { status: 'approved', updatedAt: new Date() } });

        // Recalculate Book Rating
        const reviews = await db.collection('reviews').find({ book: review.book, status: 'approved' }).toArray();
        const ratingCount = reviews.length;
        const averageRating = ratingCount > 0
            ? Number(reviews.reduce((acc, item) => item.rating + acc, 0) / ratingCount).toFixed(1)
            : 0;

        await db.collection('books').updateOne(
            { _id: new ObjectId(review.book) },
            { $set: { ratingCount, averageRating: Number(averageRating) } }
        );

        res.json({ message: 'Review approved' });
    } else {
        res.status(404);
        throw new Error('Review not found');
    }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
const deleteReview = async (req, res) => {
    const db = getDB();
    const result = await db.collection('reviews').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount > 0) {
        res.json({ message: 'Review removed' });
    } else {
        res.status(404);
        throw new Error('Review not found');
    }
};

module.exports = {
    createReview,
    getBookReviews,
    getPendingReviews,
    approveReview,
    deleteReview
};
