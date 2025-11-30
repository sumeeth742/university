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
            if (!row.studentId) continue;

            // Upsert User
            const userData = {
                username: row.studentId,
                name: row.studentName,
                role: 'student',
                department: 'General'
            };
            // Only update password if DOB is provided
            if (row.dob) userData.password = row.dob;

            await User.findOneAndUpdate(
                { username: row.studentId },
                userData,
                { upsert: true, new: true }
            );

            // Calculate SGPA
            const getGradePoint = (g) => {
                g = g ? g.toUpperCase().trim() : '';
                if(g==='O') return 10; if(g==='A+') return 9; if(g==='A') return 8;
                if(g==='B+') return 7; if(g==='B') return 6; if(g==='C') return 5;
                return 0; 
            };

            let totalPoints = 0, totalCredits = 0;
            row.subjects.forEach(sub => {
                const cred = Number(sub.credits) || 0;
                totalPoints += (getGradePoint(sub.grade) * cred);
                totalCredits += cred;
            });
            const sgpa = totalCredits === 0 ? 0 : (totalPoints / totalCredits).toFixed(2);

            // Overwrite results
            await Result.deleteMany({ studentId: row.studentId, semester: row.semester });
            
            await Result.create({
                studentId: row.studentId,
                semester: row.semester,
                gpa: sgpa,
                subjects: row.subjects
            });
            count++;
        }
        res.status(201).json({ message: `Processed ${count} records.` });
    } catch (error) {
        res.status(500).json({ message: "Upload Error: " + error.message });
    }
});

// 3. DELETE STUDENT BY NAME (The New Feature)
router.delete('/delete-student', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Student Name required" });

        // A. Find the student(s) with this name
        const users = await User.find({ name: name, role: 'student' });
        
        if (users.length === 0) {
            return res.status(404).json({ message: `Student '${name}' not found.` });
        }

        let deletedResults = 0;
        let deletedUsers = 0;

        // B. Loop through found students (in case of duplicate names) and delete everything
        for (const user of users) {
            // Delete Results using the ID found
            const resultDelete = await Result.deleteMany({ studentId: user.username });
            deletedResults += resultDelete.deletedCount;

            // Delete the User Account
            await User.findByIdAndDelete(user._id);
            deletedUsers++;
        }

        res.json({ message: `Deleted ${deletedUsers} student(s) named '${name}' and ${deletedResults} result records.` });

    } catch (error) {
        res.status(500).json({ message: "Server Error: " + error.message });
    }
});

module.exports = router;