// Project questions cache
const questions = [
  "Has the initial phase of the project been completed?",
  "Has the required documentation been submitted?",
  "Are all allocated funds being used as planned?",
  "Has the vendor selection process been finalized?",
  "Are there any delays in project execution?",
  "Have all required approvals been obtained?",
  "Is the project currently on track according to the timeline?",
  "Have all materials or resources been procured?",
  "Have there been any budget overruns so far?",
  "Has a report been submitted for the last milestone?"
];

// Define which questions require bill attachments
const questionsRequiringBills = [0,1,2,3,4,5,6,7,8,9]; // Questions about funds and budget overruns

// Cache DOM references
const DOM = {
  modal: null,
  loader: null,
  questionsContainer: null,
  toast: null,
  get: function(id) {
    if (!this[id]) {
      this[id] = document.getElementById(id);
    }
    return this[id];
  }
};

// Debounce function to limit function calls
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Render questions with optimized rendering
function renderQuestions(existingAnswers = [], existingBills = {}) {
  const container = DOM.get('questionsContainer');
  
  // Clear container once instead of on each iteration
  container.innerHTML = '';
  
  // Create a document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  questions.forEach((question, i) => {
    const currentAnswer = existingAnswers[i] ? 'yes' : 'no';
    const block = document.createElement('div');
    block.className = 'question-block animate__animated animate__fadeIn';
    block.style.animationDelay = `${i * 0.05}s`;
    
    // Check if this question requires a bill attachment
    const requiresBill = questionsRequiringBills.includes(i);
    const existingBillFile = existingBills && existingBills[i] ? existingBills[i] : null;
    
    let fileUploadHtml = '';
    if (requiresBill && currentAnswer === 'yes') {
      fileUploadHtml = `
        <div class="file-upload-container">
          <label for="bill-file-${i}" class="file-upload-label">
            <i class="fas fa-file-invoice-dollar"></i> Attach Bill/Receipt <span class="required-indicator">*</span>
            <input type="file" id="bill-file-${i}" name="bill-file-${i}" class="bill-file-input" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx">
          </label>
          <div class="file-name" id="file-name-${i}">${existingBillFile ? `<span class="existing-file"><i class="fas fa-file"></i> ${existingBillFile} <a href="/file-view/${existingBillFile}" target="_blank" class="view-file"><i class="fas fa-eye"></i> View</a></span>` : 'No file chosen'}</div>
          <div class="file-required-message">* Bill attachment is mandatory when answering 'Yes'</div>
        </div>
      `;
    }
    
    block.innerHTML = `
      <p><i class="fas fa-question-circle"></i> ${i + 1}. ${question}</p>
      <div class="radio-group">
        <label class="radio-label ${currentAnswer === 'yes' ? 'selected' : ''}">
          <input type="radio" name="question-${i}" value="yes" ${currentAnswer === 'yes' ? 'checked' : ''}>
          <span class="radio-custom"><i class="fas fa-check"></i></span>
          Yes
        </label>
        <label class="radio-label ${currentAnswer === 'no' ? 'selected' : ''}">
          <input type="radio" name="question-${i}" value="no" ${currentAnswer === 'no' ? 'checked' : ''}>
          <span class="radio-custom"><i class="fas fa-times"></i></span>
          No
        </label>
      </div>
      ${fileUploadHtml}
    `;
    
    fragment.appendChild(block);
  });
  
  // Append all elements at once for better performance
  container.appendChild(fragment);
  
  // Add event delegation instead of individual listeners
  container.addEventListener('click', handleRadioClick);
  
  // Add file input change listeners
  document.querySelectorAll('.bill-file-input').forEach(input => {
    input.addEventListener('change', handleFileInputChange);
  });
}

// Handle file input changes
function handleFileInputChange(e) {
  const fileInput = e.target;
  const fileNameElement = document.getElementById(`file-name-${fileInput.id.split('-')[2]}`);
  
  if (fileInput.files.length > 0) {
    const fileName = fileInput.files[0].name;
    fileNameElement.innerHTML = `<span class="selected-file"><i class="fas fa-file"></i> ${fileName}</span>`;
  } else {
    fileNameElement.textContent = 'No file chosen';
  }
}

