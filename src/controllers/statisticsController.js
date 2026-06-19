import Appointment from '../models/Appointment.js';
import Schedule from '../models/Schedule.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import Waitlist from '../models/Waitlist.js';
import Notification from '../models/Notification.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { startOfDay, endOfDay, formatDate, parseDate } from '../utils/dateUtils.js';

function buildSlotFilter(query) {
  const { startDate, endDate, doctorId } = query;
  const filter = { status: { $ne: 'cancelled' } };
  if (startDate) filter.date = { $gte: startOfDay(parseDate(startDate)) };
  if (endDate) {
    filter.date = filter.date || {};
    filter.date.$lte = endOfDay(parseDate(endDate));
  }
  if (doctorId) filter.doctorId = doctorId;
  return filter;
}

function buildDoctorFilter(query) {
  const { department, doctorId } = query;
  const filter = {};
  if (department) filter.department = department;
  if (doctorId) filter._id = doctorId;
  return filter;
}

function calcSlotStats(slots, appointments) {
  const totalSlots = slots.length;
  const bookedSlots = slots.filter(s => s.status === 'booked').length;
  const availableSlots = slots.filter(s => s.status === 'available').length;
  const suspendedSlots = slots.filter(s => s.status === 'suspended').length;
  const effectiveTotal = totalSlots - suspendedSlots;

  const confirmed = appointments.filter(a => a.status === 'confirmed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const noShow = appointments.filter(a => a.status === 'no_show').length;
  const totalAppointments = confirmed + cancelled + noShow;

  const emptyRate = effectiveTotal > 0 ? (effectiveTotal - bookedSlots) / effectiveTotal : 0;
  const cancelRate = totalAppointments > 0 ? cancelled / totalAppointments : 0;

  return {
    totalSlots,
    effectiveTotal,
    bookedSlots,
    availableSlots,
    suspendedSlots,
    appointmentCount: confirmed + noShow,
    cancelCount: cancelled,
    noShowCount: noShow,
    emptyRate: parseFloat(emptyRate.toFixed(4)),
    cancelRate: parseFloat(cancelRate.toFixed(4))
  };
}

export async function getDepartmentStats(req, res) {
  try {
    const slotFilter = buildSlotFilter(req.query);
    const doctorFilter = buildDoctorFilter(req.query);

    const doctors = await Doctor.find(doctorFilter).select('_id name department');
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));
    const validDoctorIds = new Set(doctorMap.keys());

    const slots = await Slot.find(slotFilter).select('_id doctorId date status');
    const filteredSlots = slots.filter(s => validDoctorIds.has(s.doctorId.toString()));
    const slotIds = filteredSlots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: slotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    });

    const deptSlotMap = new Map();
    const deptAptMap = new Map();

    for (const slot of filteredSlots) {
      const doctor = doctorMap.get(slot.doctorId.toString());
      if (!doctor) continue;
      const dept = doctor.department;
      if (!deptSlotMap.has(dept)) deptSlotMap.set(dept, []);
      deptSlotMap.get(dept).push(slot);
    }

    const slotAptMap = new Map();
    for (const apt of appointments) {
      const sid = apt.slotId.toString();
      if (!slotAptMap.has(sid)) slotAptMap.set(sid, []);
      slotAptMap.get(sid).push(apt);
    }

    for (const slot of filteredSlots) {
      const doctor = doctorMap.get(slot.doctorId.toString());
      if (!doctor) continue;
      const dept = doctor.department;
      if (!deptAptMap.has(dept)) deptAptMap.set(dept, []);
      const apts = slotAptMap.get(slot._id.toString()) || [];
      deptAptMap.get(dept).push(...apts);
    }

    const stats = [];
    for (const [dept, deptSlots] of deptSlotMap.entries()) {
      const deptApts = deptAptMap.get(dept) || [];
      const s = calcSlotStats(deptSlots, deptApts);
      stats.push({ department: dept, ...s });
    }

    stats.sort((a, b) => b.appointmentCount - a.appointmentCount);
    res.json(success(stats));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getDoctorStats(req, res) {
  try {
    const slotFilter = buildSlotFilter(req.query);
    const doctorFilter = buildDoctorFilter(req.query);

    const doctors = await Doctor.find(doctorFilter).select('_id name department');
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));
    const validDoctorIds = new Set(doctorMap.keys());

    const slots = await Slot.find(slotFilter).select('_id doctorId date status');
    const filteredSlots = slots.filter(s => validDoctorIds.has(s.doctorId.toString()));
    const slotIds = filteredSlots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: slotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    });

    const docSlotMap = new Map();
    for (const slot of filteredSlots) {
      const docId = slot.doctorId.toString();
      if (!docSlotMap.has(docId)) docSlotMap.set(docId, []);
      docSlotMap.get(docId).push(slot);
    }

    const slotAptMap = new Map();
    for (const apt of appointments) {
      const sid = apt.slotId.toString();
      if (!slotAptMap.has(sid)) slotAptMap.set(sid, []);
      slotAptMap.get(sid).push(apt);
    }

    const docAptMap = new Map();
    for (const slot of filteredSlots) {
      const docId = slot.doctorId.toString();
      if (!docAptMap.has(docId)) docAptMap.set(docId, []);
      const apts = slotAptMap.get(slot._id.toString()) || [];
      docAptMap.get(docId).push(...apts);
    }

    const stats = [];
    for (const [docId, docSlots] of docSlotMap.entries()) {
      const doctor = doctorMap.get(docId);
      const docApts = docAptMap.get(docId) || [];
      const s = calcSlotStats(docSlots, docApts);
      stats.push({
        doctorId: docId,
        doctorName: doctor.name,
        department: doctor.department,
        ...s
      });
    }

    stats.sort((a, b) => b.appointmentCount - a.appointmentCount);
    res.json(success(stats));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getDailyStats(req, res) {
  try {
    const slotFilter = buildSlotFilter(req.query);
    const doctorFilter = buildDoctorFilter(req.query);

    const doctors = await Doctor.find(doctorFilter).select('_id department');
    const validDoctorIds = new Set(doctors.map(d => d._id.toString()));

    const slots = await Slot.find(slotFilter).select('_id doctorId date status');
    const filteredSlots = slots.filter(s => validDoctorIds.has(s.doctorId.toString()));
    const slotIds = filteredSlots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: slotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    });

    const dateSlotMap = new Map();
    for (const slot of filteredSlots) {
      const dateStr = formatDate(slot.date);
      if (!dateSlotMap.has(dateStr)) dateSlotMap.set(dateStr, []);
      dateSlotMap.get(dateStr).push(slot);
    }

    const slotAptMap = new Map();
    for (const apt of appointments) {
      const sid = apt.slotId.toString();
      if (!slotAptMap.has(sid)) slotAptMap.set(sid, []);
      slotAptMap.get(sid).push(apt);
    }

    const dateAptMap = new Map();
    for (const slot of filteredSlots) {
      const dateStr = formatDate(slot.date);
      if (!dateAptMap.has(dateStr)) dateAptMap.set(dateStr, []);
      const apts = slotAptMap.get(slot._id.toString()) || [];
      dateAptMap.get(dateStr).push(...apts);
    }

    const stats = [];
    for (const [date, daySlots] of dateSlotMap.entries()) {
      const dayApts = dateAptMap.get(date) || [];
      const s = calcSlotStats(daySlots, dayApts);
      stats.push({ date, ...s });
    }

    stats.sort((a, b) => a.date.localeCompare(b.date));
    res.json(success(stats));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getAbnormalSchedules(req, res) {
  try {
    const { startDate, endDate, minSlots = 0 } = req.query;

    const scheduleFilter = { status: 'active', type: { $ne: 'suspension' } };
    if (startDate) scheduleFilter.date = { $gte: startOfDay(parseDate(startDate)) };
    if (endDate) {
      scheduleFilter.date = scheduleFilter.date || {};
      scheduleFilter.date.$lte = endOfDay(parseDate(endDate));
    }

    const schedules = await Schedule.find(scheduleFilter)
      .populate('doctorId', 'name department');

    const scheduleIds = schedules.map(s => s._id);

    const slots = await Slot.find({ scheduleId: { $in: scheduleIds } });
    const slotMap = new Map();
    for (const slot of slots) {
      const sid = slot.scheduleId.toString();
      if (!slotMap.has(sid)) slotMap.set(sid, []);
      slotMap.get(sid).push(slot);
    }

    const appointments = await Appointment.find({
      slotId: { $in: slots.map(s => s._id) },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    });
    const aptMap = new Map();
    for (const apt of appointments) {
      const sid = apt.slotId.toString();
      if (!aptMap.has(sid)) aptMap.set(sid, []);
      aptMap.get(sid).push(apt);
    }

    const abnormalSchedules = [];
    for (const schedule of schedules) {
      const scheduleSlots = slotMap.get(schedule._id.toString()) || [];
      if (scheduleSlots.length < minSlots) continue;

      const allCancelled = scheduleSlots.length > 0 &&
        scheduleSlots.every(s => s.status === 'cancelled' || s.status === 'suspended');

      let appointmentCount = 0;
      for (const slot of scheduleSlots) {
        const apts = aptMap.get(slot._id.toString()) || [];
        const bookedApts = apts.filter(a => a.status === 'confirmed' || a.status === 'no_show');
        appointmentCount += bookedApts.length;
      }

      const zeroAppointments = scheduleSlots.length > 0 && appointmentCount === 0;

      if (allCancelled || zeroAppointments) {
        abnormalSchedules.push({
          id: schedule._id,
          date: formatDate(schedule.date),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          doctorName: schedule.doctorId?.name,
          department: schedule.doctorId?.department,
          totalSlots: scheduleSlots.length,
          appointmentCount,
          allCancelled,
          zeroAppointments,
          abnormalType: allCancelled ? 'all_cancelled' : 'zero_appointments'
        });
      }
    }

    abnormalSchedules.sort((a, b) => a.date.localeCompare(b.date));
    res.json(success(abnormalSchedules));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getAdminSummary(req, res) {
  try {
    const { department, doctorId, date } = req.query;

    const doctorFilter = {};
    if (department) doctorFilter.department = department;
    if (doctorId) doctorFilter._id = doctorId;

    const doctors = await Doctor.find(doctorFilter).select('_id name department');
    const doctorIds = doctors.map(d => d._id);
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));

    let slotFilter = { doctorId: { $in: doctorIds } };
    if (date) {
      const dayStart = startOfDay(parseDate(date));
      const dayEnd = endOfDay(parseDate(date));
      slotFilter.date = { $gte: dayStart, $lte: dayEnd };
    }

    const slots = await Slot.find(slotFilter).select('_id doctorId date startTime endTime status scheduleId');
    const slotIds = slots.map(s => s._id);

    const scheduleIds = [...new Set(slots.map(s => s.scheduleId).filter(Boolean))];
    const schedules = await Schedule.find({ _id: { $in: scheduleIds } })
      .select('_id doctorId date startTime endTime type status reason');
    const scheduleMap = new Map(schedules.map(s => [s._id.toString(), s]));

    const appointments = await Appointment.find({
      slotId: { $in: slotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show', 'pending'] }
    }).select('_id slotId patientName patientPhone status cancelReason createdAt');

    const waitlists = await Waitlist.find({
      slotId: { $in: slotIds },
      status: { $in: ['waiting', 'notification_sent'] }
    }).select('_id slotId doctorId patientName patientPhone position status createdAt');

    const summary = [];
    for (const doctor of doctors) {
      const docSlots = slots.filter(s => s.doctorId.toString() === doctor._id.toString());
      const docSlotIds = docSlots.map(s => s._id);
      const docAppointments = appointments.filter(a => docSlotIds.some(id => id.toString() === a.slotId.toString()));
      const docWaitlists = waitlists.filter(w => docSlotIds.some(id => id.toString() === w.slotId.toString()));
      const docSchedules = schedules.filter(s => s.doctorId.toString() === doctor._id.toString());

      const totalSlots = docSlots.length;
      const bookedSlots = docSlots.filter(s => s.status === 'booked').length;
      const availableSlots = docSlots.filter(s => s.status === 'available').length;
      const lockedSlots = docSlots.filter(s => s.status === 'locked').length;
      const suspendedSlots = docSlots.filter(s => s.status === 'suspended').length;
      const effectiveTotal = totalSlots - suspendedSlots;

      const confirmed = docAppointments.filter(a => a.status === 'confirmed').length;
      const cancelled = docAppointments.filter(a => a.status === 'cancelled').length;
      const noShow = docAppointments.filter(a => a.status === 'no_show').length;
      const totalAppointments = confirmed + cancelled + noShow;

      const regularSchedules = docSchedules.filter(s => s.type === 'regular').length;
      const temporarySchedules = docSchedules.filter(s => s.type === 'temporary').length;
      const suspensionSchedules = docSchedules.filter(s => s.type === 'suspension').length;

      const waitingCount = docWaitlists.filter(w => w.status === 'waiting').length;
      const notifiedCount = docWaitlists.filter(w => w.status === 'notification_sent').length;

      const emptyRate = effectiveTotal > 0 ? (effectiveTotal - bookedSlots) / effectiveTotal : 0;
      const cancelRate = totalAppointments > 0 ? cancelled / totalAppointments : 0;

      summary.push({
        doctorId: doctor._id,
        doctorName: doctor.name,
        department: doctor.department,
        date: date ? formatDate(parseDate(date)) : null,
        schedules: {
          total: docSchedules.length,
          regular: regularSchedules,
          temporary: temporarySchedules,
          suspension: suspensionSchedules
        },
        slots: {
          total: totalSlots,
          effective: effectiveTotal,
          booked: bookedSlots,
          available: availableSlots,
          locked: lockedSlots,
          suspended: suspendedSlots
        },
        appointments: {
          total: totalAppointments,
          confirmed,
          cancelled,
          noShow
        },
        waitlist: {
          total: docWaitlists.length,
          waiting: waitingCount,
          notificationSent: notifiedCount
        },
        rates: {
          emptyRate: parseFloat(emptyRate.toFixed(4)),
          cancelRate: parseFloat(cancelRate.toFixed(4)),
          fillRate: parseFloat((bookedSlots / Math.max(effectiveTotal, 1)).toFixed(4))
        }
      });
    }

    summary.sort((a, b) => b.appointments.total - a.appointments.total);
    res.json(success(summary));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getScheduleDetail(req, res) {
  try {
    const { scheduleId } = req.params;

    const schedule = await Schedule.findById(scheduleId).populate('doctorId', 'name department');
    if (!schedule) {
      return res.status(HttpCode.NOT_FOUND).json(fail('排班不存在', HttpCode.NOT_FOUND));
    }

    const slots = await Slot.find({ scheduleId }).sort({ startTime: 1 });
    const slotIds = slots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: slotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show', 'pending'] }
    }).populate('slotId', 'startTime endTime');

    const waitlists = await Waitlist.find({
      slotId: { $in: slotIds },
      status: { $in: ['waiting', 'notification_sent', 'confirmed', 'cancelled'] }
    }).sort({ position: 1 });

    const notifications = await Notification.find({
      appointmentId: { $in: appointments.map(a => a._id) }
    });

    const totalSlots = slots.length;
    const bookedSlots = slots.filter(s => s.status === 'booked').length;
    const availableSlots = slots.filter(s => s.status === 'available').length;
    const lockedSlots = slots.filter(s => s.status === 'locked').length;
    const suspendedSlots = slots.filter(s => s.status === 'suspended').length;
    const cancelledSlots = slots.filter(s => s.status === 'cancelled').length;
    const effectiveTotal = totalSlots - suspendedSlots - cancelledSlots;

    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;
    const noShow = appointments.filter(a => a.status === 'no_show').length;
    const totalAppointments = confirmed + cancelled + noShow;

    const emptyRate = effectiveTotal > 0 ? (effectiveTotal - bookedSlots) / effectiveTotal : 0;
    const cancelRate = totalAppointments > 0 ? cancelled / totalAppointments : 0;

    const cancelReasons = {};
    for (const apt of appointments.filter(a => a.status === 'cancelled' && a.cancelReason)) {
      const reason = apt.cancelReason;
      cancelReasons[reason] = (cancelReasons[reason] || 0) + 1;
    }

    const slotDetails = slots.map(slot => {
      const slotApts = appointments.filter(a => a.slotId.toString() === slot._id.toString());
      const slotWaitlists = waitlists.filter(w => w.slotId.toString() === slot._id.toString());

      return {
        slotId: slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        patientName: slot.patientName,
        patientPhone: slot.patientPhone,
        appointments: slotApts,
        waitlistCount: slotWaitlists.length
      };
    });

    const abnormalAnalysis = [];
    if (emptyRate >= 0.5 && effectiveTotal >= 3) {
      if (suspendedSlots > 0) {
        abnormalAnalysis.push(`高空号率可能与停诊有关，共冻结 ${suspendedSlots} 个号源`);
      }
      if (availableSlots >= effectiveTotal * 0.5) {
        abnormalAnalysis.push(`有 ${availableSlots} 个号源未被预约，可能与排班时段选择、医生知名度或科室需求有关`);
      }
    }
    if (cancelRate >= 0.3 && totalAppointments >= 3) {
      const topReason = Object.entries(cancelReasons).sort((a, b) => b[1] - a[1])[0];
      if (topReason) {
        abnormalAnalysis.push(`高取消率可能与"${topReason[0]}"有关，共 ${topReason[1]} 例`);
      }
      if (lockedSlots > 0) {
        abnormalAnalysis.push(`当前有 ${lockedSlots} 个号源处于锁定状态未完成确认`);
      }
    }
    if (schedule.type === 'suspension') {
      abnormalAnalysis.push(`该排班为停诊记录，原因：${schedule.reason || '未填写'}`);
    }

    res.json(success({
      schedule: {
        id: schedule._id,
        doctorName: schedule.doctorId?.name,
        department: schedule.doctorId?.department,
        date: formatDate(schedule.date),
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        type: schedule.type,
        status: schedule.status,
        reason: schedule.reason
      },
      summary: {
        totalSlots,
        effectiveTotal,
        bookedSlots,
        availableSlots,
        lockedSlots,
        suspendedSlots,
        cancelledSlots,
        totalAppointments,
        confirmed,
        cancelled,
        noShow,
        waitlistCount: waitlists.length,
        emptyRate: parseFloat(emptyRate.toFixed(4)),
        cancelRate: parseFloat(cancelRate.toFixed(4))
      },
      cancelReasons,
      abnormalAnalysis,
      slotDetails,
      notifications
    }));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}
