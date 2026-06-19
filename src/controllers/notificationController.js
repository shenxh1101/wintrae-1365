import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import Slot from '../models/Slot.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { startOfDay, addDays, dayjs } from '../utils/dateUtils.js';

export async function getPendingReminders(req, res) {
  try {
    const { days = 7, doctorId, patientPhone } = req.query;

    const startDate = startOfDay(new Date());
    const endDate = addDays(startDate, days);

    const slotFilter = {
      date: { $gte: startDate, $lte: endDate }
    };
    if (doctorId) {
      slotFilter.doctorId = doctorId;
    }

    const slots = await Slot.find(slotFilter).select('_id date startTime endTime doctorId');
    const slotIds = slots.map(s => s._id);

    const appointmentFilter = {
      slotId: { $in: slotIds },
      status: 'confirmed'
    };
    if (patientPhone) {
      appointmentFilter.patientPhone = patientPhone;
    }

    const appointments = await Appointment.find(appointmentFilter)
      .populate('slotId', 'date startTime endTime')
      .populate('doctorId', 'name department');

    const slotMap = new Map(slots.map(s => [s._id.toString(), s]));
    const reminders = appointments.map(apt => {
      const slot = slotMap.get(apt.slotId._id.toString());
      return {
        id: apt._id,
        patientName: apt.patientName,
        patientPhone: apt.patientPhone,
        date: slot ? slot.date : apt.slotId.date,
        startTime: slot ? slot.startTime : apt.slotId.startTime,
        endTime: slot ? slot.endTime : apt.slotId.endTime,
        doctorName: apt.doctorId?.name,
        department: apt.doctorId?.department
      };
    });

    reminders.sort((a, b) => {
      const dateCompare = dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    res.json(success(reminders));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(HttpCode.NOT_FOUND).json(fail('通知不存在', HttpCode.NOT_FOUND));
    }

    res.json(success(notification));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getNotificationList(req, res) {
  try {
    const { doctorId, patientPhone, read, page = 1, pageSize = 10 } = req.query;

    const filter = {};
    if (doctorId) filter.doctorId = doctorId;
    if (patientPhone) filter.patientPhone = patientPhone;
    if (read !== undefined) filter.read = read === 'true';

    const skip = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('appointmentId', 'patientName patientPhone status')
        .populate('doctorId', 'name department')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter)
    ]);

    res.json(success({
      list: notifications,
      total,
      page: parseInt(page),
      pageSize: limit
    }));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function createNotification(data) {
  const notification = new Notification(data);
  await notification.save();
  return notification;
}
