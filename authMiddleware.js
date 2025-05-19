const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;

/**
 * Enhanced authentication middleware with better redirection and persistent session handling
 */
const authMiddleware = (req, res, next) => {
  // Get token from cookie or Authorization header
  const token = req.cookies.token || req.headers["authorization"]?.split(" ")[1];

  // If no token exists, redirect to login page with return URL
  if (!token) {
    // Only redirect to login for non-API requests
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ message: "Unauthorized: Token not provided" });
    } else {
      // Save the URL they were trying to access for post-login redirect
      return res.redirect(`/login?returnUrl=${encodeURIComponent(req.originalUrl)}`);
    }
  }

  // Verify token
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      // Clear the invalid token
      res.clearCookie('token');
      
      // Handle token verification errors
      if (err.name === 'TokenExpiredError') {
        console.log('Token expired for user session');
        if (req.xhr || req.path.startsWith('/api/')) {
          return res.status(401).json({ message: "Session expired, please log in again" });
        } else {
          return res.redirect(`/login?error=${encodeURIComponent('Your session has expired. Please log in again')}&returnUrl=${encodeURIComponent(req.originalUrl)}`);
        }
      } else {
        // Other JWT errors
        console.log('Invalid token:', err.message);
        if (req.xhr || req.path.startsWith('/api/')) {
          return res.status(403).json({ message: "Invalid authentication token" });
        } else {
          return res.redirect('/login?error=' + encodeURIComponent('Authentication failed. Please log in again.'));
        }
      }
    }

    // Valid token - set user info in request object
    req.user = decoded; 
    next();
  });
};

/**
 * This middleware checks if user is already authenticated and redirects to appropriate dashboard
 * Use this for login/signup pages to prevent logged-in users from seeing them
 */
const redirectIfAuthenticated = (req, res, next) => {
  const token = req.cookies.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      // Redirect to appropriate dashboard based on role
      switch (decoded.role) {
        case "Admin":
          return res.redirect("/admin-dashboard");
        case "Minister":
          return res.redirect("/minister-dashboard");
        case "Government Official":
          return res.redirect("/officials-dashboard");
        case "Public":
          return res.redirect("/public-dashboard");
        default:
          // If role is unrecognized, clear the token and continue to login
          res.clearCookie('token');
          return next();
      }
    } catch (err) {
      // Invalid token - clear it and continue to login page
      res.clearCookie('token');
      return next();
    }
  }
  // No token, continue to login page
  next();
};

module.exports = { authMiddleware, redirectIfAuthenticated };
