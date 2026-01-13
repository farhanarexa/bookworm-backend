const Activity = require('../models/activityModel');

// @desc    Get all activities
// @route   GET /api/activities
// @access  Private
const getActivities = async (req, res) => {
    const activities = await Activity.find({})
        .populate('user', 'name photo')
        .populate('book', 'title coverImage')
        .sort({ createdAt: -1 })
        .limit(20);

    res.json(activities);
};

module.exports = {
    getActivities
};
