// Track if a bill generation is in progress
let billGenerationInProgress = false;

document.addEventListener("DOMContentLoaded", () => {
  addClickListeners(".view-btn", handleViewButtonClick);
  addClickListeners(".approve, .reject", handleApprovalButtons);

  // Close buttons
  getEl("projectModal")?.querySelector(".close-btn")?.addEventListener("click", closePopup);
  getEl("confirmModal")?.querySelector(".close-btn")?.addEventListener("click", closeConfirmModal);

  // Click outside modals to close
  window.addEventListener("click", (e) => {
    if (e.target === getEl("projectModal")) closePopup();
    if (e.target === getEl("confirmModal")) closeConfirmModal();
  });
});

// Utility: Get element by ID
function getEl(id) {
  return document.getElementById(id);
}

// Utility: Add event listeners to multiple elements
function addClickListeners(selector, handler) {
  document.querySelectorAll(selector).forEach(el =>
    el.addEventListener("click", handler)
  );
}

// Handle View Project button
function handleViewButtonClick(event) {
  event.preventDefault();
  const projectId = this.getAttribute("data-project-id");
  if (projectId) openPopup(projectId);
}

// Handle Approve/Reject buttons
function handleApprovalButtons(event) {
  event.preventDefault();
  const form = this.closest("form");
  if (!form) return;
  const projectId = form.getAttribute("action")?.split("/").pop();
  const action = this.classList.contains("approve") ? "approve" : "reject";
  if (projectId) showConfirmationPopup(projectId, action);
}

// Show toast notification
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type} show`;
  toast.textContent = message;

  getEl("toast-container").appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Open project details modal
function openPopup(projectId) {
  const modal = getEl("projectModal");
  const description = getEl("projectDescription");
  const locationSection = document.querySelector('.location-section');
  const fileSection = document.querySelector('.file-section');
  const locationElement = getEl("projectLocation");
  const fileElement = getEl("fileAttachment");

  if (!modal || !description) return;

  // Reset all elements
  description.innerHTML = "Loading...";
  locationSection.style.display = "none";
  fileSection.style.display = "none";
  
  // Get clicked button to access data attributes
  const clickedButton = document.querySelector(`button[data-project-id="${projectId}"]`);
  if (!clickedButton) return;
  
  // Get data attributes from button
  const hasFile = clickedButton.getAttribute("data-has-file") === "true";
  const filePath = clickedButton.getAttribute("data-file-path");
  const hasLocation = clickedButton.getAttribute("data-has-location") === "true";
  const lat = hasLocation ? parseFloat(clickedButton.getAttribute("data-lat")) : null;
  const lng = hasLocation ? parseFloat(clickedButton.getAttribute("data-lng")) : null;

  // Fetch and show project details
  fetch(`/project-details/${projectId}`)
    .then(res => res.json())
    .then(data => {
      description.innerHTML = data.success
        ? data.projectDetails || "No details available."
        : "Project details not found.";
      
      // Show location if available
      if (hasLocation && locationElement) {
        locationSection.style.display = "block";
        locationElement.innerHTML = `<strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
      
      // Show file attachment if available
      if (hasFile && fileElement) {
        fileSection.style.display = "block";
        fileElement.innerHTML = `<a href="/file-view/${filePath}" target="_blank" class="file-link">
          <i class="fas fa-file-download"></i> View Attached File
        </a>`;
      }
      
      modal.style.display = "flex";
    })
    .catch(() => {
      description.innerHTML = "Failed to load details. Please try again.";
      modal.style.display = "flex";
    });
}

// Close project detail modal
function closePopup() {
  const modal = getEl("projectModal");
  if (modal) modal.style.display = "none";
}

// Close confirm modal and reset rejection reason
function closeConfirmModal() {
  const modal = getEl("confirmModal");
  const reasonInput = getEl("rejectionReason");
  if (modal) modal.style.display = "none";
  if (reasonInput) reasonInput.value = "";
}

// Generate Bill Function for Ministers
function generateBill(projectId) {
  fetch(`/generate-bill/${projectId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  .then((response) => {
    if (response.ok) {
      return response.json().then(data => {
        // Redirect to confirmation page for ministers without showing notification
        window.location.href = `/bill-generated/${projectId}`;
      });
    } else {
      return response.json().then(data => {
        showToast(data.message || 'Failed to generate bill.', 'error');
      }).catch(() => {
        showToast('Failed to generate bill.', 'error');
      });
    }
  })
  .catch((error) => {
    console.error('Error generating bill:', error);
    showToast('An error occurred.', 'error');
  });
}

// Handle Generate Bill button click with debounce mechanism
function handleGenerateBill(event, projectId) {
  event.preventDefault();
  
  // Prevent double clicks
  if (billGenerationInProgress) {
    console.log('Bill generation already in progress');
    return;
  }
  
  // Get the button and update its appearance
  const button = document.getElementById(`generate-btn-${projectId}`);
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }
  
  // Set flag to prevent double generation
  billGenerationInProgress = true;
  
  // Call the original generate bill function
  generateBill(projectId);
  
  // Reset the flag after a delay (in case the request fails)
  setTimeout(() => {
    billGenerationInProgress = false;
    // Only reset the button if the page hasn't navigated away
    if (button && document.body.contains(button)) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-file-invoice"></i> Generate Bill';
    }
  }, 5000); // 5 second timeout as a fallback
}

// Show approval/rejection confirmation modal
function showConfirmationPopup(projectId, action) {
  const confirmModal = getEl("confirmModal");
  const confirmMessage = getEl("confirmMessage");
  const confirmYes = getEl("confirmYes");
  const rejectReasonInput = getEl("rejectionReason");

  if (!confirmModal || !confirmMessage || !confirmYes || !rejectReasonInput) return;

  confirmMessage.innerHTML = `Are you sure you want to <strong>${action}</strong> this project?`;
  rejectReasonInput.style.display = action === "reject" ? "block" : "none";
  rejectReasonInput.value = ""; // Reset field

  confirmYes.onclick = () => handleProjectAction(projectId, action);
  confirmModal.style.display = "flex";
}

// Handle approve/reject action via Fetch
function handleProjectAction(projectId, action) {
  const reason = action === "reject" ? getEl("rejectionReason").value.trim() : null;

  if (action === "reject" && !reason) {
    showToast("Please provide a reason for rejection.", "error");
    return;
  }

  fetch(`/${action}-project/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason })
  })
    .then(res => res.json())
    .then(data => {
      showToast(data.message || `Project ${action}d successfully!`, "success");
      closeConfirmModal();
      
      if (action === "reject") {
        // Only reload for rejection
        setTimeout(() => window.location.reload(), 1500);
      } else if (action === "approve") {
        // For approval, update the UI without reloading
        const actionCell = document.querySelector(`form[action="/${action}-project/${projectId}"]`).closest('td');
        const generateBillCell = actionCell.nextElementSibling;
        
        if (actionCell) {
          // Update the actions cell to show "Bill Pending..."
          actionCell.innerHTML = '<span style="color: gray;">Bill Pending...</span>';
        }
        
        if (generateBillCell) {
          // Update the generate bill cell to show enabled button
          generateBillCell.innerHTML = `
            <button class="generate-btn enabled" id="generate-btn-${projectId}" onclick="generateBill('${projectId}')">
              <i class="fas fa-file-invoice"></i> Generate Bill
            </button>
          `;
        }
      }
    })
    .catch(() => {
      showToast("An error occurred. Please try again.", "error");
      closeConfirmModal();
    });
}