import mongoose from 'mongoose';

const connectDB = async () => {
  // Reuse existing connection in warm serverless invocations.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    throw error;
  }
};

export default connectDB;
