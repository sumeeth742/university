const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// 1. GET RESULTS
router.get('/:usn', async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.params.usn });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Error fetching results" });
    }
});

// 2. BULK UPLOAD (With Sanitization Fix)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        let count = 0;
        let skipped = 0;
        let errors = [];

        // STRICT FORMAT: 3BR + 2 Digits + 2 Letters + 3 Digits
        const usnRegex = /^3BR\d{2}[A-Z]{2}\d{3}$/; 

        for (const row of rows) {
            let rawUsn = row.usn; 
            if (!rawUsn) continue;

            // --- FIX 1: SANITIZE INPUT ---
            // Remove spaces, convert to uppercase (e.g. "3br 23 cs 001" -> "3BR23CS001")
            const usn = rawUsn.toString().toUpperCase().replace(/\s+/g, '');

            // --- RULE 1: VALIDATE USN FORMAT ---
            if (!usnRegex.test(usn)) {
                console.log(`⚠️ Skipped ${usn}: Invalid Format`);
                errors.push(`Invalid USN: '${rawUsn}' -> cleaned to '${usn}'`);
                skipped++;
                continue;
            }

            // --- RULE 2: VALIDATE AGE (Must be >= 17) ---
            if (row.dob) {
                const birthDate = new Date(row.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

                if (age < 17) {
                    errors.push(`${usn}: Student too young (${age} yrs). Min 17.`);
                    skipped++;
                    continue; 
                }
            }

            try {
                // --- ACCOUNT CREATION ---
                const userData = {
                    username: usn,
                    name: row.studentName || "Unknown",
                    role: 'student',
                    department: usn.substring(5, 7) // Extract 'CS' or 'EC'
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

                // SAVE RESULT
                await Result.deleteMany({ studentId: usn, semester: row.semester });
                
                await Result.create({
                    studentId: usn,
                    semester: row.semester,
                    gpa: sgpa,
                    subjects: row.subjects
                });
                count++;

            } catch (innerError) {
                errors.push(`${usn}: Database Error - ${innerError.message}`);
            }
        }

        let message = `Processed ${count} records.`;
        if (errors.length > 0) message += ` Errors: ${errors.length} (Check list).`;
        
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

        // Normalize input if it looks like a USN
        const cleanQuery = query.trim().toUpperCase();

        // 1. Delete by Semester
        const semDelete = await Result.deleteMany({ semester: query });
        if (semDelete.deletedCount > 0) return res.json({ message: `🗑️ Deleted ${semDelete.deletedCount} records for '${query}'.` });

        // 2. Delete by Name or USN
        const users = await User.find({ 
            $or: [{ name: query }, { username: cleanQuery }], 
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