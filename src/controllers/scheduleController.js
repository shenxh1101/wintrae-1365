import Schedule from '../models/Schedule.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { parseDate, addDays, startOfDay, endOfDay } from '../utils/dateUtils.js';
import mongoose from 'mongoose';

export async function createWeeklySchedule(req, res) {
  try {
    const { doctorId, startDate, dailySchedules } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    const schedules = [];
    const start = parseDate(startDate);

    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(start, i);
      const dayOfWeek = currentDate.getDay();
      const dailySchedule = dailySchedules.find(d => d.dayOfWeek === dayOfWeek);

      if (dailySchedule) {
        schedules.push({
          doctorId,
          date: currentDate,
          startTime: dailySchedule.startTime,
          endTime: dailySchedule.endTime,
          totalSlots: dailySchedule.totalSlots,
          type: 'regular',
          status: 'active'
        });
      }
    }

    const created = await Schedule.insertMany(schedules);

    return res.status(HttpCode.SUCCESS).json(success(created, '周排班创建成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function createTemporarySchedule(req, res) {
  try {
    const { doctorId, date, startTime, endTime, totalSlots, type } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    const schedule = new Schedule({
      doctorId,
      date: parseDate(date),
      startTime,
      endTime,
      totalSlots,
      type: type || 'temporary',
      status: 'active'
    });

    await schedule.save();

    return res.status(HttpCode.SUCCESS).json(success(schedule, '临时排班创建成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function cancelSchedule(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const schedule = await Schedule.findById(id).session(session);
    if (!schedule) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('排班不存在', HttpCode.NOT_FOUND));
    }

    if (schedule.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('排班已取消', HttpCode.BAD_REQUEST));
    }

    schedule.status = 'cancelled';
    await schedule.save({ session });

    await Slot.updateMany(
      { scheduleId: id },
      { status: 'cancelled' },
      { session }
    );

    await session.commitTransaction();

    return res.status(HttpCode.SUCCESS).json(success(null, '排班取消成功'));
  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  } finally {
    session.endSession();
  }
}

export async function getScheduleList(req, res) {
  try {
    const { doctorId, startDate, endDate } = req.query;

    const query = {};
    if (doctorId) {
      query.doctorId = doctorId;
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startOfDay(parseDate(startDate));
      }
      if (endDate) {
        query.date.$lte = endOfDay(parseDate(endDate));
      }
    }

    const schedules = await Schedule.find(query).sort({ date: 1, startTime: 1 });

    return res.status(HttpCode.SUCCESS).json(success(schedules));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getScheduleDetail(req, res) {
  try {
    const { id } = req.params;

    const schedule = await Schedule.findById(id).populate('doctorId', 'name department title');
    if (!schedule) {
      return res.status(HttpCode.NOT_FOUND).json(fail('排班不存在', HttpCode.NOT_FOUND));
    }

    return res.status(HttpCode.SUCCESS).json(success(schedule));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}
