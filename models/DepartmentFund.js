const mongoose = require('mongoose');

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
  remainingFund: { type: Number, default: 50000 }
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

module.exports = mongoose.model("DepartmentFund", departmentFundSchema);