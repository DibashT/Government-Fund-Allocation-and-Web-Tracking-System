function logout() {
  fetch("/logout", { method: "POST", credentials: "include" }) // Ensure cookies are sent
      .then(response => {
          if (response.ok) {
              window.location.href = "/login"; // Redirect to login page
          } else {
              alert("Logout failed. Please try again.");
          }
      })
      .catch(error => console.error("Logout failed:", error));
}