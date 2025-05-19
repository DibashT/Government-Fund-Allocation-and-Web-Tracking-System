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

    // Check for upcoming deadlines (7 days warning)
    const upcomingProjects = await Project.find({
      status: "Approved",
      progressStatus: "Ongoing",
      projectDeadline: {
        $gte: targetDate.toDate(),
        $lt: moment(targetDate).add(1, "days").toDate()
      }
    });

    for (const project of upcomingProjects) {
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

        console.log(`Notification sent for: "${project.projectName}"`);

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
    
    // Check for projects that have missed their deadlines
    const missedDeadlineProjects = await Project.find({
      status: "Approved",
      progressStatus: "Ongoing",
      projectDeadline: { $lt: today.toDate() }
    });
    
    console.log(`Found ${missedDeadlineProjects.length} projects that have missed their deadlines:`);
    missedDeadlineProjects.forEach(project => {
      console.log(`- Project ID: ${project._id}, Name: ${project.projectName}, Deadline: ${project.projectDeadline}`);
    });

    for (const project of missedDeadlineProjects) {
      // Check if we've already sent a missed deadline notification for this project
      const existingNotification = await Notification.findOne({
        projectId: project._id,
        status: "DeadlineMissed",
        recipientRole: "Public"
      });

      if (!existingNotification) {
        // Create notification for public users
        const missedDays = moment(today).diff(moment(project.projectDeadline), 'days');
        const newNotification = await Notification.create({
          projectId: project._id,
          message: `Project "${project.projectName}" in ${project.department} has missed its deadline by ${missedDays} days and is still not completed.`,
          status: "DeadlineMissed",
          recipientRole: "Public"
        });

        console.log(`Public notification sent for missed deadline: "${project.projectName}"`);

        // Emit real-time notification to the frontend via socket.io
        if (io) {
          io.emit('new-public-notification', {
            message: `Project "${project.projectName}" in ${project.department} has missed its deadline by ${missedDays} days and is still not completed.`,
            projectId: project._id,
            status: "DeadlineMissed",
            createdAt: new Date(),
          });
        } else {
          console.log("Socket.io not initialized, public notification will not be emitted in real-time.");
        }
      }
    }
  } catch (error) {
    console.error("Deadline check failed:", error.message);
  }
};

module.exports = { checkProjectDeadlines, setIO };
