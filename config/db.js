const mongoose = require('mongoose');

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

module.exports = connectDB;