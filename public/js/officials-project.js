document.addEventListener("DOMContentLoaded", function () {
    // Ensure we initialize UI components
    initUI();
    
    // Initialize date pickers
    initDatePickers();
    
    // Initialize form validation
    setupFormValidation();
    
    // Handle toast messages
    handleToasts();
    
    // Initialize map when Google Maps API is loaded
    window.addEventListener('load', function() {
        initializeMap();
    });
});

function initUI() {
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
            // Check if a file is selected
            if (this.files.length > 0) {
                const file = this.files[0];
                
                // Validate file size (max 5MB)
                const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSizeInBytes) {
                    // Display error message
                    showToast('File is too large. Maximum size is 5MB.', 'error');
                    // Reset file input
                    this.value = '';
                    fileName.textContent = 'No file chosen';
                    return;
                }
                
                // Validate file type
                const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
                const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
                
                if (!allowedTypes.includes(fileExtension)) {
                    // Display error message
                    showToast('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.', 'error');
                    // Reset file input
                    this.value = '';
                    fileName.textContent = 'No file chosen';
                    return;
                }
                
                // Set file name display
                fileName.textContent = file.name;
            } else {
                fileName.textContent = 'No file chosen';
            }
        });
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
        const startDate = new Date(startDateInput.value);
        const deadline = new Date(deadlineInput.value);
        
        const errors = [];
        
        if (startDate < today) errors.push("Start date cannot be in the past.");
        if (startDate < minStartDate) errors.push("Start date must be at least 10 days from today.");
        if (isWeekend(startDate)) errors.push("Start date cannot fall on a weekend.");
        if (isWeekend(deadline)) errors.push("Deadline cannot fall on a weekend.");
        if (deadline <= startDate) errors.push("Deadline must be after the start date.");
        
        const daysDiff = (deadline - startDate) / (1000 * 60 * 60 * 24);
        if (daysDiff < 30) errors.push("Deadline must be at least 30 days after the start date.");
        
        // Check if latitude and longitude are set
        const hasLatLng = latitudeInput && longitudeInput;
        if (!hasLatLng || !latitudeInput.value || !longitudeInput.value) {
            errors.push("Please choose a location on the map.");
        }
        
        // Validate file upload
        if (fileInput && fileInput.hasAttribute('required')) {
            if (!fileInput.files || fileInput.files.length === 0) {
                errors.push("Please attach a file for the project.");
            } else {
                const file = fileInput.files[0];
                
                // Validate file size (max 5MB)
                const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSizeInBytes) {
                    errors.push("File is too large. Maximum size is 5MB.");
                }
                
                // Validate file type
                const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
                const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
                
                if (!allowedTypes.includes(fileExtension)) {
                    errors.push("Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.");
                }
            }
        }
        
        if (errors.length > 0) {
            event.preventDefault();
            // Show the first error as a toast
            showToast(errors[0], "error");
            
            // Highlight all fields with errors
            const formElements = form.elements;
            for (let i = 0; i < formElements.length; i++) {
                const element = formElements[i];
                if (element.hasAttribute('required') && !element.value.trim()) {
                    element.classList.add('error');
                    const feedback = element.nextElementSibling;
                    if (feedback && feedback.classList.contains('input-feedback')) {
                        feedback.textContent = 'This field is required';
                        feedback.style.display = 'block';
                        feedback.classList.add('show');
                        
                        // Scroll to the first error
                        if (i === 0) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                }
            }
            
            return;
        }
        
        // Form will submit naturally since we're not preventing default
        // Show a small toast notification instead of the big SweetAlert
        showToast("Submitting form...", "success");
    });
    
    // Additional form input validation
    const formInputs = document.querySelectorAll('.modern-input, .modern-select, textarea');
    
    // Real-time validation
    formInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.hasAttribute('required')) {
                const value = this.value.trim();
                const isFileInput = this.type === 'file';
                const isEmpty = isFileInput ? !this.files.length : !value;
                
                const feedback = this.nextElementSibling;
                if (feedback?.classList.contains('input-feedback')) {
                    if (isEmpty) {
                        this.classList.add('error');
                        feedback.textContent = 'This field is required';
                        feedback.style.display = 'block';
                        feedback.classList.add('show');
                    } else {
                        this.classList.remove('error');
                        feedback.style.display = 'none';
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
        }, 3000);
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
    if (!mapElement) {
        console.warn('Map element not found');
        return;
    }
    
    if (typeof google === 'undefined' || !google.maps) {
        console.warn('Google Maps API not loaded');
        return;
    }

    let map;
    let marker;
    const defaultLocation = { lat: 27.7172, lng: 85.3240 }; // Kathmandu, Nepal
    
    // Initialize the map
    map = new google.maps.Map(mapElement, {
        center: defaultLocation,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT
        }
    });
    
    // Initialize the search box (autocomplete)
    const input = document.createElement('input');
    input.className = 'map-search-box';
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'Search for a location...');
    
    const searchBox = new google.maps.places.Autocomplete(input);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    
    // Bias the search results to the current map's viewport
    map.addListener('bounds_changed', function() {
        searchBox.setBounds(map.getBounds());
    });
    
    // Handle location selection from search
    searchBox.addListener('place_changed', function() {
        const place = searchBox.getPlace();
        if (!place.geometry || !place.geometry.location) {
            return;
        }
        
        // Center map on search result
        map.setCenter(place.geometry.location);
        map.setZoom(15);
        
        // Update marker position
        updateMarkerPosition(place.geometry.location);
    });
    
    // Add click listener to the map
    map.addListener('click', function(e) {
        updateMarkerPosition(e.latLng);
    });
    
    // Function to update marker position and form values
    function updateMarkerPosition(location) {
        // Update form field values
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
            
            // Add dragend event to marker
            marker.addListener('dragend', function() {
                const position = marker.getPosition();
                document.getElementById('latitude').value = position.lat().toFixed(6);
                document.getElementById('longitude').value = position.lng().toFixed(6);
            });
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: '<div>Drag to adjust position</div>'
            });
            
            // Show info window when marker is clicked
            marker.addListener('click', function() {
                infoWindow.open(map, marker);
            });
            
            // Open info window initially
            infoWindow.open(map, marker);
            setTimeout(() => infoWindow.close(), 3000); // Auto close after 3 seconds
        }
    }
}