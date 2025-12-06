const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// --- HELPER: Fix Date Format to YYYY-MM-DD ---
// This fixes the issue where Excel saves as "5/20/2002" but you want "2002-05-20"
const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return dateString; // Return original if we can't parse it
    
    // Convert to YYYY-MM-DD
    return date.toISOString().split('T')[0];
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

// 2. BULK UPLOAD (With Date Fixing)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        let successCount = 0;
        let errors = [];

        const usnRegex = /^3BR\d{2}[A-Z]{2}\d{3}$/i; 

        for (const row of rows) {
            let rawUsn = row.usn; 
            if (!rawUsn) continue;

            const usn = rawUsn.toString().toUpperCase().replace(/\s+/g, '');

            try {
                // RULE 1: VALIDATE FORMAT
                if (!usnRegex.test(usn)) throw new Error(`Invalid USN Format: '${rawUsn}'`);

                // RULE 2: FIX & VALIDATE DATE
                let cleanDOB = null;
                if (row.dob) {
                    // FIX: Convert whatever is in CSV to YYYY-MM-DD
                    cleanDOB = formatDate(row.dob); 

                    // Age Check
                    const birthDate = new Date(cleanDOB);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

                    if (age < 17) throw new Error(`Student too young (${age} yrs). Min 17.`);
                }

                // UPSERT USER
                const userData = {
                    username: usn,
                    name: row.studentName || "Unknown",
                    role: 'student',
                    department: usn.substring(5, 7)
                };
                
                // FORCE UPDATE PASSWORD WITH CLEAN DATE
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
                errors.push(`${usn}: ${rowError.message}`);
            }
        }

        res.status(200).json({ 
            message: `Processed ${successCount}/${rows.length} records.`, 
            errors: errors 
        });

    } catch (error) {
        res.status(500).json({ message: "Critical Server Error: " + error.message });
    }
});

// 3. SMART DELETE
router.delete('/delete-any', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: "Input required" });

        const cleanQuery = query.trim();
        const upperQuery = cleanQuery.toUpperCase();

        const semDelete = await Result.deleteMany({ semester: cleanQuery });
        if (semDelete.deletedCount > 0) return res.json({ message: `🗑️ Deleted ${semDelete.deletedCount} records for '${cleanQuery}'.` });

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
            return res.json({ message: `👤 Deleted ${deletedUsers} student(s) matching '${cleanQuery}'.` });
        }

        return res.status(404).json({ message: `No data found matching '${cleanQuery}'.` });

    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;