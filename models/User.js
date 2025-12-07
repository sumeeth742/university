const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        uppercase: true, 
        trim: true 
    }, 
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student'], default: 'student' },
    department: { type: String }, 
    batch: { type: Number },
}, { timestamps: true });

// --- CRASH FIX: Removed 'next' parameter ---
userSchema.pre('save', function() {
    // Only run this logic for students
    if (this.role === 'student' && this.username && this.username.length >= 7) {
        // Extract Batch
        const yearShort = this.username.substring(3, 5);
        if (!isNaN(yearShort)) {
            this.batch = parseInt("20" + yearShort);
        }
        // Extract Dept
        this.department = this.username.substring(5, 7);
    }
});

module.exports = mongoose.model('User', userSchema);