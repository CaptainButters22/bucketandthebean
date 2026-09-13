const assert = require('node:assert/strict');
const test = require('node:test');
const { dateKey, lastOccurrenceDate, occurrencesForMonth } = require('./calendar-recurrence.js');

function keys(event, year, month) {
  return occurrencesForMonth(event, year, month).map(dateKey);
}

test('repeats monthly by calendar date', () => {
  const event = { event_date: '2026-01-31', recurrence: 'monthly', monthly_mode: 'date' };
  assert.deepEqual(keys(event, 2026, 1), ['2026-02-28']);
});

test('applies occurrence counts from a non-January monthly start', () => {
  const event = {
    event_date: '2026-09-12',
    recurrence: 'monthly',
    monthly_mode: 'date',
    recurrence_end_type: 'count',
    recurrence_end_count: 2
  };
  assert.deepEqual(keys(event, 2026, 9), ['2026-10-12']);
  assert.deepEqual(keys(event, 2026, 10), []);
});

test('repeats monthly by ordinal weekday', () => {
  const event = { event_date: '2026-09-02', recurrence: 'monthly', monthly_mode: 'weekday' };
  assert.deepEqual(keys(event, 2026, 9), ['2026-10-07']);
});

test('stops after the configured total occurrence count', () => {
  const event = {
    event_date: '2026-09-02',
    recurrence: 'weekly',
    recurrence_end_type: 'count',
    recurrence_end_count: 3
  };
  assert.deepEqual(keys(event, 2026, 8), ['2026-09-02', '2026-09-09', '2026-09-16']);
  assert.deepEqual(keys(event, 2026, 9), []);
});

test('includes an occurrence on the configured end date', () => {
  const event = {
    event_date: '2026-09-02',
    recurrence: 'weekly',
    recurrence_end_type: 'date',
    recurrence_end_date: '2026-09-16'
  };
  assert.deepEqual(keys(event, 2026, 8), ['2026-09-02', '2026-09-09', '2026-09-16']);
});

test('counts only actual fifth-weekday occurrences', () => {
  const event = {
    event_date: '2026-09-30',
    recurrence: 'monthly',
    monthly_mode: 'weekday',
    recurrence_end_type: 'count',
    recurrence_end_count: 2
  };
  assert.deepEqual(keys(event, 2026, 9), []);
  assert.deepEqual(keys(event, 2026, 11), ['2026-12-30']);
  assert.deepEqual(keys(event, 2027, 2), []);
  assert.equal(dateKey(lastOccurrenceDate(event)), '2026-12-30');
});
