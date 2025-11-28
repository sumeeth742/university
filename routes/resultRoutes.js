const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// GET RESULTS
router.get('/:studentId', async (req, res) => {
    const results = await Result.find({ studentId: req.params.studentId });
    res.json(results);
});

// BULK UPLOAD
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body;
        let count = 0;

        for (const row of rows) {
            if (!row.studentId || !row.dob) continue;

            // 1. Upsert Student (Create if new, Update if exists)
            await User.findOneAndUpdate(
                { username: row.studentId },
                {
                    username: row.studentId,
                    password: row.dob, // Password is DOB
                    name: row.studentName,
                    role: 'student'
                },
                { upsert: true, new: true }
            );

            // 2. Create Result
            await Result.create({
                studentId: row.studentId,
                semester: row.semester,
                gpa: row.gpa,
                subjects: row.subjects
            });
            count++;
        }
        res.status(201).json({ message: `Processed ${count} records successfully.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Bulk upload failed" });
    }
});

module.exports = router;