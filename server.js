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
  "timetable": null,
  "deletedLessons": [] // Track deleted lessons
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
        const totalSlots = days.length * hoursPerDay; // 30 slots total

        // Create empty timetable
        let timetable = {};
        days.forEach(day => {
            timetable[day] = Array(hoursPerDay).fill(null);
        });

        // Subject requirements with CORRECT hour distribution
        const subjectRequirements = [
            { 
                name: 'Languages', 
                totalHours: 10,  // 10 hours total for Languages
                teachers: 2,
                teacherNames: ['Languages A', 'Languages B'],
                hoursPerTeacher: 5  // 5 hours each for A and B
            },
            { 
                name: 'Sciences', 
                totalHours: 10,  // 10 hours total for Sciences
                teachers: 2,
                teacherNames: ['Sciences A', 'Sciences B'],
                hoursPerTeacher: 5  // 5 hours each for A and B
            },
            { 
                name: 'Arts', 
                totalHours: 5,   // 5 hours total for Arts
                teachers: 1,
                teacherNames: ['Arts Teacher'],
                hoursPerTeacher: 5  // 5 hours for Arts Teacher
            },
            { 
                name: 'Sports', 
                totalHours: 5,   // 5 hours total for Sports
                teachers: 1,
                teacherNames: ['Sports Teacher'],
                hoursPerTeacher: 5  // 5 hours for Sports Teacher
            }
        ];

        console.log('Subject requirements with correct hours:', subjectRequirements);

        // Create teacher assignments with correct hours
        let teacherAssignments = [];
        subjectRequirements.forEach(subject => {
            subject.teacherNames.forEach(teacher => {
                for (let i = 0; i < subject.hoursPerTeacher; i++) {
                    teacherAssignments.push(teacher);
                }
            });
        });

        console.log(`Total teacher assignments: ${teacherAssignments.length} (should be 30)`);
        console.log('Teacher assignments breakdown:');
        const assignmentCount = {};
        teacherAssignments.forEach(teacher => {
            assignmentCount[teacher] = (assignmentCount[teacher] || 0) + 1;
        });
        console.log(assignmentCount);

        // Fisher-Yates shuffle for randomness
        function shuffleArray(array) {
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
            return newArray;
        }

        // Shuffle teacher assignments
        teacherAssignments = shuffleArray(teacherAssignments);

        // Create all slots
        let allSlots = [];
        days.forEach(day => {
            for (let hour = 0; hour < hoursPerDay; hour++) {
                allSlots.push({ day, hour });
            }
        });

        // Shuffle slots
        allSlots = shuffleArray(allSlots);

        // Assign teachers to slots
        teacherAssignments.forEach((teacher, index) => {
            if (index < allSlots.length) {
                const { day, hour } = allSlots[index];
                timetable[day][hour] = teacher;
            }
        });

        // Count assigned hours for verification
        const assignedHours = {};
        days.forEach(day => {
            timetable[day].forEach(teacher => {
                if (teacher) {
                    assignedHours[teacher] = (assignedHours[teacher] || 0) + 1;
                }
            });
        });

        console.log('Final assigned hours (should be 5 each for Languages/Sciences, 5 each for Arts/Sports):');
        console.log(assignedHours);

        // Update data
        jsonData.timetable = timetable;
        jsonData.deletedLessons = []; // Clear deleted lessons when generating new timetable

        // Save to file
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
                    deletedLessons: jsonData.deletedLessons,
                    message: '✅ New timetable generated! Constraints: 10h Languages (5h each A/B), 10h Sciences (5h each A/B), 5h Arts, 5h Sports'
                });
            } catch (renderError) {
                console.error('Error rendering timetable:', renderError);
                res.status(500).send('Error rendering timetable');
            }
        });
    });
});

