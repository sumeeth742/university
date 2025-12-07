const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// REGEX FOR USN (3BR + 2 Digits + 2 Letters + 3 Digits)
const USN_REGEX = /^3BR\d{2}[A-Z]{2}\d{3}$/i;

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;

        // 1. Sanitize Input (Remove spaces)
        if (!username) return res.status(400).json({ message: "Username required" });
        
        let cleanUsername = username.trim();

        // Special handling: If it looks like a student USN, make it uppercase
        if (cleanUsername.toLowerCase() !== 'admin') {
            cleanUsername = cleanUsername.toUpperCase().replace(/\s+/g, '');
            
            // --- STRICT VALIDATION WITH CLEAN MESSAGE ---
            // This ensures only valid USNs can attempt to login
            if (!USN_REGEX.test(cleanUsername)) {
                return res.status(400).json({ message: "Invalid USN Format" });
            }
        } else {
            cleanUsername = 'admin'; // Force lowercase for admin
        }

        // 2. Find User in Database
        const user = await User.findOne({ username: cleanUsername });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // 3. Check Password
        let isMatch = false;
        
        if (user.role === 'admin') {
            // Admin: Check Encrypted Password
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // Student: Check Direct String (DOB)
            isMatch = (user.password.trim() === password.trim());
        }

        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        // 4. Generate Token
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

// GET ALL USERS (For Admin Dashboard)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('username name password department batch');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;