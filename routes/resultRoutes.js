const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// --- HELPER: FORCE DATE TO YYYY-MM-DD ---
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

// 1. GET RESULTS
router.get('/:usn', async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.params.usn });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Error fetching results" });
    }
});

// 2. BULK UPLOAD (With Crash Protection)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        const usnRegex = /^3BR\d{2}[A-Z]{2}\d{3}$/i; 
        let successCount = 0;
        let errors = [];

        for (const row of rows) {
            let rawUsn = row.usn; 
            if (!rawUsn) continue;

            const usn = rawUsn.toString().toUpperCase().replace(/\s+/g, '');

            try {
                // RULE 1: VALIDATE FORMAT
                if (!usnRegex.test(usn)) throw new Error(`Invalid USN: ${usn}`);

                // RULE 2: FIX DATE & VALIDATE AGE
                let cleanDOB = null;
                if (row.dob) {
                    cleanDOB = formatDate(row.dob);
                    const birthDate = new Date(cleanDOB);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age--;
                    if (age < 17) throw new Error("Student under 17");
                }

                // UPSERT USER
                const userData = {
                    username: usn,
                    name: row.studentName || "Unknown",
                    role: 'student',
                    department: usn.substring(5, 7)
                };
                
                // Only update password if DOB is present in CSV
                if (cleanDOB) userData.password = cleanDOB;

                await User.findOneAndUpdate(
                    { username: usn },
                    userData,
                    { upsert: true, new: true }
                );

                // CALCULATE SGPA
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
                successCount++;

            } catch (rowError) {
                console.error(`Row Error (${usn}):`, rowError.message);
                errors.push(`${usn}: ${rowError.message}`);
            }
        }

        // Always return 200 OK so frontend can show the report
        res.status(200).json({ 
            message: `Processed ${successCount} records.`, 
            errors: errors 
        });

    } catch (error) {
        console.error("Critical Upload Error:", error);
        res.status(500).json({ message: "Server Error: " + error.message });
    }
});

// 3. SMART DELETE (Fix for Vercel)
router.delete('/delete-any', async (req, res) => {
    try {
        // Vercel sometimes strips body in DELETE, so we check query params too
        const query = req.query.query || req.body.query;
        
        if (!query) return res.status(400).json({ message: "Input required" });

        const cleanQuery = query.trim();
        const upperQuery = cleanQuery.toUpperCase();

        // A. Delete by SEMESTER
        const semDelete = await Result.deleteMany({ semester: cleanQuery });
        if (semDelete.deletedCount > 0) return res.json({ message: `Deleted ${semDelete.deletedCount} records for '${cleanQuery}'.` });

        // B. Delete by USN or Name
        const users = await User.find({ 
            $or: [{ name: cleanQuery }, { username: upperQuery }], 
            role: 'student' 
        });
        
        if (users.length > 0) {
            let deletedUsers = 0;
            for (const user of users) {
                await Result.deleteMany({ studentId: user.username });
                await User.findByIdAndDelete(user._id);
                deletedUsers++;
            }
            return res.json({ message: `Deleted ${deletedUsers} student(s) matching '${cleanQuery}'.` });
        }

        return res.status(404).json({ message: `No data found matching '${cleanQuery}'.` });

    } catch (error) {
        res.status(500).json({ message: "Server Error: " + error.message });
    }
});

module.exports = router;