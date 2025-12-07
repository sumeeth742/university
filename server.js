const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- SMART PATH FINDER ---
let publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// Seed Admin
app.get('/api/seed-admin', async (req, res) => {
    try {
        await connectDB();
        const User = require('./models/User');
        await User.findOneAndDelete({ username: 'admin' });
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('securepassword', salt);
        await User.create({ username: 'admin', password: hash, name: 'Admin', role: 'admin', department: 'IT' });
        res.send("<h1>✅ Admin Created</h1><a href='/'>Login</a>");
    } catch (err) { res.send(err.message); }
});

// Fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ msg: "API Route Not Found" });
    res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));