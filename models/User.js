const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student'], default: 'student' },
    department: { type: String, default: 'General' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);