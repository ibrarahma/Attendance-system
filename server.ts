import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { db, initDatabase, hashPassword, verifyPassword } from './server/db';
import {
  calculateAttendancePercentage,
  isAttendanceShortage,
  calculateAttendanceDifference,
} from './src/utils/attendanceCalculations';
import {
  validateAndParseStudentRows,
  cleanRollNumber,
  sanitizeCellString,
} from './src/utils/studentImportParser';

// Initialize the SQLite database schemas and seeds
initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Authentication middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    full_name: string;
    email: string;
  };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const session = db.prepare(`
    SELECT s.id, s.token, s.expires_at, u.id as user_id, u.username, u.full_name, u.email
    FROM cr_auth_sessions s
    JOIN cr_user u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as any;

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  req.user = {
    id: session.user_id,
    username: session.username,
    full_name: session.full_name,
    email: session.email,
  };
  next();
}

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM cr_user WHERE username = ? OR email = ?').get(username.trim(), username.trim()) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. Only the authorized CR can access this system.' });
  }

  const valid = verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials. Please verify your password.' });
  }

  // Create session (valid for 30 days)
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = 'sess_' + crypto.randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO cr_auth_sessions (id, token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, token, user.id, expiresAt, now);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
    },
  });
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    db.prepare('DELETE FROM cr_auth_sessions WHERE token = ?').run(token);
  }
  res.json({ success: true, message: 'Signed out successfully' });
});

// Current User Profile
app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// Password recovery - Step 1: get question
app.post('/api/auth/recover-question', (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Please enter your username or registered email' });
  }
  const user = db.prepare('SELECT id, username, security_question FROM cr_user WHERE username = ? OR email = ?').get(identifier.trim(), identifier.trim()) as any;
  if (!user) {
    return res.status(404).json({ error: 'No authorized Class Representative found with that username or email' });
  }
  res.json({ question: user.security_question, username: user.username });
});

// Password recovery - Step 2: verify answer and reset password
app.post('/api/auth/recover-reset', (req: Request, res: Response) => {
  const { username, answer, newPassword } = req.body;
  if (!username || !answer || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  const user = db.prepare('SELECT * FROM cr_user WHERE username = ?').get(username) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const validAnswer = verifyPassword(answer.trim().toLowerCase(), user.security_answer_hash, user.security_answer_salt);
  if (!validAnswer) {
    return res.status(400).json({ error: 'Incorrect security answer. Please try again.' });
  }

  const { hash: newHash, salt: newSalt } = hashPassword(newPassword);
  db.prepare(`
    UPDATE cr_user SET password_hash = ?, password_salt = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newHash, newSalt, user.id);

  // Invalidate past sessions
  db.prepare('DELETE FROM cr_auth_sessions WHERE user_id = ?').run(user.id);

  res.json({ success: true, message: 'Password reset successfully. You may now sign in.' });
});

