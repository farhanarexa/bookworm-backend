const mongoose = require('mongoose');

const tutorialSchema = mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title'],
        trim: true
    },
    url: {
        type: String,
        required: [true, 'Please add a YouTube URL'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Please add a category'],
        enum: ['Reading Tips', 'Writing', 'Book Reviews', 'Library Tours', 'Other'],
        default: 'Other'
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Tutorial', tutorialSchema);
