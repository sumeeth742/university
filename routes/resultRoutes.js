const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// 1. GET RESULTS
router.get('/:studentId', async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.params.studentId });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Error fetching results" });
    }
});

// 2. BULK UPLOAD
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        let count = 0;

        for (const row of rows) {
            if (!row.studentId || !row.dob) continue;

            // Sync User
            await User.findOneAndUpdate(
                { username: row.studentId },
                {
                    username: row.studentId,
                    password: row.dob, 
                    name: row.studentName,
                    role: 'student'
                },
                { upsert: true, new: true }
            );

            // Overwrite existing results for this semester/student
            await Result.deleteMany({ 
                studentId: row.studentId, 
                semester: row.semester 
            });

            // Create new result
            await Result.create({
                studentId: row.studentId,
                semester: row.semester,
                gpa: row.gpa,
                subjects: row.subjects
            });
            count++;
        }
        res.status(201).json({ message: `Successfully processed ${count} records.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Upload failed: " + error.message });
    }
});

// 3. DELETE SPECIFIC SEMESTER (NEW FEATURE)
router.delete('/delete-semester', async (req, res) => {
    try {
        const { semester } = req.body;
        if (!semester) return res.status(400).json({ message: "Semester name required" });

        const result = await Result.deleteMany({ semester: semester });
        res.json({ message: `Deleted ${result.deletedCount} records for '${semester}'.` });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;