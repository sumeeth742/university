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

// 2. BULK UPLOAD (Auto-Create Students & Grouping)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; // Grouped data from frontend
        let count = 0;

        for (const row of rows) {
            if (!row.studentId || !row.dob) continue;

            // Sync User (Create if new, Update if exists)
            // This ensures Password is set to the DOB from the CSV
            await User.findOneAndUpdate(
                { username: row.studentId },
                {
                    username: row.studentId,
                    password: row.dob, 
                    name: row.studentName,
                    role: 'student',
                    department: 'General'
                },
                { upsert: true, new: true }
            );

            // Clear old data for this specific semester to avoid duplicates
            await Result.deleteMany({ studentId: row.studentId, semester: row.semester });

            // Create new result
            await Result.create({
                studentId: row.studentId,
                semester: row.semester,
                gpa: row.gpa,
                subjects: row.subjects
            });
            count++;
        }
        res.status(201).json({ message: `Successfully processed ${count} semester records.` });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: "Bulk upload failed: " + error.message });
    }
});

// 3. DELETE SEMESTER (For Cleanup)
router.delete('/delete-semester', async (req, res) => {
    try {
        const { semester } = req.body;
        if (!semester) return res.status(400).json({ message: "Semester name required" });

        const result = await Result.deleteMany({ semester: semester });
        res.json({ message: `Deleted ${result.deletedCount} records matching '${semester}'.` });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;