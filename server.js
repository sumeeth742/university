const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const bcrypt = require('bcryptjs');

dotenv.config();

// 1. Database Connection (Cached)
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

const connectDB = async () => {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGO_URI missing");
        cached.promise = mongoose.connect(uri).then((mongoose) => mongoose);
    }
    cached.conn = await cached.promise;
    console.log("✅ MongoDB Connected");
    return cached.conn;
};
connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. Smart Frontend Path Finder
let publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
    publicPath = path.join(process.cwd(), 'public');
}
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
} else {
    console.error("❌ CRITICAL: 'public' folder not found.");
}

// 3. Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// 4. Seed Admin
app.get('/api/seed-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        await User.findOneAndDelete({ username: 'admin' });
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('securepassword', salt);
        await User.create({ username: 'admin', password: hash, name: 'Master Admin', role: 'admin', department: 'IT' });
        res.send("<h1>✅ Admin Created!</h1><p>User: admin</p><p>Pass: securepassword</p><a href='/'>Login</a>");
    } catch (err) { res.status(500).send("Error: " + err.message); }
});

// 5. Fallback Route
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ msg: "API Route Not Found" });
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(500).send("Frontend missing");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));