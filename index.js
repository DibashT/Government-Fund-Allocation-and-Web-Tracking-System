const express=require("express");
const path=require("path");
const bcrypt=require("bcrypt");
const { collection } = require("./config");
const { Project } = require("./config");
const bodyParser = require("body-parser");
const ejsLayouts = require('ejs-layouts');
const { removeListener } = require("process");
const app=express();

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(express.static("public"))

// Set EJS as the view engine and define views directory
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
// app.use(ejsLayouts);


app.get("",(req,res)=>{
  res.render("login");
}
)

app.get("/login",(req,res)=>{
  res.render("login");
})

app.get("/signup",(req,res)=>{
  res.render("signup"); 
})
app.get("/admin-dashboard",(req,res)=>{
  res.render("admin-dashboard");
})
app.get("/minister-dashboard",(req,res)=>{
  res.render("minister-dashboard");
})
app.get("/officials-dashboard",(req,res)=>{
  res.render("officials-dashboard");
})
app.get("/public-dashboard",(req,res)=>{
  res.render("public-dashboard");
})
app.get('/officials-project', (req, res) => {
  res.render('officials-project');
});
// Render the "Add User" page
app.get("/add-users", (req, res) => {
  res.render("add-users"); // Renders add-user.ejs
});
// Render the "Add User" page
app.get("/edit-user", (req, res) => {
  res.render("edit-user"); // Renders add-user.ejs
});

app.post("/signup", async (req, res) => {
  const data = {
    name: req.body.username,
    role: req.body.role,
    password: req.body.password,
  };

  try {
    // Check if a user with the same name already exists
    const existingUser = await collection.findOne({ name: data.name });
    if (existingUser) {
      return res.send("User already exists. Choose another name.");
    }

    // Ensure only one Super Admin can exist
    if (data.role === "Admin") {
      const existingAdmin = await collection.findOne({ role: "Admin" });
      if (existingAdmin) {
        return res.send("A Admin already exists. You cannot create another.");
      }
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);
    data.password = hashedPassword;

    // Insert the user into the database
    const userdata = await collection.create(data);
    console.log("User created:", userdata);
    res.redirect("/login");
  } catch (error) {
    console.error("Error during signup:", error.message);
    res.send("An error occurred during signup. Please try again.");
  }
});


//Login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).send("Username and password are required.");
    }

    // Find user in the database
    const checkUser = await collection.findOne({ name: username });
    if (!checkUser) {
      return res.status(404).send("User not found.");
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, checkUser.password);
    if (!passwordMatch) {
      return res.status(401).send("Wrong password.");
    }

    // Redirect user based on their role
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
        return res.status(400).send("Invalid user role.");
    }
  } catch (error) {
    console.error("Error during login:", error.message);
    res.status(500).send("An error occurred. Please try again later.");
  }
});

app.get("/users", async (req, res) => {
  try {
    // Fetch all users from the Mongoose model
    const users = await collection.find();
    res.render("users", { users });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).send("Error fetching user details.");
  }
});

app.post("/add-user", async (req, res) => {
  try {
    const { name, role, password } = req.body;

    // Validate input
    if (!name || !role || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new collection({ name, role, password: hashedPassword });
    await newUser.save();

    res.redirect("/users"); // Redirect to the users page after adding
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/edit-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID
    const user = await collection.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Render the edit-user.ejs template with the user's data
    res.render("edit-user", { user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/edit-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, role } = req.body;

    // Validate input
    if (!name || !role) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    // Find and update the user
    const updatedUser = await collection.findByIdAndUpdate(
      userId,
      { name, role },
      { new: true } // Return the updated user
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.redirect("/users"); // Redirect to the users page after editing
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post("/delete-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const deletedUser = await collection.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.send("User not found");
    }

    res.redirect("/users"); 
  } catch (error) {
    console.error(error);
    res.send("Error deleting user");
  }
});


app.post("/submit-project", async (req, res) => {
  try {
    const { projectName, allocatedFund, department, startDate, projectDeadline, projectDetails } = req.body;

    // Normalize the department input
    const departmentMapping = {
      education: "Ministry of Education",
      health: "Ministry of Health",
      transport: "Ministry of Transport",
      agriculture: "Ministry of Agriculture",
      finance: "Ministry of Finance",
    };

    const normalizedDepartment = departmentMapping[department.toLowerCase()];
    if (!normalizedDepartment) {
      return res.status(400).json({ message: "Invalid department provided." });
    }

    // Create a new project instance
    const project = new Project({
      projectName,
      allocatedFund,
      department: normalizedDepartment,
      startDate,
      projectDeadline,
      projectDetails,
    });

    // Save the project to the database
    const savedProject = await project.save();
    res.status(201).json({ message: "Project added successfully", project: savedProject });
  } catch (error) {
    console.error("Error adding project:", error.message);
    res.status(500).json({ message: "Failed to add project", error: error.message });
  }
});


app.get('/request', async (req, res) => {
  try {
    const projects = await Project.find({ status: { $nin: ["Approved", "Rejected"] } });
    res.render('request', { projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).send("Internal Server Error");
  }
});


// Approve Project Route
app.post('/approve-project/:id', async (req, res) => {
  try {
    const projectId = req.params.id;

    // Update the project's status to "Approved" (You can add a status field in your schema)
    await Project.findByIdAndUpdate(projectId, { status: 'Approved' });

    res.redirect('/admin-dashboard');
  } catch (error) {
    console.error('Error approving project:', error);
    res.status(500).send('Failed to approve the project.');
  }
});

// Reject Project Route
app.post('/reject-project/:id', async (req, res) => {
  try {
    const projectId = req.params.id;

    // Update the project's status to "Rejected"
    await Project.findByIdAndUpdate(projectId, { status: 'Rejected' });

    res.redirect('/admin-dashboard');
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).send('Failed to reject the project.');
  }
});

app.get('/project-details/:id', async (req, res) => {
  try {
      const projectId = req.params.id;
      const project = await Project.findById(projectId);
      if (!project) {
          return res.status(404).json({ success: false, message: "Project not found." });
      }
      res.json({ success: true, project });
  } catch (error) {
      console.error("Error fetching project details:", error);
      res.status(500).json({ success: false, message: "Error fetching project details." });
  }
});

app.get('/history', async (req, res) => {
  try {
      const approvedProjects = await Project.find({ status: "Approved" });
      console.log("Fetched Projects:", approvedProjects);
      res.render('history', { approvedProjects });
  } catch (error) {
      console.error("Error fetching approved projects:", error);
      res.status(500).send("Internal Server Error");
  }
});

const port=5000;
app.listen(port,()=>console.log(`server is running at ${port}`));