// Event delegation handler for radio buttons
function handleRadioClick(e) {
  const label = e.target.closest('.radio-label');
  if (!label) return;
  
  // Get all radio labels in this question group
  const name = label.querySelector('input').name;
  const radioLabels = label.parentElement.querySelectorAll('.radio-label');
  
  // Remove selected class from all labels in this group
  radioLabels.forEach(l => l.classList.remove('selected'));
  
  // Add selected class to clicked label
  label.classList.add('selected');
  
  // Get question index from the radio name
  const questionIndex = parseInt(name.split('-')[1]);
  
  // Check if this question requires a bill attachment
  if (questionsRequiringBills.includes(questionIndex)) {
    const questionBlock = label.closest('.question-block');
    const fileUploadContainer = questionBlock.querySelector('.file-upload-container');
    
    // If the answer is 'yes', show the file upload; otherwise, hide it
    if (label.querySelector('input').value === 'yes') {
      if (!fileUploadContainer) {
        // Create file upload container if it doesn't exist
        const newFileUploadContainer = document.createElement('div');
        newFileUploadContainer.className = 'file-upload-container';
        newFileUploadContainer.innerHTML = `
          <label for="bill-file-${questionIndex}" class="file-upload-label">
            <i class="fas fa-file-invoice-dollar"></i> Attach Bill/Receipt
            <input type="file" id="bill-file-${questionIndex}" name="bill-file-${questionIndex}" class="bill-file-input" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx">
          </label>
          <div class="file-name" id="file-name-${questionIndex}">No file chosen</div>
        `;
        questionBlock.appendChild(newFileUploadContainer);
        
        // Add event listener to the new file input
        const fileInput = newFileUploadContainer.querySelector('.bill-file-input');
        fileInput.addEventListener('change', handleFileInputChange);
      } else {
        fileUploadContainer.style.display = 'block';
      }
    } else if (fileUploadContainer) {
      fileUploadContainer.style.display = 'none';
    }
  }
}

// API requests with cached project data
const projectCache = new Map();

// API request with error handling and retries
async function fetchWithRetry(url, options = {}, retries = 2) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (retries > 0) {
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// This function will open the modal when the "Update" button is clicked
async function openModal(projectId) {
  const modal = DOM.get('progressModal');
  const loader = DOM.get('modal-loading');
  const container = DOM.get('questionsContainer');
  
  // Store current project ID
  window.currentProjectId = projectId;
  
  // Fade in animation for modal
  modal.style.display = "block";
  modal.hidden = false;
  modal.classList.add('animate__animated', 'animate__fadeIn');
  
  loader.style.display = "block";
  container.innerHTML = "";

  try {
    // Check if project data is already cached
    let data;
    if (projectCache.has(projectId)) {
      data = projectCache.get(projectId);
    } else {
      data = await fetchWithRetry(`/get-project/${projectId}`);
      projectCache.set(projectId, data);
    }
    
    // Render the questions based on existing answers and bill files
    renderQuestions(data.questionAnswers || [], data.billFiles || {});
  } catch (err) {
    console.error('Error fetching project data:', err);
    showToast("Unable to fetch project details.", "error");
    closeModal();
  } finally {
    loader.style.display = "none";
  }
}

// This function closes the modal
function closeModal() {
  const modal = DOM.get('progressModal');
  
  // Add fade out animation
  modal.classList.remove('animate__fadeIn');
  modal.classList.add('animate__fadeOut');
  
  // Wait for animation to complete before hiding
  setTimeout(() => {
    modal.style.display = "none";
    modal.hidden = true;
    modal.classList.remove('animate__fadeOut');
    
    // Remove event listener when modal is closed
    const container = DOM.get('questionsContainer');
    if (container) {
      container.removeEventListener('click', handleRadioClick);
    }
  }, 300);
}

// Setup modal event listeners only once
function setupModalEvents() {
  // Close modal if user clicks outside of it
  window.addEventListener('click', (event) => {
    const modal = DOM.get('progressModal');
    if (event.target === modal) {
      closeModal();
    }
  });
  
  // Close modal with ESC key
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && DOM.get('progressModal').style.display === 'block') {
      closeModal();
    }
  });
}

