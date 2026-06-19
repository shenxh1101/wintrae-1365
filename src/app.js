import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import config from './config/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { success, fail, HttpCode } from './utils/response.js';
import { splitTimeSlots } from './utils/dateUtils.js';
import { startLockExpiryScheduler, stopLockExpiryScheduler } from './scheduler/lockExpiry.js';

import doctorRoutes from './routes/doctorRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import statisticsRoutes from './routes/statisticsRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';

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
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  res.json({ status: 'ok', db: dbStatus });
});

app.get('/test/split-slots', (req, res) => {
  const { start = '08:00', end = '10:00', duration = '30' } = req.query;
  const slots = splitTimeSlots(start, end, parseInt(duration));
  res.json(success({
    startTime: start,
    endTime: end,
    duration: parseInt(duration),
    count: slots.length,
    slots
  }));
});

const checkDB = (req, res, next) => {
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    return res.status(HttpCode.INTERNAL_ERROR).json(
      fail('数据库连接未就绪，请先启动 MongoDB 服务', HttpCode.INTERNAL_ERROR)
    );
  }
  next();
};

app.use('/api', checkDB);

app.use('/api/doctors', doctorRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/waitlist', waitlistRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.log('Server will start without database connection. API endpoints will return database error.');
  }
};

const startServer = async (skipDBConnect = false) => {
  if (!skipDBConnect) {
    await connectDB();
  }
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`Slot split test: http://localhost:${config.port}/test/split-slots`);
  });

  if (!skipDBConnect) {
    startLockExpiryScheduler(1);
  }

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    stopLockExpiryScheduler();
    server.close(() => {
      mongoose.connection.close(false, () => {
        process.exit(0);
      });
    });
  });

  return server;
};

export { app, startServer };
export default app;
