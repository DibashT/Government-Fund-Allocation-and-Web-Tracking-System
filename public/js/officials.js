// JavaScript to handle sidebar navigation and content updates
document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll(".sidebar ul li a"); // Sidebar links
  const content = document.getElementById("content"); // Main content container

  const sections = {
      home: `
          <h1>Home</h1>
          <p>Welcome to the dashboard home. Here you can navigate to different sections.</p>
      `,
      notification: `
          <h1>Notifications</h1>
          <p>View all notifications related to your activities and updates here.</p>
      `,
      logout: `
          <h1>Logout</h1>
          <p>You have successfully logged out. Thank you for using the system.</p>
      `
  };

  // Attach click event listeners to all links
  links.forEach(link => {
      link.addEventListener("click", (e) => {
          e.preventDefault(); // Prevent default link behavior
          const section = link.getAttribute("data-section"); // Get the section from data attribute

          // Update content dynamically
          if (sections[section]) {
              content.innerHTML = sections[section];
          } else {
              content.innerHTML = `<h1>404</h1><p>Content not found!</p>`;
          }
      });
  });
});
