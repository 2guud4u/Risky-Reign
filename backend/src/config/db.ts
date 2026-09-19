import mongoose from 'mongoose';
import 'dotenv/config';

/**
 * Connect to MongoDB for persistent storage. The game currently runs fully
 * in-memory, so this is a placeholder for when the DB schema is ready.
 * A missing MONGO_URI is a valid configuration (in-memory mode) and must
 * not crash the server; a configured-but-failing connection is logged but
 * also does not exit, so a dev server never dies on a bad DB.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('MONGO_URI not set — running in-memory, skipping MongoDB connection');
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err: Error | any) {
    console.error('MongoDB connection failed:', err.message);
  }
};

export default connectDB;
