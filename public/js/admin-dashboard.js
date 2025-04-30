async function fetchLatestProjects() {
    try {
        const response = await fetch('/api/admin-dashboard');
        const data = await response.json();
  
        if (data) {
            updateProjectSection('pending-projects', data.latestPendingRequests, 'startDate', '');
            updateProjectSection('ongoing-projects', data.latestOngoingProjects, 'progress', '%');
            updateProjectSection('completed-projects', data.latestCompletedProjects, 'actualCompletionDate', '');
        }
    } catch (error) {
        console.error("Error fetching latest projects:", error);
    }
}

function updateProjectSection(sectionId, projects, key, suffix = '') {
    const section = document.getElementById(sectionId);
    if (section) {
      section.innerHTML = ''; // Clear existing content
      projects.forEach(project => {
        if (project.name) { // Ensure project name exists
          const div = document.createElement('div');
          div.className = 'latest-item';
  
          // Format date if key is a date field
          let value = project[key] ? project[key] : 'No data';
          if (key.toLowerCase().includes('date') && value !== 'No data') {
            value = new Date(value).toISOString().split('T')[0]; // Converts to YYYY-MM-DD
          }
  
          div.innerHTML = `<strong>${project.name}</strong> - ${value + suffix}`;
          section.appendChild(div);
        }
      });
    }
  }
  

// Fetch new data every 10 seconds
setInterval(fetchLatestProjects, 10000);

// Load data initially
fetchLatestProjects();
