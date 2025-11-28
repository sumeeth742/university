const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// 1. Load Config
dotenv.config();

// 2. Connect DB
const connectDB = require('./config/db');
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// 3. Serve Frontend
app.use(express.static(path.join(__dirname, 'public')));

// 4. Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));