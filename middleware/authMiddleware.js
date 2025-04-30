const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;

let blacklistedTokens = new Set(); // Stores invalidated tokens

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token; 

    if (!token) {
        return res.status(401).redirect("/login");
    }
    if (blacklistedTokens.has(token)) {
        return res.status(401).redirect("/login");
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // Attach user info to the request object
        next();
    } catch (error) {
        console.error("Token verification failed:", error.message);
        res.status(401).redirect("/login");
    }
};

const logoutUser = (req, res) => {
  res.clearCookie("token"); // Remove token from cookies
  res.json({ success: true, message: "Logged out successfully" });
}

module.exports = { authMiddleware, logoutUser };