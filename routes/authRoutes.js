const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;
        if (username && username.toLowerCase() !== 'admin') {
            username = username.toUpperCase().replace(/\s+/g, '');
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
            token, id: user.username, name: user.name, role: user.role, department: user.department 
        });
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
});

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('username name password department batch');
        res.json(users);
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
});

module.exports = router;