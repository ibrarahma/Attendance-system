export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export interface Student {
  id: string;
  roll_number: string;
  student_name: string;
  enrollment_number?: string | null;
  department: string;
  semester: string;
  section?: string | null;
  batch?: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  subject_code: string;
  subject_name: string;
  faculty_name: string;
  semester: string;
  subject_type: string;
  is_archived: number;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  subject_id: string;
  session_date: string;
  session_name: string;
  is_cancelled: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  subject_name?: string;
  subject_code?: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
}

export interface EditedAttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  updated_at: string;
}

export interface AttendanceChangeHistoryItem {
  id: string;
  session_id: string;
  student_id: string;
  previous_status: AttendanceStatus;
  new_status: AttendanceStatus;
  reason: string;
  changed_by: string;
  timestamp: string;
  student_name?: string;
  roll_number?: string;
  subject_name?: string;
  session_date?: string;
}

export interface ClassConfig {
  id: string;
  class_name: string;
  department: string;
  semester: string;
  section: string;
  academic_year: string;
  attendance_threshold: number; // e.g. 75
  default_period: string; // e.g. 'all', 'month', 'week'
  enrollment_unique: number; // 0 or 1
  updated_at: string;
}

export interface CRUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  security_question: string;
}

export interface StudentAttendanceSummary {
  student_id: string;
  roll_number: string;
  student_name: string;
  classes_held: number;
  classes_attended: number;
  attendance_percentage: number;
  cr_classes_attended: number;
  cr_attendance_percentage: number;
  difference: number;
  is_shortage: boolean;
  subject_breakdown?: Record<string, {
    subject_id: string;
    subject_name: string;
    subject_code: string;
    classes_held: number;
    classes_attended: number;
    attendance_percentage: number;
    cr_classes_attended: number;
    cr_attendance_percentage: number;
  }>;
}

export interface ImportValidationResult {
  validRows: ParsedStudentRow[];
  duplicateInFileRows: { row: ParsedStudentRow; reason: string }[];
  duplicateInDbRows: { row: ParsedStudentRow; reason: string }[];
  invalidRows: { row: Record<string, any>; reason: string }[];
  blankRowsCount: number;
  totalParsed: number;
}

export interface ParsedStudentRow {
  roll_number: string;
  student_name: string;
  enrollment_number?: string;
  department?: string;
  semester?: string;
  section?: string;
  batch?: string;
  row_number?: number;
}
