document.addEventListener("DOMContentLoaded", function () {
    // Initialize all components
    initUI();
    initDatePickers();
    setupFormValidation();
    handleToasts();
    
    // Initialize map when Google Maps API is loaded
    window.addEventListener('load', initializeMap);
    
    // Add CSS for error border on map
    const style = document.createElement('style');
    style.textContent = '.error-border { border: 2px solid var(--error-color) !important; }';
    document.head.appendChild(style);
});

function initUI() {
    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Profile dropdown functionality
    const profileIcon = document.querySelector('.profile-icon');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    if (profileIcon && dropdownMenu) {
        profileIcon.addEventListener('click', function () {
            dropdownMenu.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!profileIcon.contains(event.target) && !dropdownMenu.contains(event.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }
    
    // File upload handling
    const fileInput = document.getElementById('projectFile');
    const fileName = document.querySelector('.file-name');
    if (fileInput && fileName) {
        fileInput.addEventListener('change', function() {
            const fileContainer = this.closest('.file-upload-container');
            fileContainer?.classList.remove('error');
            
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                const maxSize = 5 * 1024 * 1024; // 5MB
                const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
                const fileExt = '.' + file.name.split('.').pop().toLowerCase();
                const feedback = fileContainer?.nextElementSibling?.nextElementSibling;
                
                // Validate file size
                if (file.size > maxSize) {
                    handleFileError('File is too large. Maximum size is 5MB.', fileContainer, feedback);
                    return;
                }
                
                // Validate file type
                if (!allowedTypes.includes(fileExt)) {
                    handleFileError('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.', fileContainer, feedback);
                    return;
                }
                
                // Valid file
                fileName.textContent = file.name;
            } else {
                fileName.textContent = 'No file chosen';
            }
        });
    }
    
    // Helper function for file validation errors
    function handleFileError(message, container, feedback) {
        showToast(message, 'error');
        fileInput.value = '';
        fileName.textContent = 'No file chosen';
        container?.classList.add('error');
        
        if (feedback?.classList.contains('input-feedback')) {
            feedback.textContent = message;
            feedback.classList.add('show');
        }
    }
    
    // Initialize Select2 if jQuery is loaded
    if (typeof $ !== 'undefined' && typeof $.fn.select2 !== 'undefined') {
        $('.modern-select').select2({
            width: '100%',
            theme: 'classic',
            dropdownCssClass: 'select2-dropdown-modern'
        });
    } else {
        // Fallback if Select2 isn't loaded yet
        window.addEventListener('load', function() {
            if (typeof $ !== 'undefined' && typeof $.fn.select2 !== 'undefined') {
                $('.modern-select').select2({
                    width: '100%',
                    theme: 'classic',
                    dropdownCssClass: 'select2-dropdown-modern'
                });
            }
        });
    }
}

function initDatePickers() {
    try {
        const startDateInput = document.getElementById("start-date");
        const deadlineInput = document.getElementById("deadline");
        
        if (!startDateInput || !deadlineInput) {
            console.warn('Date input elements not found');
            return;
        }
        
        if (typeof flatpickr === 'undefined') {
            console.warn('Flatpickr not loaded');
            // Fallback to basic date inputs
            return;
        }
        
        const today = new Date();
        const minStartDate = new Date(today);
        minStartDate.setDate(today.getDate() + 10);
        
        const formatDate = date => date.toISOString().split("T")[0];
        const isWeekend = date => date.getDay() === 0 || date.getDay() === 6;
        
        const defaultDeadline = new Date(minStartDate);
        defaultDeadline.setMonth(minStartDate.getMonth() + 1);
        
        startDateInput.value = formatDate(minStartDate);
        deadlineInput.value = formatDate(defaultDeadline);
        
        flatpickr(startDateInput, {
            minDate: minStartDate,
            dateFormat: "Y-m-d",
            disable: [isWeekend],
            onChange: ([start]) => {
                if (!start) return;
                const deadline = new Date(start);
                deadline.setMonth(deadline.getMonth() + 1);
                if (isWeekend(deadline)) {
                    deadline.setDate(deadline.getDate() + (deadline.getDay() === 6 ? 2 : 1));
                }
                deadlineInput.value = formatDate(deadline);
                
                // Also update the flatpickr instance for the deadline
                if (deadlineInput._flatpickr) {
                    deadlineInput._flatpickr.setDate(formatDate(deadline));
                }
            }
        });
        
        flatpickr(deadlineInput, {
            dateFormat: "Y-m-d",
            disable: [isWeekend],
            minDate: formatDate(defaultDeadline)
        });
    } catch (error) {
        console.error('Error initializing date pickers:', error);
    }
}

function handleToasts() {
    const toast = document.getElementById("toast");
    if (toast) {
        // Make sure toast is visible with proper styling
        toast.style.display = "block";
        toast.style.opacity = "1";
        
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.3s ease";
            
            setTimeout(() => {
                toast.style.display = "none";
                
                // Remove query parameters from URL after displaying toast
                if (window.history && window.history.replaceState) {
                    const currentUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, currentUrl);
                }
            }, 300);
        }, 3000);
    }
}

