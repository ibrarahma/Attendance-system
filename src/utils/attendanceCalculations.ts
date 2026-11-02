/**
 * Pure calculation logic for CR Attendance Management System
 */

export interface CalculationInput {
  attended: number;
  held: number;
}

/**
 * Calculates attendance percentage safely.
 * Formula: (Classes Attended / Classes Held) * 100
 * Handles zero held classes gracefully without division errors.
 * Returns percentage rounded to 1 decimal place.
 */
export function calculateAttendancePercentage(attended: number, held: number): number {
  if (!held || held <= 0) {
    return 0;
  }
  if (attended < 0) {
    attended = 0;
  }
  if (attended > held) {
    attended = held;
  }
  const pct = (attended / held) * 100;
  return Math.round(pct * 10) / 10;
}

/**
 * Formats a percentage for display, e.g. "85.5%" or "0.0%"
 */
export function formatPercentage(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

/**
 * Checks if student attendance is below the configured threshold
 */
export function isAttendanceShortage(percentage: number, classesHeld: number, threshold = 75): boolean {
  if (classesHeld === 0) {
    return false; // No classes have been held yet
  }
  return percentage < threshold;
}

/**
 * Computes difference between CR-prepared attended and actual attended classes
 */
export function calculateAttendanceDifference(crAttended: number, actualAttended: number): number {
  return crAttended - actualAttended;
}

/**
 * Aggregates attendance statistics across multiple sessions
 */
export interface SessionRecord {
  sessionId: string;
  isCancelled: boolean;
  actualStatus: 'PRESENT' | 'ABSENT';
  crStatus?: 'PRESENT' | 'ABSENT';
}

export function aggregateStudentAttendance(
  records: SessionRecord[],
  threshold = 75
) {
  // Exclude cancelled sessions from classes held and attended
  const validRecords = records.filter(r => !r.isCancelled);
  const classesHeld = validRecords.length;

  let actualAttended = 0;
  let crAttended = 0;

  for (const r of validRecords) {
    if (r.actualStatus === 'PRESENT') {
      actualAttended++;
    }
    // If CR prepared status exists, use it; otherwise defaults to actual status
    const effectiveCrStatus = r.crStatus || r.actualStatus;
    if (effectiveCrStatus === 'PRESENT') {
      crAttended++;
    }
  }

  const actualPercentage = calculateAttendancePercentage(actualAttended, classesHeld);
  const crPercentage = calculateAttendancePercentage(crAttended, classesHeld);
  const difference = calculateAttendanceDifference(crAttended, actualAttended);
  const isShortage = isAttendanceShortage(actualPercentage, classesHeld, threshold);
  const isCrShortage = isAttendanceShortage(crPercentage, classesHeld, threshold);

  return {
    classesHeld,
    actualAttended,
    actualPercentage,
    crAttended,
    crPercentage,
    difference,
    isShortage,
    isCrShortage,
  };
}
