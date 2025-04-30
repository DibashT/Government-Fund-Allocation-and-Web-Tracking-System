const mongoose = require('mongoose');

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
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    progressStatus: { type: String, enum: ["Ongoing", "Completed"], default: null },
    questionAnswers: {
      type: [Boolean],
      default: [false, false, false, false, false, false, false, false, false, false]
    },
    progress: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true, collection: "projects" }
);
module.exports=mongoose.model("Project",projectSchema);