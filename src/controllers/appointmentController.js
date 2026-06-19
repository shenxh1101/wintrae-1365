import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import config from '../config/index.js';
import { success, fail, HttpCode } from '../utils/response.js';

async function isSlotLockedExpired(slot) {
  if (slot.status !== 'locked' || !slot.lockedAt) {
    return false;
  }
  const now = Date.now();
  const lockedTime = new Date(slot.lockedAt).getTime();
  return (now - lockedTime) > config.slotLockDuration * 1000;
}

async function checkDuplicateBooking(doctorId, patientPhone, slotDate, excludeAppointmentId = null) {
  const query = {
    doctorId,
    patientPhone,
    status: { $in: ['pending', 'confirmed'] }
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const appointments = await Appointment.find(query).populate('slotId');

  const targetDateStr = new Date(slotDate).toDateString();

  for (const apt of appointments) {
    if (apt.slotId && new Date(apt.slotId.date).toDateString() === targetDateStr) {
      return true;
    }
  }

  return false;
}

export async function lockSlot(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { slotId, patientName, patientPhone } = req.body;

    const slot = await Slot.findById(slotId).session(session);
    if (!slot) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('号源不存在', HttpCode.NOT_FOUND));
    }

    if (slot.status === 'locked') {
      const expired = await isSlotLockedExpired(slot);
      if (!expired) {
        await session.abortTransaction();
        return res.status(HttpCode.CONFLICT).json(fail('号源已被锁定', HttpCode.CONFLICT));
      }
    }

    if (slot.status === 'booked') {
      await session.abortTransaction();
      return res.status(HttpCode.CONFLICT).json(fail('号源已被预约', HttpCode.CONFLICT));
    }

    if (slot.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('号源已取消', HttpCode.BAD_REQUEST));
    }

    const isDuplicate = await checkDuplicateBooking(slot.doctorId, patientPhone, slot.date);
    if (isDuplicate) {
      await session.abortTransaction();
      return res.status(HttpCode.CONFLICT).json(fail('同一时段已存在有效预约', HttpCode.CONFLICT));
    }

    slot.status = 'locked';
    slot.patientName = patientName;
    slot.patientPhone = patientPhone;
    slot.lockedAt = new Date();
    await slot.save({ session });

    await session.commitTransaction();

    return res.json(success({ slot }, '锁定成功'));
  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  } finally {
    session.endSession();
  }
}

export async function confirmAppointment(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { slotId, patientName, patientPhone } = req.body;

    const slot = await Slot.findById(slotId).session(session);
    if (!slot) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('号源不存在', HttpCode.NOT_FOUND));
    }

    if (slot.status === 'locked') {
      const expired = await isSlotLockedExpired(slot);
      if (expired) {
        slot.status = 'available';
        slot.patientName = undefined;
        slot.patientPhone = undefined;
        slot.lockedAt = undefined;
        await slot.save({ session });
        await session.abortTransaction();
        return res.status(HttpCode.CONFLICT).json(fail('锁定已超时，请重新预约', HttpCode.CONFLICT));
      }
      if (slot.patientPhone !== patientPhone) {
        await session.abortTransaction();
        return res.status(HttpCode.FORBIDDEN).json(fail('号源已被其他患者锁定', HttpCode.FORBIDDEN));
      }
    } else if (slot.status !== 'available') {
      await session.abortTransaction();
      return res.status(HttpCode.CONFLICT).json(fail('号源不可用', HttpCode.CONFLICT));
    }

    const isDuplicate = await checkDuplicateBooking(slot.doctorId, patientPhone, slot.date);
    if (isDuplicate) {
      await session.abortTransaction();
      return res.status(HttpCode.CONFLICT).json(fail('同一时段已存在有效预约', HttpCode.CONFLICT));
    }

    const appointment = new Appointment({
      slotId: slot._id,
      doctorId: slot.doctorId,
      patientName,
      patientPhone,
      status: 'confirmed'
    });
    await appointment.save({ session });

    slot.status = 'booked';
    slot.patientName = patientName;
    slot.patientPhone = patientPhone;
    slot.appointmentId = appointment._id;
    await slot.save({ session });

    await session.commitTransaction();

    return res.json(success({ appointment }, '预约成功'));
  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  } finally {
    session.endSession();
  }
}

export async function cancelAppointment(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(id).session(session);
    if (!appointment) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('预约不存在', HttpCode.NOT_FOUND));
    }

    if (appointment.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('预约已取消', HttpCode.BAD_REQUEST));
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = reason;
    await appointment.save({ session });

    const slot = await Slot.findById(appointment.slotId).session(session);
    if (slot) {
      slot.status = 'available';
      slot.patientName = undefined;
      slot.patientPhone = undefined;
      slot.lockedAt = undefined;
      slot.appointmentId = undefined;
      await slot.save({ session });
    }

    await session.commitTransaction();

    return res.json(success({ appointment }, '取消成功'));
  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  } finally {
    session.endSession();
  }
}

