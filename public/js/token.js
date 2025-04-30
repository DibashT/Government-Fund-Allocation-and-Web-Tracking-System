// token.js
async function fetchProtectedData(username) {
  const token = localStorage.getItem(`token_${username}`);
  if (!token) {
      document.getElementById("protected-data").innerText = "No token found for this user.";
      return;
  }

  try {
      const response = await fetch("/protected-route", {
          method: "GET",
          headers: {
              "Authorization": `Bearer ${token}`,
          },
      });

      if (!response.ok) {
          throw new Error("Failed to fetch protected data");
      }

      const data = await response.json();
      document.getElementById("protected-data").innerText = JSON.stringify(data, null, 2);
      console.log("Protected data:", data);
  } catch (error) {
      console.error("Error:", error.message);
      document.getElementById("protected-data").innerText = "Error: " + error.message;
  }
}

function togglePassword() {
  const passwordField = document.getElementById("password");
  const toggleIcon = document.getElementById("toggle-password");
  if (passwordField.type === "password") {
      passwordField.type = "text";
      toggleIcon.classList.add("fa-eye-slash");
      toggleIcon.classList.remove("fa-eye");
  } else {
      passwordField.type = "password";
      toggleIcon.classList.add("fa-eye");
      toggleIcon.classList.remove("fa-eye-slash");
  }
}

document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("name").value;
  const password = document.getElementById("password").value;
  const spinner = document.querySelector(".loading-spinner");

  spinner.style.display = "block";

  try {
      const response = await fetch("/login", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
      });

      spinner.style.display = "none";

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText);
      }

      const data = await response.json();
      const { token, role } = data;

      localStorage.setItem(`token_${username}`, token);

      switch (role) {
          case "Admin":
              window.location.href = "/admin-dashboard";
              break;
          case "Minister":
              window.location.href = "/minister-dashboard";
              break;
          case "Government Official":
              window.location.href = "/officials-dashboard";
              break;
          case "Public":
              window.location.href = "/public-dashboard";
              break;
          default:
              alert("Invalid user role.");
      }
  } catch (error) {
      spinner.style.display = "none";
      console.error("Login failed:", error.message);
      alert(error.message);
  }
});

function logout(username) {
  localStorage.removeItem(`token_${username}`);
  window.location.href = "/login";
}