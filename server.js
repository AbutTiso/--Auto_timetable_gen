const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;  // ← ONLY CHANGE THIS LINE
const ejs = require('ejs');

// EVERYTHING ELSE STAYS EXACTLY THE SAME AS YOUR CODE ABOVE ↓
// [All your existing code remains unchanged...]
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
    fs.readFile('data.json', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading data file');
            return;
        }
        const jsonData = JSON.parse(data);
        res.render('index', { data: jsonData });
    });
});

app.post('/generate-timetable', (req, res) => {
    console.log('Generate timetable endpoint called');
    
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const hoursPerDay = 6;

        // Create completely empty timetable - ONE SUBJECT PER SLOT
        let timetable = {};
        days.forEach(day => {
            timetable[day] = Array.from({ length: hoursPerDay }, () => null);
        });

        // Exact subject requirements
        const subjectRequirements = [
            { name: 'Languages', hours: 10, teachers: 2 },
            { name: 'Sciences', hours: 10, teachers: 2 },
            { name: 'Arts', hours: 5, teachers: 1 },
            { name: 'Sports', hours: 5, teachers: 1 }
        ];

        console.log('Subject requirements:', subjectRequirements);

        // Create all subject instances needed (exactly 30 total)
        let allSubjectInstances = [];
        subjectRequirements.forEach(subject => {
            for (let i = 0; i < subject.hours; i++) {
                allSubjectInstances.push(subject.name);
            }
        });

        console.log(`Total subject instances to assign: ${allSubjectInstances.length}`);

        // Fisher-Yates shuffle for randomness
        function shuffleArray(array) {
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
            return newArray;
        }

        // Shuffle subject instances for random distribution
        allSubjectInstances = shuffleArray(allSubjectInstances);

        // Create all possible slots
        let allSlots = [];
        days.forEach(day => {
            for (let hour = 0; hour < hoursPerDay; hour++) {
                allSlots.push({ day, hour });
            }
        });

        // Shuffle slots for random assignment
        allSlots = shuffleArray(allSlots);

        // Track assigned hours per subject
        const assignedHours = {
            Languages: 0,
            Sciences: 0,
            Arts: 0,
            Sports: 0
        };

        // Assign ONE subject per slot
        function assignSubjectsOnePerSlot() {
            let unassignedSubjects = [...allSubjectInstances];
            let attempts = 0;
            const maxAttempts = 1000;

            while (unassignedSubjects.length > 0 && attempts < maxAttempts) {
                attempts++;
                const subject = unassignedSubjects[0];
                
                // Try to find an empty slot
                let placed = false;
                for (const slot of shuffleArray([...allSlots])) {
                    const { day, hour } = slot;
                    
                    // Check if slot is empty and we haven't exceeded subject hours
                    if (timetable[day][hour] === null && 
                        assignedHours[subject] < subjectRequirements.find(s => s.name === subject).hours) {
                        
                        // Place the subject (ONE SUBJECT PER SLOT)
                        timetable[day][hour] = subject;
                        assignedHours[subject]++;
                        
                        // Remove from unassigned
                        unassignedSubjects.shift();
                        placed = true;
                        console.log(`Assigned ${subject} to ${day} slot ${hour}`);
                        break;
                    }
                }

                if (!placed) {
                    // If couldn't place, reshuffle and continue
                    unassignedSubjects = shuffleArray(unassignedSubjects);
                }
            }

            return unassignedSubjects.length === 0;
        }

        // Execute the assignment
        const success = assignSubjectsOnePerSlot();

        if (!success) {
            console.warn('Some subjects could not be placed with one-per-slot constraint');
            // Fallback: try to place remaining subjects in any empty slot
            for (const subject of allSubjectInstances) {
                for (const slot of allSlots) {
                    const { day, hour } = slot;
                    if (timetable[day][hour] === null) {
                        timetable[day][hour] = subject;
                        break;
                    }
                }
            }
        }

        console.log('Final assigned hours:', assignedHours);

        // Validate the generated timetable
        const validation = validateTimetable(timetable, jsonData.subjects);
        if (!validation.valid) {
            console.warn('Validation issues:', validation.errors);
        } else {
            console.log('Timetable validated successfully - all constraints met!');
        }

        // Update the data
        jsonData.timetable = timetable;

        // Write back to file
        fs.writeFile('data.json', JSON.stringify(jsonData, null, 4), async (err) => {
            if (err) {
                console.error('Error saving data file:', err);
                return res.status(500).send('Error saving data file');
            }
            
            console.log('Timetable saved to data.json');
            
            try {
                const timetableHtml = await ejs.renderFile('views/timetablePartial.ejs', { data: jsonData });
                res.json({ 
                    timetable: jsonData.timetable, 
                    timetableHtml: '<h2>Generated Timetable</h2>' + timetableHtml,
                    message: '✅ New timetable generated! Each session has one lesson. Constraints: 10h Languages/Sciences, 5h Arts/Sports'
                });
            } catch (renderError) {
                console.error('Error rendering timetable:', renderError);
                res.status(500).send('Error rendering timetable');
            }
        });
    });
});

