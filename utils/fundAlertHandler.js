// utils/fundAlertHandler.js

let io;

// Function to set the io instance from index.js
const setIO = (ioInstance) => {
  io = ioInstance;
};

// Function to check department funds and emit alerts if needed
const checkDepartmentFunds = async (DepartmentFund) => {
  try {
    const departments = await DepartmentFund.find({});
    
    for (const dept of departments) {
      if (dept.remainingFund < 10000) {
        emitFundAlert(dept.department, dept.remainingFund);
      }
    }
    
    console.log('Department fund check completed');
  } catch (error) {
    console.error('Error checking department funds:', error);
  }
};

// Function to emit fund alerts
const emitFundAlert = (department, remainingFund) => {
  if (!io) {
    console.log('Socket.io not initialized, skipping fund alert emission');
    return;
  }
  
  const totalFund = 50000; // Default total fund value
  const percentRemaining = ((remainingFund / totalFund) * 100).toFixed(1);
  const message = `WARNING: Funds for ${department} are below 10,000 units. Only ${remainingFund.toLocaleString()} units (${percentRemaining}%) remaining.`;
  
  io.emit('fundAlertNotification', {
    message: message,
    department: department,
    remainingFund: remainingFund,
    totalFund: totalFund,
    percentRemaining: percentRemaining,
    status: 'Warning',
    createdAt: new Date()
  });
  
  console.log(`Fund alert notification emitted for ${department}`);
};

module.exports = {
  setIO,
  checkDepartmentFunds,
  emitFundAlert
}; 