// Save progress with optimized data gathering
async function saveProgress() {
  const projectId = window.currentProjectId;
  const answers = {};
  let completedQuestions = 0;
  
  // Get all checked radios at once instead of looping through each question
  const checkedRadios = document.querySelectorAll('#questionsContainer input[type="radio"]:checked');
  
  checkedRadios.forEach(radio => {
    const index = parseInt(radio.name.split('-')[1]);
    const isYes = radio.value === 'yes';
    answers[index] = isYes;
    if (isYes) completedQuestions++;
  });
  
  // Validate that all 'Yes' answers have file attachments
  const missingAttachments = [];
  Object.keys(answers).forEach(index => {
    if (answers[index] === true) {
      const fileInput = document.getElementById(`bill-file-${index}`);
      if (!fileInput || fileInput.files.length === 0) {
        missingAttachments.push(parseInt(index) + 1); // Use 1-indexed for user display
      }
    }
  });
  
  // If any required attachments are missing, show error and stop submission
  if (missingAttachments.length > 0) {
    showToast(`Bill attachment required for question(s): ${missingAttachments.join(', ')}. Please attach all required documents.`, "error");
    return;
  }
  
  const btn = document.querySelector(".btn-submit");
  const originalText = btn.innerHTML;
  
  // Disable the button and show loading state
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

  try {
    // Create FormData to handle file uploads
    const formData = new FormData();
    
    // Add answers to FormData
    formData.append('answers', JSON.stringify(answers));
    
    // Add files for questions that require bills
    questionsRequiringBills.forEach(index => {
      const fileInput = document.getElementById(`bill-file-${index}`);
      if (fileInput && fileInput.files.length > 0 && answers[index] === true) {
        formData.append(`bill-file-${index}`, fileInput.files[0]);
      }
    });
    
    // Use fetch directly instead of fetchWithRetry for FormData
    const response = await fetch(`/update-progress/${projectId}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! Status: ${response.status}`);
    }

    if (data.success) {
      // Update the progress bar with animation
      const progressBar = document.getElementById(`progress-bar-${projectId}`);
      const progressText = document.getElementById(`progress-text-${projectId}`);
      const oldValue = parseInt(progressBar.value);
      
      // Update cached project data
      if (projectCache.has(projectId)) {
        const cachedProject = projectCache.get(projectId);
        cachedProject.progress = data.progress;
        cachedProject.questionAnswers = Object.values(answers);
        cachedProject.billFiles = data.billFiles;
        projectCache.set(projectId, cachedProject);
      }
      
      // Animate progress update
      animateProgressBar(progressBar, progressText, oldValue, data.progress);
      
      // Update status with proper styling
      updateProgressStatus(projectId, data.progress);
      
      showToast("Project progress successfully updated!", "success");
      closeModal();
      
      // If project is now complete, disable the update button
      if (data.progress === 100) {
        const buttonCell = document.querySelector(`button[onclick="openModal('${projectId}')"]`).parentNode;
        buttonCell.innerHTML = `<span class="completed-tag"><i class="fas fa-check"></i> Completed</span>`;
      }
    } else {
      showToast(data.message || "Failed to update progress.", "error");
    }
  } catch (err) {
    console.error("Network error:", err);
    showToast("Error updating project progress.", "error");
  } finally {
    // Restore button state
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// RequestAnimationFrame for smoother animations
function animateProgressBar(progressBar, progressText, startValue, endValue) {
  const duration = 800; // Animation duration in ms
  const startTime = performance.now();
  
  // Use requestAnimationFrame for smoother animation
  function step(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const currentValue = startValue + (endValue - startValue) * easeOutQuad(progress);
    
    const roundedValue = Math.round(currentValue);
    progressBar.value = roundedValue;
    progressText.textContent = roundedValue + '%';
    
    // Update color based on progress
    if (currentValue < 30) {
      progressBar.className = 'progress-low';
    } else if (currentValue < 70) {
      progressBar.className = 'progress-medium';
    } else {
      progressBar.className = 'progress-high';
    }
    
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  
  requestAnimationFrame(step);
}

// Easing function for smoother animation
function easeOutQuad(t) {
  return t * (2 - t);
}

// Update the progress status text and styling
function updateProgressStatus(projectId, progress) {
  const statusElem = document.getElementById(`progress-status-${projectId}`);
  if (!statusElem) return;
  
  let newStatus;
  if (progress === 100) {
    newStatus = `
      <div class="status-approved animate__animated animate__bounceIn">
        <i class="fas fa-flag-checkered"></i> Completed
      </div>`;
  } else if (progress > 0) {
    newStatus = `
      <div class="status-pending animate__animated animate__fadeIn">
        <i class="fas fa-spinner"></i> Ongoing
      </div>`;
  } else {
    newStatus = `
      <div class="status-rejected animate__animated animate__fadeIn">
        <i class="fas fa-clock"></i> Not Started
      </div>`;
  }
  
  statusElem.innerHTML = newStatus;
}

// Show toast notification with type-specific styling (debounced)
const showToast = debounce(function(message, type = 'success') {
  const toast = DOM.get('toast');
  toast.textContent = '';
  
  // Create icon based on message type
  const icon = document.createElement('i');
  switch(type) {
    case 'success':
      icon.className = 'fas fa-check-circle';
      toast.className = 'toast-success';
      break;
    case 'error':
      icon.className = 'fas fa-exclamation-circle';
      toast.className = 'toast-error';
      break;
    case 'warning':
      icon.className = 'fas fa-exclamation-triangle';
      toast.className = 'toast-warning';
      break;
    default:
      icon.className = 'fas fa-info-circle';
      toast.className = 'toast-info';
  }
  
  toast.appendChild(icon);
  toast.appendChild(document.createTextNode(' ' + message));
  toast.style.display = "block";
  toast.classList.add('animate__animated', 'animate__fadeInRight');
  
  // Remove the notification after a delay
  setTimeout(() => {
    toast.classList.remove('animate__fadeInRight');
    toast.classList.add('animate__fadeOutRight');
    
    setTimeout(() => {
      toast.style.display = "none";
      toast.classList.remove('animate__fadeOutRight');
    }, 500);
  }, 3000);
}, 200);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Hide modal initially
  const modal = DOM.get('progressModal');
  if (modal) {
    modal.style.display = "none";
    modal.hidden = true;
  }
  
  // Setup modal events
  setupModalEvents();
  
  // Add support for screen readers
  const closeBtn = document.querySelector('.modal .close');
  if (closeBtn) {
    closeBtn.setAttribute('aria-label', 'Close dialog');
  }
});

// Export functions for global access
window.openModal = openModal;
window.closeModal = closeModal;
window.saveProgress = saveProgress;