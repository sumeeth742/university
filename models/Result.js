const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    semester: { type: String, required: true },
    gpa: { type: Number, required: true },
    subjects: [{
        name: String,
        code: String,
        grade: String,
        credits: Number
    }]
});

module.exports = mongoose.model('Result', resultSchema);