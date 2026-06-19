import Schedule from '../models/Schedule.js';
import Appointment from '../models/Appointment.js';
import { createSuspensionNotification } from '../services/notificationService.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { parseDate, addDays, startOfDay, endOfDay } from '../utils/dateUtils.js';
import { withTransaction } from '../utils/transaction.js';

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
          date: startOfDay(currentDate),
          startTime: dailySchedule.startTime,
          endTime: dailySchedule.endTime,
          totalSlots: dailySchedule.totalSlots || 0,
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
    const { doctorId, date, startTime, endTime, totalSlots } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(HttpCode.NOT_FOUND).json(fail('医生不存在', HttpCode.NOT_FOUND));
    }

    const schedule = new Schedule({
      doctorId,
      date: startOfDay(parseDate(date)),
      startTime,
      endTime,
      totalSlots: totalSlots || 0,
      type: 'temporary',
      status: 'active'
    });

    await schedule.save();

    return res.status(HttpCode.SUCCESS).json(success(schedule, '临时出诊排班创建成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function createSuspension(req, res) {
  try {
    const { doctorId, date, startTime, endTime, reason } = req.body;

    const result = await withTransaction(async (session) => {
      const doctor = await Doctor.findById(doctorId).session(session);
      if (!doctor) {
        return { code: HttpCode.NOT_FOUND, data: fail('医生不存在', HttpCode.NOT_FOUND) };
      }

      const suspension = new Schedule({
        doctorId,
        date: startOfDay(parseDate(date)),
        startTime,
        endTime,
        type: 'suspension',
        status: 'active',
        totalSlots: 0,
        reason: reason || ''
      });
      await suspension.save({ session });

      const dayStart = startOfDay(parseDate(date));
      const dayEnd = endOfDay(parseDate(date));

      const slotFilter = {
        doctorId,
        date: { $gte: dayStart, $lte: dayEnd },
        startTime: { $gte: startTime },
        endTime: { $lte: endTime },
        status: { $in: ['available', 'locked', 'booked'] }
      };

      const affectedSlots = await Slot.find(slotFilter).session(session);

      for (const slot of affectedSlots) {
        if (slot.status === 'locked' || slot.status === 'booked') {
          const appointment = await Appointment.findOne({
            slotId: slot._id,
            status: { $in: ['pending', 'confirmed'] }
          }).session(session);

          if (appointment) {
            appointment.status = 'cancelled';
            appointment.cancelReason = `医生停诊：${reason || ''}`;
            await appointment.save({ session });

            await createSuspensionNotification(
              slot,
              doctor,
              reason || '',
              appointment.patientName,
              appointment.patientPhone,
              appointment._id,
              session
            );
          }
        }

        slot.status = 'suspended';
        await slot.save(session ? { session } : {});
      }

      return {
        code: HttpCode.SUCCESS,
        data: success({
          suspension,
          suspendedSlotCount: affectedSlots.length
        }, '停诊创建成功，对应号源已冻结')
      };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function cancelSchedule(req, res) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (session) => {
      const schedule = await Schedule.findById(id).session(session);
      if (!schedule) {
        return { code: HttpCode.NOT_FOUND, data: fail('排班不存在', HttpCode.NOT_FOUND) };
      }

      if (schedule.status === 'cancelled') {
        return { code: HttpCode.BAD_REQUEST, data: fail('排班已取消', HttpCode.BAD_REQUEST) };
      }

      schedule.status = 'cancelled';
      await schedule.save(session ? { session } : {});

      await Slot.updateMany(
        { scheduleId: id, status: { $ne: 'booked' } },
        { status: 'cancelled' },
        session ? { session } : {}
      );

      return {
        code: HttpCode.SUCCESS,
        data: success(null, '排班取消成功')
      };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getScheduleList(req, res) {
  try {
    const { doctorId, startDate, endDate, type } = req.query;

    const query = {};
    if (doctorId) {
      query.doctorId = doctorId;
    }
    if (type) {
      query.type = type;
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

    const schedules = await Schedule.find(query)
      .populate('doctorId', 'name department title')
      .sort({ date: 1, startTime: 1 });

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

    const slots = await Slot.find({ scheduleId: id }).sort({ startTime: 1 });

    return res.status(HttpCode.SUCCESS).json(success({ schedule, slots }));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}
