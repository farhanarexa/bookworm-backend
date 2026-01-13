const mongoose = require('mongoose');

const bookSchema = mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title'],
        trim: true
    },
    author: {
        type: String,
        required: [true, 'Please add an author'],
        trim: true
    },
    genre: {
        type: String,
        required: [true, 'Please add a genre'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    coverImage: {
        type: String,
        required: [true, 'Please add a cover image URL']
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    averageRating: {
        type: Number,
        default: 0
    },
    ratingCount: {
        type: Number,
        default: 0
    },
    shelvedCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Book', bookSchema);
