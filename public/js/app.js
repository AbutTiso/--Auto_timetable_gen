document.addEventListener('DOMContentLoaded', () => {
    const homeLink = document.getElementById('home-link');
    const timetableLink = document.getElementById('timetable-link');
    const homeSection = document.getElementById('home-section');
    const timetableSection = document.getElementById('timetable-section');

    let currentTimetable = {};
    let subjectsData = [];
    let availableTeachers = [];
    let currentCell;

    // Initialize the app
    function initApp() {
        fetch('data.json')
            .then(response => response.json())
            .then(data => {
                subjectsData = data.subjects;
                if (data.timetable) {
                    currentTimetable = data.timetable;
                }
                updateAvailableTeachers();
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                showMessage('⚠️ No timetable yet! Click "Generate Timetable" to create your first schedule.', 'info');
            });
    }

    initApp();

    // Enhanced message display function
    function showMessage(message, type = 'info') {
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
            
            if (type === 'success') {
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 7000);
            }
        }
    }

    // Update available teachers display WITH DEBUG LOGGING
    function updateAvailableTeachers() {
        console.log('updateAvailableTeachers called, currentTimetable:', currentTimetable);
        
        fetch('/get-available-teachers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timetable: currentTimetable })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Available teachers data:', data); // DEBUG LOG
            availableTeachers = data.availableTeachers || [];
            updateEditModalOptions();
        })
        .catch(error => {
            console.error('Error fetching available teachers:', error);
        });
    }

    // FIXED: Update edit modal with empty slot FIRST, then deleted teachers
    function updateEditModalOptions() {
        const subjectSelect = document.getElementById('subject-select');
        if (!subjectSelect) return;

        console.log('updateEditModalOptions called');

        fetch('/get-available-teachers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timetable: currentTimetable })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Edit modal data received:', data); // DEBUG LOG
            
            // CLEAR ALL OPTIONS COMPLETELY
            subjectSelect.innerHTML = '';

            // 1. ALWAYS ADD EMPTY SLOT OPTION FIRST
            const emptyOption = document.createElement('option');
            emptyOption.value = "";
            emptyOption.textContent = "-- Empty slot (no lesson) --";
            emptyOption.className = "text-muted font-weight-bold";
            emptyOption.style.backgroundColor = "#f8f9fa";
            subjectSelect.appendChild(emptyOption);

            // 2. CHECK IF WE HAVE DELETED TEACHERS
            if (data.deletedTeachers && data.deletedTeachers.length > 0) {
                console.log('Adding deleted teachers to dropdown:', data.deletedTeachers);
                
                data.deletedTeachers.forEach(teacher => {
                    const option = document.createElement('option');
                    option.value = teacher.name;
                    // Show deleted teachers with their current status
                    const statusText = teacher.canBeAdded === false ? 
                        `⛔ ${teacher.name} (max hours reached - ${teacher.currentHours}/${teacher.maxHours}h)` :
                        `↩️ ${teacher.name} (was deleted - ${teacher.currentHours}/${teacher.maxHours}h)`;
                    option.textContent = statusText;
                    
                    if (teacher.canBeAdded === false) {
                        option.style.color = "#dc3545"; // Red for maxed out
                        option.style.fontWeight = "500";
                        option.disabled = true; // Disable if can't be added
                    } else {
                        option.style.color = "#e65100"; // Orange for available deleted
                        option.style.fontWeight = "500";
                        option.style.fontStyle = "italic";
                    }
                    option.style.backgroundColor = "#fff3cd";
                    subjectSelect.appendChild(option);
                });
            } else {
                console.log('No deleted teachers found in response');
            }

            // 3. ADD AVAILABLE TEACHERS (IF ANY)
            if (data.availableTeachers && data.availableTeachers.length > 0) {
                console.log('Adding available teachers to dropdown:', data.availableTeachers);
                
                data.availableTeachers.forEach(teacher => {
                    const option = document.createElement('option');
                    option.value = teacher.name;
                    option.textContent = `✅ ${teacher.name} (${teacher.currentHours}/${teacher.maxHours}h)`;
                    option.style.color = "#155724";
                    option.style.fontWeight = "500";
                    subjectSelect.appendChild(option);
                });
            } else {
                console.log('No available teachers found in response');
            }

            // If no teachers available at all (besides empty slot)
            if (subjectSelect.options.length === 1) {
                console.log('No teachers found, showing "No teachers available" message');
                const noOptions = document.createElement('option');
                noOptions.disabled = true;
                noOptions.textContent = "No teachers available to add";
                noOptions.className = "text-muted font-italic";
                subjectSelect.appendChild(noOptions);
            }

            // Set current value
            setTimeout(() => {
                if (currentCell) {
                    const day = currentCell.data('day');
                    const slot = currentCell.closest('tr').data('slot');
                    const currentTeacher = currentTimetable[day] && currentTimetable[day][slot] ? currentTimetable[day][slot] : '';
                    
                    // For empty slots, set to empty string
                    if (!currentTeacher || currentTeacher === '-') {
                        subjectSelect.value = "";
                    } else {
                        // Clean teacher name (remove emojis)
                        const cleanTeacher = currentTeacher.replace(/✅|↩️|⛔/g, '').trim();
                        subjectSelect.value = cleanTeacher;
                    }
                    
                    console.log('Setting modal value:', { 
                        day, slot, currentTeacher, 
                        selectValue: subjectSelect.value 
                    });
                }
            }, 100);
        })
        .catch(error => {
            console.error('Error fetching teachers for edit modal:', error);
            
            // Show error in dropdown but still show empty slot
            const subjectSelect = document.getElementById('subject-select');
            if (subjectSelect) {
                subjectSelect.innerHTML = '';
                
                const emptyOption = document.createElement('option');
                emptyOption.value = "";
                emptyOption.textContent = "-- Empty slot (no lesson) --";
                emptyOption.className = "text-muted font-weight-bold";
                subjectSelect.appendChild(emptyOption);
                
                const errorOption = document.createElement('option');
                errorOption.disabled = true;
                errorOption.textContent = "Error loading teachers. Please try again.";
                errorOption.className = "text-danger";
                subjectSelect.appendChild(errorOption);
            }
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
                                <strong>Requirements:</strong> Languages A/B (5h each), Sciences A/B (5h each), Arts Teacher (5h), Sports Teacher (5h)
                            </p>
                        </div>
                    `;
                }

                homeSection.style.display = 'none';
                timetableSection.style.display = 'block';
                
                updateAvailableTeachers();
                
                if (data.message) {
                    showMessage(data.message, 'success');
                }
            })
            .catch(error => {
                console.error('Error loading timetable:', error);
                showMessage('⚠️ No timetable yet! Click "Generate Timetable" to create your first schedule.', 'info');
            });
    }

    // Edit modal handler
    $('#editModal').on('show.bs.modal', function (event) {
        const button = $(event.relatedTarget);
        currentCell = button.closest('td');
        const teacherText = currentCell.find('.subjects').text().trim();
        const modal = $(this);
        
        modal.find('#modal-error-message').hide();
        updateAvailableTeachers();
        
        let currentTeacher = '';
        if (teacherText !== '-' && teacherText !== '') {
            currentTeacher = teacherText.replace(/<\/?[^>]+(>|$)/g, "").trim();
        }
        
        let subjectCategory = '';
        subjectsData.forEach(subject => {
            if (subject.teacherNames?.includes(currentTeacher)) {
                subjectCategory = subject.category;
            }
        });
        
        const teacherWithCategory = currentTeacher ? 
            `${currentTeacher} (${subjectCategory})` : 'Empty';

        modal.find('#current-subjects-with-category').text(teacherWithCategory);
        
        setTimeout(() => {
            modal.find('#subject-select').val(currentTeacher);
        }, 100);
    });

    // Save changes handler - FIXED to handle deleted teachers
    document.getElementById('save-changes').addEventListener('click', () => {
        const selectedTeacher = $('#subject-select').val() || '';
        
        if (!currentCell) {
            showMessage('❌ No cell selected for editing', 'error');
            return;
        }

        const day = currentCell.data('day');
        const slot = currentCell.closest('tr').data('slot');

        console.log('Saving changes for:', day, slot, selectedTeacher);

        // Check if teacher can be added
        if (selectedTeacher && selectedTeacher !== '') {
            // Check if it's a deleted teacher (remove emoji first)
            const cleanTeacher = selectedTeacher.replace(/↩️|✅|⛔/g, '').trim();
            const isDeletedTeacher = selectedTeacher.includes('↩️') || selectedTeacher.includes('⛔');
            
            if (!isDeletedTeacher) {
                // For regular teachers, check availability
                const isAvailable = availableTeachers.some(t => t.name === cleanTeacher);
                if (!isAvailable) {
                    showMessage(`❌ Cannot add ${cleanTeacher} - weekly hour limit reached!`, 'error');
                    return;
                }
            } else if (selectedTeacher.includes('⛔')) {
                // If it's a deleted teacher that's maxed out
                showMessage(`❌ Cannot add ${cleanTeacher} - this teacher has reached their maximum hours!`, 'error');
                return;
            }
            
            // Use clean teacher name (without emoji)
            const teacherToSave = cleanTeacher;
            
            const updatedTimetable = JSON.parse(JSON.stringify(currentTimetable));
            
            if (!updatedTimetable[day]) {
                updatedTimetable[day] = [];
            }
            if (updatedTimetable[day][slot] === undefined) {
                updatedTimetable[day][slot] = null;
            }
            
            updatedTimetable[day][slot] = teacherToSave || null;

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
        } else {
            // Empty slot selected
            const updatedTimetable = JSON.parse(JSON.stringify(currentTimetable));
            
            if (!updatedTimetable[day]) {
                updatedTimetable[day] = [];
            }
            if (updatedTimetable[day][slot] === undefined) {
                updatedTimetable[day][slot] = null;
            }
            
            updatedTimetable[day][slot] = null;

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
        }
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

                homeSection.style.display = 'none';
                timetableSection.style.display = 'block';
                
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

    // Delete slot handler - ADDED DEBUG LOGGING
    document.addEventListener('click', function(e) {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const cell = deleteBtn.closest('td');
            const day = cell.getAttribute('data-day');
            const slot = parseInt(cell.closest('tr').getAttribute('data-slot'));
            
            console.log('Deleting slot - Day:', day, 'Slot:', slot);
            console.log('Current timetable before delete:', currentTimetable);

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
        }
    });

    // Make generateTimetable function globally available
    window.generateTimetable = function() {
        document.getElementById('generate-timetable-form').dispatchEvent(new Event('submit'));
    };
});