const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');

dotenv.config();

// 1. Connect to Database
connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. Smart Path Finding (Fixes "Page Not Found" on Vercel)
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

// 3. API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// 4. Secret Admin Creator
app.get('/api/seed-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        await User.findOneAndDelete({ username: 'admin' });
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('securepassword', salt);
        
        await User.create({ 
            username: 'admin', 
            password: hash, 
            name: 'Master Administrator', 
            role: 'admin', 
            department: 'IT' 
        });
        
        res.send("<h1>✅ Admin Created</h1><p>User: admin<br>Pass: securepassword</p><a href='/'>Go to Login</a>");
    } catch (err) { 
        res.status(500).send("Error: " + err.message); 
    }
});

// 5. Fallback Route (Serves React App)
app.get('*', (req, res) => {
    // Don't intercept API calls
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ msg: "API Route Not Found" });
    }

    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send("<h1>500 Error</h1><p>Frontend file (index.html) is missing.</p>");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));