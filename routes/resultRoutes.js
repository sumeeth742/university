const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// --- HELPER: FORMAT DATE ---
const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

// 2. BULK UPLOAD (Create User ONLY if new; Always upload Result)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        let successCount = 0;
        let errors = [];
        let newStudents = 0;

        const usnRegex = /^3BR\d{2}[A-Z]{2}\d{3}$/i; 

        for (const row of rows) {
            let rawUsn = row.usn; 
            if (!rawUsn) continue;

            // Sanitize USN
            const usn = rawUsn.toString().toUpperCase().replace(/\s+/g, '');

            try {
                // --- STEP 1: CHECK IF STUDENT EXISTS ---
                const existingUser = await User.findOne({ username: usn });

                if (!existingUser) {
                    // === REGISTER NEW STUDENT ===
                    
                    // 1. Validate Format
                    if (!usnRegex.test(usn)) throw new Error(`Invalid USN Format: '${rawUsn}'`);

                    // 2. Validate DOB & Age
                    if (!row.dob) throw new Error(`New student ${usn} requires DOB.`);
                    
                    const cleanDOB = formatDate(row.dob);
                    const birthDate = new Date(cleanDOB);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

                    if (age < 17) throw new Error(`Student under 17 years old.`);

                    // 3. Create Account
                    await User.create({
                        username: usn,
                        name: row.studentName || "Unknown",
                        password: cleanDOB, // Set initial password
                        role: 'student',
                        department: usn.substring(5, 7)
                    });
                    newStudents++;
                } 
                // IF STUDENT EXISTS: Do nothing to User table. Keep old password/name.

                // --- STEP 2: PROCESS RESULTS (Always do this) ---
                
                // Calculate SGPA
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

                // Save Result (Overwrite existing semester result if any)
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
            message: `Processed ${successCount} results. Registered ${newStudents} new students.`, 
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