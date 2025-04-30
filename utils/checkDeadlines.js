// utils/checkDeadlines.js

const moment = require("moment");
const { Project, Notification } = require("../config");

let io;

// Function to set the io instance from index.js
const setIO = (ioInstance) => {
  io = ioInstance;
};

const checkProjectDeadlines = async () => {
  try {
    const today = moment().startOf("day");
    const targetDate = moment().add(7, "days").startOf("day");

    const projects = await Project.find({
      status: "Approved",
      progressStatus: "Ongoing",
      projectDeadline: {
        $gte: targetDate.toDate(),
        $lt: moment(targetDate).add(1, "days").toDate()
      }
    });

    for (const project of projects) {
      const existingNotification = await Notification.findOne({
        projectId: project._id,
        status: "DeadlineAlert"
      });

      if (!existingNotification) {
        const newNotification = await Notification.create({
          projectId: project._id,
          message: `Project "${project.projectName}" has 7 days left until the deadline.`,
          status: "DeadlineAlert",
          recipientRole: "Government Official"
        });

        console.log(`✅ Notification sent for: "${project.projectName}"`);

        // Emit real-time notification to the frontend via socket.io
        if (io) {
          io.emit('new-notification', {
            message: `Project "${project.projectName}" has 7 days left until the deadline.`,
            projectId: project._id,
            status: "DeadlineAlert",
            createdAt: new Date(),
          });
        } else {
          console.log("Socket.io not initialized, notification will not be emitted in real-time.");
        }
      }
    }
  } catch (error) {
    console.error("🚨 Deadline check failed:", error.message);
  }
};

module.exports = { checkProjectDeadlines, setIO };
