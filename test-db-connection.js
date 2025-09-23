require('dotenv').config(); // Pastikan dotenv terinstal: npm install dotenv
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not defined in .env');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // 5 seconds
  socketTimeoutMS: 45000,
  family: 4,
})
.then(() => {
  console.log('Successfully connected to MongoDB!');
  mongoose.connection.close();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
