const express = require('express');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
const ejs = require('ejs');

// ============================================
// ADDED: Ensure data.json exists with default structure
// ============================================
const defaultData = {
  "subjects": [
    { "name": "Languages", "hours": 10, "teachers": 2, "category": "Languages", "teacherNames": ["Lang Teacher A", "Lang Teacher B"] },
    { "name": "Sciences", "hours": 10, "teachers": 2, "category": "Sciences", "teacherNames": ["Sci Teacher A", "Sci Teacher B"] },
    { "name": "Arts", "hours": 5, "teachers": 1, "category": "Arts", "teacherNames": ["Arts Teacher"] },
    { "name": "Sports", "hours": 5, "teachers": 1, "category": "Sports", "teacherNames": ["Sports Teacher"] }
  ],
  "timetable": null
};

// Check if data.json exists, create if not
if (!fs.existsSync('data.json')) {
  try {
    fs.writeFileSync('data.json', JSON.stringify(defaultData, null, 4));
    console.log('✅ Created default data.json file');
  } catch (err) {
    console.error('❌ Error creating data.json:', err);
  }
} else {
  console.log('✅ data.json already exists');
}
// ============================================

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

        // Create completely empty timetable with teacher assignment
        let timetable = {};
        let teacherSchedule = {}; // Track which teacher teaches when
        
        // Initialize teacher schedule tracking
        jsonData.subjects.forEach(subject => {
            subject.teacherNames?.forEach(teacher => {
                teacherSchedule[teacher] = {};
                days.forEach(day => {
                    teacherSchedule[teacher][day] = Array(hoursPerDay).fill(false);
                });
            });
        });

        days.forEach(day => {
            timetable[day] = Array.from({ length: hoursPerDay }, () => ({
                subject: null,
                teacher: null
            }));
        });

        // Subject requirements with teacher assignment
        const subjectRequirements = [
            { 
                name: 'Languages', 
                hours: 10, 
                teachers: 2,
                teacherNames: ['Lang Teacher A', 'Lang Teacher B']
            },
            { 
                name: 'Sciences', 
                hours: 10, 
                teachers: 2,
                teacherNames: ['Sci Teacher A', 'Sci Teacher B']
            },
            { 
                name: 'Arts', 
                hours: 5, 
                teachers: 1,
                teacherNames: ['Arts Teacher']
            },
            { 
                name: 'Sports', 
                hours: 5, 
                teachers: 1,
                teacherNames: ['Sports Teacher']
            }
        ];

        console.log('Subject requirements:', subjectRequirements);

        // Create all subject instances needed with teacher assignment
        let allSubjectInstances = [];
        subjectRequirements.forEach(subject => {
            const teachers = subject.teacherNames;
            const hoursPerTeacher = Math.ceil(subject.hours / subject.teachers);
            
            for (let i = 0; i < subject.hours; i++) {
                // Assign teacher based on round-robin distribution
                const teacherIndex = i % subject.teachers;
                allSubjectInstances.push({
                    subject: subject.name,
                    teacher: teachers[teacherIndex]
                });
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
            'Languages': { total: 0, teachers: {} },
            'Sciences': { total: 0, teachers: {} },
            'Arts': { total: 0, teachers: {} },
            'Sports': { total: 0, teachers: {} }
        };

        // Initialize teacher hours tracking
        subjectRequirements.forEach(subject => {
            subject.teacherNames.forEach(teacher => {
                assignedHours[subject.name].teachers[teacher] = 0;
            });
        });

        // Assign subjects with teacher consideration
        function assignSubjectsWithTeachers() {
            let unassignedInstances = [...allSubjectInstances];
            let attempts = 0;
            const maxAttempts = 10000;

            while (unassignedInstances.length > 0 && attempts < maxAttempts) {
                attempts++;
                const instance = unassignedInstances[0];
                
                // Try to find an empty slot
                let placed = false;
                for (const slot of shuffleArray([...allSlots])) {
                    const { day, hour } = slot;
                    
                    // Check if slot is empty
                    if (timetable[day][hour].subject === null) {
                        const subjectReq = subjectRequirements.find(s => s.name === instance.subject);
                        
                        // Check if teacher is available at this time
                        if (!teacherSchedule[instance.teacher][day][hour]) {
                            // Check if we haven't exceeded subject hours
                            if (assignedHours[instance.subject].total < subjectReq.hours) {
                                // Check if teacher hasn't exceeded their fair share
                                const maxHoursPerTeacher = Math.ceil(subjectReq.hours / subjectReq.teachers);
                                if (assignedHours[instance.subject].teachers[instance.teacher] < maxHoursPerTeacher) {
                                    
                                    // Place the subject with teacher
                                    timetable[day][hour].subject = instance.subject;
                                    timetable[day][hour].teacher = instance.teacher;
                                    
                                    // Update tracking
                                    assignedHours[instance.subject].total++;
                                    assignedHours[instance.subject].teachers[instance.teacher]++;
                                    teacherSchedule[instance.teacher][day][hour] = true;
                                    
                                    // Remove from unassigned
                                    unassignedInstances.shift();
                                    placed = true;
                                    console.log(`Assigned ${instance.subject} (${instance.teacher}) to ${day} slot ${hour}`);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!placed) {
                    // If couldn't place, reshuffle and continue
                    unassignedInstances = shuffleArray(unassignedInstances);
                }
            }

            return unassignedInstances.length === 0;
        }

        // Execute the assignment
        const success = assignSubjectsWithTeachers();

        if (!success) {
            console.warn('Some subjects could not be placed with teacher constraint');
            // Fallback: try to place remaining subjects without teacher conflict
            for (const instance of allSubjectInstances) {
                for (const slot of allSlots) {
                    const { day, hour } = slot;
                    if (timetable[day][hour].subject === null) {
                        // Check teacher availability
                        if (!teacherSchedule[instance.teacher][day][hour]) {
                            timetable[day][hour].subject = instance.subject;
                            timetable[day][hour].teacher = instance.teacher;
                            teacherSchedule[instance.teacher][day][hour] = true;
                            break;
                        }
                    }
                }
            }
        }

        console.log('Final assigned hours:', assignedHours);

        // Simplify timetable for frontend display (convert to string format)
        let simplifiedTimetable = {};
        days.forEach(day => {
            simplifiedTimetable[day] = timetable[day].map(slot => 
                slot.subject ? `${slot.subject} (${slot.teacher})` : null
            );
        });

        // Validate the generated timetable
        const validation = validateTimetable(simplifiedTimetable, jsonData.subjects);
        if (!validation.valid) {
            console.warn('Validation issues:', validation.errors);
        } else {
            console.log('Timetable validated successfully - all constraints met!');
        }

        // Update the data
        jsonData.timetable = simplifiedTimetable;

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
                    message: '✅ New timetable generated! Each session has one lesson with teacher assignments.'
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

    // Track teacher hours
    const teacherHours = {};
    subjects.forEach(subject => {
        subject.teacherNames?.forEach(teacher => {
            teacherHours[teacher] = 0;
        });
    });

    // Track daily hours
    for (const day of days) {
        let dailyHours = 0;
        
        for (let hour = 0; hour < 6; hour++) {
            const slotValue = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            
            // Count if slot has a subject
            if (slotValue && slotValue !== null) {
                dailyHours++;
                
                // Extract subject name (remove teacher in parentheses)
                const subjectMatch = slotValue.match(/^([^(]+)/);
                if (subjectMatch) {
                    const subjectName = subjectMatch[0].trim();
                    weeklyHours[subjectName] = (weeklyHours[subjectName] || 0) + 1;
                }
                
                // Extract teacher name
                const teacherMatch = slotValue.match(/\(([^)]+)\)/);
                if (teacherMatch) {
                    const teacherName = teacherMatch[1].trim();
                    teacherHours[teacherName] = (teacherHours[teacherName] || 0) + 1;
                }
            }
        }

        // Check daily hour limit
        if (dailyHours > 6) {
            result.valid = false;
            result.errors.push(`${day} exceeds 6 teaching hours (has ${dailyHours})`);
        }
    }

    // Check subject hour limits
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
            // For each teacher in the subject
            subject.teacherNames?.forEach(teacher => {
                availableSubjects.push({
                    name: subject.name,
                    teacher: teacher,
                    currentHours: currentHours,
                    maxHours: subject.hours,
                    remainingHours: remainingHours,
                    teachers: subject.teachers
                });
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
            const slotValue = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            if (slotValue && slotValue !== null) {
                // Extract subject name (remove teacher in parentheses)
                const subjectMatch = slotValue.match(/^([^(]+)/);
                if (subjectMatch) {
                    const subjectName = subjectMatch[0].trim();
                    weeklyHours[subjectName] = (weeklyHours[subjectName] || 0) + 1;
                }
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
                availableMessage = ' Available: ' + availableSubjects.map(s => 
                    `${s.name} (${s.teacher})`
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
                    `${s.name} (${s.teacher})`
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
    console.log(`Server is running on port ${port}`);
});