import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import config from './config/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import doctorRoutes from './routes/doctorRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import statisticsRoutes from './routes/statisticsRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
app.use(limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/doctors', doctorRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      mongoose.connection.close(false, () => {
        process.exit(0);
      });
    });
  });

  return server;
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, startServer };
export default app;
