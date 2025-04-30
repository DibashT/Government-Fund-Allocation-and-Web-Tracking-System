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
  const locationElement = getEl("projectLocation");

  if (!modal || !description) return;

  description.innerHTML = "Loading...";
  
  // Hide the location element
  if (locationElement) {
    locationElement.style.display = "none";
  }

  fetch(`/project-details/${projectId}`)
    .then(res => res.json())
    .then(data => {
      description.innerHTML = data.success
        ? data.projectDetails || "No details available."
        : "Project details not found.";
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
        // Show success message
        showToast('Bill generated successfully!', 'success');
        
        // Redirect to confirmation page for ministers
        setTimeout(() => {
          // The bill was generated, should redirect to confirmation page
          window.location.href = `/bill-generated/${projectId}`;
        }, 1500);
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