const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// REGEX FOR USN (3BR + 2 Digits + 2 Letters + 3 Digits)
const USN_REGEX = /^3BR\d{2}[A-Z]{2}\d{3}$/i;

router.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;

        // Sanitize input
        if (username) {
            username = username.toString().toUpperCase().replace(/\s+/g, '');
        }

        // BACKEND VALIDATION FOR STUDENT
        // If it's not admin ('admin' doesn't match the regex) AND doesn't match regex -> Reject
        if (username !== 'ADMIN' && !USN_REGEX.test(username)) {
            return res.status(400).json({ message: "Invalid USN Format (Backend)" });
        }

        const user = await User.findOne({ username });

        if (!user) return res.status(400).json({ message: "User not found" });

        let isMatch = false;
        
        if (user.role === 'admin') {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = (user.password.trim() === password.trim());
        }

        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

        res.json({ 
            token, 
            id: user.username, 
            name: user.name, 
            role: user.role,
            department: user.department 
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('username name password department batch');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;