const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const Genre = require('../models/genreModel');

// @desc    Get all genres
// @route   GET /api/admin/genres
// @access  Private/Admin
const getGenres = async (req, res) => {
    const db = getDB();
    let genres = await db.collection('genres').find({}).toArray();

    if (genres.length === 0) {
        const defaults = ['Fiction', 'Non-Fiction', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance', 'History', 'Technology'];
        const seedData = defaults.map(name => ({ name, createdAt: new Date() }));
        await db.collection('genres').insertMany(seedData);
        genres = await db.collection('genres').find({}).toArray();
    }

    res.json(genres);
};

// @desc    Create a genre
// @route   POST /api/admin/genres
// @access  Private/Admin
const createGenre = async (req, res) => {
    const { name } = req.body;
    const db = getDB();

    const exists = await db.collection('genres').findOne({ name });
    if (exists) {
        res.status(400);
        throw new Error('Genre already exists');
    }

    const result = await db.collection('genres').insertOne({ name, createdAt: new Date() });
    const created = await db.collection('genres').findOne({ _id: result.insertedId });
    res.status(201).json(created);
};

// @desc    Delete a genre
// @route   DELETE /api/admin/genres/:id
// @access  Private/Admin
const deleteGenre = async (req, res) => {
    const db = getDB();
    const result = await db.collection('genres').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount > 0) {
        res.json({ message: 'Genre removed' });
    } else {
        res.status(404);
        throw new Error('Genre not found');
    }
};

module.exports = {
    getGenres,
    createGenre,
    deleteGenre
};
