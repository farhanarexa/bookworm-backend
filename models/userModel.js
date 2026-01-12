const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    photo: {
        type: String,
        default: 'https://via.placeholder.com/150'
    },
    // User Shelves
    wantToRead: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book'
    }],
    currentlyReading: [{
        book: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Book'
        },
        progress: {
            type: Number, // Page number or percentage
            default: 0
        },
        totalLength: {
            type: Number, // Total pages
            default: 0
        }
    }],
    read: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book'
    }]
}, {
    timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
