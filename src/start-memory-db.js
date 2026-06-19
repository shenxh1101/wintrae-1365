import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import config from './config/index.js';
import { startServer } from './app.js';

async function startWithMemoryDB() {
  console.log('Starting MongoDB Memory Server...');

  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'hospital-scheduling'
    },
    startUpTimeoutMS: 60000
  });

  const uri = mongod.getUri();
  console.log(`MongoDB Memory Server started at: ${uri}`);

  process.env.MONGODB_URI = uri;
  config.mongodbUri = uri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Memory Server successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB Memory Server:', error.message);
    process.exit(1);
  }

  const server = await startServer(true);

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    server.close(async () => {
      await mongoose.connection.close();
      await mongod.stop();
      process.exit(0);
    });
  });

  return { server, mongod };
}

if (process.env.NODE_ENV !== 'test') {
  startWithMemoryDB();
}

export { startWithMemoryDB };
