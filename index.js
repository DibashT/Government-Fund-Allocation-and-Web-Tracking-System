require ("dotenv").config();
const express=require("express");
const bcrypt=require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const ejsLayouts = require('ejs-layouts');
const { User, Project, DepartmentFund, Notification, Otp, Post } = require('./config');
const { authMiddleware } = require("./authMiddleware");
const upload = require("./config/uploadConfig");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path=require("path");
const http = require("http");
const socketIO = require("socket.io");
const app=express();
const server =http.createServer(app);
const io = socketIO(server);
const otpGenerator = require("otp-generator");
const rateLimit = require('express-rate-limit');

// Set up rate limiter for OTP requests
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Too many OTP requests from this IP, please try again later'
});

// Configure nodemailer transporter for email sending
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});


// Set up socket.io with user tracking
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Store user ID when they connect
  socket.on('register-user', (userId) => {
    if (userId) {
      console.log(`User ${userId} registered with socket ${socket.id}`);
      socket.join(`user-${userId}`); // Join a room specific to this user
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Import fund alert handler and set up socket.io
const fundAlertHandler = require('./utils/fundAlertHandler');
fundAlertHandler.setIO(io);

// Import deadline checker and set up socket.io
const { checkProjectDeadlines, setIO: setDeadlineCheckerIO } = require('./utils/checkDeadlines');
setDeadlineCheckerIO(io);

const SECRET_KEY = process.env.SECRET_KEY;
const port = process.env.PORT || 5000;

const generateToken = (User) => {
  return jwt.sign(
      { id: User._id },
      process.env.JWT_SECRET
  );
};

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static("public"))
app.use('/bills', express.static(path.join(__dirname, 'public', 'bills')));
// Disable direct access to uploads
// app.use('/uploads', express.static('uploads'));

// Improved file viewer route with comprehensive MIME type detection
app.get('/file-view/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  // Get file extension to determine content type
  const ext = path.extname(filename).toLowerCase();
  
  // Set appropriate content type based on file extension
  switch(ext) {
    case '.pdf':
      res.setHeader('Content-Type', 'application/pdf');
      break;
    case '.jpg':
    case '.jpeg':
      res.setHeader('Content-Type', 'image/jpeg');
      break;
    case '.png':
      res.setHeader('Content-Type', 'image/png');
      break;
    case '.gif':
      res.setHeader('Content-Type', 'image/gif');
      break;
    case '.txt':
      res.setHeader('Content-Type', 'text/plain');
      break;
    case '.doc':
      res.setHeader('Content-Type', 'application/msword');
      break;
    case '.docx':
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      break;
    case '.xls':
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      break;
    case '.xlsx':
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      break;
    case '.ppt':
      res.setHeader('Content-Type', 'application/vnd.ms-powerpoint');
      break;
    case '.pptx':
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      break;
    default:
      // For unknown types, let the browser decide or force inline display
      res.setHeader('Content-Type', 'application/octet-stream');
  }
  
  // Force inline display to prevent download
  res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
  // Additional headers that help with browser compatibility
  res.setHeader('X-Content-Type-Options', 'nosniff'); 
  res.sendFile(filePath);
});

app.set("view engine", "ejs");
app.set("io", io);
app.set("views", path.join(__dirname, "views"));

// let userSockets = {};

// io.on("connection", (socket) => {
//   console.log("User connected:", socket.id);

//   // Handle other events
//   socket.on("new-notification", (data) => {
//     io.emit("new-notification", data);
//   });

//   // Handle disconnections
//   socket.on("disconnect", (reason) => {
//     console.log("User disconnected:", socket.id, "Reason:", reason);
//     // Remove user session when disconnected
//     delete userSockets[socket.id];
//   });
// });

io.on("connection", (socket) => {
  console.log("A user connected");
  
  // Listen for notifications sent to the user
  socket.on("sendNotification", (notificationData) => {
    io.emit("receiveNotification", notificationData);
    console.log("Notification sent:", notificationData);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// When server starts, check department funds for low balances
setTimeout(async () => {
  try {
    // Check for low department funds on server startup
    await fundAlertHandler.checkDepartmentFunds(DepartmentFund);
  } catch (error) {
    console.error('Error during initial fund check:', error);
  }
}, 5000); // Wait 5 seconds after server start

// Check project deadlines daily
setInterval(async () => {
  try {
    console.log("Running scheduled project deadline check...");
    await checkProjectDeadlines();
  } catch (error) {
    console.error('Error checking project deadlines:', error);
  }
}, 24 * 60 * 60 * 1000); // Run once every 24 hours

// Also check deadlines on server startup after a short delay
setTimeout(async () => {
  try {
    console.log("Running initial project deadline check...");
    await checkProjectDeadlines();
  } catch (error) {
    console.error('Error during initial deadline check:', error);
  }
}, 10000); // Wait 10 seconds after server start

app.get("",(req,res)=>{
  res.render("login");
})

app.get("/login",(req,res)=>{
  res.render("login");
})

// Verify email configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Registration routes
app.get('/signup', (req, res) => {
    res.render('signup', { message: req.query.message });
});



app.get("/fund-data", async (req, res) => {
  const { type } = req.query;
  let groupStage = {};
  let dateThreshold = new Date();

  switch (type) {
    case "day":
      groupStage = {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        totalAllocated: { $sum: "$allocatedFund" }
      };
      dateThreshold.setDate(dateThreshold.getDate() - 7);
      break;

    case "week":
      groupStage = {
        _id: { $isoWeek: "$createdAt" },
        totalAllocated: { $sum: "$allocatedFund" }
      };
      dateThreshold.setDate(dateThreshold.getDate() - 30);
      break;

    case "month":
      groupStage = {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        totalAllocated: { $sum: "$allocatedFund" }
      };
      dateThreshold.setMonth(dateThreshold.getMonth() - 6);
      break;

    case "year":
      groupStage = {
        _id: { $year: "$createdAt" },
        totalAllocated: { $sum: "$allocatedFund" }
      };
      dateThreshold.setFullYear(dateThreshold.getFullYear() - 3);
      break;

    default:
      return res.status(400).json({ error: "Invalid type parameter" });
  }

  try {
    const data = await Project.aggregate([
      { $match: { createdAt: { $gte: dateThreshold } } },
      { $group: groupStage },
      { $sort: { _id: 1 } }
    ]);

    res.json(data);
  } catch (err) {
    console.error("Aggregation error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/fund-data-detailed", async (req, res) => {
  try {
    const projects = await Project.find({}, "projectName allocatedFund createdAt")
      .sort({ createdAt: 1 });

    const data = projects.map(p => ({
      x: p.createdAt,
      y: p.allocatedFund,
      label: p.projectName
    }));

    res.json(data);
  } catch (err) {
    console.error("Error fetching detailed fund data:", err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/admin-dashboard", authMiddleware, async (req, res) => {
  try {
    // Parallelize all count queries
    const [
      totalProjects,
      activeProjects,
      totalUsers,
      ministers,
      governmentOfficials,
      publicUsers,
      departmentFunds,
      highestFundedProjectData,
      lowestFundedProjectData,
      monthlyFundAllocation,
      topDepartments,
      latestPendingRequests,
      latestOngoingProjects,
      latestCompletedProjects
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: "Approved" }),
      User.countDocuments(),
      User.countDocuments({ role: "Minister" }),
      User.countDocuments({ role: "Government Official" }),
      User.countDocuments({ role: "Public" }),
      DepartmentFund.find(),
      Project.findOne().sort({ allocatedFund: -1 }).lean(),
      Project.findOne().sort({ allocatedFund: 1 }).lean(),
      DepartmentFund.aggregate([
        {
          $group: {
            _id: { $month: "$allocationDate" },
            totalAllocated: { $sum: "$approvedFund" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      DepartmentFund.find().sort({ approvedFund: -1 }).limit(3).lean(),
      Project.find({ status: "Pending" }).sort({ createdAt: -1 }).limit(3).select("projectName createdAt").lean(),
      Project.find({ progressStatus: "Ongoing" }).sort({ updatedAt: -1 }).limit(3).select("projectName progress").lean(),
      Project.find({
        progressStatus: "Completed",
        actualCompletionDate: { $ne: null }
      }).sort({ actualCompletionDate: -1, updatedAt: -1 }).limit(3).lean()
    ]);

    // Fund summaries
    const totalFund = departmentFunds.reduce((acc, fund) => acc + (fund.totalFund || 0), 0);
    const allocatedFund = departmentFunds.reduce((acc, fund) => acc + (fund.usedFund || 0), 0);
    const remainingFund = departmentFunds.reduce((acc, fund) => acc + (fund.remainingFund || 0), 0);

    // Highest/Lowest Funded Projects
    const highestFundedProjectName = highestFundedProjectData?.projectName || "No Data";
    const highestFundedProjectAmount = highestFundedProjectData?.allocatedFund || 0;
    const lowestFundedProjectName = lowestFundedProjectData?.projectName || "No Data";
    const lowestFundedProjectAmount = lowestFundedProjectData?.allocatedFund || 0;

    // Monthly Fund Allocation
    const months = monthlyFundAllocation.map(data => `Month ${data._id}`);
    const fundAllocations = monthlyFundAllocation.map(data => data.totalAllocated);

    // Create trendData
    const trendData = {
      monthly: {
        labels: months,
        data: fundAllocations
      }
    };

    // Top Department Stats
    const topDepartmentNames = topDepartments.map(dept => dept.department);
    const topDepartmentFunds = topDepartments.map(dept => dept.approvedFund);

    // Format project updates
    const formattedPendingRequests = latestPendingRequests.map(project => ({
      name: project.projectName || "No Name",
      date: project.createdAt?.toISOString().split('T')[0] || "No Date"
    }));

    const formattedOngoingProjects = latestOngoingProjects.map(project => ({
      name: project.projectName || "No Name",
      progress: project.progress || 0
    }));

    const formattedCompletedProjects = latestCompletedProjects.map(project => ({
      name: project.projectName || "No Name",
      completedDate: project.actualCompletionDate?.toISOString().split('T')[0] || "No Date"
    }));

    // Send data to EJS view
    res.render("admin-dashboard", {
      totalUsers,
      ministers,
      governmentOfficials,
      publicUsers,
      totalProjects,
      activeProjects,
      totalFund,
      allocatedFund,
      remainingFund,
      highestFundedProjectName,
      highestFundedProjectAmount,
      lowestFundedProjectName,
      lowestFundedProjectAmount,
      latestPendingRequests: formattedPendingRequests,
      latestOngoingProjects: formattedOngoingProjects,
      latestCompletedProjects: formattedCompletedProjects,
      departmentFunds,
      months,
      fundAllocations,
      trendData,  // Pass trendData to EJS
      topDepartments,
      topDepartmentNames,
      topDepartmentFunds,
      user: req.user  // Pass the user object from the JWT token

    });

  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    res.status(500).send("Internal Server Error");
  }
});


// app.get("/api/fund-trend-data", async (req, res) => {
//   try {
//     const trendData = await DepartmentFundHistory.aggregate([
//       {
//         $group: {
//           _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
//           totalAllocated: { $sum: "$allocatedFund" }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     const labels = trendData.map(item => item._id);  // Extract dates
//     const data = trendData.map(item => item.totalAllocated);  // Extract fund amounts

//     res.json({ labels, data });
//   } catch (error) {
//     console.error("Error fetching fund trend data:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch fund trend data." });
//   }
// });

app.get("/api/fund-usage", async (req, res) => {
  try {
    const timeFrame = req.query.timeFrame; // Get timeframe from query (real-time, day, week, etc.)
    const today = new Date();
    
    let startDate;
    if (timeFrame === "day") {
      startDate = new Date(today.setHours(0, 0, 0, 0)); // Start of today
    } else if (timeFrame === "week") {
      startDate = new Date();
      startDate.setDate(today.getDate() - today.getDay()); // Start of the week (previous Sunday)
      startDate.setHours(0, 0, 0, 0);
    } else if (timeFrame === "month") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of the month
    } else if (timeFrame === "year") {
      startDate = new Date(today.getFullYear(), 0, 1); // Start of the year
    } else {
      startDate = null; // No filter for real-time (all-time data)
    }

    // Fetch department funds based on time range
    let fundQuery = {};
    if (startDate) {
      fundQuery = { createdAt: { $gte: startDate } };
    }

    const departmentFunds = await DepartmentFund.find(fundQuery);
    
    // Calculate fund statistics
    const totalFund = departmentFunds.reduce((acc, fund) => acc + fund.totalFund, 0);
    const allocatedFund = departmentFunds.reduce((acc, fund) => acc + fund.usedFund, 0);
    const remainingFund = departmentFunds.reduce((acc, fund) => acc + fund.remainingFund, 0);

    // Get highest and lowest funded projects
    const highestFundedProject = await Project.findOne(fundQuery).sort({ allocatedFund: -1 });
    const lowestFundedProject = await Project.findOne(fundQuery).sort({ allocatedFund: 1 });

    res.json({
      totalFund,
      allocatedFund,
      remainingFund,
      highestFundedProjectName: highestFundedProject ? highestFundedProject.name : "No Data",
      highestFundedProjectAmount: highestFundedProject ? highestFundedProject.allocatedFund : 0,
      lowestFundedProjectName: lowestFundedProject ? lowestFundedProject.name : "No Data",
      lowestFundedProjectAmount: lowestFundedProject ? lowestFundedProject.allocatedFund : 0
    });

  } catch (error) {
    console.error("Error fetching fund usage:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/minister-dashboard", authMiddleware, async (req, res) => {
  try {
    // Fetching all the necessary data concurrently
    const [
      totalProjects,
      activeProjects,
      totalUsers,
      departmentFunds,
      highestFundedProjectData,
      lowestFundedProjectData,
      monthlyFundAllocation,
      topDepartments,
      latestPendingRequests,
      latestOngoingProjects,
      latestCompletedProjects,
      roleCounts // Added role counts aggregation
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: "Approved" }),
      User.countDocuments(),
      DepartmentFund.find().lean(),
      Project.findOne().sort({ allocatedFund: -1 }).lean(),
      Project.findOne().sort({ allocatedFund: 1 }).lean(),
      DepartmentFund.aggregate([
        {
          $group: {
            _id: { $month: "$allocationDate" },
            totalAllocated: { $sum: "$approvedFund" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      DepartmentFund.find().sort({ approvedFund: -1 }).limit(3).lean(),
      Project.find({ status: "Pending" }).sort({ createdAt: -1 }).limit(3).select("projectName createdAt").lean(),
      Project.find({ progressStatus: "Ongoing" }).sort({ updatedAt: -1 }).limit(3).select("projectName progress").lean(),
      Project.find({
        progressStatus: "Completed",
        actualCompletionDate: { $ne: null }
      }).sort({ actualCompletionDate: -1, updatedAt: -1 }).limit(3).lean(),
      User.aggregate([ // New role count aggregation
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Aggregating role counts into an object
    const roleCountMap = roleCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    // Destructure role counts or set to 0 if undefined
    const ministers = roleCountMap["Minister"] || 0;
    const governmentOfficials = roleCountMap["Government Official"] || 0;
    const publicUsers = roleCountMap["Public"] || 0;

    // Fund summaries
    const totalFund = departmentFunds.reduce((acc, fund) => acc + (fund.totalFund || 0), 0);
    const allocatedFund = departmentFunds.reduce((acc, fund) => acc + (fund.usedFund || 0), 0);
    const remainingFund = departmentFunds.reduce((acc, fund) => acc + (fund.remainingFund || 0), 0);

    // Highest/Lowest Funded Projects
    const highestFundedProjectName = highestFundedProjectData?.projectName || "No Data";
    const highestFundedProjectAmount = highestFundedProjectData?.allocatedFund || 0;
    const lowestFundedProjectName = lowestFundedProjectData?.projectName || "No Data";
    const lowestFundedProjectAmount = lowestFundedProjectData?.allocatedFund || 0;

    // Monthly Fund Allocation
    const months = monthlyFundAllocation.map(data => `Month ${data._id}`);
    const fundAllocations = monthlyFundAllocation.map(data => data.totalAllocated);

    // Create trendData
    const trendData = {
      monthly: {
        labels: months,
        data: fundAllocations
      }
    };

    // Top Department Stats
    const topDepartmentNames = topDepartments.map(dept => dept.department);
    const topDepartmentFunds = topDepartments.map(dept => dept.approvedFund);

    // Format project updates
    const formattedPendingRequests = latestPendingRequests.map(project => ({
      name: project.projectName || "No Name",
      date: project.createdAt?.toISOString().split('T')[0] || "No Date"
    }));

    const formattedOngoingProjects = latestOngoingProjects.map(project => ({
      name: project.projectName || "No Name",
      progress: project.progress || 0
    }));

    const formattedCompletedProjects = latestCompletedProjects.map(project => ({
      name: project.projectName || "No Name",
      completedDate: project.actualCompletionDate?.toISOString().split('T')[0] || "No Date"
    }));

    // Send data to EJS view
    res.render("minister-dashboard", {
      totalUsers,
      ministers,
      governmentOfficials,
      publicUsers,
      totalProjects,
      activeProjects,
      totalFund,
      allocatedFund,
      remainingFund,
      highestFundedProjectName,
      highestFundedProjectAmount,
      lowestFundedProjectName,
      lowestFundedProjectAmount,
      latestPendingRequests: formattedPendingRequests,
      latestOngoingProjects: formattedOngoingProjects,
      latestCompletedProjects: formattedCompletedProjects,
      departmentFunds,
      months,
      fundAllocations,
      trendData,  // Pass trendData to EJS
      topDepartments,
      topDepartmentNames,
      topDepartmentFunds,
      user: req.user  // Pass the user object from the JWT token
    });

  } catch (error) {
    console.error("Error fetching minister dashboard data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Minister Project Status page route
app.get("/minister-project-status", authMiddleware, async (req, res) => {
  try {
    // Verify user role
    if (req.user.role !== "Minister") {
      return res.redirect("/login?error=Unauthorized access");
    }
    
    // Fetch all projects with their progress information
    const projects = await Project.find({ status: "Approved" })
      .select("projectName department allocatedFund progress progressStatus questionAnswers billFiles status createdAt startDate projectDeadline actualCompletionDate projectDetails requestedBy")
      .populate("requestedBy", "name")
      .sort({ updatedAt: -1 })
      .lean();
      
    // Calculate statistics
    const statistics = {
      totalProjects: projects.length,
      completedProjects: projects.filter(p => p.progressStatus === "Completed").length,
      ongoingProjects: projects.filter(p => p.progressStatus === "Ongoing").length,
      pendingProjects: projects.filter(p => !p.progressStatus || p.progressStatus === "Not Started").length
    };
    
    res.render("minister-project-status", {
      projects,
      statistics,
      user: req.user
    });
  } catch (error) {
    console.error("Error fetching project status data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// API endpoint to get project documents
app.get("/api/project-documents/:projectId", authMiddleware, async (req, res) => {
  try {
    // Verify user role
    if (req.user.role !== "Minister") {
      return res.status(403).json({ success: false, error: "Unauthorized access" });
    }
    
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    
    // Return the bill files (documents)
    res.json({ 
      success: true,
      documents: project.billFiles || {}
    });
  } catch (error) {
    console.error("Error fetching project documents:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// API endpoint to get project details
app.get("/api/project-details/:projectId", authMiddleware, async (req, res) => {
  try {
    // Verify user role
    if (req.user.role !== "Minister") {
      return res.status(403).json({ success: false, error: "Unauthorized access" });
    }
    
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    
    // Return the project details
    res.json({ 
      success: true,
      project: project
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get("/officials-dashboard", authMiddleware, async (req, res) => {
  try {
    // Fetching all the necessary data concurrently
    const [
      totalProjects,
      activeProjects,
      totalUsers,
      departmentFunds,
      highestFundedProjectData,
      lowestFundedProjectData,
      monthlyFundAllocation,
      topDepartments,
      latestPendingRequests,
      latestOngoingProjects,
      latestCompletedProjects,
      roleCounts // Added role counts aggregation
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: "Approved" }),
      User.countDocuments(),
      DepartmentFund.find().lean(),
      Project.findOne().sort({ allocatedFund: -1 }).lean(),
      Project.findOne().sort({ allocatedFund: 1 }).lean(),
      DepartmentFund.aggregate([
        {
          $group: {
            _id: { $month: "$allocationDate" },
            totalAllocated: { $sum: "$approvedFund" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      DepartmentFund.find().sort({ approvedFund: -1 }).limit(3).lean(),
      Project.find({ status: "Pending" }).sort({ createdAt: -1 }).limit(3).select("projectName createdAt").lean(),
      Project.find({ progressStatus: "Ongoing" }).sort({ updatedAt: -1 }).limit(3).select("projectName progress").lean(),
      Project.find({
        progressStatus: "Completed",
        actualCompletionDate: { $ne: null }
      }).sort({ actualCompletionDate: -1, updatedAt: -1 }).limit(3).lean(),
      User.aggregate([ // New role count aggregation
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Aggregating role counts into an object
    const roleCountMap = roleCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    // Destructure role counts or set to 0 if undefined
    const ministers = roleCountMap["Minister"] || 0;
    const governmentOfficials = roleCountMap["Government Official"] || 0;
    const publicUsers = roleCountMap["Public"] || 0;

    // Fund summaries
    const totalFund = departmentFunds.reduce((acc, fund) => acc + (fund.totalFund || 0), 0);
    const allocatedFund = departmentFunds.reduce((acc, fund) => acc + (fund.usedFund || 0), 0);
    const remainingFund = departmentFunds.reduce((acc, fund) => acc + (fund.remainingFund || 0), 0);

    // Highest/Lowest Funded Projects
    const highestFundedProjectName = highestFundedProjectData?.projectName || "No Data";
    const highestFundedProjectAmount = highestFundedProjectData?.allocatedFund || 0;
    const lowestFundedProjectName = lowestFundedProjectData?.projectName || "No Data";
    const lowestFundedProjectAmount = lowestFundedProjectData?.allocatedFund || 0;

    // Monthly Fund Allocation
    const months = monthlyFundAllocation.map(data => `Month ${data._id}`);
    const fundAllocations = monthlyFundAllocation.map(data => data.totalAllocated);

    // Create trendData
    const trendData = {
      monthly: {
        labels: months,
        data: fundAllocations
      }
    };

    // Top Department Stats
    const topDepartmentNames = topDepartments.map(dept => dept.department);
    const topDepartmentFunds = topDepartments.map(dept => dept.approvedFund);

    // Format project updates
    const formattedPendingRequests = latestPendingRequests.map(project => ({
      name: project.projectName || "No Name",
      date: project.createdAt?.toISOString().split('T')[0] || "No Date"
    }));

    const formattedOngoingProjects = latestOngoingProjects.map(project => ({
      name: project.projectName || "No Name",
      progress: project.progress || 0
    }));

    const formattedCompletedProjects = latestCompletedProjects.map(project => ({
      name: project.projectName || "No Name",
      completedDate: project.actualCompletionDate?.toISOString().split('T')[0] || "No Date"
    }));

    // Send data to EJS view
    res.render("officials-dashboard", {
      totalUsers,
      ministers,
      governmentOfficials,
      publicUsers,
      totalProjects,
      activeProjects,
      totalFund,
      allocatedFund,
      remainingFund,
      highestFundedProjectName,
      highestFundedProjectAmount,
      lowestFundedProjectName,
      lowestFundedProjectAmount,
      latestPendingRequests: formattedPendingRequests,
      latestOngoingProjects: formattedOngoingProjects,
      latestCompletedProjects: formattedCompletedProjects,
      departmentFunds,
      months,
      fundAllocations,
      trendData,  // Pass trendData to EJS
      topDepartments,
      topDepartmentNames,
      topDepartmentFunds,
      user: req.user  // Pass the user object from the JWT token
    });

  } catch (error) {
    console.error("Error fetching minister dashboard data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/public-dashboard", authMiddleware, async (req, res) => {
  try {
    // Fetching all the necessary data concurrently
    const [
      totalProjects,
      activeProjects,
      totalUsers,
      departmentFunds,
      highestFundedProjectData,
      lowestFundedProjectData,
      monthlyFundAllocation,
      topDepartments,
      latestPendingRequests,
      latestOngoingProjects,
      latestCompletedProjects,
      roleCounts // Added role counts aggregation
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: "Approved" }),
      User.countDocuments(),
      DepartmentFund.find().lean(),
      Project.findOne().sort({ allocatedFund: -1 }).lean(),
      Project.findOne().sort({ allocatedFund: 1 }).lean(),
      DepartmentFund.aggregate([
        {
          $group: {
            _id: { $month: "$allocationDate" },
            totalAllocated: { $sum: "$approvedFund" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      DepartmentFund.find().sort({ approvedFund: -1 }).limit(3).lean(),
      Project.find({ status: "Pending" }).sort({ createdAt: -1 }).limit(3).select("projectName createdAt").lean(),
      Project.find({ progressStatus: "Ongoing" }).sort({ updatedAt: -1 }).limit(3).select("projectName progress").lean(),
      Project.find({
        progressStatus: "Completed",
        actualCompletionDate: { $ne: null }
      }).sort({ actualCompletionDate: -1, updatedAt: -1 }).limit(3).lean(),
      User.aggregate([ // New role count aggregation
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Aggregating role counts into an object
    const roleCountMap = roleCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    // Destructure role counts or set to 0 if undefined
    const ministers = roleCountMap["Minister"] || 0;
    const governmentOfficials = roleCountMap["Government Official"] || 0;
    const publicUsers = roleCountMap["Public"] || 0;

    // Fund summaries
    const totalFund = departmentFunds.reduce((acc, fund) => acc + (fund.totalFund || 0), 0);
    const allocatedFund = departmentFunds.reduce((acc, fund) => acc + (fund.usedFund || 0), 0);
    const remainingFund = departmentFunds.reduce((acc, fund) => acc + (fund.remainingFund || 0), 0);

    // Highest/Lowest Funded Projects
    const highestFundedProjectName = highestFundedProjectData?.projectName || "No Data";
    const highestFundedProjectAmount = highestFundedProjectData?.allocatedFund || 0;
    const lowestFundedProjectName = lowestFundedProjectData?.projectName || "No Data";
    const lowestFundedProjectAmount = lowestFundedProjectData?.allocatedFund || 0;

    // Monthly Fund Allocation
    const months = monthlyFundAllocation.map(data => `Month ${data._id}`);
    const fundAllocations = monthlyFundAllocation.map(data => data.totalAllocated);

    // Create trendData
    const trendData = {
      monthly: {
        labels: months,
        data: fundAllocations
      }
    };

    // Top Department Stats
    const topDepartmentNames = topDepartments.map(dept => dept.department);
    const topDepartmentFunds = topDepartments.map(dept => dept.approvedFund);

    // Format project updates
    const formattedPendingRequests = latestPendingRequests.map(project => ({
      name: project.projectName || "No Name",
      date: project.createdAt?.toISOString().split('T')[0] || "No Date"
    }));

    const formattedOngoingProjects = latestOngoingProjects.map(project => ({
      name: project.projectName || "No Name",
      progress: project.progress || 0
    }));

    const formattedCompletedProjects = latestCompletedProjects.map(project => ({
      name: project.projectName || "No Name",
      completedDate: project.actualCompletionDate?.toISOString().split('T')[0] || "No Date"
    }));

    // Send data to EJS view
    res.render("public-dashboard", {
      totalUsers,
      ministers,
      governmentOfficials,
      publicUsers,
      totalProjects,
      activeProjects,
      totalFund,
      allocatedFund,
      remainingFund,
      highestFundedProjectName,
      highestFundedProjectAmount,
      lowestFundedProjectName,
      lowestFundedProjectAmount,
      latestPendingRequests: formattedPendingRequests,
      latestOngoingProjects: formattedOngoingProjects,
      latestCompletedProjects: formattedCompletedProjects,
      departmentFunds,
      months,
      fundAllocations,
      trendData,  // Pass trendData to EJS
      topDepartments,
      topDepartmentNames,
      topDepartmentFunds,
      user: req.user  // Pass the user object from the JWT token
    });

  } catch (error) {
    console.error("Error fetching minister dashboard data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Public Post Page Route
app.get('/public-post', authMiddleware, async (req, res) => {
  try {
    // Fetch posts sorted by most recent
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .lean();
    
    // Ensure each post has likes and dislikes arrays
    const processedPosts = posts.map(post => ({
      ...post,
      likes: post.likes || [],
      dislikes: post.dislikes || []
    }));
    
    // Make sure posts exists, even if it's empty
    res.render('public-post', { 
      user: req.user, 
      posts: processedPosts || [] 
    });
  } catch (error) {
  }
});

app.get("/officials-project", authMiddleware, (req, res) => {
  // Get toast messages from cookies
  const successMsg = req.cookies.successMessage;
  const errorMsg = req.cookies.errorMessage;
  
  // Clear the cookies after reading
  if (successMsg) res.clearCookie('successMessage');
  if (errorMsg) res.clearCookie('errorMessage');
  
  res.render("officials-project", { 
    query: {
      success: successMsg,
      error: errorMsg
    } 
  });
});
app.get("/add-users", (req, res) => {
  res.render("add-users"); 
});
app.get("/edit-user", (req, res) => {
  res.render("edit-user"); 
});

app.post("/login", async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Username and password are required'));
    }

    // Find user by username or email for more flexible login
    const checkUser = await User.findOne({ 
      $or: [{ name: username }, { email: username }]
    });
    
    if (!checkUser) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid credentials'));
    }

    const passwordMatch = await bcrypt.compare(password, checkUser.password);
    if (!passwordMatch) {
      // Use generic error message for security
      return res.redirect('/login?error=' + encodeURIComponent('Invalid credentials'));
    }

    if (!checkUser.isActive) {
      return res.redirect('/login?error=' + encodeURIComponent('Your account is deactivated. Please contact support.'));
    }

    // Update last login time
    await User.updateOne(
      { _id: checkUser._id },
      { $set: { lastLogin: new Date() } }
    );

    // Determine token expiration based on remember me option
    const expiresIn = remember ? "30d" : "7h";
    
    // Generate JWT with appropriate claims and expiration
    const token = jwt.sign(
      { 
        _id: checkUser._id.toString(), 
        role: checkUser.role, 
        name: checkUser.name,
        email: checkUser.email
      },
      SECRET_KEY,
      { expiresIn: expiresIn }
    );    

    // Set cookie expiration based on remember me option
    const cookieMaxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 60 * 60 * 1000; // 30 days or 7 hours

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "Strict",
      maxAge: cookieMaxAge,
    });

    // Redirect based on role
    switch (checkUser.role) {
      case "Admin":
        return res.redirect("/admin-dashboard");
      case "Minister":
        return res.redirect("/minister-dashboard");
      case "Government Official":
        return res.redirect("/officials-dashboard");
      case "Public":
        return res.redirect("/public-dashboard");
      default:
        return res.redirect('/login?error=' + encodeURIComponent('Invalid user role'));
    }
  } catch (error) {
    console.error("Error during login:", error.message);
    return res.redirect('/login?error=' + encodeURIComponent('An error occurred. Please try again later.'));
  }
});

app.post('/signup', otpLimiter, async (req, res) => {
    const { name, email, phone, role, password } = req.body;

    try {
        // Enhanced input validation
        if (!name || !email || !phone || !role || !password) {
            return res.redirect('/signup?message=' + encodeURIComponent('All fields are required'));
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.redirect('/signup?message=' + encodeURIComponent('Please enter a valid email address'));
        }
        
        // Validate phone number format
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        if (!phoneRegex.test(phone)) {
            return res.redirect('/signup?message=' + encodeURIComponent('Please enter a valid phone number'));
        }
        
        // Validate password strength
        if (password.length < 8) {
            return res.redirect('/signup?message=' + encodeURIComponent('Password must be at least 8 characters long'));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.redirect('/signup?message=' + encodeURIComponent('User with this email or phone already exists'));
        }

        // Generate OTP (numeric only)
        const otp = otpGenerator.generate(6, { 
            digits: true, 
            alphabets: false,
            upperCase: false,
            specialChars: false,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false
        });

        // Hash password with stronger work factor
        const hashedPassword = await bcrypt.hash(password, 12);

        // Delete any existing OTP for this email
        await Otp.deleteMany({ email });

        // Save new OTP and user info with sanitized data
        await Otp.create({
            email: email.toLowerCase().trim(),
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000, // Extended to 10 minutes
            userData: {
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                role,
                password: hashedPassword,
                isActive: true,
                lastLogin: null
            },
        });

        // Send OTP via email with improved template
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Your Verification Code - Government Fund Allocation System",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                        <h2 style="color: #333; text-align: center;">Email Verification</h2>
                        <p>Thank you for registering with the Government Fund Allocation System.</p>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px;">Your verification code is:</p>
                            <h1 style="margin: 10px 0; color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
                            <p style="margin: 0; font-size: 14px; color: #777;">This code will expire in 10 minutes</p>
                        </div>
                        <p>If you didn't request this code, please ignore this email.</p>
                        <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">This is an automated message, please do not reply.</p>
                    </div>
                `,
            });
            console.log(`OTP email sent successfully to ${email}`);
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            await Otp.deleteOne({ email });
            return res.redirect('/signup?message=' + encodeURIComponent('Failed to send verification email. Please try again later.'));
        }

        // Redirect to OTP verification page
        res.redirect(`/verify-otp?email=${encodeURIComponent(email)}&message=${encodeURIComponent('Verification code sent to your email')}`);
    } catch (err) {
        console.error("Registration error:", err);
        res.redirect('/signup?message=' + encodeURIComponent('Error processing your request. Please try again later.'));
    }
});

// OTP verification routes
app.get('/verify-otp', (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.redirect('/signup');
    }
    res.render('verify-otp', { 
        email,
        message: req.query.message 
    });
});

// Forgot password routes
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { message: req.query.message });
});

app.post('/forgot-password', otpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.redirect('/forgot-password?message=' + encodeURIComponent('Email is required'));
        }
        
        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            // For security reasons, still show success message even if email doesn't exist
            return res.redirect('/forgot-password?message=' + encodeURIComponent('If your email is registered, you will receive a password reset link'));
        }
        
        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user._id.toString(), email: user.email },
            SECRET_KEY + user.password.substring(0, 10), // Add part of hashed password to make token secure
            { expiresIn: '1h' }
        );
        
        // Generate OTP for verification
        const otp = otpGenerator.generate(6, { 
            digits: true, 
            alphabets: false,
            upperCase: false,
            specialChars: false,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false
        });
        
        // Delete any existing reset OTPs for this email
        await Otp.deleteMany({ email, type: 'reset' });
        
        // Save reset OTP
        await Otp.create({
            email: email.toLowerCase().trim(),
            otp,
            type: 'reset',
            expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
            userData: {
                resetToken
            }
        });
        
        // Send password reset email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset - Government Fund Allocation System",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333; text-align: center;">Password Reset</h2>
                    <p>You requested a password reset for your Government Fund Allocation System account.</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
                        <p style="margin: 0; font-size: 16px;">Your verification code is:</p>
                        <h1 style="margin: 10px 0; color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
                        <p style="margin: 0; font-size: 14px; color: #777;">This code will expire in 15 minutes</p>
                    </div>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">This is an automated message, please do not reply.</p>
                </div>
            `,
        });
        
        res.redirect(`/reset-password-verify?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error('Password reset error:', error);
        res.redirect('/forgot-password?message=' + encodeURIComponent('An error occurred. Please try again later.'));
    }
});

// Reset password verification
app.get('/reset-password-verify', (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.redirect('/forgot-password');
    }
    res.render('reset-password-verify', { 
        email,
        message: req.query.message 
    });
});

app.post('/reset-password-verify', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.redirect(`/reset-password-verify?email=${encodeURIComponent(email)}&message=` + 
                encodeURIComponent('Email and verification code are required'));
        }
        
        // Find OTP record
        const otpRecord = await Otp.findOne({ 
            email: email.toLowerCase().trim(), 
            otp,
            type: 'reset'
        });
        
        if (!otpRecord) {
            return res.redirect(`/reset-password-verify?email=${encodeURIComponent(email)}&message=` + 
                encodeURIComponent('Invalid verification code'));
        }
        
        if (Date.now() > otpRecord.expiresAt) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.redirect(`/reset-password-verify?email=${encodeURIComponent(email)}&message=` + 
                encodeURIComponent('Verification code expired. Please request a new one.'));
        }
        
        // Redirect to reset password form with the token
        res.redirect(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(otpRecord.userData.resetToken)}`);
    } catch (error) {
        console.error('Reset password verification error:', error);
        res.redirect('/forgot-password?message=' + encodeURIComponent('An error occurred. Please try again later.'));
    }
});

// Reset password form
app.get('/reset-password', (req, res) => {
    const { email, token } = req.query;
    if (!email || !token) {
        return res.redirect('/forgot-password');
    }
    res.render('reset-password', { 
        email,
        token,
        message: req.query.message 
    });
});

app.post('/reset-password', async (req, res) => {
    try {
        const { email, token, password, confirmPassword } = req.body;
        
        if (!email || !token || !password || !confirmPassword) {
            return res.redirect(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&message=` + 
                encodeURIComponent('All fields are required'));
        }
        
        if (password !== confirmPassword) {
            return res.redirect(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&message=` + 
                encodeURIComponent('Passwords do not match'));
        }
        
        if (password.length < 8) {
            return res.redirect(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&message=` + 
                encodeURIComponent('Password must be at least 8 characters long'));
        }
        
        // Find user
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.redirect('/login?error=' + encodeURIComponent('Invalid or expired reset link'));
        }
        
        try {
            // Verify token with user's password fragment as part of the secret
            const decoded = jwt.verify(token, SECRET_KEY + user.password.substring(0, 10));
            
            if (decoded.userId !== user._id.toString() || decoded.email !== user.email) {
                return res.redirect('/login?error=' + encodeURIComponent('Invalid or expired reset link'));
            }
            
            // Hash new password
            const hashedPassword = await bcrypt.hash(password, 12);
            
            // Update user's password
            await User.updateOne(
                { _id: user._id },
                { $set: { password: hashedPassword } }
            );
            
            // Delete all reset OTPs for this email
            await Otp.deleteMany({ email: email.toLowerCase().trim(), type: 'reset' });
            
            // Redirect to login with success message
            return res.redirect('/login?message=' + encodeURIComponent('Your password has been reset successfully. Please log in with your new password.'));
        } catch (tokenError) {
            console.error('Token verification error:', tokenError);
            return res.redirect('/login?error=' + encodeURIComponent('Invalid or expired reset link'));
        }
    } catch (error) {
        console.error('Reset password error:', error);
        res.redirect('/login?error=' + encodeURIComponent('An error occurred. Please try again later.'));
    }
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Enhanced input validation
        if (!email || !otp) {
            return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}&message=` + 
                encodeURIComponent('Email and verification code are required'));
        }

        // Normalize email to lowercase for consistent matching
        const normalizedEmail = email.toLowerCase().trim();
        
        // Validate OTP format
        if (!/^\d{6}$/.test(otp)) {
            return res.redirect(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}&message=` + 
                encodeURIComponent('Invalid verification code format. Must be 6 digits.'));
        }

        // Find OTP record with normalized email
        const otpRecord = await Otp.findOne({ email: normalizedEmail, otp });

        if (!otpRecord) {
            // Implement security delay to prevent timing attacks
            await new Promise(resolve => setTimeout(resolve, 1000));
            return res.redirect(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}&message=` + 
                encodeURIComponent('Invalid verification code'));
        }

        // Check if OTP has expired
        if (Date.now() > otpRecord.expiresAt) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.redirect(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}&message=` + 
                encodeURIComponent('Verification code expired. Please request a new one.'));
        }

        try {
            // Create user with transaction-like approach
            const user = await User.create(otpRecord.userData);

            // Create welcome notification for the user
            if (user.role === "Government Official" || user.role === "Admin") {
                await Notification.create({
                    message: `Welcome to the Government Fund Allocation System, ${user.name}!`,
                    status: "Info",
                    recipientRole: user.role,
                    isRead: false
                });
            }

            // Remove OTP record immediately after successful verification
            await Otp.deleteOne({ _id: otpRecord._id });

            // Redirect to login page with success message after registration
            return res.redirect('/login?message=' + encodeURIComponent('Registration successful! Please log in with your credentials.'));
        } catch (userCreationError) {
            console.error("User creation error:", userCreationError);
            // If user creation fails, clean up OTP record
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.redirect('/signup?message=' + encodeURIComponent('Account creation failed. Please try again.'));
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}&message=` + 
            encodeURIComponent('Error verifying code. Please try again.'));
    }
});

// Resend OTP route
app.get('/resend-otp', otpLimiter, async (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.redirect('/signup');
    }

    try {
        const otpRecord = await Otp.findOne({ email });
        
        if (!otpRecord) {
            return res.redirect('/signup?message=' + encodeURIComponent('Session expired. Please register again.'));
        }

        // Generate new OTP (numeric only)
        const otp = otpGenerator.generate(6, { 
            digits: true, 
            alphabets: false,
            upperCase: false,
            specialChars: false,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false
        });

        // Update OTP and expiry
        otpRecord.otp = otp;
        otpRecord.expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
        await otpRecord.save();

        // Send OTP via email
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Your New OTP Code",
                html: `
                    <h2>Your New OTP Code</h2>
                    <p>Your new OTP code is: <strong>${otp}</strong></p>
                    <p>This code will expire in 5 minutes.</p>
                    <p>If you didn't request this OTP, please ignore this email.</p>
                `,
            });
            console.log(`New OTP email sent successfully to ${email}`);
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}&message=` + 
                encodeURIComponent('Failed to send new OTP email. Please try again later.'));
        }

        res.redirect(`/verify-otp?email=${encodeURIComponent(email)}&message=` + 
            encodeURIComponent('New OTP sent to your email.'));
    } catch (error) {
        console.error("Resend OTP error:", error);
        res.redirect(`/verify-otp?email=${encodeURIComponent(email)}&message=` + 
            encodeURIComponent('Error resending OTP. Please try again.'));
    }
});



app.get('/officials-notification',authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientRole: "Government Official" })
      .sort({ createdAt: -1 });

    res.render('officials-notification', { notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Officials profile route
app.get('/officials-profile', authMiddleware, async (req, res) => {
  try {
    // Get user data from the database to ensure we have the most up-to-date information
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).send("User not found");
    }
    
    res.render('officials-profile', { user });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Profile update route for officials
app.post('/officials-profile/update', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, department } = req.body;
    
    // Update user data
    await User.findByIdAndUpdate(req.user._id, {
      name,
      email,
      phone,
      department
    });
    
    res.redirect('/officials-profile');
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).send("Error updating profile");
  }
});

app.get("/officials-project", (req, res) => {
  res.render('officials-project', { query: req.query });
});

app.get("/admin-users", async (req, res) => {
  try {
    const users = await User
      .find({}, 'name email phone role createdAt isActive lastLogin') // Projection
      .sort({ createdAt: -1 }) // Sort by latest first
      .lean(); // Convert to plain JS object

    // Format lastLogin to a more readable format
    users.forEach(user => {
      user.lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never";

      // Set the user status based on the isActive field (assuming isActive is a boolean)
      if (user.isActive === true || user.isActive === "true" || user.isActive === 1) {
        user.status = "Active";
      } else {
        user.status = "Inactive";
      }
    });

    res.render("admin-users", { users }); // Pass the users variable, not User
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).send("Error fetching user details.");
  }
});

app.post("/add-user", async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    // Validate input
    if (!name || !email || !phone || !role || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingUser) {
      return res.status(400).send("User with this email or phone already exists.");
    }

    // Restrict multiple Admins
    if (role === "Admin") {
      const existingAdmin = await User.findOne({ role: "Admin" });
      if (existingAdmin) {
        return res.status(403).send("An Admin already exists. You cannot create another.");
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({ name, email, phone, role, password: hashedPassword });
    await newUser.save();

    res.redirect("/admin-users"); // Redirect to the users page after adding
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/edit-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.render("edit-user", { user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/edit-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, phone, role } = req.body;

    // Validate input
    if (!name || !email || !phone || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Optionally check for email/phone uniqueness on edit
    const existingUser = await User.findOne({
      _id: { $ne: userId },
      $or: [{ email }, { phone }],
    });
    if (existingUser) {
      return res.status(400).send("Another user with this email or phone already exists.");
    }

    // Prevent changing to Admin if one already exists
    if (role === "Admin") {
      const existingAdmin = await User.findOne({ role: "Admin", _id: { $ne: userId } });
      if (existingAdmin) {
        return res.status(403).send("An Admin already exists. You cannot create another.");
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, phone, role },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.redirect("/admin-users");
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/delete-user/:id",authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.send("User not found");
    }

    res.redirect("/admin-users"); 
  } catch (error) {
    console.error(error);
    res.send("Error deleting user");
  }
});

//submit project to Minister 
app.post("/submit-project", authMiddleware, (req, res) => {
  upload.single("projectFile")(req, res, async (err) => {
    try {
      // Handle file upload errors
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.cookie('errorMessage', 'File size exceeds the 5MB limit', { maxAge: 5000, httpOnly: true });
          return res.redirect('/officials-project');
        }
        res.cookie('errorMessage', err.message || 'File upload failed', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }
      
      const { projectName, allocatedFund, department, startDate, projectDeadline, projectDetails, latitude, longitude } = req.body;
      const filePath = req.file ? req.file.filename : null;

      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized: Please log in first" });
      }

      // Validate project input
      if (isNaN(allocatedFund) || allocatedFund <= 0) {
        res.cookie('errorMessage', 'Invalid allocated fund amount', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      if (!department) {
        res.cookie('errorMessage', 'Invalid department provided', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      if (new Date(projectDeadline) <= new Date(startDate)) {
        res.cookie('errorMessage', 'Project deadline must be after the start date', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      // Validate Latitude and Longitude
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (isNaN(lat) || isNaN(lng)) {
          res.cookie('errorMessage', 'Invalid latitude or longitude values', { maxAge: 5000, httpOnly: true });
          return res.redirect('/officials-project');
        }
      }

      if (!filePath) {
        res.cookie('errorMessage', 'File attachment is required', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      const existingProject = await Project.findOne({ projectName, department });

      if (existingProject) {
        res.cookie('errorMessage', 'A project with this name already exists in this department', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      const duplicateProject = await Project.findOne({
        projectName,
        allocatedFund,
        department,
        startDate,
        projectDeadline,
        projectDetails
      });

      if (duplicateProject) {
        res.cookie('errorMessage', 'This project proposal has already been submitted', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      const departmentFund = await DepartmentFund.findOne({ department }).lean();

      if (!departmentFund || allocatedFund > departmentFund.remainingFund) {
        res.cookie('errorMessage', 'Insufficient funds in the department', { maxAge: 5000, httpOnly: true });
        return res.redirect('/officials-project');
      }

      // Create new project
      const project = new Project({
        projectName,
        allocatedFund,
        department,
        startDate,
        projectDeadline,
        projectDetails,
        location: {
          type: 'Point',
          coordinates: [
            longitude ? parseFloat(longitude) : 0, // Longitude first in GeoJSON
            latitude ? parseFloat(latitude) : 0    // Latitude second in GeoJSON
          ]
        },
        requestedBy: req.user._id,
        requestedByName: req.user.name,
        status: "Pending",
        progress: 0,
        fileAttachment: req.file?.filename,
      });

      await project.save();

      // Set success message in a cookie instead of query parameter
      res.cookie('successMessage', 'Project submitted successfully', { 
        maxAge: 5000, // 5 seconds
        httpOnly: true 
      });
      return res.redirect('/officials-project');
    } catch (error) {
      console.error("Error adding project:", error.message);
      
      // Set error message in a cookie instead of query parameter
      res.cookie('errorMessage', 'Failed to submit project: ' + (error.message || 'Unknown error'), { 
        maxAge: 5000, // 5 seconds
        httpOnly: true 
      });
      return res.redirect('/officials-project');
    }
  });
});


app.get("/officials-project-progress", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/login?error=Please log in to access project progress");
    }

    
    const projects = await Project.find({ requestedBy: req.user._id }) 
      .sort({ createdAt: -1 })
      .lean();

    res.render("officials_project_progress", {
      projects,
      success: req.query.success || "",
      error: req.query.error || ""
    });

  } catch (error) {
    console.error("Error fetching project progress:", error.message);
    res.status(500).send("Server Error");
  }
});

app.get('/get-project/:projectId',authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ 
      questionAnswers: project.questionAnswers,
      billFiles: project.billFiles || {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/update-progress/:projectId', authMiddleware, (req, res) => {
  // Use multer middleware for file uploads
  upload.fields([
    { name: 'bill-file-0', maxCount: 1 },
    { name: 'bill-file-1', maxCount: 1 },
    { name: 'bill-file-2', maxCount: 1 },
    { name: 'bill-file-3', maxCount: 1 },
    { name: 'bill-file-4', maxCount: 1 },
    { name: 'bill-file-5', maxCount: 1 },
    { name: 'bill-file-6', maxCount: 1 },
    { name: 'bill-file-7', maxCount: 1 },
    { name: 'bill-file-8', maxCount: 1 },
    { name: 'bill-file-9', maxCount: 1 }
  ])(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ success: false, error: 'File upload error: ' + err.message });
    }

    try {
      const { projectId } = req.params;
      // Parse answers from FormData
      const answers = req.body.answers ? JSON.parse(req.body.answers) : {};

      // Validate the answers object
      if (typeof answers !== 'object') {
        return res.status(400).json({ error: 'Invalid answers format' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.status !== "Approved") {
        return res.status(400).json({ error: "Project must be approved before updating progress." });
      }

      // Initialize billFiles object if it doesn't exist
      if (!project.billFiles) {
        project.billFiles = {};
      }

      // Check for mandatory bill attachments for all 'Yes' answers
      const missingAttachments = [];
      for (let i = 0; i < 10; i++) {
        const index = i.toString();
        // If answer is 'Yes' but no file was uploaded
        if (answers[index] === true) {
          const fieldName = `bill-file-${i}`;
          if (!req.files[fieldName] || !req.files[fieldName][0]) {
            missingAttachments.push(i + 1); // Store question number (1-indexed for user display)
          }
        }
      }
      
      // If any required attachments are missing, return an error
      if (missingAttachments.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Bill attachment required for question(s): ${missingAttachments.join(', ')}. Please attach all required documents.` 
        });
      }
      
      // Process uploaded files (at this point, we know all required files are present)
      for (let i = 0; i < 10; i++) {
        const index = i.toString();
        if (answers[index] === true) {
          const fieldName = `bill-file-${i}`;
          const file = req.files[fieldName][0];
          project.billFiles[index] = file.filename;
          console.log(`Saved bill file for question ${i}: ${file.filename}`);
        }
      }

      // Merge the provided answers with existing ones
      Object.keys(answers).forEach((index) => {
        const idx = parseInt(index, 10);
        if (idx >= 0 && idx < 10) {
          project.questionAnswers[idx] = answers[index];
        }
      });

      // Recalculate progress
      const progressCount = project.questionAnswers.filter(answer => answer === true).length;
      project.progress = progressCount * 10; // Each true answer gives 10%

      // Update progressStatus based on progress value
      if (project.progress === 100) {
        project.progressStatus = "Completed";
        project.actualCompletionDate = new Date(); 
      } else if (project.progress > 0) {
        project.progressStatus = "Ongoing";
      }
      
      // Ensure location coordinates are set to prevent validation errors
      if (!project.location || !project.location.coordinates || project.location.coordinates.length === 0) {
        project.location = {
          type: 'Point',
          coordinates: [0, 0] // Default coordinates if none exist
        };
      }

      await project.save();

      // Emit progress update via Socket.IO
      const io = req.app.get("io");
      io.emit('project-progress-update', {
        projectId: project._id,
        progress: project.progress,
        progressStatus: project.progressStatus
      });

      res.json({
        success: true,
        progress: project.progress,
        progressStatus: project.progressStatus,
        questionAnswers: project.questionAnswers,
        billFiles: project.billFiles
      });
    } catch (err) {
      console.error("Error updating project progress:", err);
      res.status(500).json({ success: false, error: 'Server error: ' + err.message });
    }
  });
});

app.get('/admin-request', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({ status: { $nin: ["Approved", "Rejected"] } })
      .sort({ createdAt: -1 })
      .populate("requestedBy", "name")
      .populate("projectName"); 

    res.render('admin-request', { projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to Approve Project
app.post("/approve-project/:id", authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId).exec();

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const deptFund = await DepartmentFund.findOne({ department: project.department }).exec();
    if (!deptFund) {
      return res.status(404).json({ success: false, message: "Department funds record not found" });
    }

    if (deptFund.remainingFund < project.allocatedFund) {
      return res.status(400).json({ success: false, message: "Insufficient funds in the department" });
    }

    // Update department funds
    deptFund.usedFund += project.allocatedFund;
    deptFund.remainingFund = deptFund.totalFund - deptFund.usedFund;
    await deptFund.save();

    // Approve project
    project.status = "Approved";
    project.progressStatus = "Ongoing";
    console.log("User performing action:", req.user);
    project.actionBy = req.user._id; // User ID who performed the action
    console.log("Action By:", project.actionBy);
    project.actionDate = new Date();
    project.updatedAt = new Date();
    await project.save();

    const message = `Project "${project.projectName}" has been approved.`;
    await Notification.create({
      projectId: project._id,
      message,
      status: "Approved",
      recipientRole: "Government Official",
    });

    const io = req.app.get("io");
    io.emit("new-notification", { message, status: "Approved" });

    res.json({ success: true, message: "Project approved successfully!" });
  } catch (error) {
    console.error("Error approving project:", error.message);
    res.status(500).json({ success: false, message: "Failed to approve the project." });
  }
});

// Route to Reject Project
app.post("/reject-project/:id", authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { reason } = req.body;

    const project = await Project.findById(projectId).exec();
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    project.status = "Rejected";
    project.rejectionReason = reason || "";
    console.log("User performing action:", req.user);
    project.actionBy = req.user._id; // User ID who performed the action
    project.actionDate = new Date();
    project.updatedAt = new Date();
    await project.save();

    const message = `Project "${project.projectName}" has been rejected. ${reason ? "Reason: " + reason : ""}`;
    await Notification.create({
      projectId: project._id,
      message,
      status: "Rejected",
      recipientRole: "Government Official",
    });

    const io = req.app.get("io");
    io.emit("new-notification", { message, status: "Rejected" });

    res.json({ success: true, message: "Project rejected successfully" });
  } catch (error) {
    console.error("Error rejecting project:", error.message);
    res.status(500).json({ success: false, message: "Failed to reject the project." });
  }
});


const generateBillForProject = async (project) => {
  try {
    // Create bills directory if it doesn't exist
    const billsDir = path.join(__dirname, 'public', 'bills');
    try {
      if (!fs.existsSync(billsDir)) {
        fs.mkdirSync(billsDir, { recursive: true });
        console.log(`Created bills directory at: ${billsDir}`);
      }
    } catch (dirError) {
      console.error(`Error creating bills directory: ${dirError.message}`);
      throw new Error(`Could not create bills directory: ${dirError.message}`);
    }

    // Generate unique filename without special characters
    const cleanId = String(project._id).replace(/[^a-zA-Z0-9]/g, '');
    const billFileName = `bill_${cleanId}_${Date.now()}.pdf`;
    const billFullPath = path.join(billsDir, billFileName);
    
    console.log(`Preparing to generate bill at: ${billFullPath}`);

    // Create document with error handling
    let doc;
    try {
      doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Bill for ${project.projectName}`,
          Author: 'Government Fund Allocation System',
          Subject: 'Project Bill'
        }
      });
    } catch (pdfError) {
      console.error(`Error creating PDF document: ${pdfError.message}`);
      throw new Error(`Failed to create PDF document: ${pdfError.message}`);
    }

    // Create write stream with error handling
    let stream;
    try {
      stream = fs.createWriteStream(billFullPath);
      
      // Add error handlers to the stream
      stream.on('error', (error) => {
        console.error(`Error with write stream: ${error.message}`);
        throw error;
      });
      
      doc.pipe(stream);
    } catch (streamError) {
      console.error(`Error creating write stream: ${streamError.message}`);
      throw new Error(`Failed to create file stream: ${streamError.message}`);
    }

    // Header
    doc.fontSize(24).text("Government Fund Allocation Bill", { align: "center" });
    doc.moveDown();

    // Add a horizontal line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    doc.moveDown();

    // Project details
    doc.fontSize(16).text("Project Details", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Project Name: ${project.projectName}`);
    doc.text(`Department: ${project.department}`);
    doc.text(`Allocated Fund: $${project.allocatedFund.toLocaleString()}`);
    doc.moveDown();

    // Approval details
    doc.fontSize(16).text("Approval Details", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Approved By: ${project.actionBy && project.actionBy.name ? project.actionBy.name : 'N/A'}`);
    doc.text(`Approval Date: ${project.actionDate ? new Date(project.actionDate).toLocaleDateString() : 'N/A'}`);
    doc.text(`Bill Generated On: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Add footer
    doc.fontSize(10).text(`This is an official document generated on ${new Date().toLocaleString()}`, {
      align: 'center',
      color: 'gray'
    });

    // Finalize the PDF and end the stream with careful error handling
    try {
      doc.end();
    } catch (docEndError) {
      console.error(`Error ending PDF document: ${docEndError.message}`);
      throw new Error(`Failed to finalize PDF: ${docEndError.message}`);
    }

    // Return a promise that resolves when the stream is finished
    return new Promise((resolve, reject) => {
      stream.on("finish", () => {
        // Store path as /bills/filename.pdf (without 'public')
        const relativePath = `/bills/${billFileName}`;
        console.log(`Bill generated successfully. Relative path: ${relativePath}`);
        
        // Verify that the file was actually created
        if (!fs.existsSync(billFullPath)) {
          console.error(`File verification failed: ${billFullPath} does not exist`);
          reject(new Error("Bill file was not created successfully"));
          return;
        }
        
        const fileSize = fs.statSync(billFullPath).size;
        console.log(`File size: ${fileSize} bytes`);
        
        if (fileSize === 0) {
          console.error("Generated file is empty (0 bytes)");
          reject(new Error("Generated bill file is empty"));
          return;
        }
        
        resolve(relativePath);
      });
      
      stream.on("error", (error) => {
        console.error(`Stream error generating bill: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Bill generation failed: ${error.message}`);
    console.error(error.stack); // Log the full stack trace
    throw error; // Rethrow to be handled by the calling function
  }
};

// Track ongoing bill generations to prevent duplicates
const ongoingBillGenerations = new Set();

// Keep only this real implementation
app.post("/generate-bill/:id", authMiddleware, async (req, res) => {
  const projectId = req.params.id;
  console.log(`Bill generation requested for project ID: ${projectId}`);
  
  // Check if bill generation is already in progress for this project
  if (ongoingBillGenerations.has(projectId)) {
    console.log(`Bill generation already in progress for project ID: ${projectId}`);
    return res.status(429).json({
      success: false,
      message: "Bill generation already in progress for this project"
    });
  }
  
  // Add project to ongoing generations set
  ongoingBillGenerations.add(projectId);
  
  try {
    // Verify user role
    if (req.user.role !== "Minister") {
      console.log(`Unauthorized bill generation attempt by user role: ${req.user.role}`);
      // Remove from ongoing generations on error
      ongoingBillGenerations.delete(projectId);
      return res.status(403).json({ 
        success: false, 
        message: "Only ministers can generate bills." 
      });
    }

    // Fetch project with all necessary data
    console.log(`Fetching project data for ID: ${req.params.id}`);
    const project = await Project.findById(req.params.id)
      .populate('actionBy', 'name')
      .populate('requestedBy', 'name email');

    if (!project) {
      console.log(`Project not found with ID: ${req.params.id}`);
      // Remove from ongoing generations on error
      ongoingBillGenerations.delete(projectId);
      return res.status(404).json({ 
        success: false, 
        message: "Project not found." 
      });
    }

    console.log(`Project status: ${project.status}`);
    if (project.status !== "Approved") {
      // Remove from ongoing generations on error
      ongoingBillGenerations.delete(projectId);
      return res.status(400).json({ 
        success: false, 
        message: "Only approved projects can have bills generated." 
      });
    }

    console.log(`Project bill status: ${project.billFilePath ? 'Bill exists' : 'No bill'}`);
    if (project.billFilePath) {
      // Remove from ongoing generations on error
      ongoingBillGenerations.delete(projectId);
      return res.status(400).json({ 
        success: false, 
        message: "Bill already generated." 
      });
    }

    console.log(`Starting bill generation for project: ${project.projectName} (${project._id})`);
    
    // Generate the bill PDF
    let billPath;
    try {
      billPath = await generateBillForProject(project);
      console.log(`Bill successfully generated at path: ${billPath}`);
    } catch (billGenError) {
      console.error(`Error during bill generation: ${billGenError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: `Bill generation failed: ${billGenError.message}` 
      });
    }
    
    // Verify the file was created
    const absoluteBillPath = path.join(__dirname, 'public', billPath.replace(/^\/+/, ''));
    console.log(`Checking for bill file at: ${absoluteBillPath}`);
    
    const fileExists = fs.existsSync(absoluteBillPath);
    console.log(`Bill file exists: ${fileExists}`);
    
    if (!fileExists) {
      console.error(`Bill file not found at path: ${absoluteBillPath}`);
      return res.status(500).json({ 
        success: false, 
        message: "Bill generation failed: File not created" 
      });
    }

    const fileSize = fs.statSync(absoluteBillPath).size;
    console.log(`Bill file size: ${fileSize} bytes`);
    
    if (fileSize === 0) {
      console.error(`Bill file is empty (0 bytes): ${absoluteBillPath}`);
      return res.status(500).json({ 
        success: false, 
        message: "Bill generation failed: File is empty" 
      });
    }

    // Update project with bill information
    console.log(`Updating project with bill information...`);
    try {
      project.billGenerated = true;
      project.billGeneratedAt = new Date();
      project.billFilePath = billPath; // Store the relative path
      project.billGeneratedBy = req.user._id;
      
      await project.save();
      console.log(`Project ${project._id} updated with bill path: ${billPath}`);
    } catch (saveError) {
      console.error(`Error saving project with bill info: ${saveError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: `Failed to update project with bill info: ${saveError.message}` 
      });
    }

    // Create notification only for the specific official who requested the project
    try {
      if (project.requestedBy && project.requestedBy._id) {
        console.log(`Creating notification for requesting official ID: ${project.requestedBy._id}...`);
        await Notification.create({
          projectId: project._id,
          message: `Bill for project "${project.projectName}" has been generated and is ready for review.`,
          status: "BillGenerated",
          recipientId: project.requestedBy._id, // Send only to the specific official
          recipientRole: "Government Official",
        });
        console.log(`Notification created for project ${project._id} for official ${project.requestedBy._id}`);
      } else {
        console.log(`No requesting official found for project ${project._id}, skipping notification`);
      }
    } catch (notificationError) {
      console.warn(`Warning: Failed to create notification: ${notificationError.message}`);
      // Continue even if notification creation fails
    }

    // Emit notification via socket.io only to the specific official using rooms
    try {
      if (project.requestedBy && project.requestedBy._id) {
        console.log(`Emitting socket notification to specific official...`);
        const io = req.app.get("io");
        const officialId = project.requestedBy._id.toString();
        
        // Send to the specific user's room
        io.to(`user-${officialId}`).emit("targeted-notification", { 
          message: `Bill for project "${project.projectName}" has been generated.`, 
          status: "BillGenerated"
        });
        
        console.log(`Socket notification emitted for project ${project._id} to official ${officialId} room`);
      } else {
        console.log(`No requesting official found for project ${project._id}, skipping socket notification`);
      }
    } catch (socketError) {
      console.warn(`Warning: Socket emit failed: ${socketError.message}`);
      // Continue even if socket emit fails
    }
    
    // Remove project from ongoing generations set
    ongoingBillGenerations.delete(projectId);

    // Send bill to the specific official who requested the project
    try {
      console.log(`Preparing to send bill via email...`);
      
      // Check if the project has a requestedBy field with a valid user
      if (!project.requestedBy || !project.requestedBy.email) {
        console.warn(`No requesting official found or no email available for project: ${project._id}`);
      } else {
        // Get the absolute path to the bill file
        const absoluteBillPath = path.join(__dirname, 'public', billPath.replace(/^\/+/, ''));
        
        // Prepare email content with personalized greeting
        const officialName = project.requestedBy.name || 'Government Official';
        const emailSubject = `New Bill Generated for Your Project: ${project.projectName}`;
        const emailText = `
          Dear ${officialName},

          A bill has been generated for your project "${project.projectName}" in the ${project.department} department. This is an automated message. Please do not reply to this email.

          Regards,
          Government Fund Allocation System
        `;
        
        // Send email with bill attachment to the specific official
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: project.requestedBy.email,
          subject: emailSubject,
          text: emailText,
          attachments: [
            {
              filename: path.basename(absoluteBillPath),
              path: absoluteBillPath
            }
          ]
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`Bill email sent successfully to ${project.requestedBy.name} (${project.requestedBy.email})`);
      }
    } catch (emailError) {
      console.warn(`Warning: Failed to send bill via email: ${emailError.message}`);
      // Continue even if email sending fails
    }

    // Respond with success
    console.log(`Bill generation process completed successfully for project ${project._id}`);
    res.status(200).json({ 
      success: true, 
      message: "Bill generated successfully", 
      billPath: billPath,
      projectId: project._id
    });
  } catch (err) {
    console.error("Error in bill generation route:", err);
    console.error(err.stack); // Log the full stack trace
    res.status(500).json({ 
      success: false, 
      message: `Failed to generate bill: ${err.message}` 
    });
  }
});

// Route to serve the bill to officials
app.get("/officials-bill/:id", authMiddleware, async (req, res) => {
  try {
    // Only allow Government Officials to access this page
    if (req.user.role !== "Government Official") {
      return res.status(403).send("Access denied. Only Government Officials can view bill details.");
    }
    
    const projectId = req.params.id;
    console.log(`Bill view requested for project ID: ${projectId}`);
    
    const project = await Project.findById(projectId)
      .populate("requestedBy", "name")
      .populate("actionBy", "name")
      .populate("billGeneratedBy", "name");
    
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return res.status(404).send("Project not found");
    }
    
    // Check if the current user is the one who requested this project
    if (project.requestedBy && project.requestedBy._id && 
        project.requestedBy._id.toString() !== req.user._id.toString()) {
      console.error(`Access denied: User ${req.user._id} attempted to view bill for project requested by ${project.requestedBy._id}`);
      return res.status(403).send("Access denied. You can only view bills for projects you requested.");
    }
    
    if (!project.billFilePath) {
      console.error(`Bill not found for project: ${projectId}`);
      return res.status(404).send("Bill has not been generated for this project");
    }

    // Log bill path information
    console.log(`Bill path in database: ${project.billFilePath || 'Not generated'}`);
    
    // Remove leading slash if present
    const relativeBillPath = project.billFilePath.replace(/^\/+/, '');
    const fullPath = path.join(__dirname, 'public', relativeBillPath);
    console.log(`Full bill path: ${fullPath}`);
    
    // Check if bill file actually exists
    const billExists = fs.existsSync(fullPath);
    console.log(`Bill file exists: ${billExists}`);

    // Format dates for display
    const formattedProject = {
      ...project.toObject(),
      startDate: project.startDate ? new Date(project.startDate).toLocaleDateString() : "N/A",
      projectDeadline: project.projectDeadline ? new Date(project.projectDeadline).toLocaleDateString() : "N/A",
      actionDate: project.actionDate ? new Date(project.actionDate).toLocaleDateString() : "N/A",
      billGeneratedAt: project.billGeneratedAt ? new Date(project.billGeneratedAt).toLocaleDateString() : "N/A",
      billPath: project.billFilePath, // Use the stored path directly
      billExists: billExists // Pass this info to template
    };

    // Render with hyphenated template name
    res.render("officials-bill", { project: formattedProject });
  } catch (error) {
    console.error(`Error retrieving bill: ${error.message}`);
    res.status(500).send("Error retrieving bill");
  }
});

// Route to serve the bill list page to officials - only shows bills for projects they requested
app.get("/officials-bill", authMiddleware, async (req, res) => {
  try {
    // Only allow Government Officials to access this page
    if (req.user.role !== "Government Official") {
      return res.status(403).send("Access denied. Only Government Officials can view bills.");
    }
    
    console.log(`Fetching bills for user ID: ${req.user._id}`);
    
    // Only fetch projects that were requested by the current user and have bills generated
    const projects = await Project.find({ 
      requestedBy: req.user._id,
      billGenerated: true,
      billFilePath: { $exists: true, $ne: null }
    })
    .populate("billGeneratedBy", "name")
    .populate("actionBy", "name")
    .lean();
    
    console.log(`Found ${projects.length} bills for user ${req.user._id}`);
    
    // Format dates for display
    const formattedProjects = projects.map(project => ({
      ...project,
      billGeneratedAt: project.billGeneratedAt ? new Date(project.billGeneratedAt).toLocaleDateString() : "N/A",
      billGeneratedBy: project.billGeneratedBy ? project.billGeneratedBy.name : "N/A"
    }));
    
    // Render the bill list page with only the current user's bills
    res.render("officials_bill_list", { projects: formattedProjects });
  } catch (error) {
    console.error(`Error retrieving bills: ${error.message}`);
    res.status(500).send("Error retrieving bills");
  }
});

// Route to download the bill - also restricted to officials
app.get("/download-bill/:id", authMiddleware, async (req, res) => {
  try {
    // Only allow Government Officials to download bills
    if (req.user.role !== "Government Official") {
      return res.status(403).send("Access denied. Only Government Officials can download bills.");
    }
    
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.billFilePath) {
      console.error(`Bill not found for project ID: ${req.params.id}`);
      return res.status(404).send("Bill not found in database");
    }
    
    // Clean up the relative path by removing the leading slash
    const relativeBillPath = project.billFilePath.replace(/^\/+/, '');
    
    // Construct the full file path in public directory
    const fullPath = path.join(__dirname, 'public', relativeBillPath);
    
    console.log(`Bill download requested for project: ${project.projectName}`);
    console.log(`Relative bill path: ${relativeBillPath}`);
    console.log(`Full bill path: ${fullPath}`);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`Bill file not found at: ${fullPath}`);
      
      // Check if the bills directory exists
      const billsDir = path.join(__dirname, 'public', 'bills');
      const billsDirExists = fs.existsSync(billsDir);
      console.log(`Bills directory exists: ${billsDirExists}, path: ${billsDir}`);
      
      if (billsDirExists) {
        try {
          // List files in bills directory for debugging
          const files = fs.readdirSync(billsDir);
          console.log(`Files in bills directory: ${files.join(', ')}`);
        } catch (err) {
          console.error(`Error reading bills directory: ${err.message}`);
        }
      }
      
      return res.status(404).send("Bill file not found on server. Please contact administrator.");
    }
    
    // Set download file name
    const downloadName = `${project.projectName}_Bill_${Date.now()}.pdf`;
    
    // Send the file as a download
    res.download(fullPath, downloadName, (err) => {
      if (err) {
        console.error(`Error during download: ${err.message}`);
        // Only send error if headers not sent yet
        if (!res.headersSent) {
          return res.status(500).send("Error downloading bill file");
        }
      }
    });
  } catch (error) {
    console.error(`Error in download-bill route: ${error.message}`);
    return res.status(500).send("Server error while processing bill download");
  }
});

// Route to view the bill directly in the browser
app.get("/view-bill/:id", authMiddleware, async (req, res) => {
  try {
    // Only allow Government Officials to view bills
    if (req.user.role !== "Government Official") {
      return res.status(403).send("Access denied. Only Government Officials can view bills.");
    }
    
    const project = await Project.findById(req.params.id);
    
    if (!project || !project.billFilePath) {
      return res.status(404).send("Bill not found in database");
    }
    
    // Clean up the relative path by removing the leading slash
    const relativeBillPath = project.billFilePath.replace(/^\/+/, '');
    
    // Construct the full file path in public directory
    const fullPath = path.join(__dirname, 'public', relativeBillPath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`Bill file not found at: ${fullPath}`);
      return res.status(404).send("Bill file not found on server.");
    }
    
    // Set content-type for inline viewing in browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="bill.pdf"');
    
    // Send the file to be displayed in the browser
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    console.error(`Error viewing bill: ${error.message}`);
    return res.status(500).send("Error viewing bill file");
  }
});

app.get('/officials-bill',authMiddleware, async (req, res) => {
  try {
    // Only allow Government Officials to access this page
    if (req.user.role !== "Government Official") {
      return res.status(403).send("Access denied. Only Government Officials can view bills.");
    }

    // Find all projects with generated bills
    const projectsWithBills = await Project.find({ 
      status: "Approved", 
      billFilePath: { $ne: null } 
    })
    .populate("requestedBy", "name")
    .populate("actionBy", "name")
    .populate("billGeneratedBy", "name")
    .sort({ billGeneratedAt: -1 });

    // Format data for display
    const formattedProjects = projectsWithBills.map(project => ({
      _id: project._id,
      projectName: project.projectName,
      department: project.department,
      allocatedFund: project.allocatedFund,
      requestedBy: project.requestedBy ? project.requestedBy.name : "Unknown",
      approvedBy: project.actionBy ? project.actionBy.name : "Unknown",
      approvalDate: project.actionDate ? new Date(project.actionDate).toLocaleDateString() : "Unknown",
      billGeneratedAt: project.billGeneratedAt ? new Date(project.billGeneratedAt).toLocaleDateString() : "Unknown",
      billGeneratedBy: project.billGeneratedBy ? project.billGeneratedBy.name : "Unknown"
    }));

    res.render("officials_bill_list", { projects: formattedProjects });
  } catch (error) {
    console.error("Error retrieving bills:", error);
    res.status(500).send("Error retrieving bills");
  }
});

// Route for minister confirmation after bill generation
app.get("/bill-generated/:id", authMiddleware, async (req, res) => {
  console.log(`Bill confirmation page requested for project ID: ${req.params.id}`);
  try {
    // Only allow Ministers to access this page
    if (req.user.role !== "Minister") {
      console.log(`Unauthorized access attempt by user role: ${req.user.role}`);
      return res.status(403).send("Access denied. Only Ministers can view this page.");
    }
    
    // Find project with bill information
    console.log(`Fetching project with ID: ${req.params.id}`);
    const project = await Project.findById(req.params.id)
      .populate("requestedBy", "name")
      .populate("actionBy", "name")
      .populate("billGeneratedBy", "name");
    
    if (!project) {
      console.log(`Project not found with ID: ${req.params.id}`);
      return res.status(404).send("Project not found");
    }
    
    console.log(`Project bill path: ${project.billFilePath || 'Not generated'}`);
    if (!project.billFilePath) {
      console.log(`No bill found for project: ${req.params.id}`);
      return res.status(404).send("Bill has not been generated for this project");
    }
    
    // Verify bill file exists
    const absoluteBillPath = path.join(__dirname, 'public', project.billFilePath.replace(/^\/+/, ''));
    console.log(`Checking bill file at: ${absoluteBillPath}`);
    
    if (!fs.existsSync(absoluteBillPath)) {
      console.error(`Bill file not found at path: ${absoluteBillPath}`);
      return res.status(404).send("Bill file not found. Please try generating the bill again.");
    }
    
    console.log(`Rendering bill confirmation page for project: ${project.projectName}`);
    res.render("minister_bill_generated", { 
      project,
      billUrl: project.billFilePath
    });
  } catch (error) {
    console.error("Error displaying bill confirmation:", error);
    res.status(500).send(`Error displaying bill confirmation: ${error.message}`);
  }
});

app.get('/minister/bill-generated/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const project = await Project.findById(projectId);

  if (!project || !project.billFilePath) {
      return res.status(404).send('Bill not found');
  }

  res.render('minister-confirmation', { project });
});


app.get('/minister-request', authMiddleware, async (req, res) => {
  try {
    // Only show pending projects and approved projects that don't have bills generated yet
    const projects = await Project.find({
      $or: [
        { status: "Pending" },
        { status: "Approved", billFilePath: null } // Don't show projects with bills already generated
      ]
    })
    .sort({ createdAt: -1 })
    .populate("requestedBy", "name")
    .populate("projectName");
     
    res.render('minister-request', { projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/officials-notification", authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role;  // Assuming the role is stored in the user object after login

    // Fetch Approval or Rejection notifications for the logged-in user
    const approvalNotifications = await Notification.find({
      recipientRole: userRole,  // Filter by role
      status: { $in: ["Approved", "Rejected"] }
    })
      .populate("projectId", "name")
      .lean();

    // Fetch Deadline Alert notifications for the logged-in user
    const deadlineNotifications = await Notification.find({
      recipientRole: userRole,  // Filter by role
      status: "DeadlineAlert"    // Use the updated status for deadline notifications
    })
      .populate("projectId", "name")
      .lean();

    res.render("officials-notification", {
      notifications: {
        approval: approvalNotifications || [],
        deadline: deadlineNotifications || []
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get('/project-details/:id',authMiddleware, async (req, res) => {
  try {
      const projectId = req.params.id;

      if (!projectId) {
          return res.status(400).json({ success: false, message: "Invalid project ID." });
      }

      const project = await Project.findById(projectId).lean(); // Use .lean() for better performance if you don't need Mongoose docs

      if (!project) {
          return res.status(404).json({ success: false, message: "Project not found." });
      }
      res.json({
          success: true,
          projectDetails: project.projectDetails,
      });

  } catch (error) {
      console.error('Error fetching project details:', error.message);
      res.status(500).json({ success: false, message: "Error fetching project details." });
  }
});

app.get('/admin-history', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({ status: { $in: ["Approved", "Rejected"] } })
      .populate("requestedBy", "name")
      .populate("actionBy", "name") 
      .sort({ updatedAt: -1 });

    res.render('admin-history', { projects });
  } catch (error) {
    console.error("Error fetching admin history:", error);
    res.status(500).send("Internal Server Error");
  }
});


async function getNotifications(filters) {
  return Notification.find(filters).sort({ createdAt: -1 }).lean(); // Sorting by createdAt in descending order
}

async function sendAdminNotification(message, status) {
  try {
    const notification = new Notification({
      message,
      status,
      recipientRole: 'Admin',
      isRead: false
    });
    await notification.save();

    // Emit notification to all connected Admin clients using socket
    io.emit('newAdminNotification', notification);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// Function to update department funds and send a notification if funds are low
async function updateDepartmentFund(departmentId, newFundValue) {
  try {
    // Find the department and update the fund value
    const department = await DepartmentFund.findById(departmentId);
    if (!department) throw new Error("Department not found");

    // Update the fund value
    department.remainingFund = newFundValue;
    await department.save();

    // Check if the fund is below the threshold after update
    if (newFundValue < 10000) {
      // Send a notification immediately if the fund is below 10,000
      const message = `Warning: Funds for ${department.department} are below 10,000.`;
      await sendAdminNotification(message, 'Warning');
      
      // Use the fund alert handler to emit the socket notification
      fundAlertHandler.emitFundAlert(department.department, newFundValue);
    }

  } catch (error) {
    console.error("Error updating department fund:", error);
  }
}

// Endpoint to get admin notifications (render view)
app.get('/admin-notifications',authMiddleware, async (req, res) => {
  try {
    const notifications = await getNotifications({ recipientRole: 'Admin' });
    res.render('admin-notifications', { notifications });
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch notifications' });
  }
});

express.application.get("/protected-route", authMiddleware, (req, res) => {
  res.json({ message: "Access granted!", user: req.user });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.redirect("/login");  // Redirect to login page after logging out
});


app.get("/project-timeline-data", authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const projects = await Project.find({
      createdAt: { $gte: startDate },
      status: "Approved"
    }).select('projectName allocatedFund createdAt').lean();
  
    const projectMap = {};
    
    projects.forEach(project => {
      if (!projectMap[project.projectName]) {
        projectMap[project.projectName] = {
          name: project.projectName,
          allocations: []
        };
      }
      
      projectMap[project.projectName].allocations.push({
        date: project.createdAt,
        amount: project.allocatedFund
      });
    });
    
    // Convert map to array
    const projectsArray = Object.values(projectMap);
    
    res.json({ projects: projectsArray });
  } catch (error) {
    console.error("Error fetching project timeline data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Projects with location data for maps
app.get("/active-project-locations", authMiddleware, async (req, res) => {
  try {
    // Find approved projects that have location data (both ongoing and completed)
    const projects = await Project.find({
      status: "Approved",
      progressStatus: { $in: ["Ongoing", "Completed"] },
      "location.coordinates.0": { $ne: 0 },
      "location.coordinates.1": { $ne: 0 }
    }).select('_id projectName department allocatedFund startDate projectDeadline location progress progressStatus actualCompletionDate projectDetails requestedBy')
    .lean();
    
    // Format date and prepare response
    const projectsWithFormattedDates = projects.map(project => ({
      ...project,
      startDateFormatted: new Date(project.startDate).toLocaleDateString(),
      projectDeadlineFormatted: new Date(project.projectDeadline).toLocaleDateString(),
      completionDateFormatted: project.actualCompletionDate ? new Date(project.actualCompletionDate).toLocaleDateString() : null
    }));
    
    res.json({ projects: projectsWithFormattedDates });
  } catch (error) {
    console.error("Error fetching project locations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Profile update route for ministers
app.post('/minister-profile/update', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    // Update user data
    await User.findByIdAndUpdate(req.user._id, {
      name,
      email,
      phone
    });
    
    res.redirect('/minister-profile');
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).send("Error updating profile");
  }
});

app.get('/minister-profile', authMiddleware, async (req, res) => {
  try {

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).send("User not found");
    }
    
    res.render('minister-profile', { user });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post('/test-deadline-notification', authMiddleware, async (req, res) => {
  try {
    const newNotification = await Notification.create({
      projectId: req.user._id, // Using user ID as a placeholder for project ID
      message: ` Project "Test Project" has 7 days left until the deadline.`,
      status: "DeadlineAlert",
      recipientRole: "Government Official"
    });
    
    // Send real-time notification
    io.emit('new-notification', {
      message: `Project "Test Project" has 7 days left until the deadline.`,
      projectId: req.user._id,
      status: "DeadlineAlert",
      createdAt: new Date(),
    });
    
    console.log("Test deadline notification created successfully");
    res.status(200).json({ message: "Test notification sent successfully" });
  } catch (error) {
    console.error("Error creating test notification:", error);
    res.status(500).json({ error: "Failed to create test notification" });
  }
});

// Public Post Page Route
app.get('/public-post', authMiddleware, async (req, res) => {
  try {
    // Fetch posts sorted by most recent
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .lean();
    
    // Make sure posts exists, even if it's empty
    res.render('public-post', { 
      user: req.user, 
      posts: posts || [] 
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    // Even on error, pass empty array to avoid template errors
    res.render('public-post', { 
      user: req.user, 
      posts: [],
      error: 'Failed to load posts'
    });
  }
});

// Create a new post with image upload
app.post('/api/posts', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    
    // Create post object
    const postData = {
      title,
      content,
      author: req.user._id,
      authorName: req.user.name
    };

    // If image was uploaded, add it to the post
    if (req.file) {
      postData.imageUrl = `/file-view/${req.file.filename}`;
    }

    // Create new post
    const post = await Post.create(postData);
    
    res.status(201).json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post'
    });
  }
});

// Like a post
app.post('/api/posts/:postId/like', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if user already liked or disliked this post
    const alreadyLiked = post.likes.includes(userId);
    const alreadyDisliked = post.dislikes.includes(userId);

    // If already liked, remove like (toggle behavior)
    if (alreadyLiked) {
      post.likes = post.likes.filter(id => !id.equals(userId));
    } else {
      // Add like
      post.likes.push(userId);
      
      // Remove dislike if exists
      if (alreadyDisliked) {
        post.dislikes = post.dislikes.filter(id => !id.equals(userId));
      }
    }

    await post.save();

    res.json({
      success: true,
      likes: post.likes.length,
      dislikes: post.dislikes.length,
      userLiked: post.likes.some(id => id.equals(userId)),
      userDisliked: post.dislikes.some(id => id.equals(userId))
    });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Dislike a post
app.post('/api/posts/:postId/dislike', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if user already liked or disliked this post
    const alreadyLiked = post.likes.includes(userId);
    const alreadyDisliked = post.dislikes.includes(userId);

    // If already disliked, remove dislike (toggle behavior)
    if (alreadyDisliked) {
      post.dislikes = post.dislikes.filter(id => !id.equals(userId));
    } else {
      // Add dislike
      post.dislikes.push(userId);
      
      // Remove like if exists
      if (alreadyLiked) {
        post.likes = post.likes.filter(id => !id.equals(userId));
      }
    }

    await post.save();

    res.json({
      success: true,
      likes: post.likes.length,
      dislikes: post.dislikes.length,
      userLiked: post.likes.some(id => id.equals(userId)),
      userDisliked: post.dislikes.some(id => id.equals(userId))
    });
  } catch (error) {
    console.error('Error disliking post:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

server.listen(port,()=>console.log(`Server running on http://localhost:${port}`));
