import dayjs from 'dayjs';
import customParseFormatModule from 'dayjs/plugin/customParseFormat.js';

const customParseFormat = customParseFormatModule.default || customParseFormatModule;
dayjs.extend(customParseFormat);

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
  const refDate = '2000-01-01';
  const start = dayjs(`${refDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
  const end = dayjs(`${refDate} ${endTime}`, 'YYYY-MM-DD HH:mm');

  if (!start.isValid() || !end.isValid() || !start.isBefore(end)) {
    return [];
  }

  const slots = [];
  let current = start;

  while (current.isBefore(end)) {
    const slotEnd = current.add(durationMinutes, 'minute');
    if (slotEnd.isAfter(end)) break;

    slots.push({
      startTime: current.format('HH:mm'),
      endTime: slotEnd.format('HH:mm')
    });

    current = slotEnd;
  }

  return slots;
}

export { dayjs };
