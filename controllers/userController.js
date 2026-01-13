const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const Activity = require('../models/activityModel');

// @desc    Add book to shelf
// @route   POST /api/users/shelf
// @access  Private
const addToShelf = async (req, res) => {
    const db = getDB();
    const { bookId, shelf, progress, totalLength } = req.body;

    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user._id) });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Initialize shelves if they don't exist
    user.wantToRead = user.wantToRead || [];
    user.read = user.read || [];
    user.currentlyReading = user.currentlyReading || [];

    // Check if book was already on any shelf
    const wasOnShelf =
        (user.wantToRead || []).some(id => id.toString() === bookId) ||
        (user.read || []).some(id => id.toString() === bookId) ||
        (user.currentlyReading || []).some(item => item.book.toString() === bookId);

    // Remove from all shelves first
    user.wantToRead = (user.wantToRead || []).filter(id => id.toString() !== bookId);
    user.read = (user.read || []).filter(id => id.toString() !== bookId);
    user.currentlyReading = (user.currentlyReading || []).filter(item => item.book.toString() !== bookId);

    if (shelf === 'wantToRead') {
        user.wantToRead.push(new ObjectId(bookId));
    } else if (shelf === 'read') {
        user.read.push(new ObjectId(bookId));
    } else if (shelf === 'currentlyReading') {
        user.currentlyReading.push({
            book: new ObjectId(bookId),
            progress: progress || 0,
            totalLength: totalLength || 0
        });
    }

    const isNowOnShelf = ['wantToRead', 'read', 'currentlyReading'].includes(shelf);

    if (!wasOnShelf && isNowOnShelf) {
        // Increment shelvedCount
        await db.collection('books').updateOne(
            { _id: new ObjectId(bookId) },
            { $inc: { shelvedCount: 1 } }
        );
    } else if (wasOnShelf && !isNowOnShelf) {
        // Decrement shelvedCount
        await db.collection('books').updateOne(
            { _id: new ObjectId(bookId) },
            { $inc: { shelvedCount: -1 } }
        );
    }

    await db.collection('users').updateOne(
        { _id: new ObjectId(req.user._id) },
        {
            $set: {
                wantToRead: user.wantToRead,
                read: user.read,
                currentlyReading: user.currentlyReading,
                updatedAt: new Date()
            }
        }
    );

    // Activity logging
    let details = '';
    if (shelf === 'wantToRead') details = 'added to wishlist';
    else if (shelf === 'read') details = 'finished reading';
    else if (shelf === 'currentlyReading') details = progress > 0 ? `updated progress to ${progress}` : 'started reading';

    if (details) {
        await Activity.create({
            user: new ObjectId(req.user._id),
            type: 'shelf_update',
            book: new ObjectId(bookId),
            details
        });
    }

    const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(req.user._id) });
    res.json(updatedUser);
};

// @desc    Get user library
// @route   GET /api/users/library
// @access  Private
const getUserLibrary = async (req, res) => {
    const db = getDB();

    // Instead of populate, we use aggregation or multiple queries. Let's use aggregation for power.
    const user = await db.collection('users').aggregate([
        { $match: { _id: new ObjectId(req.user._id) } },
        {
            $lookup: {
                from: 'books',
                localField: 'wantToRead',
                foreignField: '_id',
                as: 'wantToReadDetails'
            }
        },
        {
            $lookup: {
                from: 'books',
                localField: 'read',
                foreignField: '_id',
                as: 'readDetails'
            }
        },
        // currentlyReading is an array of objects, need special lookup
        {
            $lookup: {
                from: 'books',
                localField: 'currentlyReading.book',
                foreignField: '_id',
                as: 'currentlyReadingBooks'
            }
        },
        {
            $project: {
                wantToRead: '$wantToReadDetails',
                read: '$readDetails',
                currentlyReading: 1, // We still need the progress/totalLength
                currentlyReadingBooks: 1
            }
        }
    ]).next();

    if (user) {
        // Map currentlyReading to include book details
        const currentlyReadingMapped = (user.currentlyReading || []).map(item => {
            const bookInfo = user.currentlyReadingBooks.find(b => b._id.toString() === item.book.toString());
            return {
                ...item,
                book: bookInfo
            };
        });

        res.json({
            wantToRead: user.wantToRead,
            currentlyReading: currentlyReadingMapped,
            read: user.read
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Update user reading goal
// @route   PUT /api/users/goal
// @access  Private
const updateReadingGoal = async (req, res) => {
    const db = getDB();
    const { goal } = req.body;

    await db.collection('users').updateOne(
        { _id: new ObjectId(req.user._id) },
        { $set: { readingGoal: Number(goal) } }
    );

    res.json({ message: 'Reading goal updated', goal });
};

module.exports = {
    addToShelf,
    getUserLibrary,
    updateReadingGoal
};
