const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sales_order_db';

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('\n========================================');
    console.error('MongoDB connection failed!');
    console.error('----------------------------------------');
    console.error('Could not connect to MongoDB at:', uri);
    console.error('\nPlease check the following:');
    console.error('  1. Is MongoDB installed on your computer?');
    console.error('  2. Is the MongoDB service running?');
    console.error('     - On Mac: run "brew services start mongodb-community"');
    console.error('     - On Windows: start the MongoDB service from Services');
    console.error('     - On Linux: run "sudo systemctl start mongod"');
    console.error('  3. Is the MONGODB_URI in your .env file correct?');
    console.error('\nThe server will continue starting but database features will not work.');
    console.error('========================================\n');
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Database features are temporarily unavailable.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected.');
  });
};

module.exports = connectDB;
