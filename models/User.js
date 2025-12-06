const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        uppercase: true, 
        trim: true 
    }, // USN (e.g., 3BR23CS001)
    
    password: { type: String, required: true }, // DOB (YYYY-MM-DD)
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student'], default: 'student' },
    
    // --- AUTOMATIC FIELDS ---
    department: { type: String }, // Extracted from USN
    batch: { type: Number },      // Extracted from USN
    
}, { timestamps: true });

// --- SMART LOGIC: Auto-fill Batch & Dept before saving ---
// FIX: Removed 'next' parameter. This prevents the "next is not a function" error.
userSchema.pre('save', function() {
    // Only run this logic for students with a valid USN length
    if (this.role === 'student' && this.username && this.username.length >= 7) {
        
        // Example USN: 3BR21CS001
        // Year is at index 3 & 4 ("21") -> Becomes 2021
        const yearShort = this.username.substring(3, 5);
        if (!isNaN(yearShort)) {
            this.batch = parseInt("20" + yearShort);
        }

        // Dept is at index 5 & 6 ("CS")
        this.department = this.username.substring(5, 7);
    }
});

module.exports = mongoose.model('User', userSchema);