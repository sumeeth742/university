const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    // Links result to the Student's USN
    studentId: { type: String, required: true, ref: 'User' }, 
    
    semester: { type: String, required: true }, // e.g., "Semester 1"
    gpa: { type: Number, required: true },      // SGPA for this specific semester
    
    subjects: [{
        name: { type: String, required: true }, // e.g. "Mathematics-I"
        code: { type: String, required: true }, // e.g. "21MAT11"
        grade: { type: String, required: true }, // e.g. "A+"
        credits: { type: Number, required: true } // e.g. 4
    }]
}, { timestamps: true });

// Compound Index: Optimizes searching for specific semester results
resultSchema.index({ studentId: 1, semester: 1 });

module.exports = mongoose.model('Result', resultSchema);