// Enhanced validation function for flexible editing
function validateTimetable(timetable, subjects) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const result = { valid: true, errors: [], warnings: [] };
    
    // Track weekly hours per subject
    const weeklyHours = {};
    subjects.forEach(s => weeklyHours[s.name] = 0);

    // Track daily hours
    for (const day of days) {
        let dailyHours = 0;
        
        for (let hour = 0; hour < 6; hour++) {
            const subject = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            
            // Count if slot has a subject
            if (subject && subject !== null) {
                dailyHours++;
                weeklyHours[subject] = (weeklyHours[subject] || 0) + 1;
            }
        }

        // Check daily hour limit
        if (dailyHours > 6) {
            result.valid = false;
            result.errors.push(`${day} exceeds 6 teaching hours (has ${dailyHours})`);
        }
    }

    // NEW: More flexible validation for editing - allow under-assignment but not over-assignment
    for (const subject of subjects) {
        if (weeklyHours[subject.name] > subject.hours) {
            result.valid = false;
            result.errors.push(`${subject.name} exceeds weekly limit: ${weeklyHours[subject.name]} hours instead of ${subject.hours}`);
        } else if (weeklyHours[subject.name] < subject.hours) {
            result.warnings.push(`${subject.name} has ${weeklyHours[subject.name]}/${subject.hours} hours - you can add more ${subject.name} lessons`);
        }
    }

    return result;
}

// NEW: Function to get available subjects for editing
function getAvailableSubjects(timetable, subjects) {
    const weeklyHours = calculateWeeklyHours(timetable);
    const availableSubjects = [];
    
    subjects.forEach(subject => {
        const currentHours = weeklyHours[subject.name] || 0;
        const remainingHours = subject.hours - currentHours;
        
        if (remainingHours > 0) {
            availableSubjects.push({
                name: subject.name,
                currentHours: currentHours,
                maxHours: subject.hours,
                remainingHours: remainingHours,
                teachers: subject.teachers
            });
        }
    });
    
    return availableSubjects;
}

// Helper function to calculate current weekly hours
function calculateWeeklyHours(timetable) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weeklyHours = {};
    
    for (const day of days) {
        for (let hour = 0; hour < 6; hour++) {
            const subject = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            if (subject && subject !== null) {
                weeklyHours[subject] = (weeklyHours[subject] || 0) + 1;
            }
        }
    }
    
    return weeklyHours;
}

app.post('/save-timetable', (req, res) => {
    const newTimetable = req.body.timetable;
    console.log('Saving timetable:', newTimetable);

    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);
        const subjects = jsonData.subjects;

        // Validate the edited timetable - allow under-assignment
        const validation = validateTimetable(newTimetable, subjects);
        if (!validation.valid) {
            return res.status(400).send(validation.errors.join(', '));
        }

        jsonData.timetable = newTimetable;

        fs.writeFile('data.json', JSON.stringify(jsonData, null, 4), async (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error saving data file');
            }
            
            // Calculate available subjects for the response
            const availableSubjects = getAvailableSubjects(newTimetable, subjects);
            let availableMessage = '';
            if (availableSubjects.length > 0) {
                availableMessage = ' Available subjects: ' + availableSubjects.map(s => 
                    `${s.name} (${s.remainingHours}h left)`
                ).join(', ');
            }
            
            const timetableHtml = await ejs.renderFile('views/timetablePartial.ejs', { data: jsonData });
            res.json({ 
                timetable: jsonData.timetable, 
                timetableHtml: '<h2>Generated Timetable</h2>' + timetableHtml,
                message: '✅ Timetable saved successfully!' + availableMessage,
                availableSubjects: availableSubjects
            });
        });
    });
});

app.post('/delete-slot', (req, res) => {
    const { day, slot } = req.body;
    console.log('Deleting slot:', day, slot);

    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);

        // Ensure the structure exists before deleting
        if (jsonData.timetable && jsonData.timetable[day] && jsonData.timetable[day][slot] !== undefined) {
            const deletedSubject = jsonData.timetable[day][slot];
            jsonData.timetable[day][slot] = null;
            console.log(`Cleared slot ${slot} on ${day}, deleted: ${deletedSubject}`);
            
            // Calculate available subjects after deletion
            const availableSubjects = getAvailableSubjects(jsonData.timetable, jsonData.subjects);
            let availableMessage = '';
            if (availableSubjects.length > 0) {
                availableMessage = ' You can now add: ' + availableSubjects.map(s => 
                    `${s.name} (${s.remainingHours}h left)`
                ).join(', ');
            }
            
            fs.writeFile('data.json', JSON.stringify(jsonData, null, 4), async (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error saving data file');
                }
                const timetableHtml = await ejs.renderFile('views/timetablePartial.ejs', { data: jsonData });
                res.json({ 
                    timetable: jsonData.timetable, 
                    timetableHtml: '<h2>Generated Timetable</h2>' + timetableHtml,
                    message: '✅ Slot cleared successfully!' + availableMessage,
                    availableSubjects: availableSubjects
                });
            });
        } else {
            console.log(`Slot ${slot} on ${day} not found or already empty`);
            res.status(400).send('Slot not found or already empty');
        }
    });
});

// NEW: Endpoint to get available subjects for a timetable
app.post('/get-available-subjects', (req, res) => {
    const { timetable } = req.body;
    
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);
        const subjects = jsonData.subjects;
        
        const availableSubjects = getAvailableSubjects(timetable || jsonData.timetable, subjects);
        res.json({ availableSubjects });
    });
});

app.get('/get-timetable', (req, res) => {
    fs.readFile('data.json', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading data file');
            return;
        }
        const jsonData = JSON.parse(data);
        if (jsonData.timetable) {
            ejs.renderFile('views/timetablePartial.ejs', { data: jsonData }, (err, html) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error rendering timetable partial');
                    return;
                }
                res.json({ 
                    timetable: jsonData.timetable, 
                    timetableHtml: '<h2>Generated Timetable</h2>' + html 
                });
            });
        } else {
            res.json({ timetableHtml: null });
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);  // Updated log message (optional)
});