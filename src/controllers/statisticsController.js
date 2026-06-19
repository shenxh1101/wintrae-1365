import Appointment from '../models/Appointment.js';
import Schedule from '../models/Schedule.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import { success, fail, HttpCode } from '../utils/response.js';
import { startOfDay, endOfDay, formatDate, dayjs } from '../utils/dateUtils.js';

function calculateStats(appointments) {
  const confirmed = appointments.filter(a => a.status === 'confirmed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const noShow = appointments.filter(a => a.status === 'no_show').length;

  const totalAppointments = confirmed + cancelled + noShow;
  const bookedTotal = confirmed + noShow;

  const cancelRate = totalAppointments > 0 ? (cancelled / totalAppointments).toFixed(4) : 0;
  const noShowRate = bookedTotal > 0 ? (noShow / bookedTotal).toFixed(4) : 0;

  return {
    appointmentCount: bookedTotal,
    cancelCount: cancelled,
    noShowCount: noShow,
    cancelRate: parseFloat(cancelRate),
    noShowRate: parseFloat(noShowRate)
  };
}

export async function getDepartmentStats(req, res) {
  try {
    const { startDate, endDate, department, doctorId } = req.query;

    const slotFilter = {};
    if (startDate) slotFilter.date = { $gte: startOfDay(new Date(startDate)) };
    if (endDate) {
      slotFilter.date = slotFilter.date || {};
      slotFilter.date.$lte = endOfDay(new Date(endDate));
    }
    if (doctorId) slotFilter.doctorId = doctorId;

    const slots = await Slot.find(slotFilter).select('_id date doctorId');
    const slotIds = slots.map(s => s._id);

    const doctorFilter = {};
    if (department) doctorFilter.department = department;
    if (doctorId) doctorFilter._id = doctorId;
    const doctors = await Doctor.find(doctorFilter).select('_id name department');
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));

    const filteredSlots = slots.filter(s => doctorMap.has(s.doctorId.toString()));
    const filteredSlotIds = filteredSlots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: filteredSlotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    }).populate('slotId', 'date doctorId');

    const deptMap = new Map();
    for (const apt of appointments) {
      const doctor = doctorMap.get(apt.slotId.doctorId.toString());
      if (!doctor) continue;

      const deptName = doctor.department;
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, []);
      }
      deptMap.get(deptName).push(apt);
    }

    const stats = [];
    for (const [deptName, apts] of deptMap.entries()) {
      const deptStats = calculateStats(apts);
      stats.push({
        department: deptName,
        ...deptStats
      });
    }

    stats.sort((a, b) => b.appointmentCount - a.appointmentCount);

    res.json(success(stats));
  } catch (error) {
    res.status(HttpCode.INTERNAL_ERROR).json(fail(error.message, HttpCode.INTERNAL_ERROR));
  }
}

export async function getDoctorStats(req, res) {
  try {
    const { startDate, endDate, department, doctorId } = req.query;

    const slotFilter = {};
    if (startDate) slotFilter.date = { $gte: startOfDay(new Date(startDate)) };
    if (endDate) {
      slotFilter.date = slotFilter.date || {};
      slotFilter.date.$lte = endOfDay(new Date(endDate));
    }
    if (doctorId) slotFilter.doctorId = doctorId;

    const slots = await Slot.find(slotFilter).select('_id date doctorId');
    const slotIds = slots.map(s => s._id);

    const doctorFilter = {};
    if (department) doctorFilter.department = department;
    if (doctorId) doctorFilter._id = doctorId;
    const doctors = await Doctor.find(doctorFilter).select('_id name department');
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));

    const filteredSlots = slots.filter(s => doctorMap.has(s.doctorId.toString()));
    const filteredSlotIds = filteredSlots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: filteredSlotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    }).populate('slotId', 'date doctorId');

    const docMap = new Map();
    for (const apt of appointments) {
      const docId = apt.slotId.doctorId.toString();
      const doctor = doctorMap.get(docId);
      if (!doctor) continue;

      if (!docMap.has(docId)) {
        docMap.set(docId, []);
      }
      docMap.get(docId).push(apt);
    }

    const stats = [];
    for (const [docId, apts] of docMap.entries()) {
      const doctor = doctorMap.get(docId);
      const docStats = calculateStats(apts);
      stats.push({
        doctorId: docId,
        doctorName: doctor.name,
        department: doctor.department,
        ...docStats
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
    const { startDate, endDate, department, doctorId } = req.query;

    const slotFilter = {};
    if (startDate) slotFilter.date = { $gte: startOfDay(new Date(startDate)) };
    if (endDate) {
      slotFilter.date = slotFilter.date || {};
      slotFilter.date.$lte = endOfDay(new Date(endDate));
    }
    if (doctorId) slotFilter.doctorId = doctorId;

    const slots = await Slot.find(slotFilter).select('_id date doctorId');
    const slotIds = slots.map(s => s._id);

    const doctorFilter = {};
    if (department) doctorFilter.department = department;
    const doctors = await Doctor.find(doctorFilter).select('_id department');
    const doctorMap = new Map(doctors.map(d => [d._id.toString(), d]));

    let filteredSlots = slots;
    if (department) {
      filteredSlots = slots.filter(s => doctorMap.has(s.doctorId.toString()));
    }
    const filteredSlotIds = filteredSlots.map(s => s._id);

    const appointments = await Appointment.find({
      slotId: { $in: filteredSlotIds },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    }).populate('slotId', 'date doctorId');

    const dateMap = new Map();
    for (const apt of appointments) {
      const dateStr = formatDate(apt.slotId.date);
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr).push(apt);
    }

    const stats = [];
    for (const [date, apts] of dateMap.entries()) {
      const dayStats = calculateStats(apts);
      stats.push({
        date,
        ...dayStats
      });
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

    const scheduleFilter = { status: 'active' };
    if (startDate) scheduleFilter.date = { $gte: startOfDay(new Date(startDate)) };
    if (endDate) {
      scheduleFilter.date = scheduleFilter.date || {};
      scheduleFilter.date.$lte = endOfDay(new Date(endDate));
    }

    const schedules = await Schedule.find(scheduleFilter)
      .populate('doctorId', 'name department');

    const scheduleIds = schedules.map(s => s._id);

    const slots = await Slot.find({ scheduleId: { $in: scheduleIds } });
    const slotMap = new Map();
    for (const slot of slots) {
      const sid = slot.scheduleId.toString();
      if (!slotMap.has(sid)) {
        slotMap.set(sid, []);
      }
      slotMap.get(sid).push(slot);
    }

    const appointments = await Appointment.find({
      slotId: { $in: slots.map(s => s._id) },
      status: { $in: ['confirmed', 'cancelled', 'no_show'] }
    });
    const aptMap = new Map();
    for (const apt of appointments) {
      const sid = apt.slotId.toString();
      if (!aptMap.has(sid)) {
        aptMap.set(sid, []);
      }
      aptMap.get(sid).push(apt);
    }

    const abnormalSchedules = [];
    for (const schedule of schedules) {
      const scheduleSlots = slotMap.get(schedule._id.toString()) || [];
      if (scheduleSlots.length < minSlots) continue;

      const allCancelled = scheduleSlots.length > 0 && 
        scheduleSlots.every(s => s.status === 'cancelled');

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
