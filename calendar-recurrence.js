(function (root, factory) {
  const recurrence = factory();
  if (typeof module === 'object' && module.exports) module.exports = recurrence;
  if (root) root.CalendarRecurrence = recurrence;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function localDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function monthlyDate(startDate, year, month) {
    const day = Math.min(startDate.getDate(), new Date(year, month + 1, 0).getDate());
    return new Date(year, month, day);
  }

  function monthlyWeekday(startDate, year, month) {
    const ordinal = Math.floor((startDate.getDate() - 1) / 7) + 1;
    const first = new Date(year, month, 1);
    const day = 1 + ((startDate.getDay() - first.getDay() + 7) % 7) + ((ordinal - 1) * 7);
    return day <= new Date(year, month + 1, 0).getDate() ? new Date(year, month, day) : null;
  }

  function monthlyOccurrence(event, startDate, year, month) {
    return event.monthly_mode === 'weekday'
      ? monthlyWeekday(startDate, year, month)
      : monthlyDate(startDate, year, month);
  }

  function occurrenceNumber(event, startDate, occurrence) {
    if (event.recurrence === 'weekly') {
      return Math.round((occurrence - startDate) / 604800000) + 1;
    }

    let count = 0;
    const finalMonth = ((occurrence.getFullYear() - startDate.getFullYear()) * 12)
      + occurrence.getMonth()
      - startDate.getMonth();
    for (let offset = 0; offset <= finalMonth; offset += 1) {
      const candidate = monthlyOccurrence(
        event,
        startDate,
        startDate.getFullYear(),
        startDate.getMonth() + offset
      );
      if (candidate && candidate >= startDate) count += 1;
    }
    return count;
  }

  function isWithinRepeatLimit(event, startDate, occurrence) {
    if (event.recurrence_end_type === 'date' && event.recurrence_end_date) {
      if (dateKey(occurrence) > event.recurrence_end_date) return false;
    }
    if (event.recurrence_end_type === 'count' && Number.isInteger(event.recurrence_end_count)) {
      return occurrenceNumber(event, startDate, occurrence) <= event.recurrence_end_count;
    }
    return true;
  }

  function occurrencesForMonth(event, year, month) {
    const startDate = localDate(event.event_date);
    if (Number.isNaN(startDate.getTime())) return [];

    if ((year < startDate.getFullYear()) || (year === startDate.getFullYear() && month < startDate.getMonth())) {
      return [];
    }

    if ((event.recurrence || 'once') === 'once') {
      return startDate.getFullYear() === year && startDate.getMonth() === month ? [startDate] : [];
    }

    const candidates = [];
    if (event.recurrence === 'weekly') {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const occurrence = new Date(year, month, day);
        if (occurrence >= startDate && occurrence.getDay() === startDate.getDay()) candidates.push(occurrence);
      }
    } else if (event.recurrence === 'monthly') {
      const occurrence = monthlyOccurrence(event, startDate, year, month);
      if (occurrence && occurrence >= startDate) candidates.push(occurrence);
    }

    return candidates.filter((occurrence) => isWithinRepeatLimit(event, startDate, occurrence));
  }

  function lastOccurrenceDate(event) {
    const startDate = localDate(event.event_date);
    if (Number.isNaN(startDate.getTime()) || (event.recurrence || 'once') === 'once') return startDate;
    if (event.recurrence_end_type === 'date' && event.recurrence_end_date) {
      return localDate(event.recurrence_end_date);
    }
    if (event.recurrence_end_type !== 'count' || !Number.isInteger(event.recurrence_end_count)) {
      return null;
    }
    if (event.recurrence === 'weekly') {
      return new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + ((event.recurrence_end_count - 1) * 7)
      );
    }

    let count = 0;
    for (let offset = 0; offset < event.recurrence_end_count * 3; offset += 1) {
      const occurrence = monthlyOccurrence(
        event,
        startDate,
        startDate.getFullYear(),
        startDate.getMonth() + offset
      );
      if (occurrence && occurrence >= startDate) {
        count += 1;
        if (count === event.recurrence_end_count) return occurrence;
      }
    }
    return null;
  }

  return { dateKey, lastOccurrenceDate, occurrencesForMonth };
});
