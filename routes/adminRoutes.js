const express = require('express');
const router = express.Router();
const {
    getStats,
    getUsers,
    updateUserRole,
    deleteUser
} = require('../controllers/adminController');
const { getGenres, createGenre, deleteGenre } = require('../controllers/genreController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/stats', protect, admin, getStats);
router.get('/users', protect, admin, getUsers);
router.put('/users/:id/role', protect, admin, updateUserRole);
router.delete('/users/:id', protect, admin, deleteUser);

// Genre routes
router.get('/genres', protect, admin, getGenres);
router.post('/genres', protect, admin, createGenre);
router.delete('/genres/:id', protect, admin, deleteGenre);


module.exports = router;
