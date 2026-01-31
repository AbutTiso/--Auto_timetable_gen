document.addEventListener('DOMContentLoaded', () => {
    const homeLink = document.getElementById('home-link');
    const timetableLink = document.getElementById('timetable-link');
    const homeSection = document.getElementById('home-section');
    const timetableSection = document.getElementById('timetable-section');

    let currentTimetable = {};
    let subjectsData = [];
    let availableTeachers = []; // Changed from availableSubjects

    // Initialize the app
    function initApp() {
        fetch('data.json')
            .then(response => response.json())
            .then(data => {
                subjectsData = data.subjects;
                if (data.timetable) {
                    currentTimetable = data.timetable;
                }
                // Load available teachers on startup
                updateAvailableTeachers(); // Changed function name
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                showMessage('⚠️ No timetable yet! Click "Generate Timetable" to create your first schedule.', 'info');
            });
    }

    initApp();

    // Enhanced message display function
    function showMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.alert-message');
        existingMessages.forEach(msg => msg.remove());

        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'error' ? 'alert-danger' : 'alert-info';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-message ${alertClass} alert-dismissible fade show mt-3`;
        messageDiv.style.cssText = 'border-left: 4px solid; z-index: 1000;';
        if (type === 'success') messageDiv.style.borderLeftColor = '#28a745';
        if (type === 'error') messageDiv.style.borderLeftColor = '#dc3545';
        if (type === 'info') messageDiv.style.borderLeftColor = '#17a2b8';
        
        messageDiv.innerHTML = `
            <strong>${message}</strong>
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;
        
        const timetableContainer = document.getElementById('timetable-container');
        if (timetableContainer) {
            timetableContainer.parentNode.insertBefore(messageDiv, timetableContainer);
            
            // Auto-dismiss after 7 seconds for success messages
            if (type === 'success') {
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 7000);
            }
        }
    }

    // UPDATED: Function to update available teachers display
    function updateAvailableTeachers() {
        fetch('/get-available-teachers', { // Changed endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timetable: currentTimetable })
        })
        .then(response => response.json())
        .then(data => {
            availableTeachers = data.availableTeachers || [];
            updateEditModalOptions();
        })
        .catch(error => {
            console.error('Error fetching available teachers:', error);
        });
    }

    // UPDATED: Function to update edit modal with available teachers
    function updateEditModalOptions() {
        const subjectSelect = document.getElementById('subject-select');
        if (!subjectSelect) return;

        // Clear existing options except the first one
        while (subjectSelect.options.length > 1) {
            subjectSelect.remove(1);
        }

        // Add available teachers with remaining hours information
        availableTeachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.name; // e.g., "Languages A"
            option.textContent = `${teacher.name} (${teacher.currentHours}/${teacher.maxHours} hours - ${teacher.remainingHours}h left)`;
            option.disabled = teacher.remainingHours <= 0;
            subjectSelect.appendChild(option);
        });

        // Also add all teachers but mark unavailable ones as disabled
        subjectsData.forEach(subject => {
            subject.teacherNames?.forEach(teacherName => {
                const isAvailable = availableTeachers.some(t => t.name === teacherName);
                if (!isAvailable) {
                    const maxHours = teacherName.includes('Languages') || teacherName.includes('Sciences') ? 6 : 5;
                    const option = document.createElement('option');
                    option.value = teacherName;
                    option.textContent = `${teacherName} (MAXED OUT - ${maxHours}/${maxHours} hours)`;
                    option.disabled = true;
                    subjectSelect.appendChild(option);
                }
            });
        });
    }

    // Navigation handlers
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        homeSection.style.display = 'block';
        timetableSection.style.display = 'none';
    });

    timetableLink.addEventListener('click', (e) => {
        e.preventDefault();
        showTimetableSection();
    });

    function showTimetableSection() {
        fetch('/get-timetable')
            .then(response => response.json())
            .then(data => {
                console.log('Timetable data received:', data);
                const timetableContainer = document.getElementById('timetable-container');
                if (data.timetableHtml) {
                    timetableContainer.innerHTML = data.timetableHtml;
                    currentTimetable = data.timetable;
                } else {
                    timetableContainer.innerHTML = `
                        <div class="alert alert-info" style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #2196F3;">
                            <h3 style="margin-top: 0; color: #1565C0;">🚀 Ready to Create Your Timetable!</h3>
                            <p style="font-size: 16px; margin: 10px 0;">
                                No timetable has been generated yet. Click the button below to create your first schedule!
                            </p>
                            <button onclick="generateTimetable()" style="background-color: #2196F3; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 6px; cursor: pointer; margin-top: 10px;">
                                🎯 Generate Timetable
                            </button>
                            <p style="font-size: 14px; color: #666; margin-top: 15px;">
                                <strong>Requirements:</strong> Languages A/B (6h each), Sciences A/B (6h each), Arts Teacher (5h), Sports Teacher (5h)
                            </p>
                        </div>
                    `;
                }

                homeSection.style.display = 'none';
                timetableSection.style.display = 'block';
                
                // Update available teachers when showing timetable
                updateAvailableTeachers();
                
                // Show success message if any
                if (data.message) {
                    showMessage(data.message, 'success');
                }
            })
            .catch(error => {
                console.error('Error loading timetable:', error);
                showMessage('⚠️ No timetable yet! Click "Generate Timetable" to create your first schedule.', 'info');
            });
    }

    let currentCell;

    // Edit modal handler - UPDATED with teacher names
    $('#editModal').on('show.bs.modal', function (event) {
        const button = $(event.relatedTarget);
        currentCell = button.closest('td');
        const teacherText = currentCell.find('.subjects').text().trim();
        const modal = $(this);
        
        // Clear previous error messages
        modal.find('#modal-error-message').hide();
        
        // Update available teachers before showing modal
        updateAvailableTeachers();
        
        // Extract teacher name from cell
        let currentTeacher = '';
        if (teacherText !== '-' && teacherText !== '') {
            // Extract from badge text
            currentTeacher = teacherText.replace(/<\/?[^>]+(>|$)/g, "").trim();
        }
        
        // Find which subject this teacher belongs to
        let subjectCategory = '';
        subjectsData.forEach(subject => {
            if (subject.teacherNames?.includes(currentTeacher)) {
                subjectCategory = subject.category;
            }
        });
        
        const teacherWithCategory = currentTeacher ? 
            `${currentTeacher} (${subjectCategory})` : 'Empty';

        modal.find('#current-subjects-with-category').text(teacherWithCategory);
        
        // Set the current value after a small delay to ensure options are populated
        setTimeout(() => {
            modal.find('#subject-select').val(currentTeacher);
        }, 100);
    });

    // Save changes handler - UPDATED for teachers
    document.getElementById('save-changes').addEventListener('click', () => {
        const selectedTeacher = $('#subject-select').val() || '';
        
        if (!currentCell) {
            showMessage('❌ No cell selected for editing', 'error');
            return;
        }

        const day = currentCell.data('day');
        const slot = currentCell.closest('tr').data('slot');

        console.log('Saving changes for:', day, slot, selectedTeacher);

        // Check if selected teacher is available
        if (selectedTeacher && selectedTeacher !== '') {
            const isAvailable = availableTeachers.some(t => t.name === selectedTeacher);
            if (!isAvailable) {
                showMessage(`❌ Cannot add ${selectedTeacher} - weekly hour limit reached!`, 'error');
                return;
            }
        }

        // Create a deep copy to avoid reference issues
        const updatedTimetable = JSON.parse(JSON.stringify(currentTimetable));
        
        // Ensure the structure exists
        if (!updatedTimetable[day]) {
            updatedTimetable[day] = [];
        }
        if (updatedTimetable[day][slot] === undefined) {
            updatedTimetable[day][slot] = null;
        }
        
        // Store teacher name (e.g., "Languages A")
        updatedTimetable[day][slot] = selectedTeacher || null;

        const saveButton = document.getElementById('save-changes');
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveButton.disabled = true;

        fetch('/save-timetable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timetable: updatedTimetable })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return response.text().then(text => { throw new Error(text) });
            }
        })
        .then(data => {
            console.log('Save changes response:', data);
            const timetableContainer = document.getElementById('timetable-container');
            if (timetableContainer && data.timetableHtml) {
                timetableContainer.innerHTML = data.timetableHtml;
                currentTimetable = data.timetable;
            }
            $('#editModal').modal('hide');
            if (data.message) {
                showMessage(data.message, 'success');
            }
            // Update available teachers after saving
            updateAvailableTeachers();
        })
        .catch(error => {
            console.error('Error saving timetable:', error.message);
            const errorElement = document.getElementById('modal-error-message');
            if(errorElement) {
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
            } else {
                showMessage('❌ Error saving changes: ' + error.message, 'error');
            }
        })
        .finally(() => {
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
        });
    });

    // Save timetable button handler
    document.addEventListener('click', function(e) {
        if (e.target && (e.target.id === 'save-timetable' || e.target.closest('#save-timetable'))) {
            const saveButton = e.target.id === 'save-timetable' ? e.target : e.target.closest('#save-timetable');
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveButton.disabled = true;

            console.log('Saving entire timetable:', currentTimetable);

            fetch('/save-timetable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ timetable: currentTimetable })
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    return response.text().then(text => { throw new Error(text) });
                }
            })
            .then(data => {
                console.log('Save timetable response:', data);
                const timetableContainer = document.getElementById('timetable-container');
                if (timetableContainer && data.timetableHtml) {
                    timetableContainer.innerHTML = data.timetableHtml;
                    currentTimetable = data.timetable;
                }
                if (data.message) {
                    showMessage(data.message, 'success');
                }
                // Update available teachers after saving
                updateAvailableTeachers();
            })
            .catch(error => {
                console.error('Error saving timetable:', error.message);
                showMessage('❌ Error saving timetable: ' + error.message, 'error');
            })
            .finally(() => {
                saveButton.innerHTML = originalText;
                saveButton.disabled = false;
            });
        }
    });

    // Generate timetable form handler
    document.getElementById('generate-timetable-form').addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Generate button clicked');
        
        const generateButton = e.target.querySelector('button[type="submit"]');
        const originalText = generateButton.innerHTML;
        generateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        generateButton.disabled = true;

        console.log('Sending generate request to server...');

        fetch('/generate-timetable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        .then(response => {
            console.log('Response status:', response.status);
            if (response.ok) {
                return response.json();
            } else {
                return response.text().then(text => { 
                    console.error('Server error:', text);
                    throw new Error(text) 
                });
            }
        })
        .then(data => {
            console.log('Generate response data:', data);
            if (data && data.timetable) {
                currentTimetable = data.timetable;
                const timetableSection = document.getElementById('timetable-section');
                let timetableContainer = document.getElementById('timetable-container');
                
                console.log('Updating timetable display...');
                
                if (!timetableContainer) {
                    console.log('Creating new timetable container');
                    timetableContainer = document.createElement('div');
                    timetableContainer.id = 'timetable-container';
                    timetableSection.appendChild(timetableContainer);
                }

                timetableContainer.innerHTML = data.timetableHtml;

                // Switch to the timetable view
                homeSection.style.display = 'none';
                timetableSection.style.display = 'block';
                
                // Update available teachers after generation
                updateAvailableTeachers();
                
                if (data.message) {
                    showMessage(data.message, 'success');
                }
            } else {
                console.error('No timetable data in response');
                showMessage('❌ No timetable data received from server', 'error');
            }
        })
        .catch(error => {
            console.error('Error generating timetable:', error);
            showMessage('❌ Error generating timetable: ' + error.message, 'error');
        })
        .finally(() => {
            generateButton.innerHTML = originalText;
            generateButton.disabled = false;
        });
    });

    // Delete slot handler - UPDATED for teachers
    document.addEventListener('click', function(e) {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const cell = deleteBtn.closest('td');
            const day = cell.getAttribute('data-day');
            const slot = parseInt(cell.closest('tr').getAttribute('data-slot'));
            
            console.log('Deleting slot - Day:', day, 'Slot:', slot);

            // Show loading state on the button
            const originalHtml = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.disabled = true;

            fetch('/delete-slot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ day, slot })
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => { throw new Error(text) });
                }
                return response.json();
            })
            .then(data => {
                console.log('Delete response:', data);
                const timetableContainer = document.getElementById('timetable-container');
                if (timetableContainer && data.timetableHtml) {
                    timetableContainer.innerHTML = data.timetableHtml;
                    if(data.timetable){
                        currentTimetable = data.timetable;
                    }
                }
                if (data.message) {
                    showMessage(data.message, 'success');
                }
                // Update available teachers after deletion
                updateAvailableTeachers();
            })
            .catch(error => {
                console.error('Error deleting slot:', error);
                showMessage('❌ Error deleting slot: ' + error.message, 'error');
            })
            .finally(() => {
                deleteBtn.innerHTML = originalHtml;
                deleteBtn.disabled = false;
            });
        }
    });

    // Edit button handler
    document.addEventListener('click', function(e) {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            console.log('Edit button clicked');
            // Bootstrap modal will handle the rest via data-target
        }
    });

    // Make generateTimetable function globally available for the "No timetable" button
    window.generateTimetable = function() {
        document.getElementById('generate-timetable-form').dispatchEvent(new Event('submit'));
    };
});