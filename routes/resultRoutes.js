const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');

// --- HELPER: GRADE TO POINTS TABLE ---
// Modify this according to your University's regulation
const getGradePoint = (grade) => {
    const g = grade.toUpperCase().trim();
    if (g === 'O') return 10;
    if (g === 'A+') return 9;
    if (g === 'A') return 8;
    if (g === 'B+') return 7;
    if (g === 'B') return 6;
    if (g === 'C') return 5;
    if (g === 'P') return 4;
    if (['F', 'AB', 'ABSENT'].includes(g)) return 0;
    return 0; // Default failure for unknown grades
};

// --- HELPER: CALCULATE SGPA ---
const calculateSGPA = (subjects) => {
    let totalPoints = 0;
    let totalCredits = 0;

    subjects.forEach(sub => {
        const points = getGradePoint(sub.grade);
        const credits = Number(sub.credits) || 0;
        
        // Only count towards SGPA if not Absent/Fail (depending on rules)
        // Usually, F grades DO count in the denominator (credits), lowering the GPA.
        totalPoints += (points * credits);
        totalCredits += credits;
    });

    if (totalCredits === 0) return 0;
    return (totalPoints / totalCredits).toFixed(2); // Returns string "8.55"
};

// 1. GET RESULTS
router.get('/:studentId', async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.params.studentId });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Error fetching results" });
    }
});

// 2. BULK UPLOAD (With Auto-Calculation)
router.post('/bulk', async (req, res) => {
    try {
        const rows = req.body; 
        let count = 0;

        for (const row of rows) {
            if (!row.studentId || !row.dob) continue;

            // 1. Sync User
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

            // 2. AUTO-CALCULATE SGPA HERE
            // We ignore whatever GPA was sent from frontend and calc it fresh
            const calculatedGPA = calculateSGPA(row.subjects);

            // 3. Clear old data & Save
            await Result.deleteMany({ studentId: row.studentId, semester: row.semester });

            await Result.create({
                studentId: row.studentId,
                semester: row.semester,
                gpa: calculatedGPA, // <--- Using the calculated value
                subjects: row.subjects
            });
            count++;
        }
        res.status(201).json({ message: `Successfully processed ${count} semesters. SGPA calculated automatically.` });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: "Bulk upload failed: " + error.message });
    }
});

// 3. DELETE SEMESTER
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