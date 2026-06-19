import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  slotLockDuration: parseInt(process.env.SLOT_LOCK_DURATION || '300', 10),
};

export default config;