// Enhanced validation function for CORRECT constraints
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

    // Track total hours per subject category
    const categoryHours = {};
    subjects.forEach(subject => {
        categoryHours[subject.name] = 0;
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
                
                // Find which subject this teacher belongs to and count category hours
                subjects.forEach(subject => {
                    if (subject.teacherNames?.includes(teacher)) {
                        categoryHours[subject.name] = (categoryHours[subject.name] || 0) + 1;
                    }
                });
            }
        }

        // Check daily hour limit (6 hours per day)
        if (dailyHours > 6) {
            result.valid = false;
            result.errors.push(`${day} exceeds 6 teaching hours (has ${dailyHours})`);
        }
    }

    // Check CORRECT teacher hour limits
    subjects.forEach(subject => {
        if (subject.name === 'Languages' || subject.name === 'Sciences') {
            // Languages and Sciences: 10 hours total, 5 hours per teacher
            if (categoryHours[subject.name] > 10) {
                result.valid = false;
                result.errors.push(`${subject.name} exceeds 10 hours total (has ${categoryHours[subject.name]})`);
            } else if (categoryHours[subject.name] < 10) {
                result.warnings.push(`${subject.name} has ${categoryHours[subject.name]}/10 hours - can add more`);
            }
            
            // Check individual teachers (should be 5 hours each)
            subject.teacherNames?.forEach(teacher => {
                const hours = teacherHours[teacher] || 0;
                if (hours > 5) {
                    result.valid = false;
                    result.errors.push(`${teacher} exceeds 5 hours (has ${hours})`);
                } else if (hours < 5) {
                    result.warnings.push(`${teacher} has ${hours}/5 hours`);
                }
            });
        } else if (subject.name === 'Arts' || subject.name === 'Sports') {
            // Arts and Sports: 5 hours total, 5 hours for the single teacher
            if (categoryHours[subject.name] > 5) {
                result.valid = false;
                result.errors.push(`${subject.name} exceeds 5 hours total (has ${categoryHours[subject.name]})`);
            } else if (categoryHours[subject.name] < 5) {
                result.warnings.push(`${subject.name} has ${categoryHours[subject.name]}/5 hours - can add more`);
            }
            
            // Check the single teacher
            const teacher = subject.teacherNames[0];
            const hours = teacherHours[teacher] || 0;
            if (hours > 5) {
                result.valid = false;
                result.errors.push(`${teacher} exceeds 5 hours (has ${hours})`);
            } else if (hours < 5) {
                result.warnings.push(`${teacher} has ${hours}/5 hours`);
            }
        }
    });

    return result;
}

// Function to get available teachers INCLUDING deleted ones
function getAvailableTeachers(timetable, subjects, deletedLessons = []) {
    const teacherHours = calculateTeacherHours(timetable);
    const categoryHours = calculateCategoryHours(timetable, subjects);
    const availableTeachers = [];
    
    subjects.forEach(subject => {
        subject.teacherNames?.forEach(teacher => {
            const currentHours = teacherHours[teacher] || 0;
            let maxHoursPerTeacher = 0;
            let maxCategoryHours = 0;
            
            // Set correct limits based on subject
            if (subject.name === 'Languages' || subject.name === 'Sciences') {
                maxHoursPerTeacher = 5; // Each teacher gets max 5 hours
                maxCategoryHours = 10;  // Subject total is 10 hours
            } else {
                maxHoursPerTeacher = 5; // Arts/Sports teacher gets 5 hours
                maxCategoryHours = 5;   // Subject total is 5 hours
            }
            
            const currentCategoryHours = categoryHours[subject.name] || 0;
            const remainingCategoryHours = maxCategoryHours - currentCategoryHours;
            const remainingTeacherHours = maxHoursPerTeacher - currentHours;
            
            // Teacher can be added if:
            // 1. Teacher hasn't reached their individual limit (5 hours)
            // 2. Subject category hasn't reached its total limit (10 or 5 hours)
            if (remainingTeacherHours > 0 && remainingCategoryHours > 0) {
                // Check if this teacher is in deleted lessons
                const isDeleted = deletedLessons.some(lesson => lesson.teacher === teacher);
                if (!isDeleted) {
                    availableTeachers.push({
                        name: teacher,
                        currentHours: currentHours,
                        maxHours: maxHoursPerTeacher,
                        remainingHours: Math.min(remainingTeacherHours, remainingCategoryHours),
                        subject: subject.name,
                        type: 'available',
                        categoryRemaining: remainingCategoryHours
                    });
                }
            }
        });
    });
    
    return availableTeachers;
}