// Setup form validation with SweetAlert
function setupFormValidation() {
    const form = document.getElementById('project-form');
    const startDateInput = document.getElementById("start-date");
    const deadlineInput = document.getElementById("deadline");
    const latitudeInput = document.getElementById("latitude");
    const longitudeInput = document.getElementById("longitude");
    const fileInput = document.getElementById("projectFile");
    
    if (!form || !startDateInput || !deadlineInput) {
        return;
    }
    
    const today = new Date();
    const minStartDate = new Date(today);
    minStartDate.setDate(today.getDate() + 10);
    
    const isWeekend = date => date.getDay() === 0 || date.getDay() === 6;
    
    form.addEventListener("submit", function (event) {
        // Prevent default form submission initially - we'll submit manually if validation passes
        event.preventDefault();
        
        const startDate = new Date(startDateInput.value);
        const deadline = new Date(deadlineInput.value);
        const allocatedFundInput = document.getElementById('allocated-fund');
        const projectNameInput = document.getElementById('project-name');
        const departmentInput = document.getElementById('department');
        const detailsInput = document.getElementById('details');
        
        const errors = [];
        let hasFieldErrors = false;
        
        // Validate project name
        if (!projectNameInput || !projectNameInput.value.trim()) {
            addFieldError(projectNameInput, 'Project name is required');
            hasFieldErrors = true;
        } else if (projectNameInput.value.trim().length < 3) {
            addFieldError(projectNameInput, 'Project name must be at least 3 characters');
            hasFieldErrors = true;
        } else {
            clearFieldError(projectNameInput);
        }
        
        // Validate allocated fund
        if (!allocatedFundInput || !allocatedFundInput.value.trim()) {
            addFieldError(allocatedFundInput, 'Allocated fund is required');
            hasFieldErrors = true;
        } else {
            const fundValue = parseFloat(allocatedFundInput.value);
            if (isNaN(fundValue)) {
                addFieldError(allocatedFundInput, 'Please enter a valid number');
                hasFieldErrors = true;
            } else if (fundValue <= 0) {
                addFieldError(allocatedFundInput, 'Allocated fund must be greater than zero');
                hasFieldErrors = true;
            } else {
                clearFieldError(allocatedFundInput);
            }
        }
        
        // Validate department
        if (!departmentInput || !departmentInput.value) {
            addFieldError(departmentInput, 'Please select a department');
            hasFieldErrors = true;
        } else {
            clearFieldError(departmentInput);
        }
        
        // Validate project details
        if (!detailsInput || !detailsInput.value.trim()) {
            addFieldError(detailsInput, 'Project details are required');
            hasFieldErrors = true;
        } else if (detailsInput.value.trim().length < 10) {
            addFieldError(detailsInput, 'Please provide more detailed information (at least 10 characters)');
            hasFieldErrors = true;
        } else {
            clearFieldError(detailsInput);
        }
        
        // Validate dates
        if (!startDateInput.value) {
            addFieldError(startDateInput, 'Start date is required');
            hasFieldErrors = true;
        } else if (startDate < today) {
            addFieldError(startDateInput, 'Start date cannot be in the past');
            hasFieldErrors = true;
            errors.push("Start date cannot be in the past.");
        } else if (startDate < minStartDate) {
            addFieldError(startDateInput, 'Start date must be at least 10 days from today');
            hasFieldErrors = true;
            errors.push("Start date must be at least 10 days from today.");
        } else if (isWeekend(startDate)) {
            addFieldError(startDateInput, 'Start date cannot fall on a weekend');
            hasFieldErrors = true;
            errors.push("Start date cannot fall on a weekend.");
        } else {
            clearFieldError(startDateInput);
        }
        
        if (!deadlineInput.value) {
            addFieldError(deadlineInput, 'Project deadline is required');
            hasFieldErrors = true;
        } else if (isWeekend(deadline)) {
            addFieldError(deadlineInput, 'Deadline cannot fall on a weekend');
            hasFieldErrors = true;
            errors.push("Deadline cannot fall on a weekend.");
        } else if (deadline <= startDate) {
            addFieldError(deadlineInput, 'Deadline must be after the start date');
            hasFieldErrors = true;
            errors.push("Deadline must be after the start date.");
        } else {
            const daysDiff = (deadline - startDate) / (1000 * 60 * 60 * 24);
            if (daysDiff < 30) {
                addFieldError(deadlineInput, 'Deadline must be at least 30 days after the start date');
                hasFieldErrors = true;
                errors.push("Deadline must be at least 30 days after the start date.");
            } else {
                clearFieldError(deadlineInput);
            }
        }
        
        // Check if latitude and longitude are set
        const hasLatLng = latitudeInput && longitudeInput;
        if (!hasLatLng || !latitudeInput.value || !longitudeInput.value) {
            errors.push("Please choose a location on the map.");
            // Add visual indication that map selection is required
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.classList.add('error-border');
            }
            hasFieldErrors = true;
        } else {
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.classList.remove('error-border');
            }
        }
        
        // Validate file upload
        if (fileInput && fileInput.hasAttribute('required')) {
            if (!fileInput.files || fileInput.files.length === 0) {
                errors.push("Please attach a file for the project.");
                
                // Add error styling to file input container
                const fileContainer = fileInput.closest('.file-upload-container');
                if (fileContainer) {
                    fileContainer.classList.add('error');
                }
            } else {
                const file = fileInput.files[0];
                let fileError = false;
                
                // Validate file size (max 5MB)
                const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSizeInBytes) {
                    errors.push("File is too large. Maximum size is 5MB.");
                    fileError = true;
                }
                
                // Validate file type
                const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
                const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
                
                if (!allowedTypes.includes(fileExtension)) {
                    errors.push("Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.");
                    fileError = true;
                }
                
                // Add error styling to file input if there's an error
                if (fileError) {
                    const fileContainer = fileInput.closest('.file-upload-container');
                    if (fileContainer) {
                        fileContainer.classList.add('error');
                    }
                }
            }
        }
        
        if (errors.length > 0 || hasFieldErrors) {
            // Show the first error as a toast if there are general errors
            if (errors.length > 0) {
                showToast(errors[0], "error");
            } else {
                showToast("Please fix the form errors", "error");
            }
            
            // Focus on the first invalid field if available
            if (firstInvalidField) {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalidField.focus();
            }
            return;
        }

        // If validation passes, submit the form
        showToast("Submitting form...", "success");
        form.submit();
    });

    // Helper function to add error to a field
    function addFieldError(element, message) {
        if (!element) return;

        element.classList.add('error');

        // Find the feedback element
        const feedback = element.nextElementSibling;
        if (feedback && feedback.classList.contains('input-feedback')) {
            feedback.textContent = message;
            feedback.style.visibility = 'visible';
            feedback.classList.add('show');
        }
    }

    // Helper function to clear error from a field
    function clearFieldError(element) {
        if (!element) return;

        element.classList.remove('error');

        // Find the feedback element
        const feedback = element.nextElementSibling;
        if (feedback && feedback.classList.contains('input-feedback')) {
            feedback.textContent = '';
            feedback.style.visibility = 'hidden';
            feedback.classList.remove('show');
        }
    }

    // Helper function to show map error
    function showMapError(mapElement, message) {
        const mapError = mapElement.querySelector('.map-error');
        if (mapError) {
            mapError.textContent = message;
            mapError.style.visibility = 'visible';
        }
    }

    // Helper function to hide map error
    function hideMapError(mapElement) {
        const mapError = mapElement.querySelector('.map-error');
        if (mapError) {
            mapError.style.visibility = 'hidden';
        }
    }

    // Additional form input validation
    const formInputs = document.querySelectorAll('.modern-input, .modern-select, textarea');

    // Real-time validation
    formInputs.forEach(input => {
        // Special handling for allocated fund input
        if (input.id === 'allocated-fund') {
            input.addEventListener('input', function() {
                const value = parseFloat(this.value);
                const feedback = this.nextElementSibling;
                
                if (feedback && feedback.classList.contains('input-feedback')) {
                    if (this.value.trim() === '') {
                        this.classList.add('error');
                        feedback.textContent = 'This field is required';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else if (isNaN(value)) {
                        this.classList.add('error');
                        feedback.textContent = 'Please enter a valid number';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else if (value <= 0) {
                        this.classList.add('error');
                        feedback.textContent = 'Allocated fund must be greater than zero';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else {
                        this.classList.remove('error');
                        feedback.style.visibility = 'hidden';
                        feedback.classList.remove('show');
                    }
                }
            });
        }
        
        // Validate project name with minimum length
        if (input.id === 'project-name') {
            input.addEventListener('input', function() {
                const value = this.value.trim();
                const feedback = this.nextElementSibling;
                
                if (feedback && feedback.classList.contains('input-feedback')) {
                    if (value === '') {
                        this.classList.add('error');
                        feedback.textContent = 'Project name is required';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else if (value.length < 3) {
                        this.classList.add('error');
                        feedback.textContent = 'Project name must be at least 3 characters';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else {
                        this.classList.remove('error');
                        feedback.style.visibility = 'hidden';
                        feedback.classList.remove('show');
                    }
                }
            });
        }
        
        // Validate project details with minimum length
        if (input.id === 'details') {
            input.addEventListener('input', function() {
                const value = this.value.trim();
                const feedback = this.nextElementSibling;
                
                if (feedback && feedback.classList.contains('input-feedback')) {
                    if (value === '') {
                        this.classList.add('error');
                        feedback.textContent = 'Project details are required';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else if (value.length < 10) {
                        this.classList.add('error');
                        feedback.textContent = 'Please provide more detailed information (at least 10 characters)';
                        feedback.style.visibility = 'visible';
                        feedback.classList.add('show');
                    } else {
                        this.classList.remove('error');
                        feedback.style.visibility = 'hidden';
                        feedback.classList.remove('show');
                    }
                }
            });
        }
        
        // General blur validation for required fields
        input.addEventListener('blur', function() {
            if (this.hasAttribute('required') && !this.classList.contains('error')) {
                const isEmpty = this.type === 'file' ? !this.files.length : !this.value.trim();
                const feedback = this.nextElementSibling;
                
                if (feedback?.classList.contains('input-feedback')) {
                    if (isEmpty) {
                        this.classList.add('error');
                        feedback.textContent = 'Required';
                        feedback.classList.add('show');
                    } else {
                        this.classList.remove('error');
                        feedback.classList.remove('show');
                    }
                }
            }
        });
        
        // Add focus effect
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
}

// Utility function to show toast messages
function showToast(message, type = "success") {
    if (!message) return;
    
    try {
        // Check if there's already a toast with the same message to prevent duplicates
        const existingToasts = document.querySelectorAll('.toast');
        for (let i = 0; i < existingToasts.length; i++) {
            if (existingToasts[i].textContent === message) {
                return; // Don't show duplicate toasts
            }
        }
        
        const toast = document.createElement("div");
        toast.className = `toast ${type}-toast`;
        toast.textContent = message;
        toast.style.opacity = "0";
        
        const container = document.getElementById("toast-container") || createToastContainer();
        container.appendChild(toast);
        
        // Add a small delay before showing to ensure animation works
        setTimeout(() => {
            toast.style.opacity = "1";
            toast.style.transition = "opacity 0.3s ease";
        }, 10);
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000); // Increased to 5 seconds for better readability
    } catch (error) {
        console.error('Error showing toast:', error);
        // Fallback to alert if toast fails
        if (type === "error") {
            alert("Error: " + message);
        }
    }
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const existingContainer = document.getElementById("toast-container");
    if (existingContainer) return existingContainer;
    
    const container = document.createElement("div");
    container.id = "toast-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
    return container;
}

// Initialize map when Google Maps API is loaded
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof google === 'undefined' || !google.maps) {
        console.warn('Map element or Google Maps API not available');
        return;
    }

    let marker;
    const defaultLocation = { lat: 27.7172, lng: 85.3240 }; // Kathmandu, Nepal
    
    // Initialize the map with simplified options
    const map = new google.maps.Map(mapElement, {
        center: defaultLocation,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT
        }
    });
    
    // Add search box
    const input = document.createElement('input');
    input.className = 'map-search-box';
    input.type = 'text';
    input.placeholder = 'Search for a location...';
    
    const searchBox = new google.maps.places.Autocomplete(input);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    
    // Set up event listeners
    map.addListener('bounds_changed', () => searchBox.setBounds(map.getBounds()));
    map.addListener('click', e => updateMarkerPosition(e.latLng));
    
    searchBox.addListener('place_changed', () => {
        const place = searchBox.getPlace();
        if (place.geometry?.location) {
            map.setCenter(place.geometry.location);
            map.setZoom(15);
            updateMarkerPosition(place.geometry.location);
        }
    });
    
    // Function to update marker position and form values
    function updateMarkerPosition(location) {
        // Update form fields
        document.getElementById('latitude').value = location.lat().toFixed(6);
        document.getElementById('longitude').value = location.lng().toFixed(6);
        
        // Update or create marker
        if (marker) {
            marker.setPosition(location);
        } else {
            marker = new google.maps.Marker({
                position: location,
                map: map,
                draggable: true,
                animation: google.maps.Animation.DROP
            });
            
            // Add dragend event
            marker.addListener('dragend', () => {
                const position = marker.getPosition();
                document.getElementById('latitude').value = position.lat().toFixed(6);
                document.getElementById('longitude').value = position.lng().toFixed(6);
            });
            
            // Show brief info window
            const infoWindow = new google.maps.InfoWindow({
                content: '<div>Drag to adjust position</div>'
            });
            infoWindow.open(map, marker);
            setTimeout(() => infoWindow.close(), 3000);
        }
    }
}