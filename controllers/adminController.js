const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getStats = async (req, res) => {
    const db = getDB();

    try {
        const totalBooks = await db.collection('books').countDocuments();
        const totalUsers = await db.collection('users').countDocuments();
        const totalReviews = await db.collection('reviews').countDocuments();
        const totalTutorials = await db.collection('tutorials') ? await db.collection('tutorials').countDocuments() : 0;

        // Genre distribution for charts
        const genreDistribution = await db.collection('books').aggregate([
            { $group: { _id: '$genre', count: { $sum: 1 } } },
            { $project: { name: '$_id', value: '$count', _id: 0 } }
        ]).toArray();

        // Pending reviews count
        const pendingReviews = await db.collection('reviews').countDocuments({ status: 'pending' });

        res.json({
            totalBooks,
            totalUsers,
            totalReviews,
            totalTutorials,
            pendingReviews,
            genreDistribution
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    const db = getDB();
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
    const db = getDB();
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
        res.status(400);
        throw new Error('Invalid role');
    }

    const result = await db.collection('users').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role, updatedAt: new Date() } }
    );

    if (result.matchedCount > 0) {
        res.json({ message: 'User role updated' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    const db = getDB();
    // Prevent self-deletion
    if (req.user._id.toString() === req.params.id) {
        res.status(400);
        throw new Error('Cannot delete yourself');
    }

    const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount > 0) {
        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
};

module.exports = {
    getStats,
    getUsers,
    updateUserRole,
    deleteUser
};

