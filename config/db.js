const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Robustly check for the URI variable
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGO_URI is missing in .env file");

        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ Database Connection Error:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;