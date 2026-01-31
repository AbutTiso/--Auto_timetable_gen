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
    { "name": "Languages", "hours": 10, "teachers": 2, "category": "Languages", "teacherNames": ["Languages A", "Languages B"] },
    { "name": "Sciences", "hours": 10, "teachers": 2, "category": "Sciences", "teacherNames": ["Sciences A", "Sciences B"] },
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

        // Subject requirements with A/B teacher naming
        const subjectRequirements = [
            { 
                name: 'Languages', 
                hours: 10, 
                teachers: 2,
                teacherNames: ['Languages A', 'Languages B']
            },
            { 
                name: 'Sciences', 
                hours: 10, 
                teachers: 2,
                teacherNames: ['Sciences A', 'Sciences B']
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
            
            // Distribute hours fairly between teachers
            const hoursPerTeacher = Math.ceil(subject.hours / subject.teachers);
            
            for (let teacherIndex = 0; teacherIndex < subject.teachers; teacherIndex++) {
                const teacher = teachers[teacherIndex];
                // Calculate hours for this teacher (last teacher might get fewer hours)
                const hoursForThisTeacher = (teacherIndex === subject.teachers - 1) 
                    ? subject.hours - (hoursPerTeacher * (subject.teachers - 1))
                    : hoursPerTeacher;
                
                for (let i = 0; i < hoursForThisTeacher; i++) {
                    allSubjectInstances.push({
                        subject: subject.name,
                        teacher: teacher // This will be "Languages A", "Sciences B", etc.
                    });
                }
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

        // Track assigned hours per teacher
        const assignedHours = {
            'Languages A': 0,
            'Languages B': 0,
            'Sciences A': 0,
            'Sciences B': 0,
            'Arts Teacher': 0,
            'Sports Teacher': 0
        };

        // Track total hours per subject category
        const subjectCategoryHours = {
            'Languages': 0,
            'Sciences': 0,
            'Arts': 0,
            'Sports': 0
        };

        // Assign subjects with teacher consideration
        function assignSubjectsWithTeachers() {
            let unassignedInstances = [...allSubjectInstances];
            let attempts = 0;
            const maxAttempts = 10000;

            while (unassignedInstances.length > 0 && attempts < maxAttempts) {
                attempts++;
                const instance = unassignedInstances[0];
                const subjectCategory = instance.teacher.includes('Languages') ? 'Languages' : 
                                      instance.teacher.includes('Sciences') ? 'Sciences' :
                                      instance.teacher.includes('Arts') ? 'Arts' : 'Sports';
                
                // Try to find an empty slot
                let placed = false;
                for (const slot of shuffleArray([...allSlots])) {
                    const { day, hour } = slot;
                    
                    // Check if slot is empty
                    if (timetable[day][hour].subject === null) {
                        // Check if teacher is available at this time
                        if (!teacherSchedule[instance.teacher][day][hour]) {
                            // Check subject category limit (10h for Languages/Sciences, 5h for Arts/Sports)
                            const maxCategoryHours = subjectCategory === 'Languages' || subjectCategory === 'Sciences' ? 10 : 5;
                            
                            if (subjectCategoryHours[subjectCategory] < maxCategoryHours) {
                                // Check individual teacher limit (max 5-6 hours each for Languages/Sciences teachers)
                                const maxTeacherHours = subjectCategory === 'Languages' || subjectCategory === 'Sciences' ? 6 : 5;
                                
                                if (assignedHours[instance.teacher] < maxTeacherHours) {
                                    
                                    // Place the subject with teacher
                                    timetable[day][hour].subject = instance.subject;
                                    timetable[day][hour].teacher = instance.teacher;
                                    
                                    // Update tracking
                                    assignedHours[instance.teacher]++;
                                    subjectCategoryHours[subjectCategory]++;
                                    teacherSchedule[instance.teacher][day][hour] = true;
                                    
                                    // Remove from unassigned
                                    unassignedInstances.shift();
                                    placed = true;
                                    console.log(`Assigned ${instance.teacher} to ${day} slot ${hour}`);
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
        console.log('Subject category hours:', subjectCategoryHours);

        // Create display format: Use teacher name directly (e.g., "Languages A", "Sciences B")
        let displayTimetable = {};
        days.forEach(day => {
            displayTimetable[day] = timetable[day].map(slot => 
                slot.teacher || null
            );
        });

        // Validate the generated timetable
        const validation = validateTimetable(displayTimetable, jsonData.subjects);
        if (!validation.valid) {
            console.warn('Validation issues:', validation.errors);
        } else {
            console.log('Timetable validated successfully - all constraints met!');
        }

        // Update the data
        jsonData.timetable = displayTimetable;

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
                    message: '✅ New timetable generated! Showing teacher assignments (A/B).'
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
    
    // Track weekly hours per teacher
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
            const teacher = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            
            // Count if slot has a teacher
            if (teacher && teacher !== null) {
                dailyHours++;
                teacherHours[teacher] = (teacherHours[teacher] || 0) + 1;
            }
        }

        // Check daily hour limit
        if (dailyHours > 6) {
            result.valid = false;
            result.errors.push(`${day} exceeds 6 teaching hours (has ${dailyHours})`);
        }
    }

    // Check teacher hour limits based on their subject
    for (const teacher in teacherHours) {
        let maxHours = 0;
        
        if (teacher.includes('Languages') || teacher.includes('Sciences')) {
            maxHours = 6; // Each Languages/Sciences teacher gets max 6 hours
        } else {
            maxHours = 5; // Arts/Sports teachers get 5 hours
        }
        
        if (teacherHours[teacher] > maxHours) {
            result.valid = false;
            result.errors.push(`${teacher} exceeds limit: ${teacherHours[teacher]} hours instead of ${maxHours}`);
        } else if (teacherHours[teacher] < maxHours) {
            result.warnings.push(`${teacher} has ${teacherHours[teacher]}/${maxHours} hours`);
        }
    }

    return result;
}

// NEW: Function to get available teachers for editing
function getAvailableTeachers(timetable, subjects) {
    const teacherHours = calculateTeacherHours(timetable);
    const availableTeachers = [];
    
    subjects.forEach(subject => {
        subject.teacherNames?.forEach(teacher => {
            const currentHours = teacherHours[teacher] || 0;
            let maxHours = 0;
            
            // Determine max hours based on teacher type
            if (teacher.includes('Languages') || teacher.includes('Sciences')) {
                maxHours = 6; // Each gets max 6 hours
            } else {
                maxHours = 5; // Arts/Sports get 5 hours
            }
            
            const remainingHours = maxHours - currentHours;
            
            if (remainingHours > 0) {
                availableTeachers.push({
                    name: teacher,
                    currentHours: currentHours,
                    maxHours: maxHours,
                    remainingHours: remainingHours,
                    subject: subject.name
                });
            }
        });
    });
    
    return availableTeachers;
}

// Helper function to calculate current teacher hours
function calculateTeacherHours(timetable) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const teacherHours = {};
    
    for (const day of days) {
        for (let hour = 0; hour < 6; hour++) {
            const teacher = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            if (teacher && teacher !== null) {
                teacherHours[teacher] = (teacherHours[teacher] || 0) + 1;
            }
        }
    }
    
    return teacherHours;
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
            
            // Calculate available teachers for the response
            const availableTeachers = getAvailableTeachers(newTimetable, subjects);
            let availableMessage = '';
            if (availableTeachers.length > 0) {
                availableMessage = ' Available: ' + availableTeachers.map(t => 
                    `${t.name} (${t.remainingHours}h left)`
                ).join(', ');
            }
            
            const timetableHtml = await ejs.renderFile('views/timetablePartial.ejs', { data: jsonData });
            res.json({ 
                timetable: jsonData.timetable, 
                timetableHtml: '<h2>Generated Timetable</h2>' + timetableHtml,
                message: '✅ Timetable saved successfully!' + availableMessage,
                availableTeachers: availableTeachers
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
            const deletedTeacher = jsonData.timetable[day][slot];
            jsonData.timetable[day][slot] = null;
            console.log(`Cleared slot ${slot} on ${day}, deleted: ${deletedTeacher}`);
            
            // Calculate available teachers after deletion
            const availableTeachers = getAvailableTeachers(jsonData.timetable, jsonData.subjects);
            let availableMessage = '';
            if (availableTeachers.length > 0) {
                availableMessage = ' You can now add: ' + availableTeachers.map(t => 
                    `${t.name} (${t.remainingHours}h left)`
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
                    availableTeachers: availableTeachers
                });
            });
        } else {
            console.log(`Slot ${slot} on ${day} not found or already empty`);
            res.status(400).send('Slot not found or already empty');
        }
    });
});

// NEW: Endpoint to get available teachers for a timetable
app.post('/get-available-teachers', (req, res) => {
    const { timetable } = req.body;
    
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);
        const subjects = jsonData.subjects;
        
        const availableTeachers = getAvailableTeachers(timetable || jsonData.timetable, subjects);
        res.json({ availableTeachers });
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