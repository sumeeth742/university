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
    
    // Automatic Fields
    department: { type: String }, 
    batch: { type: Number },
    
}, { timestamps: true });

// --- STANDARD FIX: Explicitly use 'next' ---
userSchema.pre('save', function(next) {
    try {
        // Only run this logic for students
        if (this.role === 'student' && this.username && this.username.length >= 7) {
            
            // Extract Batch (e.g. 3BR21... -> 2021)
            const yearShort = this.username.substring(3, 5);
            if (!isNaN(yearShort)) {
                this.batch = parseInt("20" + yearShort);
            }

            // Extract Dept (e.g. ...CS... -> CS)
            this.department = this.username.substring(5, 7);
        }
        next(); // <--- CRITICAL: Successfully move to save
    } catch (error) {
        next(error); // Pass error if something breaks
    }
});

module.exports = mongoose.model('User', userSchema);