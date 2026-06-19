import dayjs from 'dayjs';

export function formatDate(date, format = 'YYYY-MM-DD') {
  return dayjs(date).format(format);
}

export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  return dayjs(date).format(format);
}

export function parseDate(dateStr, format = 'YYYY-MM-DD') {
  return dayjs(dateStr, format).toDate();
}

export function addDays(date, days) {
  return dayjs(date).add(days, 'day').toDate();
}

export function addMinutes(date, minutes) {
  return dayjs(date).add(minutes, 'minute').toDate();
}

export function isSameDay(date1, date2) {
  return dayjs(date1).isSame(date2, 'day');
}

export function diffMinutes(date1, date2) {
  return dayjs(date1).diff(dayjs(date2), 'minute');
}

export function isBefore(date1, date2) {
  return dayjs(date1).isBefore(date2);
}

export function isAfter(date1, date2) {
  return dayjs(date1).isAfter(date2);
}

export function startOfDay(date) {
  return dayjs(date).startOf('day').toDate();
}

export function endOfDay(date) {
  return dayjs(date).endOf('day').toDate();
}

export function splitTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  let current = dayjs(startTime);
  const end = dayjs(endTime);

  while (current.isBefore(end) || current.isSame(end, 'minute')) {
    const slotEnd = current.add(durationMinutes, 'minute');
    if (slotEnd.isAfter(end)) break;

    slots.push({
      startTime: current.format('HH:mm'),
      endTime: slotEnd.format('HH:mm'),
      startDateTime: current.format(),
      endDateTime: slotEnd.format()
    });

    current = slotEnd;
  }

  return slots;
}

export { dayjs };
