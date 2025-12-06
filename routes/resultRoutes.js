const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// 1. GET RESULTS
router.get('/:usn', async (req, res) => {
    try {
        // We look for 'studentId' in Result schema which holds the USN
        const results = await Result.find({ studentId: req.params.usn });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Error fetching results" });
    }
});

// 2. BULK UPLOAD (With USN & Age Validation)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        let count = 0;
        let skipped = 0;
        let errors = [];

        // VALIDATION REGEX: 3BR + 2 Digits + 2 Letters + 3 Digits (e.g. 3BR23CS001)
        const usnRegex = /^3BR\d{2}[A-Z]{2}\d{3}$/i; 

        for (const row of rows) {
            // We expect 'usn' from the frontend parser
            const usn = row.usn; 

            if (!usn) continue;

            // --- RULE 1: VALIDATE USN FORMAT ---
            if (!usnRegex.test(usn)) {
                console.log(`⚠️ Skipped ${usn}: Invalid Format`);
                errors.push(`Invalid USN format: ${usn}`);
                skipped++;
                continue;
            }

            // --- RULE 2: VALIDATE AGE (Must be >= 17) ---
            if (row.dob) {
                const birthDate = new Date(row.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

                if (age < 17) {
                    console.log(`⚠️ Skipped ${usn}: Too young (${age} yrs).`);
                    errors.push(`Student ${usn} is under 17 (${age} yrs)`);
                    skipped++;
                    continue; 
                }
            }

            // --- ACCOUNT CREATION ---
            const userData = {
                username: usn,
                name: row.studentName,
                role: 'student',
                // Determine department from USN (e.g., 'CS' from 3BR23CS001)
                department: usn.substring(5, 7) 
            };
            if (row.dob) userData.password = row.dob;

            await User.findOneAndUpdate(
                { username: usn },
                userData,
                { upsert: true, new: true }
            );

            // --- SGPA CALCULATION ---
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

            // Save Result (delete old for this sem/student first)
            await Result.deleteMany({ studentId: usn, semester: row.semester });
            
            await Result.create({
                studentId: usn,
                semester: row.semester,
                gpa: sgpa,
                subjects: row.subjects
            });
            count++;
        }

        let message = `Processed ${count} records.`;
        if (errors.length > 0) message += ` Skipped ${skipped}. First error: ${errors[0]}`;
        
        res.status(201).json({ message, errors });

    } catch (error) {
        res.status(500).json({ message: "Upload Error: " + error.message });
    }
});

// 3. SMART DELETE
router.delete('/delete-any', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: "Input required" });

        // Delete by Semester
        const semDelete = await Result.deleteMany({ semester: query });
        if (semDelete.deletedCount > 0) {
            return res.json({ message: `🗑️ Deleted ${semDelete.deletedCount} records for '${query}'.` });
        }

        // Delete by Name or USN
        const users = await User.find({ 
            $or: [{ name: query }, { username: query }], 
            role: 'student' 
        });
        
        if (users.length > 0) {
            let deletedUsers = 0;
            for (const user of users) {
                await Result.deleteMany({ studentId: user.username });
                await User.findByIdAndDelete(user._id);
                deletedUsers++;
            }
            return res.json({ message: `👤 Deleted ${deletedUsers} student(s) matching '${query}'.` });
        }

        return res.status(404).json({ message: `No data found matching '${query}'.` });

    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;