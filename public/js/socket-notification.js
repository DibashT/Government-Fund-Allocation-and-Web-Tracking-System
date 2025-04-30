// Socket.io Notification Handlers
document.addEventListener('DOMContentLoaded', function() {
  // Connect to Socket.io server
  const socket = io();
  
  // Ensure the socket is connected
  socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
  });

  // Listen for new admin notifications (fund alerts)
  socket.on('fundAlertNotification', (notification) => {
    console.log('Fund alert notification received:', notification);
    
    // Show browser notification for fund alerts
    if (Notification.permission === 'granted') {
      new Notification('Department Fund Alert', {
        body: notification.message,
        icon: '/images/logo.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Department Fund Alert', {
            body: notification.message,
            icon: '/images/logo.png',
          });
        }
      });
    }
    
    // Update UI with fund alert
    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
      const li = document.createElement('li');
      li.classList.add('notification-item');
      li.classList.add('warning');
      li.classList.add('unread');
      
      const now = new Date().toLocaleString();
      
      li.innerHTML = `
        <div class="icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="message-content">
          <div class="message">
            ${notification.message}
          </div>
          <div class="meta">
            <span class="status">Warning</span>
            <span class="time"><i class="fas fa-clock"></i> ${now}</span>
          </div>
        </div>
      `;
      
      // Insert at the top
      notificationList.insertBefore(li, notificationList.firstChild);
      
      // Show toast notification
      const toast = document.getElementById('toast-container');
      if (toast) {
        toast.textContent = notification.message;
        toast.style.display = 'block';
        
        setTimeout(() => {
          toast.style.display = 'none';
        }, 3000);
      }
    }
  });
  
  // Listen for admin notifications
  socket.on('newAdminNotification', (notification) => {
    console.log('New admin notification received:', notification);
    
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('New Admin Notification', {
        body: notification.message,
        icon: '/images/logo.png',
      });
    }
    
    // Add notification to UI
    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
      // Check if there's a no-notifications element to remove
      const noNotifications = document.querySelector('.no-notifications');
      if (noNotifications) {
        const container = noNotifications.parentElement;
        const newList = document.createElement('ul');
        newList.className = 'notification-list';
        newList.id = 'notification-list';
        container.replaceChild(newList, noNotifications);
        notificationList = newList;
      }
      
      const li = document.createElement('li');
      li.classList.add('notification-item');
      li.classList.add(notification.status.toLowerCase());
      li.classList.add('unread');
      
      // Choose the appropriate icon based on status
      let iconClass = 'fas fa-bell';
      if (notification.status === 'success') {
        iconClass = 'fas fa-check-circle';
      } else if (notification.status === 'warning') {
        iconClass = 'fas fa-exclamation-triangle';
      } else if (notification.status === 'info') {
        iconClass = 'fas fa-info-circle';
      } else if (notification.status === 'error') {
        iconClass = 'fas fa-times-circle';
      }
      
      const now = new Date().toLocaleString();
      
      li.innerHTML = `
        <div class="icon">
          <i class="${iconClass}"></i>
        </div>
        <div class="message-content">
          <div class="message">
            ${notification.message}
          </div>
          <div class="meta">
            <span class="status">${notification.status}</span>
            <span class="time"><i class="fas fa-clock"></i> ${now}</span>
          </div>
        </div>
      `;
      
      notificationList.insertBefore(li, notificationList.firstChild);
      
      // Show toast notification
      const toast = document.getElementById('toast-container');
      if (toast) {
        toast.textContent = notification.message;
        toast.style.display = 'block';
        
        setTimeout(() => {
          toast.style.display = 'none';
        }, 3000);
      }
    }
  });
  
  // Keep existing officials notification functionality
  socket.on("new-notification", (data) => {
    console.log("New Notification Received:", data);

    if (Notification.permission === "granted") {
      new Notification("New Project Update", {
        body: data.message,
        icon: "/images/logo.png"
      });
    }

    // Determine which tab to add the notification to
    let targetList;
    if (data.status === 'DeadlineAlert') {
      targetList = document.querySelector("#deadline .notification-list");
    } else if (data.status === 'Approved' || data.status === 'Rejected') {
      targetList = document.querySelector("#status .notification-list");
    }

    // If no list is found or it's an unrecognized notification type, return
    if (!targetList) {
      // Check if there's a no-notification message to replace
      const noNotificationMsg = data.status === 'DeadlineAlert' 
        ? document.querySelector("#deadline .no-notifications")
        : document.querySelector("#status .no-notifications");
      
      if (noNotificationMsg) {
        // Replace with a new list
        const newList = document.createElement("ul");
        newList.className = "notification-list";
        noNotificationMsg.parentNode.replaceChild(newList, noNotificationMsg);
        targetList = newList;
      } else {
        return;
      }
    }

    // Create notification item
    const newItem = document.createElement("li");
    
    // Set appropriate class based on notification type
    let statusClass = data.status.toLowerCase();
    if (data.status === 'DeadlineAlert') {
      statusClass = 'deadline-alert';
    }
    
    newItem.className = `notification-item ${statusClass}`;
    
    // Set appropriate icon based on notification type
    let iconClass = "fa-info-circle";
    if (data.status === 'DeadlineAlert') {
      iconClass = "fa-exclamation-triangle";
    }
    
    newItem.innerHTML = `
      <div class="icon"><i class="fas ${iconClass}"></i></div>
      <div class="message">
        <strong><i class="fas fa-envelope"></i> Message:</strong> ${data.message}
        <br>
        <small><i class="fas fa-clock"></i> ${new Date().toLocaleString()}</small>
      </div>
    `;
    
    // Add new notification to the top of the list
    targetList.prepend(newItem);
  });

  // Request permission for browser notifications
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
});