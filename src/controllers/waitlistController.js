import Waitlist from '../models/Waitlist.js';
import Slot from '../models/Slot.js';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { withTransaction } from '../utils/transaction.js';
import { startOfDay, endOfDay } from '../utils/dateUtils.js';
import { createAppointmentConfirmed } from '../services/notificationService.js';

export async function joinWaitlist(req, res) {
  try {
    const { slotId, patientName, patientPhone } = req.body;

    const result = await withTransaction(async (session) => {
      const slot = await Slot.findById(slotId).session(session);
      if (!slot) {
        return { code: HttpCode.NOT_FOUND, data: fail('号源不存在', HttpCode.NOT_FOUND) };
      }

      if (slot.status !== 'booked') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源未满，无需加入候补', HttpCode.BAD_REQUEST) };
      }

      const existingWaitlist = await Waitlist.findOne({
        slotId,
        patientPhone,
        status: 'waiting'
      }).session(session);

      if (existingWaitlist) {
        return { code: HttpCode.CONFLICT, data: fail('您已在该号源的候补队列中', HttpCode.CONFLICT) };
      }

      const waitingCount = await Waitlist.countDocuments({
        slotId,
        status: 'waiting'
      }).session(session);

      const waitlist = new Waitlist({
        slotId,
        doctorId: slot.doctorId,
        patientName,
        patientPhone,
        position: waitingCount + 1,
        status: 'waiting'
      });
      await waitlist.save({ session });

      return { code: HttpCode.SUCCESS, data: success(waitlist, '加入候补成功') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function cancelWaitlist(req, res) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (session) => {
      const waitlist = await Waitlist.findById(id).session(session);
      if (!waitlist) {
        return { code: HttpCode.NOT_FOUND, data: fail('候补记录不存在', HttpCode.NOT_FOUND) };
      }

      if (waitlist.status !== 'waiting') {
        return { code: HttpCode.BAD_REQUEST, data: fail('该候补已确认或已取消', HttpCode.BAD_REQUEST) };
      }

      waitlist.status = 'cancelled';
      await waitlist.save({ session });

      await Waitlist.updateMany(
        {
          slotId: waitlist.slotId,
          status: 'waiting',
          position: { $gt: waitlist.position }
        },
        { $inc: { position: -1 } },
        { session }
      );

      return { code: HttpCode.SUCCESS, data: success(waitlist, '取消候补成功') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getWaitlistStatus(req, res) {
  try {
    const { patientPhone, doctorId, date, slotId } = req.query;

    const query = { patientPhone, status: 'waiting' };

    if (slotId) {
      query.slotId = slotId;
    } else if (doctorId && date) {
      const dayStart = startOfDay(new Date(date));
      const dayEnd = endOfDay(new Date(date));
      const slots = await Slot.find({ doctorId, date: { $gte: dayStart, $lte: dayEnd } }).select('_id');
      const slotIds = slots.map(s => s._id);
      query.slotId = { $in: slotIds };
    } else if (doctorId) {
      query.doctorId = doctorId;
    }

    const waitlists = await Waitlist.find(query)
      .populate('slotId')
      .populate('doctorId', 'name department title')
      .sort({ position: 1 });

    return res.status(HttpCode.SUCCESS).json(success(waitlists, '查询成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getWaitlistBySlot(req, res) {
  try {
    const { slotId } = req.params;

    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(HttpCode.NOT_FOUND).json(fail('号源不存在', HttpCode.NOT_FOUND));
    }

    const waitlists = await Waitlist.find({ slotId, status: { $in: ['waiting', 'notification_sent'] } })
      .populate('doctorId', 'name department title')
      .sort({ status: 1, position: 1 });

    return res.status(HttpCode.SUCCESS).json(success(waitlists, '查询成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function confirmWaitlistBooking(req, res) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (session) => {
      const waitlist = await Waitlist.findById(id).session(session);
      if (!waitlist) {
        return { code: HttpCode.NOT_FOUND, data: fail('候补记录不存在', HttpCode.NOT_FOUND) };
      }

      if (waitlist.status === 'confirmed' || waitlist.status === 'cancelled' || waitlist.status === 'expired') {
        return { code: HttpCode.BAD_REQUEST, data: fail('该候补已确认、已取消或已过期', HttpCode.BAD_REQUEST) };
      }

      if (waitlist.status === 'waiting') {
        return { code: HttpCode.BAD_REQUEST, data: fail('轮候未到您，请等待通知', HttpCode.BAD_REQUEST) };
      }

      const slot = await Slot.findById(waitlist.slotId).session(session);
      if (!slot) {
        return { code: HttpCode.NOT_FOUND, data: fail('号源不存在', HttpCode.NOT_FOUND) };
      }

      if (slot.status === 'booked') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源已被预约', HttpCode.BAD_REQUEST) };
      }

      if (slot.status === 'cancelled' || slot.status === 'suspended') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源已取消或停诊', HttpCode.BAD_REQUEST) };
      }

      slot.status = 'booked';
      slot.patientName = waitlist.patientName;
      slot.patientPhone = waitlist.patientPhone;
      await slot.save({ session });

      const appointment = new Appointment({
        slotId: waitlist.slotId,
        doctorId: waitlist.doctorId,
        patientName: waitlist.patientName,
        patientPhone: waitlist.patientPhone,
        status: 'confirmed'
      });
      await appointment.save({ session });

      slot.appointmentId = appointment._id;
      await slot.save({ session });

      waitlist.status = 'confirmed';
      await waitlist.save({ session });

      await Waitlist.updateMany(
        {
          slotId: waitlist.slotId,
          status: 'waiting',
          position: { $gt: 1 }
        },
        { $inc: { position: -1 } },
        { session }
      );

      const doctor = await Doctor.findById(waitlist.doctorId).session(session);
      if (doctor) {
        await createAppointmentConfirmed(appointment, slot, doctor, session);
      }

      return {
        code: HttpCode.SUCCESS,
        data: success({ waitlist, appointment, slot }, '候补确认预约成功')
      };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}
