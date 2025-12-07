const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const bcrypt = require('bcryptjs');

dotenv.config();

// --- 1. CONNECT DB ---
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGO_URI missing");
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected");
    } catch (error) {
        console.error("DB Error:", error.message);
    }
};
connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- 2. SMART FRONTEND PATH FINDING ---
// Vercel sometimes puts files in unexpected places. We check multiple spots.
let publicPath = path.join(__dirname, 'public'); 

if (!fs.existsSync(publicPath)) {
    // Try finding it relative to the process root (Vercel specific)
    publicPath = path.join(process.cwd(), 'backend', 'public');
}
if (!fs.existsSync(publicPath)) {
    // Last resort
    publicPath = path.join(process.cwd(), 'public');
}

if (fs.existsSync(publicPath)) {
    console.log(`✅ Serving frontend from: ${publicPath}`);
    app.use(express.static(publicPath));
} else {
    console.error("❌ CRITICAL: Could not find 'public' folder!");
}

// --- 3. ROUTES ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// Admin Seed Route
app.get('/api/seed-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        await User.findOneAndDelete({ username: 'admin' });
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('securepassword', salt);
        await User.create({ username: 'admin', password: hash, name: 'Admin', role: 'admin', department: 'IT' });
        res.send("✅ Admin Created");
    } catch (err) { res.send(err.message); }
});

// --- 4. FALLBACK (Prevents 500/404 on Refresh) ---
app.get('*', (req, res) => {
    // Don't intercept API calls
    if (req.path.startsWith('/api')) return res.status(404).json({ msg: "API Route Not Found" });

    if (fs.existsSync(path.join(publicPath, 'index.html'))) {
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        res.send("<h1>500 Error: Frontend File Missing</h1>");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));