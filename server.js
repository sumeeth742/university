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

// --- 1. SMART PATH FINDING (Fixes "Page Not Found") ---
let publicPath = path.join(__dirname, 'public');

// If local path fails, try Vercel root path
if (!fs.existsSync(publicPath)) {
    publicPath = path.join(process.cwd(), 'public');
}

if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
} else {
    console.error("❌ CRITICAL: 'public' folder not found. Site will be blank.");
}

// --- 2. ROUTES ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// Seed Admin Route
app.get('/api/seed-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        await User.findOneAndDelete({ username: 'admin' });
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('securepassword', salt);
        await User.create({ username: 'admin', password: hash, name: 'Admin', role: 'admin', department: 'IT' });
        res.send("<h1>✅ Admin Created</h1><p>User: admin / Pass: securepassword</p>");
    } catch (err) { res.send(err.message); }
});

// --- 3. FALLBACK ROUTE (Fixes White Screen) ---
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ msg: "API Route Not Found" });
    
    const file = path.join(publicPath, 'index.html');
    if (fs.existsSync(file)) {
        res.sendFile(file);
    } else {
        res.status(500).send("<h1>500 Error: Frontend Missing</h1><p>Check if 'public/index.html' exists.</p>");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));