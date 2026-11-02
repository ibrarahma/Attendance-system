import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Filter,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  User,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';
import { api } from '../api/client';
import { Subject, ClassConfig } from '../utils/types';
import { formatPercentage } from '../utils/attendanceCalculations';

interface AttendanceReportsViewProps {
  config: ClassConfig | null;
  onSelectStudentDetails?: (studentId: string) => void;
}

export const AttendanceReportsView: React.FC<AttendanceReportsViewProps> = ({
  config,
  onSelectStudentDetails,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reportType, setReportType] = useState<
    'class' | 'subject' | 'weekly' | 'monthly' | 'semester' | 'shortage' | 'comparison'
  >('class');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{
    totalHeld: number;
    threshold: number;
    rows: any[];
  } | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedSubjectId, startDate, endDate]);

  const loadSubjects = async () => {
    try {
      const res = await api.getSubjects();
      setSubjects(res.subjects || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getReports({
        type: reportType,
        subject_id: selectedSubjectId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: searchTerm || undefined,
      });
      setReportData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Quick preset dates
  const handleSetPreset = (preset: 'all' | 'month' | 'week') => {
    const today = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
      const sunday = new Date(d.setDate(diff + 6)).toISOString().slice(0, 10);
      setStartDate(monday);
      setEndDate(sunday);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredRows = (reportData?.rows || []).filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return r.roll_number.toLowerCase().includes(term) || r.student_name.toLowerCase().includes(term);
  });

  const threshold = reportData?.threshold || 75;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Attendance Analytics & Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Subject-wise, weekly, monthly, complete class, and low-attendance deficiency audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter and Configuration Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        {/* Report Type Selector Tabs */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Select Report Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'class', label: 'Complete Class Report' },
              { id: 'subject', label: 'Subject-Wise Report' },
              { id: 'weekly', label: 'Weekly Summary' },
              { id: 'monthly', label: 'Monthly Summary' },
              { id: 'shortage', label: 'Low-Attendance Shortage (<75%)' },
              { id: 'comparison', label: 'Actual vs CR Comparison' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setReportType(tab.id as any);
                  if (tab.id === 'weekly') handleSetPreset('week');
                  else if (tab.id === 'monthly') handleSetPreset('month');
                  else if (tab.id === 'class' || tab.id === 'shortage') handleSetPreset('all');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  reportType === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            >
              <option value="all">All Subjects (Aggregate)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_code} - {s.subject_name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* Student Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search roll or name..."
                className="w-full pl-8 pr-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Header */}
      {reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-500 font-medium">Classes Held in Scope</div>
            <div className="text-xl font-bold text-slate-800 mt-1">{reportData.totalHeld}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Excludes cancelled sessions</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-500 font-medium">Total Students Evaluated</div>
            <div className="text-xl font-bold text-slate-800 mt-1">{filteredRows.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active enrolled students</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-500 font-medium">Shortage Threshold</div>
            <div className="text-xl font-bold text-amber-600 mt-1">{threshold}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Configured college limit</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-slate-500 font-medium">Deficient Students (&lt;{threshold}%)</div>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {filteredRows.filter(r => r.is_shortage).length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Action required</div>
          </div>
        </div>
      )}

      {/* Report Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {reportType === 'shortage'
                ? `Low-Attendance Deficiency Report (<${threshold}%)`
                : reportType === 'comparison'
                ? 'Actual vs CR-Prepared Comparison Report'
                : 'Class Attendance Summary'}
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any student's name or roll number to view individual breakdown.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Roll Number</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3 text-center">Classes Held</th>
                {reportType === 'comparison' ? (
                  <>
                    <th className="px-4 py-3 text-center">Actual Attended</th>
                    <th className="px-4 py-3 text-center">Actual %</th>
                    <th className="px-4 py-3 text-center">CR-Prepared Attended</th>
                    <th className="px-4 py-3 text-center">CR-Prepared %</th>
                    <th className="px-4 py-3 text-center">Difference</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-center">Classes Attended</th>
                    <th className="px-4 py-3 text-center">Attendance %</th>
                  </>
                )}
                <th className="px-4 py-3 text-center">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Generating report calculations...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <p className="font-semibold text-slate-700">No records found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {reportType === 'shortage'
                        ? 'Great news! No students are below the configured attendance threshold.'
                        : 'No sessions or attendance records match the selected dates.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  return (
                    <tr
                      key={r.student_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        r.is_shortage ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        <button
                          onClick={() => onSelectStudentDetails && onSelectStudentDetails(r.student_id)}
                          className="hover:text-blue-600 hover:underline cursor-pointer"
                        >
                          {r.roll_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        <button
                          onClick={() => onSelectStudentDetails && onSelectStudentDetails(r.student_id)}
                          className="hover:text-blue-600 hover:underline text-left cursor-pointer"
                        >
                          {r.student_name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">{r.classes_held}</td>

                      {reportType === 'comparison' ? (
                        <>
                          <td className="px-4 py-3 text-center font-mono text-slate-700">{r.actual_attended}</td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800">
                            {formatPercentage(r.actual_percentage)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-blue-700">{r.cr_attended}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-blue-900">
                            {formatPercentage(r.cr_percentage)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                r.difference > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.difference < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {r.difference > 0 ? `+${r.difference}` : r.difference}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">{r.cr_attended}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                            {formatPercentage(r.cr_percentage)}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 text-center">
                        {r.is_shortage ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                            SHORTAGE (&lt;{threshold}%)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ELIGIBLE
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
