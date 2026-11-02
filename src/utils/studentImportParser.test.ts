import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeCellString,
  cleanRollNumber,
  validateAndParseStudentRows,
  normalizeHeader,
} from './studentImportParser';

test('sanitizeCellString neutralizes formula injection characters', () => {
  assert.equal(sanitizeCellString('=CMD()'), 'CMD()');
  assert.equal(sanitizeCellString('+12345'), '12345');
  assert.equal(sanitizeCellString('@SUM(A1)'), 'SUM(A1)');
  assert.equal(sanitizeCellString('John Doe'), 'John Doe');
});

test('cleanRollNumber preserves leading zeros and trims spaces', () => {
  assert.equal(cleanRollNumber(' 007 '), '007');
  assert.equal(cleanRollNumber('0124'), '0124');
  assert.equal(cleanRollNumber('CS-001'), 'CS-001');
});

test('normalizeHeader recognizes common synonyms', () => {
  assert.equal(normalizeHeader('Roll No'), 'roll_number');
  assert.equal(normalizeHeader('Roll Number'), 'roll_number');
  assert.equal(normalizeHeader('Student Name'), 'student_name');
  assert.equal(normalizeHeader('Full Name'), 'student_name');
  assert.equal(normalizeHeader('Enrollment No.'), 'enrollment_number');
  assert.equal(normalizeHeader('Branch'), 'department');
  assert.equal(normalizeHeader('Sem'), 'semester');
});

test('validateAndParseStudentRows flags missing fields and blank rows', () => {
  const rows = [
    { 'Roll Number': '01', 'Student Name': 'Alice' },
    { 'Roll Number': '', 'Student Name': '' }, // completely blank -> ignored
    { 'Roll Number': '02', 'Student Name': '' }, // missing name -> invalid
    { 'Roll Number': '', 'Student Name': 'Bob' }, // missing roll -> invalid
  ];

  const result = validateAndParseStudentRows(rows);
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].roll_number, '01');
  assert.equal(result.blankRowsCount, 1);
  assert.equal(result.invalidRows.length, 2);
});

test('validateAndParseStudentRows detects duplicates in file and against database', () => {
  const existingDb = {
    rollNumbers: new Set(['01', '02']),
    enrollmentNumbers: new Set(['ENR01']),
  };

  const rows = [
    { 'Roll No': '01', 'Name': 'Existing In DB' }, // In DB duplicate
    { 'Roll No': '03', 'Name': 'Charlie' },
    { 'Roll No': '03', 'Name': 'Charlie Duplicate' }, // Duplicate in file
    { 'Roll No': '04', 'Name': 'Diana' },
  ];

  const result = validateAndParseStudentRows(rows, { existingDb });

  assert.equal(result.validRows.length, 2); // 03 (first occurrence) and 04
  assert.equal(result.duplicateInDbRows.length, 1);
  assert.equal(result.duplicateInDbRows[0].row.roll_number, '01');
  assert.equal(result.duplicateInFileRows.length, 1);
  assert.equal(result.duplicateInFileRows[0].row.roll_number, '03');
});
