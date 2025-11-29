const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) return res.status(400).json({ message: "User not found" });

        // Check Password
        let isMatch = false;
        
        if (user.role === 'admin') {
            // Admin: Check Encrypted Password
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // Student: Check Direct String (DOB)
            // Note: In this system, student passwords (DOB) are stored as plain text for easy CSV matching
            isMatch = (user.password === password);
        }

        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        // Generate Token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ token, id: user.username, name: user.name, role: user.role });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;