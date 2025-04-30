const mongoose=require("mongoose");
const connect=mongoose.connect("mongodb://localhost:27017/GovernmentFund");

const departments = [
  "Ministry of Education",
  "Ministry of Health",
  "Ministry of Transport",
  "Ministry of Agriculture",
  "Ministry of Finance"
];

async function initializeDepartmentFunds() {
  try {
    for (const dept of departments) {
      const existing = await DepartmentFund.findOne({ department: dept });
      if (!existing) {
        await DepartmentFund.create({
          department: dept,
          totalFund: 50000,
          usedFund: 0,
          remainingFund: 50000,
        });
        console.log(` Initialized fund for ${dept}`);
      } else {
        console.log(`🔁 ${dept} already initialized`);
      }
    }
  } catch (error) {
    console.error("❌ Error initializing department funds:", error);
  }
}

connect.then(()=>{
  console.log("connected to database successfully");
  initializeDepartmentFunds();
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
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Email is invalid"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      match: [/^\+?\d{10,15}$/, "Phone number is invalid"],
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
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null, // Ensure the field is null initially
    },    
  },
  {
    timestamps: true,
  }
);
const User = mongoose.model("User", userSchema);

const projectSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: [true, "Project name is required"] },
    allocatedFund: { type: Number, required: [true, "Allocated fund is required"], min: 1 },
    department: { 
      type: String, 
      required: true,
      enum: [
        "Ministry of Education",
        "Ministry of Health",
        "Ministry of Transport",
        "Ministry of Agriculture",
        "Ministry of Finance"
      ]
    },
    startDate: { type: Date, required: true },
    projectDeadline: { 
      type: Date, 
      required: true,
      validate: {
        validator: function(value) { return value > this.startDate; },
        message: "Project deadline must be after the start date."
      }
    },
    actualCompletionDate: { type: Date, default: null },
    projectDetails: { type: String, required: true },
    fileAttachment: { type: String, default: null },
    
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    actionDate: { type: Date, default: null },
    progressStatus: { type: String, enum: ["Ongoing", "Completed"], default: null },
    questionAnswers: {
      type: [Boolean],
      default: [false, false, false, false, false, false, false, false, false, false]
    },
    billFiles: {
      type: Object,
      default: {}
    },
    progress: {
      type: Number,
      default: 0
    },
    billGenerated: { type: Boolean, default: false },
    billGeneratedAt: { type: Date, default: null },
    billGeneratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    billFilePath: { type: String, default: null }
  },
  { 
    timestamps: true, 
    collection: "projects"
  }
);
projectSchema.index({ location: "2dsphere" });
const Project = mongoose.model("Project", projectSchema);

const departmentFundSchema = new mongoose.Schema({
  department: { 
    type: String, 
    required: true, 
    unique: true,
    enum: [
      "Ministry of Education",
      "Ministry of Health",
      "Ministry of Transport",
      "Ministry of Agriculture",
      "Ministry of Finance"
    ]
  },
  totalFund: { type: Number, default: 50000 },
  usedFund: { type: Number, default: 0 },
  remainingFund: { type: Number, default: 50000 },
  allocationDate: { type: Date, required: true, default: Date.now }
});

// Middleware to check fund status before saving
departmentFundSchema.pre("save", async function (next) {
  if (this.isModified("remainingFund") && this.remainingFund < 10000) {
    console.log(`Alert: The fund for ${this.department} is below 10,000.`);

    try {
      await Notification.create({
        message: `Warning: Funds for ${this.department} are below 10,000.`,
        status: "Warning",
        recipientRole: "Admin",
        isRead: false,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
  next();
});

const DepartmentFund = mongoose.model("DepartmentFund", departmentFundSchema);


const notificationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: false }, // Optional for Admin notifications
    message: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["Approved", "Rejected", "Warning", "Critical", "Info", "DeadlineAlert"], 
      required: true 
    },  
    recipientRole: { type: String, enum: ["Government Official", "Admin"], required: true }, 
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const Notification = mongoose.model("Notification", notificationSchema);

const OtpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date,
  type: { type: String, enum: ['signup', 'reset'], default: 'signup' },
  userData: Object, // temporarily store user data or reset token
});
const Otp = mongoose.model("Otp", OtpSchema);


module.exports = { 
  User, 
  Project,
  DepartmentFund,
  Notification,
  Otp
};




