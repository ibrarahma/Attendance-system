import { ImportValidationResult, ParsedStudentRow } from './types';

/**
 * Sanitizes against spreadsheet formula injection (CSV/Excel injection)
 * Any string beginning with =, +, -, @, or tab/CR is neutralized by stripping or prepending quote.
 */
export function sanitizeCellString(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // If formula indicator detected at start
  if (/^[=+\-@\t\r]/.test(str)) {
    // Strip leading formula character or prefix with single quote
    str = str.replace(/^[=+\-@\t\r]+/, '');
  }
  return str.trim();
}

/**
 * Preserves leading zeros in roll numbers while trimming whitespace
 */
export function cleanRollNumber(val: any): string {
  if (val === null || val === undefined) return '';
  return sanitizeCellString(val);
}

export interface ExistingStudentInfo {
  rollNumbers: Set<string>;
  enrollmentNumbers: Set<string>;
}

export interface ParseOptions {
  existingDb?: ExistingStudentInfo;
  requireUniqueEnrollment?: boolean;
  defaultDepartment?: string;
  defaultSemester?: string;
}

/**
 * Maps arbitrary header keys to normalized field names
 */
export function normalizeHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['enrollmentno', 'enrollmentnumber', 'enrollno', 'enrollment', 'regno', 'registrationno'].some(k => h.includes(k) || h === k)) {
    return 'enrollment_number';
  }
  if (['rollno', 'rollnumber', 'studentroll', 'roll_no'].some(k => h.includes(k) || h === k) || h === 'roll') {
    return 'roll_number';
  }
  if (['studentname', 'name', 'fullname', 'student'].some(k => h.includes(k) || h === k)) {
    return 'student_name';
  }
  if (['department', 'dept', 'branch'].some(k => h.includes(k) || h === k)) {
    return 'department';
  }
  if (['semester', 'sem'].some(k => h.includes(k) || h === k)) {
    return 'semester';
  }
  if (['section', 'sec'].some(k => h.includes(k) || h === k)) {
    return 'section';
  }
  if (['batch'].some(k => h.includes(k) || h === k)) {
    return 'batch';
  }
  return header.trim();
}

/**
 * Validates and classifies raw student rows from Excel / CSV
 */
export function validateAndParseStudentRows(
  rawRows: Array<Record<string, any>>,
  options: ParseOptions = {}
): ImportValidationResult {
  const existingDbRolls = options.existingDb?.rollNumbers || new Set<string>();
  const existingDbEnrollments = options.existingDb?.enrollmentNumbers || new Set<string>();
  const requireUniqueEnrollment = options.requireUniqueEnrollment ?? false;

  const validRows: ParsedStudentRow[] = [];
  const duplicateInFileRows: { row: ParsedStudentRow; reason: string }[] = [];
  const duplicateInDbRows: { row: ParsedStudentRow; reason: string }[] = [];
  const invalidRows: { row: Record<string, any>; reason: string }[] = [];
  let blankRowsCount = 0;

  const seenRollsInFile = new Set<string>();
  const seenEnrollmentsInFile = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // Accounting for 1-based index + header row

    // Map keys to normalized fields
    const normalizedRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const normKey = normalizeHeader(k);
      normalizedRow[normKey] = v;
    }

    const rawRoll = normalizedRow['roll_number'];
    const rawName = normalizedRow['student_name'];
    const rawEnrollment = normalizedRow['enrollment_number'];
    const rawDept = normalizedRow['department'];
    const rawSem = normalizedRow['semester'];
    const rawSec = normalizedRow['section'];
    const rawBatch = normalizedRow['batch'];

    // Check if entire row is blank
    const allValues = Object.values(rawRow)
      .map(v => (v !== null && v !== undefined ? String(v).trim() : ''))
      .join('');
    if (!allValues) {
      blankRowsCount++;
      return;
    }

    const rollNumber = cleanRollNumber(rawRoll);
    const studentName = sanitizeCellString(rawName);
    const enrollmentNumber = rawEnrollment ? sanitizeCellString(rawEnrollment) : '';
    const department = (rawDept ? sanitizeCellString(rawDept) : options.defaultDepartment) || '';
    const semester = (rawSem ? sanitizeCellString(rawSem) : options.defaultSemester) || '';
    const section = rawSec ? sanitizeCellString(rawSec) : '';
    const batch = rawBatch ? sanitizeCellString(rawBatch) : '';

    const parsedStudent: ParsedStudentRow = {
      roll_number: rollNumber,
      student_name: studentName,
      enrollment_number: enrollmentNumber || undefined,
      department: department || undefined,
      semester: semester || undefined,
      section: section || undefined,
      batch: batch || undefined,
      row_number: rowNumber,
    };

    // Validation 1: Required Roll Number
    if (!rollNumber) {
      invalidRows.push({
        row: rawRow,
        reason: `Row ${rowNumber}: Roll Number is missing or empty.`,
      });
      return;
    }

    // Validation 2: Required Student Name
    if (!studentName) {
      invalidRows.push({
        row: rawRow,
        reason: `Row ${rowNumber}: Student Name is missing or empty.`,
      });
      return;
    }

    // Validation 3: Semester value checks if present
    if (semester && !/^[0-9]+$/.test(semester) && !/^(sem|semester)\s*[0-9]+$/i.test(semester)) {
      // If semester is not numeric or recognized
      // Note: allow roman numerals like I, II, III, IV, V, VI, VII, VIII
      if (!/^(I|II|III|IV|V|VI|VII|VIII|[1-8])$/i.test(semester)) {
        invalidRows.push({
          row: rawRow,
          reason: `Row ${rowNumber}: Invalid semester value '${semester}'. Must be 1-8 or roman numeral.`,
        });
        return;
      }
    }

    // Validation 4: Duplicate within file
    const lowerRoll = rollNumber.toLowerCase();
    if (seenRollsInFile.has(lowerRoll)) {
      duplicateInFileRows.push({
        row: parsedStudent,
        reason: `Row ${rowNumber}: Duplicate Roll Number '${rollNumber}' found multiple times in uploaded file.`,
      });
      return;
    }

    // Check duplicate enrollment in file if unique
    if (requireUniqueEnrollment && enrollmentNumber) {
      const lowerEnroll = enrollmentNumber.toLowerCase();
      if (seenEnrollmentsInFile.has(lowerEnroll)) {
        duplicateInFileRows.push({
          row: parsedStudent,
          reason: `Row ${rowNumber}: Duplicate Enrollment Number '${enrollmentNumber}' found in uploaded file.`,
        });
        return;
      }
    }

    // Validation 5: Duplicate in existing database
    if (existingDbRolls.has(lowerRoll)) {
      duplicateInDbRows.push({
        row: parsedStudent,
        reason: `Row ${rowNumber}: Roll Number '${rollNumber}' already exists in database.`,
      });
      return;
    }

    if (requireUniqueEnrollment && enrollmentNumber && existingDbEnrollments.has(enrollmentNumber.toLowerCase())) {
      duplicateInDbRows.push({
        row: parsedStudent,
        reason: `Row ${rowNumber}: Enrollment Number '${enrollmentNumber}' already exists in database.`,
      });
      return;
    }

    // Passed all checks!
    seenRollsInFile.add(lowerRoll);
    if (enrollmentNumber) {
      seenEnrollmentsInFile.add(enrollmentNumber.toLowerCase());
    }
    validRows.push(parsedStudent);
  });

  return {
    validRows,
    duplicateInFileRows,
    duplicateInDbRows,
    invalidRows,
    blankRowsCount,
    totalParsed: rawRows.length,
  };
}
