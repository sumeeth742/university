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

            const userData = {
                username: row.studentId,
                name: row.studentName,
                role: 'student',
                department: 'General'
            };
            if (row.dob) userData.password = row.dob;

            await User.findOneAndUpdate(
                { username: row.studentId },
                userData,
                { upsert: true, new: true }
            );

            // SGPA Calc
            const getGradePoint = (g) => {
                g = g ? g.toUpperCase().trim() : '';
                if(g==='O') return 10; if(g==='A+') return 9; if(g==='A') return 8;
                if(g==='B+') return 7; if(g==='B') return 6; if(g==='C') return 5;
                if(g==='P') return 4; return 0; 
            };

            let totalPoints = 0, totalCredits = 0;
            row.subjects.forEach(sub => {
                const cred = Number(sub.credits) || 0;
                totalPoints += (getGradePoint(sub.grade) * cred);
                totalCredits += cred;
            });
            const sgpa = totalCredits === 0 ? 0 : (totalPoints / totalCredits).toFixed(2);

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

// 3. SMART DELETE (Handles Name OR Semester)
router.delete('/delete-any', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: "Input required" });

        // A. Try Deleting by SEMESTER first
        // (Deletes results, keeps student accounts)
        const semDelete = await Result.deleteMany({ semester: query });
        
        if (semDelete.deletedCount > 0) {
            return res.json({ message: `🗑️ Deleted ${semDelete.deletedCount} records for semester '${query}'.` });
        }

        // B. If no semester matched, Try Deleting by STUDENT NAME
        // (Deletes user account AND their results)
        const users = await User.find({ name: query, role: 'student' });
        
        if (users.length > 0) {
            let deletedUsers = 0;
            for (const user of users) {
                await Result.deleteMany({ studentId: user.username }); // Delete results
                await User.findByIdAndDelete(user._id); // Delete user
                deletedUsers++;
            }
            return res.json({ message: `👤 Deleted ${deletedUsers} student(s) named '${query}' and their data.` });
        }

        return res.status(404).json({ message: `No Semester or Student found matching '${query}'.` });

    } catch (error) {
        res.status(500).json({ message: "Server Error: " + error.message });
    }
});

module.exports = router;