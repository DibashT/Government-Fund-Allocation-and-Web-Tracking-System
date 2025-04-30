/**
 * Admin Notifications JavaScript - Handles notification display and interactions
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize app
  const socket = io();
  
  // Setup UI components
  setupProfileDropdown();
  setupMobileSidebar();
  
  // Listen for notifications
  socket.on('fundAlertNotification', handleFundAlert);
  
  // Request notification permission
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
  
  /**
   * Handle socket connection errors
   * @param {Error} error - Socket connection error
   */
  function handleSocketError(error) {
    console.error('Socket connection error:', error);
    showToast('error', 'Connection error: Unable to receive real-time notifications');
  }
  
  /**
   * Set up profile dropdown functionality
   */
  function setupProfileDropdown() {
    const profileIcon = document.querySelector('.profile-icon');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (!profileIcon || !dropdownMenu) return;
    
    profileIcon.addEventListener('click', function() {
      dropdownMenu.classList.toggle('show');
    });
    
    document.addEventListener('click', function(event) {
      if (!profileIcon.contains(event.target) && !dropdownMenu.contains(event.target)) {
        dropdownMenu.classList.remove('show');
      }
    });
  }
  
  /**
   * Set up mobile sidebar toggle functionality
   */
  function setupMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (!sidebarToggle || !sidebar) return;
    
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('active');
    });
  }
  
  /**
   * Handle fund alerts from socket
   * @param {Object} data - Fund alert data
   */
  function handleFundAlert(data) {
    if (!data) return;
    
    console.log('Fund alert received:', data);
    
    // Prepare notification data
    const notification = {
      type: 'fund_alert',
      message: data.message || 'Fund alert received',
      department: data.department,
      status: 'Warning',
      remainingFund: data.remainingFund,
      totalFund: data.totalFund,
      percentRemaining: data.percentRemaining,
      createdAt: new Date()
    };
    
    // Show desktop notification if permission granted
    if (Notification.permission === 'granted') {
      try {
        const desktopNotification = new Notification('Fund Alert', {
          body: notification.message,
          icon: '/images/alert-icon.png'
        });
        
        desktopNotification.onclick = function() {
          window.focus();
          this.close();
        };
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
    
    // Add to UI
    addNotificationToUI(notification);
    
    // Show toast
    showToast('warning', notification.message, notification.department);
  }
  
  /**
   * Add notification to the UI
   * @param {Object} notification - Notification data
   */
  function addNotificationToUI(notification) {
    if (!notification) return;
    
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    // Handle empty state
    const notificationsContainer = document.querySelector('.notifications-container');
    if (notificationsContainer) {
      const noNotifications = notificationsContainer.querySelector('.no-notifications');
      if (noNotifications) {
        const newList = document.createElement('ul');
        newList.className = 'notification-list';
        newList.id = 'notification-list';
        notificationsContainer.replaceChild(newList, noNotifications);
        return addNotificationToUI(notification);
      }
    }
    
    // Create notification element
    const li = document.createElement('li');
    li.classList.add('notification-item');
    li.classList.add(notification.status ? notification.status.toLowerCase() : 'info');
    li.classList.add('unread');
    
    // Determine icon
    let iconClass = getIconClass(notification.status);
    
    // Build HTML content
    let content = `
      <div class="icon" aria-hidden="true">
        <i class="fas fa-${iconClass}"></i>
      </div>
      <div class="message-content">
        <div class="message">
          ${escapeHTML(notification.message)}
        </div>
    `;
    
    // Add fund progress if available
    if (notification.type === 'fund_alert' && notification.percentRemaining) {
      content += `
        <div class="fund-progress-container">
          <div class="fund-progress-bar" style="width: ${notification.percentRemaining}%"></div>
          <span class="fund-progress-text">${notification.percentRemaining}% remaining</span>
        </div>
        <div class="department-details">
          <strong>Department:</strong> ${escapeHTML(notification.department || 'N/A')}
          <strong>Remaining:</strong> ${notification.remainingFund ? notification.remainingFund.toLocaleString() : 'N/A'} units
        </div>
      `;
    }
    
    // Add meta info
    content += `
        <div class="meta">
          <span class="status">${notification.status || 'Info'}</span>
          <span class="time"><i class="fas fa-clock" aria-hidden="true"></i> ${notification.createdAt ? new Date(notification.createdAt).toLocaleString() : new Date().toLocaleString()}</span>
        </div>
      </div>
    `;
    
    li.innerHTML = content;
    notificationList.insertBefore(li, notificationList.firstChild);
  }
  
  /**
   * Get icon class based on notification status
   * @param {string} status - Notification status
   * @return {string} - Font Awesome icon class
   */
  function getIconClass(status) {
    if (!status) return 'bell';
    
    status = status.toLowerCase();
    
    if (status === 'warning') return 'exclamation-triangle';
    if (status === 'success') return 'check-circle';
    if (status === 'info') return 'info-circle';
    if (status === 'error') return 'times-circle';
    
    return 'bell';
  }
  
  /**
   * Show toast notification
   * @param {string} type - Toast type
   * @param {string} message - Toast message
   * @param {string} [department] - Optional department info
   */
  function showToast(type, message, department) {
    const toast = document.getElementById('toast-container');
    if (!toast) return;
    
    // Clear existing timeout
    if (toast.toastTimeout) {
      clearTimeout(toast.toastTimeout);
    }
    
    // Set content
    if (type === 'warning' && department) {
      toast.textContent = `Fund Alert: ${message} - Department: ${department}`;
      toast.className = 'toast-container toast-warning';
    } else {
      toast.textContent = message;
      toast.className = `toast-container toast-${type}`;
    }
    
    toast.style.display = 'block';
    
    // Hide after 5 seconds
    toast.toastTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 5000);
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} unsafe - Unsafe string
   * @return {string} - Escaped string
   */
  function escapeHTML(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}); 