import Appointment from '../models/Appointment.js';
import Schedule from '../models/Schedule.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
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
