import React from 'react';
import {
  Users,
  BookOpen,
  CalendarCheck,
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
  FileUp,
  FileEdit,
  BarChart3,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { NavTab } from './Navigation';
import { formatPercentage } from '../utils/attendanceCalculations';

interface DashboardStats {
  totalStudents: number;
  totalSubjects: number;
  todaySummary: {
    date: string;
    sessionCount: number;
    presentCount: number;
    absentCount: number;
  };
  shortageCount: number;
  lowAttendanceStudents: Array<{
    id: string;
    roll_number: string;
    student_name: string;
    classes_held: number;
    classes_attended: number;
    attendance_percentage: number;
  }>;
  recentSessions: Array<{
    id: string;
    session_date: string;
    session_name: string;
    is_cancelled: number;
    subject_name: string;
    subject_code: string;
    present_count: number;
    absent_count: number;
  }>;
  threshold: number;
}

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (tab: NavTab) => void;
  onSelectStudent?: (studentId: string) => void;
  onOpenAddStudent: () => void;
  onOpenImportStudents: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  onNavigate,
  onSelectStudent,
  onOpenAddStudent,
  onOpenImportStudents,
}) => {
  if (loading || !stats) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading live dashboard metrics from database...</p>
      </div>
    );
  }

  const threshold = stats.threshold || 75;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-white/20 text-white backdrop-blur-xs">
              Class Representative Workspace
            </span>
            <h2 className="text-xl font-bold mt-1.5">Class Attendance Overview</h2>
            <p className="text-xs text-blue-100 max-w-xl mt-1">
              Real-time attendance calculations computed directly from database sessions. Keep student records up to date and generate verified faculty reports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('actual-attendance')}
              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Mark Today's Attendance</span>
            </button>
            <button
              onClick={() => onNavigate('excel-export')}
              className="px-3.5 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Total Enrolled Students</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{stats.totalStudents}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>Active in current section</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Subjects */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Curriculum Subjects</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{stats.totalSubjects}</div>
            <div className="text-[11px] text-slate-400 mt-1">Theory & Practical courses</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Attendance Summary */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-slate-500">Today's Class Marks</div>
            <span className="text-[10px] font-mono text-slate-400">{stats.todaySummary.date}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-lg font-bold leading-tight">{stats.todaySummary.presentCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Present</div>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 text-rose-600">
              <XCircle className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-lg font-bold leading-tight">{stats.todaySummary.absentCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Absent</div>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {stats.todaySummary.sessionCount} session(s) conducted today
          </div>
        </div>

        {/* Shortage Alert Card */}
        <div className={`p-4 rounded-xl border shadow-xs flex items-center justify-between ${
          stats.shortageCount > 0
            ? 'bg-amber-50/70 border-amber-200'
            : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div>
            <div className="text-xs font-medium text-slate-600">Attendance Below {threshold}%</div>
            <div className={`text-2xl font-bold mt-1 ${
              stats.shortageCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {stats.shortageCount} {stats.shortageCount === 1 ? 'Student' : 'Students'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.shortageCount > 0 ? 'Requires attention before exams' : 'All students eligible'}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            stats.shortageCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">CR Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={onOpenAddStudent}
            className="p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-blue-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-800">Add Student</div>
            <div className="text-[11px] text-slate-500">Single student form</div>
          </button>

          <button
            onClick={onOpenImportStudents}
            className="p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
          >
            <FileUp className="w-5 h-5 text-indigo-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-800">Import Excel</div>
            <div className="text-[11px] text-slate-500">Batch CSV / XLSX</div>
          </button>

          <button
            onClick={() => onNavigate('actual-attendance')}
            className="p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
          >
            <CalendarCheck className="w-5 h-5 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-800">Take Attendance</div>
            <div className="text-[11px] text-slate-500">Daily session log</div>
          </button>

          <button
            onClick={() => onNavigate('edited-attendance')}
            className="p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
          >
            <FileEdit className="w-5 h-5 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-800">Edit Records</div>
            <div className="text-[11px] text-slate-500">CR corrections</div>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
          >
            <BarChart3 className="w-5 h-5 text-purple-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-800">View Reports</div>
            <div className="text-[11px] text-slate-500">Subject & weekly</div>
          </button>

          <button
            onClick={() => onNavigate('excel-export')}
            className="p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer"
          >
            <FileSpreadsheet className="w-5 h-5 text-teal-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-800">Export Excel</div>
            <div className="text-[11px] text-slate-500">Teacher verified format</div>
          </button>
        </div>
      </div>

      {/* Two-Column Layout: Shortage List & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shortage Watchlist */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-sm text-slate-800">Shortage Watchlist (&lt;{threshold}%)</h3>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              Full Report <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 flex-1">
            {stats.lowAttendanceStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">All students are above the {threshold}% threshold!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No attendance shortage flags detected in current records.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.lowAttendanceStudents.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => onSelectStudent && onSelectStudent(st.id)}
                    className="p-3 rounded-lg border border-amber-200/80 bg-amber-50/40 hover:bg-amber-100/50 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {st.roll_number}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{st.student_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Attended: <strong className="text-slate-700">{st.classes_attended}</strong> of <strong className="text-slate-700">{st.classes_held}</strong> classes held
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-700 font-mono">
                        {formatPercentage(st.attendance_percentage)}
                      </div>
                      <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-800">
                        Shortage
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Attendance Sessions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-800">Recent Attendance Sessions</h3>
            </div>
            <button
              onClick={() => onNavigate('actual-attendance')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              All Sessions <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 flex-1">
            {stats.recentSessions.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No attendance sessions recorded yet.</p>
                <button
                  onClick={() => onNavigate('actual-attendance')}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Mark the first session now
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.recentSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                          {sess.subject_code}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{sess.subject_name}</span>
                        {sess.is_cancelled === 1 && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>{sess.session_date}</span>
                        <span>•</span>
                        <span>{sess.session_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-700">
                        <span className="text-emerald-600">{sess.present_count}P</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-rose-600">{sess.absent_count}A</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Marked & Saved</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