export async function rescheduleAppointment(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { newSlotId, reason } = req.body;

    const originalAppointment = await Appointment.findById(id).session(session);
    if (!originalAppointment) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('原预约不存在', HttpCode.NOT_FOUND));
    }

    if (originalAppointment.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('原预约已取消', HttpCode.BAD_REQUEST));
    }

    if (originalAppointment.status === 'no_show') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('已标记爽约的预约不能改约', HttpCode.BAD_REQUEST));
    }

    const newSlot = await Slot.findById(newSlotId).session(session);
    if (!newSlot) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('新号源不存在', HttpCode.NOT_FOUND));
    }

    if (newSlot.status === 'locked') {
      const expired = await isSlotLockedExpired(newSlot);
      if (!expired) {
        await session.abortTransaction();
        return res.status(HttpCode.CONFLICT).json(fail('新号源已被锁定', HttpCode.CONFLICT));
      }
    }

    if (newSlot.status === 'booked') {
      await session.abortTransaction();
      return res.status(HttpCode.CONFLICT).json(fail('新号源已被预约', HttpCode.CONFLICT));
    }

    if (newSlot.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('新号源已取消', HttpCode.BAD_REQUEST));
    }

    const isDuplicate = await checkDuplicateBooking(
      newSlot.doctorId,
      originalAppointment.patientPhone,
      newSlot.date,
      originalAppointment._id
    );
    if (isDuplicate) {
      await session.abortTransaction();
      return res.status(HttpCode.CONFLICT).json(fail('新时段已存在有效预约', HttpCode.CONFLICT));
    }

    originalAppointment.status = 'cancelled';
    originalAppointment.cancelReason = reason;
    await originalAppointment.save({ session });

    const originalSlot = await Slot.findById(originalAppointment.slotId).session(session);
    if (originalSlot) {
      originalSlot.status = 'available';
      originalSlot.patientName = undefined;
      originalSlot.patientPhone = undefined;
      originalSlot.lockedAt = undefined;
      originalSlot.appointmentId = undefined;
      await originalSlot.save({ session });
    }

    const newAppointment = new Appointment({
      slotId: newSlot._id,
      doctorId: newSlot.doctorId,
      patientName: originalAppointment.patientName,
      patientPhone: originalAppointment.patientPhone,
      status: 'confirmed',
      isRescheduled: true,
      originalAppointmentId: originalAppointment._id
    });
    await newAppointment.save({ session });

    newSlot.status = 'booked';
    newSlot.patientName = originalAppointment.patientName;
    newSlot.patientPhone = originalAppointment.patientPhone;
    newSlot.appointmentId = newAppointment._id;
    await newSlot.save({ session });

    await session.commitTransaction();

    return res.json(success({
      originalAppointment,
      newAppointment
    }, '改约成功'));
  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  } finally {
    session.endSession();
  }
}

export async function markNoShow(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(id).session(session);
    if (!appointment) {
      await session.abortTransaction();
      return res.status(HttpCode.NOT_FOUND).json(fail('预约不存在', HttpCode.NOT_FOUND));
    }

    if (appointment.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('已取消的预约不能标记爽约', HttpCode.BAD_REQUEST));
    }

    if (appointment.status === 'no_show') {
      await session.abortTransaction();
      return res.status(HttpCode.BAD_REQUEST).json(fail('预约已标记爽约', HttpCode.BAD_REQUEST));
    }

    appointment.status = 'no_show';
    appointment.noShowReason = reason;
    await appointment.save({ session });

    const slot = await Slot.findById(appointment.slotId).session(session);
    if (slot) {
      slot.status = 'available';
      slot.patientName = undefined;
      slot.patientPhone = undefined;
      slot.lockedAt = undefined;
      slot.appointmentId = undefined;
      await slot.save({ session });
    }

    await session.commitTransaction();

    return res.json(success({ appointment }, '标记成功'));
  } catch (error) {
    await session.abortTransaction();
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  } finally {
    session.endSession();
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

    return res.json(success({ appointment }, '查询成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function checkDuplicateBookingHandler(req, res) {
  try {
    const { doctorId, patientPhone, slotDate } = req.query;

    if (!doctorId || !patientPhone || !slotDate) {
      return res.status(HttpCode.BAD_REQUEST).json(fail('参数不完整', HttpCode.BAD_REQUEST));
    }

    const isDuplicate = await checkDuplicateBooking(doctorId, patientPhone, slotDate);

    return res.json(success({ isDuplicate }, '查询成功'));
  } catch (error) {
    return res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}
