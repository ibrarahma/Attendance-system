import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'attendance.db');
export const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cr_user (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      security_question TEXT NOT NULL,
      security_answer_hash TEXT NOT NULL,
      security_answer_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_config (
      id TEXT PRIMARY KEY,
      class_name TEXT NOT NULL,
      department TEXT NOT NULL,
      semester TEXT NOT NULL,
      section TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      attendance_threshold REAL NOT NULL DEFAULT 75.0,
      default_period TEXT NOT NULL DEFAULT 'all',
      enrollment_unique INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      roll_number TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      enrollment_number TEXT,
      department TEXT NOT NULL,
      semester TEXT NOT NULL,
      section TEXT,
      batch TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      subject_code TEXT UNIQUE NOT NULL,
      subject_name TEXT NOT NULL,
      faculty_name TEXT NOT NULL,
      semester TEXT NOT NULL,
      subject_type TEXT NOT NULL DEFAULT 'Theory',
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      session_date TEXT NOT NULL,
      session_name TEXT NOT NULL,
      is_cancelled INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE(subject_id, session_date, session_name)
    );

    CREATE TABLE IF NOT EXISTS original_attendance_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT')),
      marked_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS cr_prepared_attendance_records (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT')),
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_change_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      valid_rows INTEGER NOT NULL,
      duplicate_rows INTEGER NOT NULL,
      invalid_rows INTEGER NOT NULL,
      imported_count INTEGER NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS export_history (
      id TEXT PRIMARY KEY,
      export_type TEXT NOT NULL,
      subject_id TEXT,
      record_count INTEGER NOT NULL,
      filename TEXT NOT NULL,
      exported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cr_auth_sessions (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES cr_user(id) ON DELETE CASCADE
    );
  `);

  // Seed default CR user if empty
  const crCount = db.prepare('SELECT count(*) as count FROM cr_user').get() as { count: number };
  if (crCount.count === 0) {
    const { hash: pHash, salt: pSalt } = hashPassword('crattendance2026');
    const { hash: aHash, salt: aSalt } = hashPassword('computer science');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO cr_user (
        id, username, password_hash, password_salt, full_name, email,
        security_question, security_answer_hash, security_answer_salt,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'cr-1',
      'cr_admin',
      pHash,
      pSalt,
      'Alex Mercer (Class Rep)',
      'cr@college.edu',
      'What is your primary college department?',
      aHash,
      aSalt,
      now,
      now
    );
  }

  // Seed class config if empty
  const cfgCount = db.prepare('SELECT count(*) as count FROM class_config').get() as { count: number };
  if (cfgCount.count === 0) {
    db.prepare(`
      INSERT INTO class_config (
        id, class_name, department, semester, section, academic_year,
        attendance_threshold, default_period, enrollment_unique, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'cfg-1',
      'B.Tech Computer Science & Engineering',
      'CSE',
      '5',
      'Section A',
      '2026-2027',
      75.0,
      'all',
      0,
      new Date().toISOString()
    );
  }

  // Seed initial subjects if empty
  const subCount = db.prepare('SELECT count(*) as count FROM subjects').get() as { count: number };
  if (subCount.count === 0) {
    const subjectsSeed = [
      { id: 'sub-1', code: 'CS501', name: 'Operating Systems', faculty: 'Prof. R. K. Sharma', sem: '5', type: 'Theory' },
      { id: 'sub-2', code: 'CS502', name: 'Database Management Systems', faculty: 'Dr. Anita Verma', sem: '5', type: 'Theory' },
      { id: 'sub-3', code: 'CS503', name: 'Computer Networks', faculty: 'Prof. Vikram Patel', sem: '5', type: 'Theory' },
      { id: 'sub-4', code: 'CS504', name: 'Software Engineering', faculty: 'Dr. Priya Mukherjee', sem: '5', type: 'Theory' },
      { id: 'sub-5', code: 'CS505', name: 'Web Technologies Lab', faculty: 'Prof. Davis John', sem: '5', type: 'Practical' },
    ];
    const insertSub = db.prepare(`
      INSERT INTO subjects (id, subject_code, subject_name, faculty_name, semester, subject_type, is_archived, created_at)
      VALUES (@id, @code, @name, @faculty, @sem, @type, 0, datetime('now'))
    `);
    const insertManySubs = db.transaction((subs) => {
      for (const s of subs) insertSub.run(s);
    });
    insertManySubs(subjectsSeed);
  }

  // Seed sample students if empty
  const stuCount = db.prepare('SELECT count(*) as count FROM students').get() as { count: number };
  if (stuCount.count === 0) {
    const studentsSeed = [
      { id: 'stu-01', roll: 'CS2601', name: 'Aarav Sharma', enr: 'EN202401', dept: 'CSE', sem: '5', sec: 'A', batch: 'B1' },
      { id: 'stu-02', roll: 'CS2602', name: 'Ananya Iyer', enr: 'EN202402', dept: 'CSE', sem: '5', sec: 'A', batch: 'B1' },
      { id: 'stu-03', roll: 'CS2603', name: 'Devansh Verma', enr: 'EN202403', dept: 'CSE', sem: '5', sec: 'A', batch: 'B1' },
      { id: 'stu-04', roll: 'CS2604', name: 'Ishaan Gupta', enr: 'EN202404', dept: 'CSE', sem: '5', sec: 'A', batch: 'B1' },
      { id: 'stu-05', roll: 'CS2605', name: 'Kavya Nair', enr: 'EN202405', dept: 'CSE', sem: '5', sec: 'A', batch: 'B2' },
      { id: 'stu-06', roll: 'CS2606', name: 'Manish Reddy', enr: 'EN202406', dept: 'CSE', sem: '5', sec: 'A', batch: 'B2' },
      { id: 'stu-07', roll: 'CS2607', name: 'Neha Chawla', enr: 'EN202407', dept: 'CSE', sem: '5', sec: 'A', batch: 'B2' },
      { id: 'stu-08', roll: 'CS2608', name: 'Pranav Joshi', enr: 'EN202408', dept: 'CSE', sem: '5', sec: 'A', batch: 'B2' },
      { id: 'stu-09', roll: 'CS2609', name: 'Riya Sen', enr: 'EN202409', dept: 'CSE', sem: '5', sec: 'A', batch: 'B3' },
      { id: 'stu-10', roll: 'CS2610', name: 'Siddharth Roy', enr: 'EN202410', dept: 'CSE', sem: '5', sec: 'A', batch: 'B3' },
      { id: 'stu-11', roll: 'CS2611', name: 'Tanvi Saxena', enr: 'EN202411', dept: 'CSE', sem: '5', sec: 'A', batch: 'B3' },
      { id: 'stu-12', roll: 'CS2612', name: 'Zaid Khan', enr: 'EN202412', dept: 'CSE', sem: '5', sec: 'A', batch: 'B3' },
    ];
    const insertStu = db.prepare(`
      INSERT INTO students (id, roll_number, student_name, enrollment_number, department, semester, section, batch, is_archived, created_at, updated_at)
      VALUES (@id, @roll, @name, @enr, @dept, @sem, @sec, @batch, 0, datetime('now'), datetime('now'))
    `);
    const insertManyStus = db.transaction((stus) => {
      for (const s of stus) insertStu.run(s);
    });
    insertManyStus(studentsSeed);

    // Also seed a couple of realistic attendance sessions so dashboard and reports have realistic data right away
    const sessSeed = [
      { id: 'sess-1', subId: 'sub-1', date: '2026-10-26', name: 'Period 1 (09:00 - 10:00 AM)', notes: 'Process Scheduling' },
      { id: 'sess-2', subId: 'sub-2', date: '2026-10-26', name: 'Period 2 (10:15 - 11:15 AM)', notes: 'Relational Algebra' },
      { id: 'sess-3', subId: 'sub-1', date: '2026-10-27', name: 'Period 3 (11:30 - 12:30 PM)', notes: 'Deadlock Detection' },
      { id: 'sess-4', subId: 'sub-3', date: '2026-10-28', name: 'Period 1 (09:00 - 10:00 AM)', notes: 'TCP/IP Architecture' },
    ];

    const insertSess = db.prepare(`
      INSERT INTO attendance_sessions (id, subject_id, session_date, session_name, is_cancelled, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
    `);
    for (const ss of sessSeed) {
      insertSess.run(ss.id, ss.subId, ss.date, ss.name, ss.notes);
    }

    // Attendance markings:
    // Make 2 students have low attendance (<75%) to showcase the shortage alert!
    // e.g. stu-06 (Manish) and stu-10 (Siddharth)
    const insertOrig = db.prepare(`
      INSERT INTO original_attendance_records (id, session_id, student_id, status, marked_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    const insertCr = db.prepare(`
      INSERT INTO cr_prepared_attendance_records (id, session_id, student_id, status, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    for (const ss of sessSeed) {
      for (const st of studentsSeed) {
        let isPresent = true;
        if (st.id === 'stu-06') {
          // Manish absent in 3 out of 4
          isPresent = ss.id === 'sess-1';
        } else if (st.id === 'stu-10') {
          // Siddharth absent in 2 out of 4
          isPresent = ss.id === 'sess-1' || ss.id === 'sess-2';
        } else if (st.id === 'stu-12' && ss.id === 'sess-4') {
          isPresent = false;
        }

        const status = isPresent ? 'PRESENT' : 'ABSENT';
        const recId = `${ss.id}_${st.id}`;
        insertOrig.run(recId, ss.id, st.id, status);
        // By default cr_prepared matches original
        insertCr.run(recId, ss.id, st.id, status);
      }
    }

    // Seed one CR edit with audit history to showcase the Edited Attendance tab right away!
    // For stu-10 in sess-2, student showed medical slip, so CR prepared attendance is PRESENT
    const editRecId = `sess-2_stu-10`;
    db.prepare(`UPDATE cr_prepared_attendance_records SET status = 'PRESENT', updated_at = datetime('now') WHERE id = ?`).run(editRecId);
    db.prepare(`
      INSERT INTO attendance_change_history (id, session_id, student_id, previous_status, new_status, reason, changed_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('hist-1', 'sess-2', 'stu-10', 'ABSENT', 'PRESENT', 'Medical slip submitted to CR and verified with HOD', 'Alex Mercer (CR)');
  }
}
