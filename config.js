
const mongoose=require("mongoose");
const connect=mongoose.connect("mongodb://localhost:27017/GovernmentFund");

//check database connection
connect.then(()=>{
  console.log("connected to database successfully");
})
.catch(()=>{
  console.log("failed to connect to database");
});

//create a schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: ["Minister", "Government Official", "Public", "Admin"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
  },
  { 
    timestamps: true,
    collection: "users", 
  }
);
const collection = mongoose.model("users", userSchema);

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: [true, "Project name is required"],
    },
    allocatedFund: {
      type: Number,
      required: [true, "Allocated fund is required"],
      min: [1, "Allocated fund must be at least 1"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      enum: [
        "Ministry of Education",
        "Ministry of Health",
        "Ministry of Transport",
        "Ministry of Agriculture",
        "Ministry of Finance",
      ],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    projectDeadline: {
      type: Date,
      required: [true, "Project deadline is required"],
    },
    projectDetails: {
      type: String,
      required: [true, "Project details are required"],
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending", // New projects are created as "Pending"
    },
  },
  {
    timestamps: true,
    collection: "projects",
  }
);


const Project = mongoose.model('Project', projectSchema);
module.exports = { 
  collection, 
  Project 
};




