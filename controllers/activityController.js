

// @desc    Get all activities
// @route   GET /api/activities
// @access  Private
const getActivities = async (req, res) => {
    const db = getDB();
    const activities = await db.collection('activities').aggregate([
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
            $lookup: {
                from: 'books',
                localField: 'book',
                foreignField: '_id',
                as: 'bookDetails'
            }
        },
        { $unwind: '$bookDetails' },
        {
            $project: {
                user: { name: '$userDetails.name', photo: '$userDetails.photo' },
                book: { title: '$bookDetails.title', coverImage: '$bookDetails.coverImage' },
                type: 1,
                details: 1,
                timestamp: 1,
                createdAt: 1
            }
        },
        { $sort: { createdAt: -1 } },
        { $limit: 20 }
    ]).toArray();

    res.json(activities);
};

module.exports = {
    getActivities
};
