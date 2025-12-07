const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;

        // Sanitize input
        if (username) {
            username = username.toString().toUpperCase().replace(/\s+/g, '');
        }

        const user = await User.findOne({ username });

        if (!user) return res.status(400).json({ message: "User not found" });

        let isMatch = false;
        
        if (user.role === 'admin') {
            // Admin: Check Encrypted Password
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // Student: Check Direct String (DOB)
            isMatch = (user.password.trim() === password.trim());
        }

        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        // Generate Token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

        // Send Department info so Frontend can display Branch Name
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

// --- RESTORED: GET ALL STUDENTS (For Admin Dashboard) ---
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('username name password department batch');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;