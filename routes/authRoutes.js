const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// REGISTER (Only used to create the first Admin)
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, role, department } = req.body;
        
        // Simple validation
        if (!username || !password) return res.status(400).json({ message: "Missing fields" });

        // Hash password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            name,
            role,
            department
        });

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(400).json({ message: "User already exists or error occurred" });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) return res.status(400).json({ message: "User not found" });

        // Check Password
        // 1. If Admin: Compare hashed password
        // 2. If Student: Compare direct string (DOB)
        let isMatch = false;
        if (user.role === 'admin') {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = (user.password === password);
        }

        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        // Generate Token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            token,
            id: user.username,
            name: user.name,
            role: user.role
        });

    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;