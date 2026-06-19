import Appointment from '../models/Appointment.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import Waitlist from '../models/Waitlist.js';
import { success, fail, HttpCode } from '../utils/response.js';
import config from '../config/index.js';
import { withTransaction } from '../utils/transaction.js';
import { createAppointmentConfirmed, createAppointmentCancelled } from '../services/notificationService.js';
import { releaseSlot } from '../services/slotReleaseService.js';

async function checkDuplicateBooking(doctorId, patientPhone, date, excludeSlotId = null) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const slots = await Slot.find({
    doctorId,
    date: { $gte: dayStart, $lte: dayEnd },
    ...(excludeSlotId ? { _id: { $ne: excludeSlotId } } : {})
  }).select('_id');

  const slotIds = slots.map(s => s._id);

  const existingAppointment = await Appointment.findOne({
    slotId: { $in: slotIds },
    patientPhone,
    status: { $in: ['pending', 'confirmed'] }
  });

  return !!existingAppointment;
}

export async function lockSlot(req, res) {
  try {
    const { slotId, patientName, patientPhone } = req.body;

    const result = await withTransaction(async (session) => {
      const slot = await Slot.findById(slotId).session(session);
      if (!slot) {
        return { code: HttpCode.NOT_FOUND, data: fail('号源不存在', HttpCode.NOT_FOUND) };
      }

      if (slot.status === 'locked') {
        const now = new Date();
        const lockTime = new Date(slot.lockedAt);
        const diff = (now - lockTime) / 1000;
        if (diff < config.slotLockDuration) {
          return { code: HttpCode.BAD_REQUEST, data: fail('号源已被锁定', HttpCode.BAD_REQUEST) };
        }
      }

      if (slot.status === 'booked') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源已被预约', HttpCode.BAD_REQUEST) };
      }

      if (slot.status === 'cancelled') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源已取消', HttpCode.BAD_REQUEST) };
      }

      if (slot.status === 'suspended') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源已停诊', HttpCode.BAD_REQUEST) };
      }

      const notifiedWaitlist = await Waitlist.findOne({
        slotId,
        status: 'notification_sent'
      }).session(session);

      if (notifiedWaitlist) {
        if (notifiedWaitlist.patientPhone !== patientPhone) {
          return { code: HttpCode.BAD_REQUEST, data: fail('该号源已预留给候补患者', HttpCode.BAD_REQUEST) };
        }
        if (notifiedWaitlist.expiredAt && new Date() > new Date(notifiedWaitlist.expiredAt)) {
          return { code: HttpCode.BAD_REQUEST, data: fail('候补预约已过期，请重新加入候补', HttpCode.BAD_REQUEST) };
        }
      }

      const isDuplicate = await checkDuplicateBooking(slot.doctorId, patientPhone, slot.date);
      if (isDuplicate) {
        return { code: HttpCode.CONFLICT, data: fail('您已预约该医生当日号源，请勿重复预约', HttpCode.CONFLICT) };
      }

      slot.status = 'locked';
      slot.patientName = patientName;
      slot.patientPhone = patientPhone;
      slot.lockedAt = new Date();
      await slot.save({ session });

      return { code: HttpCode.SUCCESS, data: success({ slot }, '号源锁定成功') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function confirmAppointment(req, res) {
  try {
    const { slotId, patientName, patientPhone } = req.body;

    const result = await withTransaction(async (session) => {
      const slot = await Slot.findById(slotId).session(session);
      if (!slot) {
        return { code: HttpCode.NOT_FOUND, data: fail('号源不存在', HttpCode.NOT_FOUND) };
      }

      if (slot.status !== 'locked') {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源未锁定，请先锁定号源', HttpCode.BAD_REQUEST) };
      }

      if (slot.patientPhone !== patientPhone) {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源锁定信息与预约人不一致', HttpCode.BAD_REQUEST) };
      }

      const now = new Date();
      const lockTime = new Date(slot.lockedAt);
      const diff = (now - lockTime) / 1000;
      if (diff > config.slotLockDuration) {
        return { code: HttpCode.BAD_REQUEST, data: fail('号源锁定已超时，请重新锁定', HttpCode.BAD_REQUEST) };
      }

      const isDuplicate = await checkDuplicateBooking(slot.doctorId, patientPhone, slot.date, slotId);
      if (isDuplicate) {
        return { code: HttpCode.CONFLICT, data: fail('您已预约该医生当日号源，请勿重复预约', HttpCode.CONFLICT) };
      }

      slot.status = 'booked';
      await slot.save({ session });

      const appointment = new Appointment({
        slotId,
        doctorId: slot.doctorId,
        patientName,
        patientPhone,
        status: 'confirmed'
      });
      await appointment.save({ session });

      slot.appointmentId = appointment._id;
      await slot.save({ session });

      const doctor = await Doctor.findById(slot.doctorId).session(session);
      if (doctor) {
        await createAppointmentConfirmed(appointment, slot, doctor, session);
      }

      return { code: HttpCode.SUCCESS, data: success({ appointment, slot }, '预约确认成功') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function cancelAppointment(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await withTransaction(async (session) => {
      const appointment = await Appointment.findById(id).session(session);
      if (!appointment) {
        return { code: HttpCode.NOT_FOUND, data: fail('预约不存在', HttpCode.NOT_FOUND) };
      }

      if (appointment.status === 'cancelled') {
        return { code: HttpCode.BAD_REQUEST, data: fail('预约已取消', HttpCode.BAD_REQUEST) };
      }

      if (appointment.status === 'no_show') {
        return { code: HttpCode.BAD_REQUEST, data: fail('预约已标记为爽约，无法取消', HttpCode.BAD_REQUEST) };
      }

      const slot = await Slot.findById(appointment.slotId).session(session);
      const doctor = slot ? await Doctor.findById(slot.doctorId).session(session) : null;

      appointment.status = 'cancelled';
      appointment.cancelReason = reason;
      await appointment.save({ session });

      let releaseResult = null;
      if (slot) {
        releaseResult = await releaseSlot(slot._id, 'user_cancelled');
        if (doctor) {
          await createAppointmentCancelled(appointment, slot, doctor, reason, session);
        }
      }

      return { code: HttpCode.SUCCESS, data: success({ appointment, slot: releaseResult?.slot, notifiedWaitlist: releaseResult?.notifiedWaitlist }, '预约取消成功') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function rescheduleAppointment(req, res) {
  try {
    const { id } = req.params;
    const { newSlotId, reason } = req.body;

    const result = await withTransaction(async (session) => {
      const originalAppointment = await Appointment.findById(id).session(session);
      if (!originalAppointment) {
        return { code: HttpCode.NOT_FOUND, data: fail('原预约不存在', HttpCode.NOT_FOUND) };
      }

      if (originalAppointment.status !== 'confirmed') {
        return { code: HttpCode.BAD_REQUEST, data: fail('只有已确认的预约才能改约', HttpCode.BAD_REQUEST) };
      }

      const newSlot = await Slot.findById(newSlotId).session(session);
      if (!newSlot) {
        return { code: HttpCode.NOT_FOUND, data: fail('新号源不存在', HttpCode.NOT_FOUND) };
      }

      if (newSlot.status === 'booked') {
        return { code: HttpCode.BAD_REQUEST, data: fail('新号源已被预约', HttpCode.BAD_REQUEST) };
      }

      if (newSlot.status === 'cancelled') {
        return { code: HttpCode.BAD_REQUEST, data: fail('新号源已取消', HttpCode.BAD_REQUEST) };
      }

      if (newSlot.status === 'suspended') {
        return { code: HttpCode.BAD_REQUEST, data: fail('新号源已停诊', HttpCode.BAD_REQUEST) };
      }

      const isDuplicate = await checkDuplicateBooking(
        newSlot.doctorId,
        originalAppointment.patientPhone,
        newSlot.date,
        newSlotId
      );
      if (isDuplicate) {
        return { code: HttpCode.CONFLICT, data: fail('您已预约该医生当日号源，请勿重复预约', HttpCode.CONFLICT) };
      }

      const oldSlot = await Slot.findById(originalAppointment.slotId).session(session);

      originalAppointment.status = 'cancelled';
      originalAppointment.cancelReason = reason || '改约';
      await originalAppointment.save({ session });

      if (oldSlot) {
        oldSlot.status = 'available';
        oldSlot.patientName = undefined;
        oldSlot.patientPhone = undefined;
        oldSlot.lockedAt = undefined;
        oldSlot.appointmentId = undefined;
        await oldSlot.save({ session });
      }

      newSlot.status = 'booked';
      newSlot.patientName = originalAppointment.patientName;
      newSlot.patientPhone = originalAppointment.patientPhone;
      await newSlot.save({ session });

      const newAppointment = new Appointment({
        slotId: newSlotId,
        doctorId: newSlot.doctorId,
        patientName: originalAppointment.patientName,
        patientPhone: originalAppointment.patientPhone,
        status: 'confirmed',
        isRescheduled: true,
        originalAppointmentId: originalAppointment._id
      });
      await newAppointment.save({ session });

      newSlot.appointmentId = newAppointment._id;
      await newSlot.save({ session });

      return { code: HttpCode.SUCCESS, data: success({
        originalAppointment,
        newAppointment,
        oldSlot,
        newSlot
      }, '改约成功') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function markNoShow(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await withTransaction(async (session) => {
      const appointment = await Appointment.findById(id).session(session);
      if (!appointment) {
        return { code: HttpCode.NOT_FOUND, data: fail('预约不存在', HttpCode.NOT_FOUND) };
      }

      if (appointment.status !== 'confirmed') {
        return { code: HttpCode.BAD_REQUEST, data: fail('只有已确认的预约才能标记为爽约', HttpCode.BAD_REQUEST) };
      }

      const slot = await Slot.findById(appointment.slotId).session(session);

      appointment.status = 'no_show';
      appointment.noShowReason = reason;
      await appointment.save({ session });

      if (slot) {
        slot.status = 'available';
        slot.patientName = undefined;
        slot.patientPhone = undefined;
        slot.lockedAt = undefined;
        slot.appointmentId = undefined;
        await slot.save({ session });
      }

      return { code: HttpCode.SUCCESS, data: success({ appointment, slot }, '已标记为爽约') };
    });

    return res.status(result.code).json(result.data);
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getAppointmentList(req, res) {
  try {
    const { doctorId, patientPhone, status, startDate, endDate, page = 1, pageSize = 10 } = req.query;

    const query = {};

    if (doctorId) {
      query.doctorId = doctorId;
    }
    if (patientPhone) {
      query.patientPhone = patientPhone;
    }
    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      const slotDateFilter = {};
      if (startDate) {
        slotDateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        slotDateFilter.$lte = new Date(endDate);
      }
      const slots = await Slot.find({ date: slotDateFilter }).select('_id');
      const slotIds = slots.map(s => s._id);
      query.slotId = { $in: slotIds };
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('slotId')
        .populate('doctorId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(pageSize)),
      Appointment.countDocuments(query)
    ]);

    return res.json(success({
      list: appointments,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }, '查询成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getAppointmentDetail(req, res) {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate('slotId')
      .populate('doctorId')
      .populate('originalAppointmentId');

    if (!appointment) {
      return res.status(HttpCode.NOT_FOUND).json(fail('预约不存在', HttpCode.NOT_FOUND));
    }

    return res.json(success(appointment));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export { checkDuplicateBooking };
