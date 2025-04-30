const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token || req.headers["authorization"]?.split(" ")[1]; // Look for token in cookie or Authorization header

  // Log the token for debugging purposes
  console.log("Token:", token); // This will log the token for each request

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token not provided" });
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    req.user = decoded; 
    next();
  });
};

module.exports = { authMiddleware };
