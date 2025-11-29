const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Load Environment Variables
dotenv.config();

// 2. Connect to Database (Robust Method)
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGO_URI missing in .env");
        
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ Database Connection Error:", error.message);
        process.exit(1);
    }
};
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// 3. Serve Frontend (Static Files)
app.use(express.static(path.join(__dirname, 'public')));

// 4. Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// --- SPECIAL: SECRET ADMIN CREATION ROUTE ---
// NEW URL: https://your-site.vercel.app/api/seed-admin
app.get('/api/seed-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        
        // Delete old admin if exists (to reset password)
        await User.findOneAndDelete({ username: 'admin' });

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('securepassword', salt);

        // Create Admin
        await User.create({
            username: 'admin',
            password: hashedPassword,
            name: 'Master Administrator',
            role: 'admin',
            department: 'IT'
        });

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">✅ Admin Created Successfully!</h1>
                <p><strong>Username:</strong> admin</p>
                <p><strong>Password:</strong> securepassword</p>
                <br/>
                <a href="/" style="background: blue; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
            </div>
        `);
    } catch (err) {
        res.send("<h1>❌ Error</h1><p>" + err.message + "</p>");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));