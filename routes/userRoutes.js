const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile
} = require('../controllers/authController');
const { addToShelf, getUserLibrary, updateReadingGoal } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/profile', protect, getUserProfile);
router.post('/shelf', protect, addToShelf);
router.get('/library', protect, getUserLibrary);
router.put('/goal', protect, updateReadingGoal);

module.exports = router;
