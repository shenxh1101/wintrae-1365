import Notification from '../models/Notification.js';

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function createAppointmentConfirmed(appointment, slot, doctor, session = null) {
  const content = `您好${appointment.patientName}，您的预约已确认。医生：${doctor.name}，科室：${doctor.department}，时间：${formatDate(slot.date)} ${slot.startTime}-${slot.endTime}。请按时就诊。`;
  
  const notification = new Notification({
    appointmentId: appointment._id,
    doctorId: doctor._id,
    patientPhone: appointment.patientPhone,
    type: 'confirmed',
    content
  });

  return session ? notification.save({ session }) : notification.save();
}

export async function createAppointmentCancelled(appointment, slot, doctor, reason, session = null) {
  const content = `您好${appointment.patientName}，您的预约已取消。医生：${doctor.name}，科室：${doctor.department}，时间：${formatDate(slot.date)} ${slot.startTime}-${slot.endTime}。原因：${reason}。`;
  
  const notification = new Notification({
    appointmentId: appointment._id,
    doctorId: doctor._id,
    patientPhone: appointment.patientPhone,
    type: 'cancelled',
    content
  });

  return session ? notification.save({ session }) : notification.save();
}

export async function createSuspensionNotification(slot, doctor, reason, patientName, patientPhone, appointmentId, session = null) {
  const content = `您好${patientName}，非常抱歉通知您，医生：${doctor.name}，科室：${doctor.department}，时间：${formatDate(slot.date)} ${slot.startTime}-${slot.endTime} 的门诊因故停诊。原因：${reason}。请您重新预约。`;
  
  const notification = new Notification({
    appointmentId,
    doctorId: doctor._id,
    patientPhone,
    type: 'suspension',
    content
  });

  return session ? notification.save({ session }) : notification.save();
}

export async function createWaitlistNotification(waitlist, slot, doctor, session = null) {
  const content = `您好${waitlist.patientName}，您候补的号源已可预约。医生：${doctor.name}，科室：${doctor.department}，时间：${formatDate(slot.date)} ${slot.startTime}-${slot.endTime}。请在30分钟内完成预约，逾期将自动释放。`;
  
  const notification = new Notification({
    waitlistId: waitlist._id,
    doctorId: doctor._id,
    patientPhone: waitlist.patientPhone,
    type: 'waitlist',
    content
  });

  return session ? notification.save({ session }) : notification.save();
}

export default {
  createAppointmentConfirmed,
  createAppointmentCancelled,
  createSuspensionNotification,
  createWaitlistNotification
};
