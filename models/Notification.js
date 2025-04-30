const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: false }, // Optional for Admin notifications
    message: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["Approved", "Rejected", "Warning", "Critical", "Info"], 
      required: true 
    }, // Expanded to support various types of notifications
    recipientRole: { type: String, enum: ["Government Official", "Admin"], required: true }, 
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);