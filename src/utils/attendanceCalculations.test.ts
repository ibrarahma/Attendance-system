import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendancePercentage,
  formatPercentage,
  isAttendanceShortage,
  calculateAttendanceDifference,
  aggregateStudentAttendance,
  SessionRecord,
} from './attendanceCalculations';

test('calculateAttendancePercentage handles normal cases correctly', () => {
  // 17 out of 20 = 85.0%
  assert.equal(calculateAttendancePercentage(17, 20), 85.0);
  // 15 out of 20 = 75.0%
  assert.equal(calculateAttendancePercentage(15, 20), 75.0);
  // 14 out of 20 = 70.0%
  assert.equal(calculateAttendancePercentage(14, 20), 70.0);
  // 2 out of 3 = 66.7%
  assert.equal(calculateAttendancePercentage(2, 3), 66.7);
});

test('calculateAttendancePercentage handles zero held classes without division errors', () => {
  assert.equal(calculateAttendancePercentage(0, 0), 0);
  assert.equal(calculateAttendancePercentage(5, 0), 0);
});

test('calculateAttendancePercentage clamps negative or excess values safely', () => {
  assert.equal(calculateAttendancePercentage(-1, 10), 0);
  assert.equal(calculateAttendancePercentage(15, 10), 100);
});

test('formatPercentage formats to 1 decimal place with percent symbol', () => {
  assert.equal(formatPercentage(85), '85.0%');
  assert.equal(formatPercentage(66.666), '66.7%');
  assert.equal(formatPercentage(0), '0.0%');
});

test('isAttendanceShortage checks threshold accurately', () => {
  assert.equal(isAttendanceShortage(74.9, 20, 75), true);
  assert.equal(isAttendanceShortage(75.0, 20, 75), false);
  assert.equal(isAttendanceShortage(80.0, 20, 75), false);
  // When zero classes have been held, it should not falsely flag a shortage
  assert.equal(isAttendanceShortage(0, 0, 75), false);
});

test('calculateAttendanceDifference tracks CR modification change count', () => {
  // If CR marked 18 and actual was 16, diff is +2
  assert.equal(calculateAttendanceDifference(18, 16), 2);
  // If CR reduced from 15 to 14, diff is -1
  assert.equal(calculateAttendanceDifference(14, 15), -1);
  assert.equal(calculateAttendanceDifference(15, 15), 0);
});

test('aggregateStudentAttendance excludes cancelled sessions', () => {
  const records: SessionRecord[] = [
    { sessionId: 's1', isCancelled: false, actualStatus: 'PRESENT' },
    { sessionId: 's2', isCancelled: false, actualStatus: 'PRESENT' },
    { sessionId: 's3', isCancelled: false, actualStatus: 'ABSENT', crStatus: 'PRESENT' }, // CR edited this to PRESENT
    { sessionId: 's4', isCancelled: true, actualStatus: 'ABSENT' }, // Cancelled, must not count
  ];

  const summary = aggregateStudentAttendance(records, 75);
  // Total held classes = 3 (s1, s2, s3, excluding s4)
  assert.equal(summary.classesHeld, 3);
  // Actual attended = 2 (s1, s2)
  assert.equal(summary.actualAttended, 2);
  assert.equal(summary.actualPercentage, 66.7);
  assert.equal(summary.isShortage, true);

  // CR attended = 3 (s1, s2, and edited s3)
  assert.equal(summary.crAttended, 3);
  assert.equal(summary.crPercentage, 100.0);
  assert.equal(summary.isCrShortage, false);
  assert.equal(summary.difference, 1);
});
