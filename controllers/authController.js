const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

// Generate JWT
const generateToken = (res, userId) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    const db = getDB();
    const { name, email, password, photo } = req.body;

    const userExists = await db.collection('users').findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = {
        name,
        email,
        password: hashedPassword,
        role: 'user',
        photo: photo || 'https://via.placeholder.com/150',
        wantToRead: [],
        currentlyReading: [],
        read: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(user);
    const createdUser = await db.collection('users').findOne({ _id: result.insertedId });

    if (createdUser) {
        generateToken(res, createdUser._id);
        res.status(201).json({
            _id: createdUser._id,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
            photo: createdUser.photo,
            read: createdUser.read || [],
            readingGoal: createdUser.readingGoal || 0
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
    const db = getDB();
    const { email, password } = req.body;

    const user = await db.collection('users').findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        generateToken(res, user._id);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            photo: user.photo,
            read: user.read || [],
            readingGoal: user.readingGoal || 0
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
};

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    const user = {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        photo: req.user.photo,
        read: req.user.read || [],
        readingGoal: req.user.readingGoal || 0
    };
    res.status(200).json(user);
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile
};