// Update Profile / Change Password
app.put('/api/auth/update-profile', authMiddleware, (req: AuthRequest, res: Response) => {
  const { full_name, email, current_password, new_password } = req.body;
  const user = db.prepare('SELECT * FROM cr_user WHERE id = ?').get(req.user!.id) as any;

  if (new_password) {
    if (!current_password) {
      return res.status(400).json({ error: 'Current password is required to set a new password' });
    }
    const valid = verifyPassword(current_password, user.password_hash, user.password_salt);
    if (!valid) {
      return res.status(400).json({ error: 'Current password entered is incorrect' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const { hash, salt } = hashPassword(new_password);
    db.prepare(`
      UPDATE cr_user SET password_hash = ?, password_salt = ?, full_name = ?, email = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(hash, salt, full_name || user.full_name, email || user.email, user.id);
  } else {
    db.prepare(`
      UPDATE cr_user SET full_name = ?, email = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(full_name || user.full_name, email || user.email, user.id);
  }

  res.json({ success: true, message: 'Profile updated successfully' });
});

// -------------------------------------------------------------
// SETTINGS & CLASS CONFIGURATION
// -------------------------------------------------------------

app.get('/api/settings', authMiddleware, (_req: AuthRequest, res: Response) => {
  const config = db.prepare('SELECT * FROM class_config LIMIT 1').get();
  res.json({ config });
});

app.put('/api/settings', authMiddleware, (req: AuthRequest, res: Response) => {
  const {
    class_name,
    department,
    semester,
    section,
    academic_year,
    attendance_threshold,
    default_period,
    enrollment_unique,
  } = req.body;

  db.prepare(`
    UPDATE class_config SET
      class_name = ?,
      department = ?,
      semester = ?,
      section = ?,
      academic_year = ?,
      attendance_threshold = ?,
      default_period = ?,
      enrollment_unique = ?,
      updated_at = datetime('now')
    WHERE id = (SELECT id FROM class_config LIMIT 1)
  `).run(
    class_name,
    department,
    semester,
    section,
    academic_year,
    Number(attendance_threshold) || 75.0,
    default_period || 'all',
    enrollment_unique ? 1 : 0
  );

  const updated = db.prepare('SELECT * FROM class_config LIMIT 1').get();
  res.json({ success: true, config: updated });
});

// Backup Database
app.get('/api/settings/backup', authMiddleware, (_req: AuthRequest, res: Response) => {
  const config = db.prepare('SELECT * FROM class_config').all();
  const students = db.prepare('SELECT * FROM students').all();
  const subjects = db.prepare('SELECT * FROM subjects').all();
  const sessions = db.prepare('SELECT * FROM attendance_sessions').all();
  const originalRecords = db.prepare('SELECT * FROM original_attendance_records').all();
  const crPreparedRecords = db.prepare('SELECT * FROM cr_prepared_attendance_records').all();
  const changeHistory = db.prepare('SELECT * FROM attendance_change_history').all();
  const importHistory = db.prepare('SELECT * FROM import_history').all();

  const backupData = {
    app: 'CR Attendance Management System',
    version: '1.0',
    exported_at: new Date().toISOString(),
    config,
    students,
    subjects,
    sessions,
    originalRecords,
    crPreparedRecords,
    changeHistory,
    importHistory,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=cr_attendance_backup_${new Date().toISOString().slice(0, 10)}.json`);
  res.send(JSON.stringify(backupData, null, 2));
});

// Restore Database Backup
app.post('/api/settings/restore', authMiddleware, (req: AuthRequest, res: Response) => {
  const backup = req.body;
  if (!backup || !backup.students || !backup.subjects || !backup.sessions) {
    return res.status(400).json({ error: 'Invalid backup format. Required database tables missing.' });
  }

  const restoreTransaction = db.transaction(() => {
    // Clear existing data safely
    db.prepare('DELETE FROM cr_prepared_attendance_records').run();
    db.prepare('DELETE FROM original_attendance_records').run();
    db.prepare('DELETE FROM attendance_change_history').run();
    db.prepare('DELETE FROM attendance_sessions').run();
    db.prepare('DELETE FROM subjects').run();
    db.prepare('DELETE FROM students').run();

    if (backup.config && backup.config.length > 0) {
      const cfg = backup.config[0];
      db.prepare(`
        UPDATE class_config SET
          class_name = ?, department = ?, semester = ?, section = ?,
          academic_year = ?, attendance_threshold = ?, default_period = ?, enrollment_unique = ?, updated_at = datetime('now')
        WHERE id = (SELECT id FROM class_config LIMIT 1)
      `).run(
        cfg.class_name, cfg.department, cfg.semester, cfg.section,
        cfg.academic_year, cfg.attendance_threshold, cfg.default_period, cfg.enrollment_unique
      );
    }

    const insertStu = db.prepare(`
      INSERT INTO students (id, roll_number, student_name, enrollment_number, department, semester, section, batch, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of backup.students) {
      insertStu.run(s.id, s.roll_number, s.student_name, s.enrollment_number, s.department, s.semester, s.section, s.batch, s.is_archived || 0, s.created_at, s.updated_at);
    }

    const insertSub = db.prepare(`
      INSERT INTO subjects (id, subject_code, subject_name, faculty_name, semester, subject_type, is_archived, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const sub of backup.subjects) {
      insertSub.run(sub.id, sub.subject_code, sub.subject_name, sub.faculty_name, sub.semester, sub.subject_type || 'Theory', sub.is_archived || 0, sub.created_at);
    }

    const insertSess = db.prepare(`
      INSERT INTO attendance_sessions (id, subject_id, session_date, session_name, is_cancelled, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ss of backup.sessions) {
      insertSess.run(ss.id, ss.subject_id, ss.session_date, ss.session_name, ss.is_cancelled || 0, ss.notes, ss.created_at, ss.updated_at);
    }

    const insertOrig = db.prepare(`
      INSERT INTO original_attendance_records (id, session_id, student_id, status, marked_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const o of backup.originalRecords || []) {
      insertOrig.run(o.id, o.session_id, o.student_id, o.status, o.marked_at);
    }

    const insertCr = db.prepare(`
      INSERT INTO cr_prepared_attendance_records (id, session_id, student_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const c of backup.crPreparedRecords || []) {
      insertCr.run(c.id, c.session_id, c.student_id, c.status, c.updated_at);
    }

    const insertHist = db.prepare(`
      INSERT INTO attendance_change_history (id, session_id, student_id, previous_status, new_status, reason, changed_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const h of backup.changeHistory || []) {
      insertHist.run(h.id, h.session_id, h.student_id, h.previous_status, h.new_status, h.reason, h.changed_by, h.timestamp);
    }
  });

  try {
    restoreTransaction();
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

// -------------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------------

app.get('/api/dashboard/stats', authMiddleware, (_req: AuthRequest, res: Response) => {
  const config = db.prepare('SELECT attendance_threshold FROM class_config LIMIT 1').get() as any;
  const threshold = config?.attendance_threshold || 75.0;

  // Active students
  const totalStudents = (db.prepare('SELECT count(*) as count FROM students WHERE is_archived = 0').get() as any).count;
  // Active subjects
  const totalSubjects = (db.prepare('SELECT count(*) as count FROM subjects WHERE is_archived = 0').get() as any).count;

  // Today's attendance summary
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = db.prepare(`
    SELECT s.id, s.session_name, sub.subject_name, sub.subject_code
    FROM attendance_sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE s.session_date = ? AND s.is_cancelled = 0
  `).all(today) as any[];

  let todayPresent = 0;
  let todayAbsent = 0;

  if (todaySessions.length > 0) {
    const sessionIds = todaySessions.map(s => `'${s.id}'`).join(',');
    const counts = db.prepare(`
      SELECT status, count(*) as count
      FROM cr_prepared_attendance_records
      WHERE session_id IN (${sessionIds})
      GROUP BY status
    `).all() as any[];

    for (const c of counts) {
      if (c.status === 'PRESENT') todayPresent = c.count;
      if (c.status === 'ABSENT') todayAbsent = c.count;
    }
  }

  // Calculate students below threshold
  const students = db.prepare('SELECT id, roll_number, student_name FROM students WHERE is_archived = 0').all() as any[];
  const lowAttendanceStudents: any[] = [];

  for (const st of students) {
    const stats = db.prepare(`
      SELECT
        count(CASE WHEN s.is_cancelled = 0 THEN 1 END) as held,
        count(CASE WHEN s.is_cancelled = 0 AND r.status = 'PRESENT' THEN 1 END) as attended
      FROM attendance_sessions s
      JOIN cr_prepared_attendance_records r ON s.id = r.session_id AND r.student_id = ?
    `).get(st.id) as any;

    const pct = calculateAttendancePercentage(stats.attended, stats.held);
    if (isAttendanceShortage(pct, stats.held, threshold)) {
      lowAttendanceStudents.push({
        id: st.id,
        roll_number: st.roll_number,
        student_name: st.student_name,
        classes_held: stats.held,
        classes_attended: stats.attended,
        attendance_percentage: pct,
      });
    }
  }

  // Recent attendance sessions
  const recentSessions = db.prepare(`
    SELECT s.id, s.session_date, s.session_name, s.is_cancelled, sub.subject_name, sub.subject_code,
      (SELECT count(*) FROM cr_prepared_attendance_records r WHERE r.session_id = s.id AND r.status = 'PRESENT') as present_count,
      (SELECT count(*) FROM cr_prepared_attendance_records r WHERE r.session_id = s.id AND r.status = 'ABSENT') as absent_count
    FROM attendance_sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    ORDER BY s.session_date DESC, s.created_at DESC
    LIMIT 6
  `).all();

  res.json({
    totalStudents,
    totalSubjects,
    todaySummary: {
      date: today,
      sessionCount: todaySessions.length,
      presentCount: todayPresent,
      absentCount: todayAbsent,
    },
    shortageCount: lowAttendanceStudents.length,
    lowAttendanceStudents,
    recentSessions,
    threshold,
  });
});

// -------------------------------------------------------------
// STUDENT MANAGEMENT
// -------------------------------------------------------------

// List students with search, filters, pagination
app.get('/api/students', authMiddleware, (req: AuthRequest, res: Response) => {
  const { search, archived, department, semester, section } = req.query;

  let query = 'SELECT * FROM students WHERE 1=1';
  const params: any[] = [];

  if (archived === '1') {
    query += ' AND is_archived = 1';
  } else {
    query += ' AND is_archived = 0';
  }

  if (search && typeof search === 'string' && search.trim()) {
    query += ' AND (roll_number LIKE ? OR student_name LIKE ? OR enrollment_number LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (department && typeof department === 'string' && department !== 'undefined' && department.trim()) {
    query += ' AND department = ?';
    params.push(department.trim());
  }

  if (semester && typeof semester === 'string' && semester !== 'undefined' && semester.trim()) {
    query += ' AND semester = ?';
    params.push(semester.trim());
  }

  if (section && typeof section === 'string' && section !== 'undefined' && section.trim()) {
    query += ' AND section = ?';
    params.push(section.trim());
  }

  query += ' ORDER BY roll_number ASC';
  const students = db.prepare(query).all(...params);
  res.json({ students });
});

// Add single student
app.post('/api/students', authMiddleware, (req: AuthRequest, res: Response) => {
  const {
    roll_number,
    student_name,
    enrollment_number,
    department,
    semester,
    section,
    batch,
  } = req.body;

  const roll = cleanRollNumber(roll_number);
  const name = sanitizeCellString(student_name);

  if (!roll) {
    return res.status(400).json({ error: 'Roll Number is required' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Student Name is required' });
  }

  // Check unique roll number
  const existing = db.prepare('SELECT id FROM students WHERE roll_number = ?').get(roll);
  if (existing) {
    return res.status(409).json({ error: `A student with Roll Number '${roll}' already exists in the system.` });
  }

  const cfg = db.prepare('SELECT department, semester, enrollment_unique FROM class_config LIMIT 1').get() as any;
  const enr = enrollment_number ? sanitizeCellString(enrollment_number) : null;

  if (cfg.enrollment_unique && enr) {
    const existingEnr = db.prepare('SELECT id FROM students WHERE enrollment_number = ?').get(enr);
    if (existingEnr) {
      return res.status(409).json({ error: `A student with Enrollment Number '${enr}' already exists.` });
    }
  }

  const id = 'stu_' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO students (id, roll_number, student_name, enrollment_number, department, semester, section, batch, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id,
    roll,
    name,
    enr,
    department ? sanitizeCellString(department) : cfg.department,
    semester ? sanitizeCellString(semester) : cfg.semester,
    section ? sanitizeCellString(section) : null,
    batch ? sanitizeCellString(batch) : null,
    now,
    now
  );

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.status(201).json({ success: true, student });
});

// Edit student
app.put('/api/students/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    roll_number,
    student_name,
    enrollment_number,
    department,
    semester,
    section,
    batch,
  } = req.body;

  const roll = cleanRollNumber(roll_number);
  const name = sanitizeCellString(student_name);

  if (!roll || !name) {
    return res.status(400).json({ error: 'Roll number and student name cannot be empty' });
  }

  // Ensure roll uniqueness among other students
  const duplicate = db.prepare('SELECT id FROM students WHERE roll_number = ? AND id != ?').get(roll, id);
  if (duplicate) {
    return res.status(409).json({ error: `Roll number '${roll}' is already in use by another student.` });
  }

  const enr = enrollment_number ? sanitizeCellString(enrollment_number) : null;
  const cfg = db.prepare('SELECT enrollment_unique FROM class_config LIMIT 1').get() as any;
  if (cfg.enrollment_unique && enr) {
    const dupEnr = db.prepare('SELECT id FROM students WHERE enrollment_number = ? AND id != ?').get(enr, id);
    if (dupEnr) {
      return res.status(409).json({ error: `Enrollment number '${enr}' is already assigned to another student.` });
    }
  }

  db.prepare(`
    UPDATE students SET
      roll_number = ?,
      student_name = ?,
      enrollment_number = ?,
      department = ?,
      semester = ?,
      section = ?,
      batch = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    roll,
    name,
    enr,
    department ? sanitizeCellString(department) : '',
    semester ? sanitizeCellString(semester) : '',
    section ? sanitizeCellString(section) : null,
    batch ? sanitizeCellString(batch) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  res.json({ success: true, student: updated });
});

// Delete or Archive Student
app.delete('/api/students/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { force } = req.query;

  // Check if student has attendance history
  const attCount = (db.prepare('SELECT count(*) as count FROM original_attendance_records WHERE student_id = ?').get(id) as any).count;

  if (attCount > 0 && force !== '1') {
    // Prompt instructs: "If a student has existing attendance records, prefer archiving or deactivating the student rather than deleting historical records."
    return res.status(409).json({
      error: 'Cannot permanently delete student with existing attendance history. Please archive the student instead to preserve historical records, or confirm archival.',
      hasAttendance: true,
      attendanceCount: attCount,
    });
  }

  if (attCount > 0 && force === '1') {
    // If explicit archive requested
    db.prepare("UPDATE students SET is_archived = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    return res.json({ success: true, message: 'Student archived successfully to preserve historical attendance.' });
  }

  // Safe to permanently delete since no attendance records exist
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
  res.json({ success: true, message: 'Student deleted successfully' });
});

// Toggle Archive Student
app.post('/api/students/:id/archive', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const current = db.prepare('SELECT is_archived FROM students WHERE id = ?').get(id) as any;
  if (!current) {
    return res.status(404).json({ error: 'Student not found' });
  }
  const newStatus = current.is_archived === 1 ? 0 : 1;
  db.prepare("UPDATE students SET is_archived = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
  res.json({ success: true, is_archived: newStatus, message: newStatus === 1 ? 'Student archived' : 'Student unarchived' });
});

// Student Detail View with subject-wise attendance breakdown
app.get('/api/students/:id/details', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as any;
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const subjects = db.prepare('SELECT * FROM subjects WHERE is_archived = 0').all() as any[];
  const breakdown: any[] = [];

  let totalHeld = 0;
  let totalActual = 0;
  let totalCr = 0;

  for (const sub of subjects) {
    const stats = db.prepare(`
      SELECT
        count(CASE WHEN s.is_cancelled = 0 THEN 1 END) as held,
        count(CASE WHEN s.is_cancelled = 0 AND o.status = 'PRESENT' THEN 1 END) as actual_attended,
        count(CASE WHEN s.is_cancelled = 0 AND c.status = 'PRESENT' THEN 1 END) as cr_attended
      FROM attendance_sessions s
      LEFT JOIN original_attendance_records o ON s.id = o.session_id AND o.student_id = ?
      LEFT JOIN cr_prepared_attendance_records c ON s.id = c.session_id AND c.student_id = ?
      WHERE s.subject_id = ?
    `).get(id, id, sub.id) as any;

    const actualPct = calculateAttendancePercentage(stats.actual_attended, stats.held);
    const crPct = calculateAttendancePercentage(stats.cr_attended, stats.held);

    totalHeld += stats.held;
    totalActual += stats.actual_attended;
    totalCr += stats.cr_attended;

    breakdown.push({
      subject_id: sub.id,
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      faculty_name: sub.faculty_name,
      classes_held: stats.held,
      classes_attended: stats.actual_attended,
      attendance_percentage: actualPct,
      cr_classes_attended: stats.cr_attended,
      cr_attendance_percentage: crPct,
      difference: calculateAttendanceDifference(stats.cr_attended, stats.actual_attended),
    });
  }

  const overallActualPct = calculateAttendancePercentage(totalActual, totalHeld);
  const overallCrPct = calculateAttendancePercentage(totalCr, totalHeld);

  res.json({
    student,
    summary: {
      totalHeld,
      totalActual,
      overallActualPct,
      totalCr,
      overallCrPct,
      difference: calculateAttendanceDifference(totalCr, totalActual),
    },
    subjectBreakdown: breakdown,
  });
});

// -------------------------------------------------------------
// EXCEL / CSV IMPORT WORKFLOW
// -------------------------------------------------------------

// Download Excel Template
app.get('/api/students/template', (_req: Request, res: Response) => {
  const wb = XLSX.utils.book_new();
  const templateData = [
    {
      'Roll Number': 'CS2601',
      'Student Name': 'Sample Student Name',
      'Enrollment Number': 'EN202401',
      'Department': 'CSE',
      'Semester': '5',
      'Section': 'A',
      'Batch': 'B1',
    },
    {
      'Roll Number': 'CS2602',
      'Student Name': 'Second Student Example',
      'Enrollment Number': 'EN202402',
      'Department': 'CSE',
      'Semester': '5',
      'Section': 'A',
      'Batch': 'B1',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(templateData);
  XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=CR_Student_Import_Template.xlsx');
  res.send(buffer);
});

// Preview & Validate Uploaded Rows
app.post('/api/students/import-preview', authMiddleware, (req: AuthRequest, res: Response) => {
  const { rows, filename } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'No data rows provided for import preview' });
  }

  const cfg = db.prepare('SELECT department, semester, enrollment_unique FROM class_config LIMIT 1').get() as any;
  const existingStudents = db.prepare('SELECT roll_number, enrollment_number FROM students').all() as any[];

  const existingRolls = new Set<string>();
  const existingEnrs = new Set<string>();
  for (const s of existingStudents) {
    if (s.roll_number) existingRolls.add(String(s.roll_number).toLowerCase().trim());
    if (s.enrollment_number) existingEnrs.add(String(s.enrollment_number).toLowerCase().trim());
  }

  const validationResult = validateAndParseStudentRows(rows, {
    existingDb: {
      rollNumbers: existingRolls,
      enrollmentNumbers: existingEnrs,
    },
    requireUniqueEnrollment: Boolean(cfg?.enrollment_unique),
    defaultDepartment: cfg?.department,
    defaultSemester: cfg?.semester,
  });

  res.json({
    filename: filename || 'students_upload.xlsx',
    ...validationResult,
  });
});

// Confirm Import of Valid Rows
app.post('/api/students/import-confirm', authMiddleware, (req: AuthRequest, res: Response) => {
  const { validRows, filename, totalRows, duplicateCount, invalidCount } = req.body;
  if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
    return res.status(400).json({ error: 'No valid student rows to import' });
  }

  const cfg = db.prepare('SELECT department, semester FROM class_config LIMIT 1').get() as any;
  let importedCount = 0;

  const importTx = db.transaction((rowsToImport: any[]) => {
    const insertStmt = db.prepare(`
      INSERT INTO students (id, roll_number, student_name, enrollment_number, department, semester, section, batch, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `);

    for (const r of rowsToImport) {
      const id = 'stu_' + crypto.randomBytes(8).toString('hex');
      insertStmt.run(
        id,
        cleanRollNumber(r.roll_number),
        sanitizeCellString(r.student_name),
        r.enrollment_number ? sanitizeCellString(r.enrollment_number) : null,
        r.department ? sanitizeCellString(r.department) : cfg.department,
        r.semester ? sanitizeCellString(r.semester) : cfg.semester,
        r.section ? sanitizeCellString(r.section) : null,
        r.batch ? sanitizeCellString(r.batch) : null
      );
      importedCount++;
    }

    // Log to import history
    db.prepare(`
      INSERT INTO import_history (id, filename, total_rows, valid_rows, duplicate_rows, invalid_rows, imported_count, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      'imp_' + crypto.randomBytes(8).toString('hex'),
      filename || 'students_upload',
      totalRows || rowsToImport.length,
      rowsToImport.length,
      duplicateCount || 0,
      invalidCount || 0,
      importedCount
    );
  });

  try {
    importTx(validRows);
    res.json({
      success: true,
      importedCount,
      message: `Successfully imported ${importedCount} student(s) into the database without overwriting existing records.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Import transaction failed: ' + err.message });
  }
});

// Import History
app.get('/api/students/import-history', authMiddleware, (_req: AuthRequest, res: Response) => {
  const history = db.prepare('SELECT * FROM import_history ORDER BY timestamp DESC LIMIT 20').all();
  res.json({ history });
});

// -------------------------------------------------------------
// SUBJECT MANAGEMENT
// -------------------------------------------------------------

app.get('/api/subjects', authMiddleware, (_req: AuthRequest, res: Response) => {
  const subjects = db.prepare('SELECT * FROM subjects WHERE is_archived = 0 ORDER BY subject_code ASC').all();
  res.json({ subjects });
});

app.post('/api/subjects', authMiddleware, (req: AuthRequest, res: Response) => {
  const { subject_code, subject_name, faculty_name, semester, subject_type } = req.body;
  if (!subject_code || !subject_name) {
    return res.status(400).json({ error: 'Subject Code and Subject Name are required' });
  }

  const code = sanitizeCellString(subject_code).toUpperCase();
  const existing = db.prepare('SELECT id FROM subjects WHERE subject_code = ?').get(code);
  if (existing) {
    return res.status(409).json({ error: `Subject code '${code}' is already registered.` });
  }

  const id = 'sub_' + crypto.randomBytes(8).toString('hex');
  db.prepare(`
    INSERT INTO subjects (id, subject_code, subject_name, faculty_name, semester, subject_type, is_archived, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(
    id,
    code,
    sanitizeCellString(subject_name),
    sanitizeCellString(faculty_name || 'Faculty Assigned'),
    sanitizeCellString(semester || '5'),
    subject_type || 'Theory'
  );

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
  res.status(201).json({ success: true, subject });
});

app.put('/api/subjects/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { subject_code, subject_name, faculty_name, semester, subject_type } = req.body;

  const code = sanitizeCellString(subject_code).toUpperCase();
  const dup = db.prepare('SELECT id FROM subjects WHERE subject_code = ? AND id != ?').get(code, id);
  if (dup) {
    return res.status(409).json({ error: `Subject code '${code}' is already used by another subject.` });
  }

  db.prepare(`
    UPDATE subjects SET
      subject_code = ?,
      subject_name = ?,
      faculty_name = ?,
      semester = ?,
      subject_type = ?
    WHERE id = ?
  `).run(
    code,
    sanitizeCellString(subject_name),
    sanitizeCellString(faculty_name || ''),
    sanitizeCellString(semester || ''),
    subject_type || 'Theory',
    id
  );

  const updated = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
  res.json({ success: true, subject: updated });
});

app.delete('/api/subjects/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const sessCount = (db.prepare('SELECT count(*) as count FROM attendance_sessions WHERE subject_id = ?').get(id) as any).count;
  if (sessCount > 0) {
    // Soft delete/archive to protect historical attendance
    db.prepare('UPDATE subjects SET is_archived = 1 WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Subject archived to protect existing attendance sessions.' });
  }
  db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  res.json({ success: true, message: 'Subject deleted successfully' });
});

// -------------------------------------------------------------
// ACTUAL ATTENDANCE TAB
// -------------------------------------------------------------

// List sessions with counts
app.get('/api/attendance/sessions', authMiddleware, (req: AuthRequest, res: Response) => {
  const { subject_id, date, start_date, end_date } = req.query;

  let query = `
    SELECT s.*, sub.subject_name, sub.subject_code, sub.faculty_name,
      (SELECT count(*) FROM original_attendance_records o WHERE o.session_id = s.id AND o.status = 'PRESENT') as present_count,
      (SELECT count(*) FROM original_attendance_records o WHERE o.session_id = s.id AND o.status = 'ABSENT') as absent_count
    FROM attendance_sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (subject_id && typeof subject_id === 'string') {
    query += ' AND s.subject_id = ?';
    params.push(subject_id);
  }
  if (date && typeof date === 'string') {
    query += ' AND s.session_date = ?';
    params.push(date);
  }
  if (start_date && typeof start_date === 'string') {
    query += ' AND s.session_date >= ?';
    params.push(start_date);
  }
  if (end_date && typeof end_date === 'string') {
    query += ' AND s.session_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY s.session_date DESC, s.created_at DESC';
  const sessions = db.prepare(query).all(...params);
  res.json({ sessions });
});

// Create & Mark New Actual Attendance Session
app.post('/api/attendance/sessions', authMiddleware, (req: AuthRequest, res: Response) => {
  const { subject_id, session_date, session_name, notes, attendance } = req.body;

  if (!subject_id || !session_date || !session_name) {
    return res.status(400).json({ error: 'Subject, Date, and Session Name/Period are required.' });
  }

  if (!attendance || !Array.isArray(attendance) || attendance.length === 0) {
    return res.status(400).json({ error: 'No student attendance markings provided.' });
  }

  // Prevent duplicate attendance sessions
  const existingSess = db.prepare(`
    SELECT id FROM attendance_sessions
    WHERE subject_id = ? AND session_date = ? AND session_name = ?
  `).get(subject_id, session_date, session_name.trim());

  if (existingSess) {
    return res.status(409).json({
      error: `An attendance session already exists for this subject, date (${session_date}), and session (${session_name}). Duplicate sessions are prevented.`,
    });
  }

  const sessionId = 'sess_' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString();

  const createTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO attendance_sessions (id, subject_id, session_date, session_name, is_cancelled, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(sessionId, subject_id, session_date, session_name.trim(), notes || null, now, now);

    const insertOrig = db.prepare(`
      INSERT INTO original_attendance_records (id, session_id, student_id, status, marked_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertCr = db.prepare(`
      INSERT INTO cr_prepared_attendance_records (id, session_id, student_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of attendance) {
      const recId = `${sessionId}_${item.student_id}`;
      const status = item.status === 'PRESENT' ? 'PRESENT' : 'ABSENT';
      insertOrig.run(recId, sessionId, item.student_id, status, now);
      // Initialize CR-prepared to match original
      insertCr.run(recId, sessionId, item.student_id, status, now);
    }
  });

  try {
    createTx();
    res.status(201).json({
      success: true,
      session_id: sessionId,
      message: 'Attendance session successfully saved and preserved in the database.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save attendance session: ' + err.message });
  }
});

// Get session details and student markings
app.get('/api/attendance/sessions/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const session = db.prepare(`
    SELECT s.*, sub.subject_name, sub.subject_code, sub.faculty_name
    FROM attendance_sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE s.id = ?
  `).get(id) as any;

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const records = db.prepare(`
    SELECT
      st.id as student_id,
      st.roll_number,
      st.student_name,
      st.enrollment_number,
      o.status as original_status,
      c.status as cr_status,
      c.updated_at as last_modified
    FROM students st
    JOIN original_attendance_records o ON st.id = o.student_id AND o.session_id = ?
    JOIN cr_prepared_attendance_records c ON st.id = c.student_id AND c.session_id = ?
    ORDER BY st.roll_number ASC
  `).all(id, id);

  res.json({ session, records });
});

// Toggle Session Cancelled
app.put('/api/attendance/sessions/:id/cancel', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const sess = db.prepare('SELECT is_cancelled FROM attendance_sessions WHERE id = ?').get(id) as any;
  if (!sess) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const newStatus = sess.is_cancelled === 1 ? 0 : 1;
  db.prepare("UPDATE attendance_sessions SET is_cancelled = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
  res.json({
    success: true,
    is_cancelled: newStatus,
    message: newStatus === 1 ? 'Session marked as cancelled (excluded from classes held).' : 'Session reinstated as active.',
  });
});

// -------------------------------------------------------------
// EDITED ATTENDANCE TAB
// -------------------------------------------------------------

// List records with filters and discrepancy tracking
app.get('/api/attendance/edited-records', authMiddleware, (req: AuthRequest, res: Response) => {
  const { subject_id, date, roll_number, student_name, changed_only } = req.query;

  let query = `
    SELECT
      c.id as record_id,
      s.id as session_id,
      s.session_date,
      s.session_name,
      sub.id as subject_id,
      sub.subject_code,
      sub.subject_name,
      st.id as student_id,
      st.roll_number,
      st.student_name,
      o.status as original_status,
      c.status as cr_status,
      c.updated_at as last_modified,
      (SELECT reason FROM attendance_change_history h WHERE h.session_id = s.id AND h.student_id = st.id ORDER BY timestamp DESC LIMIT 1) as edit_reason,
      (SELECT changed_by FROM attendance_change_history h WHERE h.session_id = s.id AND h.student_id = st.id ORDER BY timestamp DESC LIMIT 1) as changed_by
    FROM cr_prepared_attendance_records c
    JOIN original_attendance_records o ON c.session_id = o.session_id AND c.student_id = o.student_id
    JOIN attendance_sessions s ON c.session_id = s.id
    JOIN subjects sub ON s.subject_id = sub.id
    JOIN students st ON c.student_id = st.id
    WHERE s.is_cancelled = 0
  `;
  const params: any[] = [];

  if (changed_only === '1' || changed_only === 'true') {
    query += ' AND o.status != c.status';
  }
  if (subject_id && typeof subject_id === 'string') {
    query += ' AND sub.id = ?';
    params.push(subject_id);
  }
  if (date && typeof date === 'string') {
    query += ' AND s.session_date = ?';
    params.push(date);
  }
  if (roll_number && typeof roll_number === 'string') {
    query += ' AND st.roll_number LIKE ?';
    params.push(`%${roll_number.trim()}%`);
  }
  if (student_name && typeof student_name === 'string') {
    query += ' AND st.student_name LIKE ?';
    params.push(`%${student_name.trim()}%`);
  }

  query += ' ORDER BY s.session_date DESC, st.roll_number ASC';
  const records = db.prepare(query).all(...params);
  res.json({ records });
});

// Controlled editing interface to prepare corrected attendance
app.post('/api/attendance/prepare-edit', authMiddleware, (req: AuthRequest, res: Response) => {
  const { session_id, student_id, new_status, reason } = req.body;

  if (!session_id || !student_id || !new_status || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'Session ID, Student ID, New Status, and an Edit Reason are all mandatory.' });
  }

  if (new_status !== 'PRESENT' && new_status !== 'ABSENT') {
    return res.status(400).json({ error: 'Status must be either PRESENT or ABSENT.' });
  }

  const origRec = db.prepare('SELECT status FROM original_attendance_records WHERE session_id = ? AND student_id = ?').get(session_id, student_id) as any;
  if (!origRec) {
    return res.status(404).json({ error: 'Original attendance record not found for this student and session.' });
  }

  const crRec = db.prepare('SELECT status FROM cr_prepared_attendance_records WHERE session_id = ? AND student_id = ?').get(session_id, student_id) as any;
  const previousStatus = crRec ? crRec.status : origRec.status;

  const now = new Date().toISOString();
  const histId = 'hist_' + crypto.randomBytes(8).toString('hex');

  const editTx = db.transaction(() => {
    // CR-prepared attendance table updated (original record stays pristine!)
    db.prepare(`
      INSERT INTO cr_prepared_attendance_records (id, session_id, student_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(`${session_id}_${student_id}`, session_id, student_id, new_status, now);

    // Audit change history logged
    db.prepare(`
      INSERT INTO attendance_change_history (id, session_id, student_id, previous_status, new_status, reason, changed_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(histId, session_id, student_id, previousStatus, new_status, sanitizeCellString(reason), req.user!.full_name, now);
  });

  try {
    editTx();
    res.json({
      success: true,
      message: 'CR-prepared attendance record updated with change audit log.',
      previous_status: previousStatus,
      new_status,
      original_status: origRec.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record attendance edit: ' + err.message });
  }
});

// Audit Change History Log
app.get('/api/attendance/change-history', authMiddleware, (req: AuthRequest, res: Response) => {
  const { student_id, session_id } = req.query;

  let query = `
    SELECT h.*, st.roll_number, st.student_name, sub.subject_name, sub.subject_code, s.session_date, s.session_name
    FROM attendance_change_history h
    JOIN students st ON h.student_id = st.id
    JOIN attendance_sessions s ON h.session_id = s.id
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (student_id && typeof student_id === 'string') {
    query += ' AND h.student_id = ?';
    params.push(student_id);
  }
  if (session_id && typeof session_id === 'string') {
    query += ' AND h.session_id = ?';
    params.push(session_id);
  }

  query += ' ORDER BY h.timestamp DESC LIMIT 50';
  const history = db.prepare(query).all(...params);
  res.json({ history });
});

// -------------------------------------------------------------
// ATTENDANCE REPORTS
// -------------------------------------------------------------

app.get('/api/reports', authMiddleware, (req: AuthRequest, res: Response) => {
  const {
    type, // 'class', 'subject', 'weekly', 'monthly', 'semester', 'individual', 'shortage', 'comparison'
    subject_id,
    start_date,
    end_date,
    student_id,
    search,
  } = req.query;

  const cfg = db.prepare('SELECT attendance_threshold FROM class_config LIMIT 1').get() as any;
  const threshold = cfg?.attendance_threshold || 75.0;

  // Filter sessions
  let sessQuery = 'SELECT id, subject_id, session_date FROM attendance_sessions WHERE is_cancelled = 0';
  const sessParams: any[] = [];

  if (subject_id && typeof subject_id === 'string' && subject_id !== 'all') {
    sessQuery += ' AND subject_id = ?';
    sessParams.push(subject_id);
  }
  if (start_date && typeof start_date === 'string') {
    sessQuery += ' AND session_date >= ?';
    sessParams.push(start_date);
  }
  if (end_date && typeof end_date === 'string') {
    sessQuery += ' AND session_date <= ?';
    sessParams.push(end_date);
  }

  const validSessions = db.prepare(sessQuery).all(...sessParams) as any[];
  const sessionIds = validSessions.map(s => s.id);
  const totalHeld = sessionIds.length;

  // Fetch target students
  let stuQuery = 'SELECT * FROM students WHERE is_archived = 0';
  const stuParams: any[] = [];

  if (student_id && typeof student_id === 'string') {
    stuQuery += ' AND id = ?';
    stuParams.push(student_id);
  }
  if (search && typeof search === 'string' && search.trim()) {
    stuQuery += ' AND (roll_number LIKE ? OR student_name LIKE ?)';
    const term = `%${search.trim()}%`;
    stuParams.push(term, term);
  }

  stuQuery += ' ORDER BY roll_number ASC';
  const students = db.prepare(stuQuery).all(...stuParams) as any[];

  // If no sessions held in period
  if (sessionIds.length === 0) {
    const emptyRows = students.map(s => ({
      student_id: s.id,
      roll_number: s.roll_number,
      student_name: s.student_name,
      classes_held: 0,
      actual_attended: 0,
      actual_percentage: 0,
      cr_attended: 0,
      cr_percentage: 0,
      difference: 0,
      is_shortage: false,
      status_label: 'No Classes',
    }));
    return res.json({
      type: type || 'class',
      totalHeld: 0,
      threshold,
      rows: emptyRows,
    });
  }

  const inClause = sessionIds.map(id => `'${id}'`).join(',');

  const rows = students.map(s => {
    const origCounts = db.prepare(`
      SELECT count(*) as count FROM original_attendance_records
      WHERE session_id IN (${inClause}) AND student_id = ? AND status = 'PRESENT'
    `).get(s.id) as any;

    const crCounts = db.prepare(`
      SELECT count(*) as count FROM cr_prepared_attendance_records
      WHERE session_id IN (${inClause}) AND student_id = ? AND status = 'PRESENT'
    `).get(s.id) as any;

    const actualAttended = origCounts ? origCounts.count : 0;
    const crAttended = crCounts ? crCounts.count : 0;

    const actualPct = calculateAttendancePercentage(actualAttended, totalHeld);
    const crPct = calculateAttendancePercentage(crAttended, totalHeld);
    const diff = calculateAttendanceDifference(crAttended, actualAttended);
    const shortage = isAttendanceShortage(crPct, totalHeld, threshold);

    return {
      student_id: s.id,
      roll_number: s.roll_number,
      student_name: s.student_name,
      classes_held: totalHeld,
      actual_attended: actualAttended,
      actual_percentage: actualPct,
      cr_attended: crAttended,
      cr_percentage: crPct,
      difference: diff,
      is_shortage: shortage,
      status_label: shortage ? 'SHORTAGE' : 'ELIGIBLE',
    };
  });

  // If shortage report requested, filter to only shortage rows
  const finalRows = type === 'shortage' ? rows.filter(r => r.is_shortage) : rows;

  res.json({
    type: type || 'class',
    totalHeld,
    threshold,
    rows: finalRows,
  });
});

// -------------------------------------------------------------
// GENUINE EXCEL EXPORT
// -------------------------------------------------------------

app.post('/api/export/excel', authMiddleware, (req: AuthRequest, res: Response) => {
  const {
    report_type, // 'cr_prepared' | 'actual' | 'comparison'
    subject_id,
    start_date,
    end_date,
    period_label, // e.g. "Monthly - October 2026"
  } = req.body;

  const cfg = db.prepare('SELECT * FROM class_config LIMIT 1').get() as any;
  const threshold = cfg?.attendance_threshold || 75.0;

  let subjectName = 'All Subjects';
  let subjectCode = 'ALL';
  if (subject_id && subject_id !== 'all') {
    const sub = db.prepare('SELECT subject_name, subject_code FROM subjects WHERE id = ?').get(subject_id) as any;
    if (sub) {
      subjectName = sub.subject_name;
      subjectCode = sub.subject_code;
    }
  }

  // Find sessions
  let sessQuery = 'SELECT id FROM attendance_sessions WHERE is_cancelled = 0';
  const sessParams: any[] = [];
  if (subject_id && subject_id !== 'all') {
    sessQuery += ' AND subject_id = ?';
    sessParams.push(subject_id);
  }
  if (start_date) {
    sessQuery += ' AND session_date >= ?';
    sessParams.push(start_date);
  }
  if (end_date) {
    sessQuery += ' AND session_date <= ?';
    sessParams.push(end_date);
  }

  const sessions = db.prepare(sessQuery).all(...sessParams) as any[];
  const totalHeld = sessions.length;
  const sessionIds = sessions.map(s => s.id);
  const inClause = sessionIds.length > 0 ? sessionIds.map(id => `'${id}'`).join(',') : "''";

  const students = db.prepare('SELECT * FROM students WHERE is_archived = 0 ORDER BY roll_number ASC').all() as any[];
  const now = new Date();
  const prepDate = now.toISOString().slice(0, 10);

  // Build row objects for workbook
  const reportRows: any[] = [];

  students.forEach((st) => {
    let actualAttended = 0;
    let crAttended = 0;

    if (sessionIds.length > 0) {
      const actualRes = db.prepare(`
        SELECT count(*) as count FROM original_attendance_records
        WHERE session_id IN (${inClause}) AND student_id = ? AND status = 'PRESENT'
      `).get(st.id) as any;
      actualAttended = actualRes ? actualRes.count : 0;

      const crRes = db.prepare(`
        SELECT count(*) as count FROM cr_prepared_attendance_records
        WHERE session_id IN (${inClause}) AND student_id = ? AND status = 'PRESENT'
      `).get(st.id) as any;
      crAttended = crRes ? crRes.count : 0;
    }

    const actualPct = calculateAttendancePercentage(actualAttended, totalHeld);
    const crPct = calculateAttendancePercentage(crAttended, totalHeld);

    if (report_type === 'comparison') {
      reportRows.push({
        'Roll Number': st.roll_number,
        'Student Name': st.student_name,
        'Subject Code': subjectCode,
        'Subject Name': subjectName,
        'Classes Held': totalHeld,
        'Actual Attended': actualAttended,
        'Actual %': `${actualPct.toFixed(1)}%`,
        'CR-Prepared Attended': crAttended,
        'CR-Prepared %': `${crPct.toFixed(1)}%`,
        'Difference': calculateAttendanceDifference(crAttended, actualAttended),
        'Status (<75%)': crPct < threshold ? 'SHORTAGE' : 'ELIGIBLE',
      });
    } else if (report_type === 'actual') {
      reportRows.push({
        'Roll Number': st.roll_number,
        'Student Name': st.student_name,
        'Subject Code': subjectCode,
        'Subject Name': subjectName,
        'Total Classes Held': totalHeld,
        'Classes Attended': actualAttended,
        'Attendance Percentage': `${actualPct.toFixed(1)}%`,
        'Report Period': period_label || 'Current Semester',
        'Preparation Date': prepDate,
        'Verification Status': 'Original Records Logged',
      });
    } else {
      // Standard CR-Prepared Report
      // Prompt requirements:
      // "For the standard CR-prepared report, include:
      // Roll Number, Student Name, Subject Code, Subject Name, Total Classes Held, CR-prepared Classes Attended, CR-prepared Attendance Percentage, Report Period, Report Preparation Date, Verification Status.
      // The standard export should not automatically include internal comparison columns or the private editing history.
      // Clearly label the file as CR-prepared attendance pending faculty verification."
      reportRows.push({
        'Roll Number': st.roll_number,
        'Student Name': st.student_name,
        'Subject Code': subjectCode,
        'Subject Name': subjectName,
        'Total Classes Held': totalHeld,
        'CR-prepared Classes Attended': crAttended,
        'CR-prepared Attendance %': `${crPct.toFixed(1)}%`,
        'Eligibility Status': crPct < threshold ? 'SHORTAGE ALERT' : 'ELIGIBLE',
        'Report Period': period_label || 'Current Academic Session',
        'Report Preparation Date': prepDate,
        'Verification Status': 'CR-prepared pending faculty verification',
      });
    }
  });

  // Create real XLSX
  const wb = XLSX.utils.book_new();

  // Create metadata header block
  const headerMeta = [
    ['COLLEGE CLASS ATTENDANCE REPORT — CLASS REPRESENTATIVE RECORD'],
    [`Class / Branch: ${cfg.class_name} (${cfg.department} Sem-${cfg.semester} Sec-${cfg.section})`],
    [`Subject: ${subjectCode} - ${subjectName}`],
    [`Report Period: ${period_label || 'Full Semester'} | Preparation Date: ${prepDate}`],
    ['DISCLAIMER: CR-prepared attendance pending faculty verification. Prepared by authorized Class Representative.'],
    [], // empty spacer row
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerMeta);
  XLSX.utils.sheet_add_json(ws, reportRows, { origin: 'A7' });

  // Column width styling
  ws['!cols'] = [
    { wch: 15 }, // Roll Number
    { wch: 25 }, // Student Name
    { wch: 14 }, // Subject Code
    { wch: 28 }, // Subject Name
    { wch: 18 }, // Total Held
    { wch: 22 }, // CR Attended
    { wch: 22 }, // CR %
    { wch: 18 }, // Eligibility
    { wch: 22 }, // Report Period
    { wch: 18 }, // Prep Date
    { wch: 38 }, // Verification Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance_Report');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Format descriptive filename
  // E.g. "ECE_Sem5_Mathematics_Monthly_Attendance.xlsx"
  const safeDept = (cfg.department || 'Class').replace(/[^a-zA-Z0-9]/g, '');
  const safeSem = `Sem${cfg.semester || '5'}`;
  const safeSub = subjectCode.replace(/[^a-zA-Z0-9]/g, '');
  const safePeriod = (period_label || 'Attendance').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeDept}_${safeSem}_${safeSub}_${safePeriod}_Report.xlsx`;

  // Log to export history
  db.prepare(`
    INSERT INTO export_history (id, export_type, subject_id, record_count, filename, exported_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'exp_' + crypto.randomBytes(8).toString('hex'),
    report_type || 'cr_prepared',
    subject_id || null,
    reportRows.length,
    filename
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Filename', filename);
  res.send(buffer);
});

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC FILES
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CR Attendance Management System server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
