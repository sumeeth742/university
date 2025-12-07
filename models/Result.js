const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentId: { type: String, required: true, ref: 'User' }, 
    semester: { type: String, required: true }, 
    gpa: { type: Number, required: true },
    subjects: [{
        name: String,
        code: String,
        grade: String,
        credits: Number
    }]
}, { timestamps: true });

resultSchema.index({ studentId: 1, semester: 1 });
module.exports = mongoose.model('Result', resultSchema);