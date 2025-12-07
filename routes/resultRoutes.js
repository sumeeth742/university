const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

const formatDate = (dateString) => {
    if (!dateString) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) return dateString.trim();
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

router.get('/:usn', async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.params.usn });
        res.json(results);
    } catch (err) { res.status(500).json({ message: "Error" }); }
});

router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        const usnRegex = /^3BR\d{2}[A-Z]{2}\d{3}$/i; 
        let successCount = 0, errors = [];

        for (const row of rows) {
            let usn = row.usn; 
            if (!usn) continue;
            usn = usn.toString().toUpperCase().replace(/\s+/g, '');

            try {
                if (!usnRegex.test(usn)) throw new Error(`Invalid USN: ${usn}`);
                
                let cleanDOB = null;
                if (row.dob) {
                    cleanDOB = formatDate(row.dob);
                    const birthDate = new Date(cleanDOB);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age--;
                    if (age < 17) throw new Error("Student under 17");
                }

                const userData = { username: usn, name: row.studentName || "Unknown", role: 'student', department: usn.substring(5, 7) };
                if (cleanDOB) userData.password = cleanDOB;

                await User.findOneAndUpdate({ username: usn }, userData, { upsert: true, new: true });

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

                await Result.deleteMany({ studentId: usn, semester: row.semester });
                await Result.create({ studentId: usn, semester: row.semester, gpa: sgpa, subjects: row.subjects });
                successCount++;
            } catch (err) { errors.push(`${usn}: ${err.message}`); }
        }
        res.status(200).json({ message: `Processed ${successCount} records.`, errors });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/delete-any', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: "Input required" });
        const cleanQuery = query.trim().toUpperCase();

        const semDelete = await Result.deleteMany({ semester: query.trim() }); // Case sensitive for Semester names usually
        if (semDelete.deletedCount > 0) return res.json({ message: `Deleted semester '${query}'.` });

        const users = await User.find({ $or: [{ name: query.trim() }, { username: cleanQuery }], role: 'student' });
        if (users.length > 0) {
            for (const user of users) {
                await Result.deleteMany({ studentId: user.username });
                await User.findByIdAndDelete(user._id);
            }
            return res.json({ message: `Deleted student '${query}'.` });
        }
        res.status(404).json({ message: "Not found." });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

module.exports = router;