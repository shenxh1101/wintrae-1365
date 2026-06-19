import Schedule from '../models/Schedule.js';
import Slot from '../models/Slot.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { parseDate, splitTimeSlots, startOfDay, endOfDay } from '../utils/dateUtils.js';

export async function generateSlotsFromSchedule(req, res) {
  try {
    const { scheduleId, durationMinutes } = req.body;

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(HttpCode.NOT_FOUND).json(fail('排班不存在', HttpCode.NOT_FOUND));
    }

    if (schedule.status === 'cancelled') {
      return res.status(HttpCode.BAD_REQUEST).json(fail('排班已取消，无法生成号源', HttpCode.BAD_REQUEST));
    }

    const existingSlots = await Slot.countDocuments({ scheduleId });
    if (existingSlots > 0) {
      return res.status(HttpCode.BAD_REQUEST).json(fail('该排班已生成号源', HttpCode.BAD_REQUEST));
    }

    const timeSlots = splitTimeSlots(schedule.startTime, schedule.endTime, durationMinutes || 30);

    const slots = timeSlots.map(slot => ({
      scheduleId: schedule._id,
      doctorId: schedule.doctorId,
      date: schedule.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'available'
    }));

    const createdSlots = await Slot.insertMany(slots);

    return res.status(HttpCode.SUCCESS).json(success(createdSlots, '号源生成成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getSlotList(req, res) {
  try {
    const { doctorId, date, status } = req.query;

    const query = {};
    if (doctorId) {
      query.doctorId = doctorId;
    }
    if (date) {
      query.date = {
        $gte: startOfDay(parseDate(date)),
        $lte: endOfDay(parseDate(date))
      };
    }

    if (status) {
      query.status = status;
    }

    const slots = await Slot.find(query).sort({ startTime: 1 });

    return res.status(HttpCode.SUCCESS).json(success(slots));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getDoctorDailyRemaining(req, res) {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId) {
      return res.status(HttpCode.BAD_REQUEST).json(fail('医生ID不能为空', HttpCode.BAD_REQUEST));
    }

    const query = {
      doctorId,
      status: 'available'
    };

    if (date) {
      query.date = {
        $gte: startOfDay(parseDate(date)),
        $lte: endOfDay(parseDate(date))
      };
    } else {
      const today = new Date();
      query.date = {
        $gte: startOfDay(today),
        $lte: endOfDay(today)
      };
    }

    const count = await Slot.countDocuments(query);

    return res.status(HttpCode.SUCCESS).json(success({ remaining: count }));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}
