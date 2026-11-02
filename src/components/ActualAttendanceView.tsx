import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Check,
  X,
  History,
  Ban,
  Clock,
  Eye,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { api } from '../api/client';
import { Subject, Student, AttendanceSession } from '../utils/types';

interface ActualAttendanceViewProps {
  config: any;
}

export const ActualAttendanceView: React.FC<ActualAttendanceViewProps> = ({ config }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionName, setSessionName] = useState('Period 1 (09:00 - 10:00 AM)');
  const [sessionNotes, setSessionNotes] = useState('');

  // Markings state: student_id -> 'PRESENT' | 'ABSENT'
  const [attendanceMarks, setAttendanceMarks] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Session details inspection modal
  const [inspectedSession, setInspectedSession] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [subsRes, stusRes, sessRes] = await Promise.all([
        api.getSubjects(),
        api.getStudents(),
        api.getAttendanceSessions(),
      ]);

      const activeSubs = subsRes.subjects || [];
      const activeStus = stusRes.students || [];
      setSubjects(activeSubs);
      setStudents(activeStus);
      setSessions(sessRes.sessions || []);

      if (activeSubs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(activeSubs[0].id);
      }

      // Initialize all students as PRESENT by default (fastest for CR)
      const initialMarks: Record<string, 'PRESENT' | 'ABSENT'> = {};
      activeStus.forEach((s: Student) => {
        initialMarks[s.id] = 'PRESENT';
      });
      setAttendanceMarks(initialMarks);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setAttendanceMarks(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT',
    }));
  };

  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    const updated: Record<string, 'PRESENT' | 'ABSENT'> = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendanceMarks(updated);
  };

  const handleInvertAll = () => {
    const updated: Record<string, 'PRESENT' | 'ABSENT'> = {};
    students.forEach(s => {
      updated[s.id] = attendanceMarks[s.id] === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    });
    setAttendanceMarks(updated);
  };

  // Counts
  const presentCount = Object.values(attendanceMarks).filter(s => s === 'PRESENT').length;
  const absentCount = students.length - presentCount;

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setMessage({ type: 'error', text: 'Please select a subject' });
      return;
    }
    if (!sessionDate) {
      setMessage({ type: 'error', text: 'Please choose the session date' });
      return;
    }
    if (!sessionName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a session / period name' });
      return;
    }
    if (students.length === 0) {
      setMessage({ type: 'error', text: 'No active students enrolled to mark attendance' });
      return;
    }
    setConfirmModalOpen(true);
  };

  const executeSaveSession = async () => {
    setSubmitting(true);
    setMessage(null);

    const payload = {
      subject_id: selectedSubjectId,
      session_date: sessionDate,
      session_name: sessionName.trim(),
      notes: sessionNotes.trim() || undefined,
      attendance: students.map(s => ({
        student_id: s.id,
        status: attendanceMarks[s.id] || 'PRESENT',
      })),
    };

    try {
      const res = await api.createAttendanceSession(payload);
      setMessage({ type: 'success', text: res.message || 'Attendance session saved and securely locked!' });
      setConfirmModalOpen(false);

      // Refresh recent sessions
      const sessRes = await api.getAttendanceSessions();
      setSessions(sessRes.sessions || []);

      // Reset notes and advance session name preset
      setSessionNotes('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save attendance session' });
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInspectSession = async (sessionId: string) => {
    setInspectLoading(true);
    try {
      const res = await api.getSessionDetails(sessionId);
      setInspectedSession(res);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load session details' });
    } finally {
      setInspectLoading(false);
    }
  };

  const handleToggleCancel = async (sessionId: string) => {
    try {
      const res = await api.toggleCancelSession(sessionId);
      setMessage({ type: 'success', text: res.message });
      const sessRes = await api.getAttendanceSessions();
      setSessions(sessRes.sessions || []);
      if (inspectedSession && inspectedSession.session.id === sessionId) {
        setInspectedSession({
          ...inspectedSession,
          session: {
            ...inspectedSession.session,
            is_cancelled: res.is_cancelled,
          },
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Filter students for display
  const filteredStudents = students.filter(st => {
    if (!studentSearch.trim()) return true;
    const term = studentSearch.toLowerCase();
    return st.roll_number.toLowerCase().includes(term) || st.student_name.toLowerCase().includes(term);
  });

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
              Live Classroom Mode
            </span>
            <span className="text-xs text-slate-500 font-mono">Original Record Storage</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mt-1">Actual Class Attendance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mark official attendance for today's session. Once saved, original attendance records are permanently preserved and cannot be silently overwritten.
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-sm font-bold leading-none">{presentCount} Present</div>
              <div className="text-[10px] text-emerald-600 font-medium">In Class</div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600" />
            <div>
              <div className="text-sm font-bold leading-none">{absentCount} Absent</div>
              <div className="text-[10px] text-rose-600 font-medium">Not In Class</div>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Session Details Form Bar */}
      <form onSubmit={handlePromptSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Subject <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              required
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.subject_code} — {s.subject_name} ({s.faculty_name})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Class Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 3. Class Session Preset */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Class Session / Period <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              required
              placeholder="e.g. Period 1 (09:00 - 10:00 AM)"
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Topic / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Topic / Lecture Notes <span className="text-slate-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Chapter 4 Pipeline Hazards"
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick Bulk Toggle Toolbar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Quick Actions:</span>
            <button
              type="button"
              onClick={() => handleMarkAll('PRESENT')}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> All Present
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('ABSENT')}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> All Absent
            </button>
            <button
              type="button"
              onClick={handleInvertAll}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Invert Marks
            </button>
          </div>

          {/* Search within student roster */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student roll or name..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Student Grid / List */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Student Roster ({filteredStudents.length} Students)</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Click student card or toggle button to switch Present / Absent
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No students match your search filter.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isPresent = attendanceMarks[st.id] === 'PRESENT';
                return (
                  <div
                    key={st.id}
                    onClick={() => handleToggleStudent(st.id)}
                    className={`px-4 py-3 flex items-center justify-between transition-colors cursor-pointer select-none ${
                      isPresent
                        ? 'bg-white hover:bg-emerald-50/40'
                        : 'bg-rose-50/50 hover:bg-rose-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {st.roll_number}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{st.student_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {st.enrollment_number ? `Enr: ${st.enrollment_number}` : `Sec ${st.section || 'A'}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-rose-600 text-white shadow-xs'
                        }`}
                      >
                        {isPresent ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>PRESENT</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>ABSENT</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Submitting permanently writes to <strong className="text-slate-700">original_attendance_records</strong>. Later CR changes must be recorded through the Edited Attendance tab.
          </div>
          <button
            type="submit"
            disabled={submitting || students.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Save & Lock Attendance Session</span>
          </button>
        </div>
      </form>

      {/* Confirmation Dialog before Saving */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm">Confirm Session Attendance</h3>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                You are about to save the attendance session for:
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div><strong>Subject:</strong> {selectedSubject?.subject_code} - {selectedSubject?.subject_name}</div>
                <div><strong>Date:</strong> {sessionDate}</div>
                <div><strong>Session:</strong> {sessionName}</div>
                <div className="pt-1 flex items-center gap-4 text-xs font-bold">
                  <span className="text-emerald-700">{presentCount} Students Present</span>
                  <span className="text-rose-700">{absentCount} Students Absent</span>
                </div>
              </div>
              <p className="text-slate-500 text-[11px]">
                Note: In accordance with attendance integrity requirements, once saved, original values cannot be overwritten. Any corrections must be submitted with an audit reason in the Edited Attendance tab.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Go Back & Review
              </button>
              <button
                type="button"
                onClick={executeSaveSession}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {submitting ? 'Saving Session...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History of Saved Sessions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Saved Attendance Sessions History</h3>
          </div>
          <span className="text-xs text-slate-500">{sessions.length} Sessions Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Session / Period</th>
                <th className="px-4 py-2.5">Present / Absent</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No sessions saved yet.
                  </td>
                </tr>
              ) : (
                sessions.map((ss) => (
                  <tr key={ss.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-mono text-slate-700">{ss.session_date}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      <span>{ss.subject_name}</span>
                      <span className="ml-1.5 text-[10px] font-mono text-blue-600 font-bold">({ss.subject_code})</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{ss.session_name}</td>
                    <td className="px-4 py-2.5 font-mono font-bold">
                      <span className="text-emerald-600">{ss.present_count ?? '—'}P</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="text-rose-600">{ss.absent_count ?? '—'}A</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {ss.is_cancelled === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                          Cancelled
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleInspectSession(ss.id)}
                          className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 cursor-pointer"
                          title="View student markings for this session"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleToggleCancel(ss.id)}
                          className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer ${
                            ss.is_cancelled === 1
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-amber-700 hover:bg-amber-50'
                          }`}
                          title={ss.is_cancelled === 1 ? 'Reinstate Session' : 'Mark as Cancelled'}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{ss.is_cancelled === 1 ? 'Reinstate' : 'Cancel'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT SESSION MODAL */}
      {inspectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {inspectedSession.session.subject_name} ({inspectedSession.session.subject_code})
                </h3>
                <p className="text-[11px] text-slate-300">
                  {inspectedSession.session.session_date} • {inspectedSession.session.session_name}
                </p>
              </div>
              <button onClick={() => setInspectedSession(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <strong>Session Status:</strong>{' '}
                  {inspectedSession.session.is_cancelled === 1 ? (
                    <span className="text-rose-600 font-bold">CANCELLED (Excluded from classes held)</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">ACTIVE</span>
                  )}
                </div>
                {inspectedSession.session.notes && (
                  <div className="text-slate-500 italic">Notes: {inspectedSession.session.notes}</div>
                )}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Student Name</th>
                      <th className="px-3 py-2">Original Mark</th>
                      <th className="px-3 py-2">CR Prepared Mark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectedSession.records.map((r: any) => (
                      <tr key={r.student_id}>
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">{r.roll_number}</td>
                        <td className="px-3 py-2 text-slate-800">{r.student_name}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.original_status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.original_status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.cr_status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.cr_status}
                          </span>
                          {r.original_status !== r.cr_status && (
                            <span className="ml-1 text-[10px] text-amber-600 font-semibold">(Edited)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setInspectedSession(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
