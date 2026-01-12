const express = require("express");
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes
const userRoutes = require('./routes/userRoutes');
const bookRoutes = require('./routes/bookRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/upload', uploadRoutes);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get("/", (req, res) => {
    res.send("Bookworm API is running...");
});

// Error Handler Placeholder (will implement properly later)
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

app.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});