// FIXED: Function to get deleted teachers specifically for edit modal - ALWAYS show deleted teachers
function getDeletedTeachersForEdit(timetable, subjects, deletedLessons = []) {
    console.log('getDeletedTeachersForEdit called with:', {
        timetableKeys: Object.keys(timetable || {}),
        deletedLessonsCount: deletedLessons.length,
        deletedLessons: deletedLessons
    });
    
    const teacherHours = calculateTeacherHours(timetable || {});
    const categoryHours = calculateCategoryHours(timetable || {}, subjects);
    const deletedTeachersList = [];
    
    // Get ALL teachers that have been deleted (even if they appear multiple times)
    const allDeletedTeachers = deletedLessons
        .filter(lesson => lesson.teacher && lesson.teacher.trim() !== '')
        .map(lesson => lesson.teacher);
    
    console.log('All deleted teachers found:', allDeletedTeachers);
    
    // Create a Set to get unique teachers
    const uniqueDeletedTeachers = [...new Set(allDeletedTeachers)];
    console.log('Unique deleted teachers:', uniqueDeletedTeachers);
    
    uniqueDeletedTeachers.forEach(teacher => {
        if (teacher) {
            // Find which subject this teacher belongs to
            let teacherSubject = null;
            subjects.forEach(subject => {
                if (subject.teacherNames?.includes(teacher)) {
                    teacherSubject = subject;
                }
            });
            
            if (teacherSubject) {
                const currentHours = teacherHours[teacher] || 0;
                let maxHoursPerTeacher = 0;
                let maxCategoryHours = 0;
                
                if (teacherSubject.name === 'Languages' || teacherSubject.name === 'Sciences') {
                    maxHoursPerTeacher = 5;
                    maxCategoryHours = 10;
                } else {
                    maxHoursPerTeacher = 5;
                    maxCategoryHours = 5;
                }
                
                const currentCategoryHours = categoryHours[teacherSubject.name] || 0;
                const remainingCategoryHours = maxCategoryHours - currentCategoryHours;
                const remainingTeacherHours = maxHoursPerTeacher - currentHours;
                
                console.log(`Checking ${teacher}: currentHours=${currentHours}, max=${maxHoursPerTeacher}, remaining=${remainingTeacherHours}, categoryRemaining=${remainingCategoryHours}`);
                
                // ALWAYS add deleted teacher to the list, even if at max hours
                // This allows user to see and potentially re-add deleted teachers
                deletedTeachersList.push({
                    name: teacher,
                    currentHours: currentHours,
                    maxHours: maxHoursPerTeacher,
                    remainingHours: Math.min(remainingTeacherHours, remainingCategoryHours),
                    subject: teacherSubject.name,
                    type: 'deleted',
                    categoryRemaining: remainingCategoryHours,
                    recentlyDeleted: true,
                    canBeAdded: remainingTeacherHours > 0 && remainingCategoryHours > 0
                });
            } else {
                console.log(`Could not find subject for teacher: ${teacher}`);
            }
        }
    });
    
    console.log('Deleted teachers list to return:', deletedTeachersList.map(t => ({
        name: t.name,
        currentHours: t.currentHours,
        maxHours: t.maxHours,
        canBeAdded: t.canBeAdded
    })));
    return deletedTeachersList;
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

// Helper function to calculate category hours
function calculateCategoryHours(timetable, subjects) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const categoryHours = {};
    
    // Initialize
    subjects.forEach(subject => {
        categoryHours[subject.name] = 0;
    });
    
    for (const day of days) {
        for (let hour = 0; hour < 6; hour++) {
            const teacher = timetable[day] && timetable[day][hour] ? timetable[day][hour] : null;
            if (teacher && teacher !== null) {
                // Find which subject this teacher belongs to
                subjects.forEach(subject => {
                    if (subject.teacherNames?.includes(teacher)) {
                        categoryHours[subject.name] = (categoryHours[subject.name] || 0) + 1;
                    }
                });
            }
        }
    }
    
    return categoryHours;
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

        // Validate the edited timetable with CORRECT constraints
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
            const availableTeachers = getAvailableTeachers(newTimetable, subjects, jsonData.deletedLessons || []);
            const deletedTeachers = getDeletedTeachersForEdit(newTimetable, subjects, jsonData.deletedLessons || []);
            
            let availableMessage = '';
            if (availableTeachers.length > 0 || deletedTeachers.length > 0) {
                if (availableTeachers.length > 0) {
                    availableMessage = ' Available: ' + availableTeachers.map(t => 
                        `${t.name} (${t.remainingHours}h left)`
                    ).join(', ');
                }
                
                if (deletedTeachers.length > 0) {
                    availableMessage += (availableMessage ? ' | ' : '') + 'Recently deleted available: ' + 
                        deletedTeachers.map(t => `${t.name}`).join(', ');
                }
            }
            
            const timetableHtml = await ejs.renderFile('views/timetablePartial.ejs', { data: jsonData });
            res.json({ 
                timetable: jsonData.timetable, 
                timetableHtml: '<h2>Generated Timetable</h2>' + timetableHtml,
                deletedLessons: jsonData.deletedLessons || [],
                message: '✅ Timetable saved successfully!' + (availableMessage ? ' ' + availableMessage : ''),
                availableTeachers: availableTeachers,
                deletedTeachers: deletedTeachers
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
            
            // ALWAYS add to deleted lessons history when a teacher is deleted
            if (deletedTeacher && deletedTeacher !== null) {
                const deletedLesson = {
                    teacher: deletedTeacher,
                    day: day,
                    slot: slot,
                    timestamp: new Date().toISOString()
                };
                
                // Initialize deletedLessons array if it doesn't exist
                if (!jsonData.deletedLessons) {
                    jsonData.deletedLessons = [];
                }
                
                // Remove any existing entries for this teacher (we want most recent only)
                jsonData.deletedLessons = jsonData.deletedLessons.filter(lesson => 
                    lesson.teacher !== deletedTeacher
                );
                
                // Add to beginning of array (most recent first)
                jsonData.deletedLessons.unshift(deletedLesson);
                
                // Keep only last 10 unique deleted teachers
                const uniqueTeachers = [];
                const filteredLessons = [];
                for (const lesson of jsonData.deletedLessons) {
                    if (!uniqueTeachers.includes(lesson.teacher) && uniqueTeachers.length < 10) {
                        uniqueTeachers.push(lesson.teacher);
                        filteredLessons.push(lesson);
                    }
                }
                jsonData.deletedLessons = filteredLessons;
            }
            
            jsonData.timetable[day][slot] = null;
            console.log(`Cleared slot ${slot} on ${day}, deleted: ${deletedTeacher}`);
            console.log('Current deleted lessons:', jsonData.deletedLessons);
            
            // Calculate available teachers and deleted teachers
            const availableTeachers = getAvailableTeachers(jsonData.timetable, jsonData.subjects, jsonData.deletedLessons || []);
            const deletedTeachers = getDeletedTeachersForEdit(jsonData.timetable, jsonData.subjects, jsonData.deletedLessons || []);
            
            let availableMessage = '';
            if (availableTeachers.length > 0 || deletedTeachers.length > 0) {
                if (availableTeachers.length > 0) {
                    availableMessage = ' You can now add: ' + availableTeachers.map(t => 
                        `${t.name} (${t.remainingHours}h left)`
                    ).join(', ');
                }
                
                if (deletedTeachers.length > 0) {
                    availableMessage += (availableMessage ? ' | ' : '') + 'Recently deleted available: ' + 
                        deletedTeachers.map(t => `${t.name}`).join(', ');
                }
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
                    deletedLessons: jsonData.deletedLessons || [],
                    message: '✅ Slot cleared successfully! Deleted teacher is now available in edit dropdown.' + availableMessage,
                    availableTeachers: availableTeachers,
                    deletedTeachers: deletedTeachers
                });
            });
        } else {
            console.log(`Slot ${slot} on ${day} not found or already empty`);
            res.status(400).send('Slot not found or already empty');
        }
    });
});

// Endpoint to get available teachers AND deleted teachers for edit modal
app.post('/get-available-teachers', (req, res) => {
    const { timetable } = req.body;
    
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);
        const subjects = jsonData.subjects;
        
        const currentTimetable = timetable || jsonData.timetable;
        const deletedLessons = jsonData.deletedLessons || [];
        
        const availableTeachers = getAvailableTeachers(currentTimetable, subjects, deletedLessons);
        const deletedTeachers = getDeletedTeachersForEdit(currentTimetable, subjects, deletedLessons);
        
        console.log('Sending response - deletedTeachers:', deletedTeachers);
        
        res.json({ 
            availableTeachers: availableTeachers,
            deletedTeachers: deletedTeachers,
            allTeachers: [...availableTeachers, ...deletedTeachers]
        });
    });
});

// Endpoint to get deleted lessons
app.get('/get-deleted-lessons', (req, res) => {
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading data file');
        }

        const jsonData = JSON.parse(data);
        res.json({ deletedLessons: jsonData.deletedLessons || [] });
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
                    timetableHtml: '<h2>Generated Timetable</h2>' + html,
                    deletedLessons: jsonData.deletedLessons || []
                });
            });
        } else {
            res.json({ timetableHtml: null, deletedLessons: [] });
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});