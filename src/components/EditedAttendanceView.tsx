import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  X,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import { Subject } from '../utils/types';
import { formatPercentage } from '../utils/attendanceCalculations';

export const EditedAttendanceView: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [rollSearch, setRollSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);

  // Controlled Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [editReason, setEditReason] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // History Drawer/Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadSubjects();
    loadRecords();
  }, [selectedSubjectId, filterDate, changedOnly]);

  const loadSubjects = async () => {
    try {
      const res = await api.getSubjects();
      setSubjects(res.subjects || []);
    } catch (err: any) {
      console.error('Failed to load subjects:', err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await api.getEditedRecords({
        subject_id: selectedSubjectId || undefined,
        date: filterDate || undefined,
        roll_number: rollSearch || undefined,
        student_name: nameSearch || undefined,
        changed_only: changedOnly,
      });
      setRecords(res.records || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load records' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (rec: any) => {
    setSelectedRecord(rec);
    setNewStatus(rec.cr_status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
    setEditReason('');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!editReason.trim()) {
      setEditError('A valid justification / reason is mandatory for any attendance correction.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await api.prepareEdit({
        session_id: selectedRecord.session_id,
        student_id: selectedRecord.student_id,
        new_status: newStatus,
        reason: editReason.trim(),
      });

      setMessage({
        type: 'success',
        text: `CR-prepared attendance for ${selectedRecord.student_name} updated to ${newStatus}. Original record preserved.`,
      });
      setEditModalOpen(false);
      setSelectedRecord(null);
      loadRecords();
    } catch (err: any) {
      setEditError(err.message || 'Failed to submit modification');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenHistory = async () => {
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const res = await api.getChangeHistory();
      setAuditHistory(res.history || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load audit history: ' + err.message });
    } finally {
      setHistoryLoading(false);
    }
  };

  // Search filter applied locally for fast responsiveness
  const filteredRecords = records.filter(r => {
    if (rollSearch && !r.roll_number.toLowerCase().includes(rollSearch.toLowerCase())) {
      return false;
    }
    if (nameSearch && !r.student_name.toLowerCase().includes(nameSearch.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Disclaimer / Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 shadow-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
            CR-Prepared Attendance Management System
          </div>
          <p className="mt-0.5 leading-relaxed">
            All adjustments made in this tab are recorded in the CR-prepared layer with change reason logs. The original recorded attendance is preserved in the database. When exporting to faculty, files are clearly marked as <em>"CR-prepared attendance pending faculty verification."</em>
          </p>
        </div>
      </div>

      {/* Header and Audit Log button */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Edited Attendance (CR Corrections)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review discrepancies between actual attendance logs and CR-prepared adjustments with full audit history.
          </p>
        </div>

        <button
          onClick={handleOpenHistory}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <History className="w-4 h-4 text-blue-400" />
          <span>View Change Audit History</span>
        </button>
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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_code} - {s.subject_name}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            >
            </input>
          </div>

          {/* Roll Number Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Roll Number</label>
            <input
              type="text"
              value={rollSearch}
              onChange={(e) => setRollSearch(e.target.value)}
              placeholder="e.g. CS2601"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* Student Name Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Student Name</label>
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="e.g. Siddharth"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={changedOnly}
              onChange={(e) => setChangedOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Show Only Modified / Corrected Records (Discrepancies)</span>
          </label>

          {(selectedSubjectId || filterDate || rollSearch || nameSearch || changedOnly) && (
            <button
              onClick={() => {
                setSelectedSubjectId('');
                setFilterDate('');
                setRollSearch('');
                setNameSearch('');
                setChangedOnly(false);
              }}
              className="text-xs text-blue-600 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Edited Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Subject & Session</th>
                <th className="px-4 py-3 text-center">Original Mark</th>
                <th className="px-4 py-3 text-center">CR-Prepared Mark</th>
                <th className="px-4 py-3">Discrepancy / Diff</th>
                <th className="px-4 py-3">Edit Reason / Justification</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading attendance records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <p className="font-semibold text-slate-700">No records found matching criteria</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {changedOnly ? 'No edited discrepancies found in this selection.' : 'Try adjusting your search filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const hasDiscrepancy = r.original_status !== r.cr_status;
                  return (
                    <tr
                      key={r.record_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasDiscrepancy ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{r.roll_number}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.student_name}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">{r.subject_code} - {r.subject_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.session_date} • {r.session_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
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
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.cr_status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {r.cr_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasDiscrepancy ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
                              {r.original_status === 'ABSENT' && r.cr_status === 'PRESENT' ? '+1 (ABS→PRE)' : '-1 (PRE→ABS)'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Match (0)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {r.edit_reason ? (
                          <div title={r.edit_reason}>
                            <span className="text-slate-800 font-medium">{r.edit_reason}</span>
                            {r.changed_by && (
                              <div className="text-[10px] text-slate-400">By: {r.changed_by}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">No modifications</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenEditModal(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Correct</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTROLLED EDIT MODAL */}
      {editModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Prepare Attendance Correction</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-5 space-y-4">
              {/* Record Summary Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div>
                  <strong>Student:</strong> {selectedRecord.student_name} ({selectedRecord.roll_number})
                </div>
                <div>
                  <strong>Subject:</strong> {selectedRecord.subject_code} - {selectedRecord.subject_name}
                </div>
                <div>
                  <strong>Session:</strong> {selectedRecord.session_date} • {selectedRecord.session_name}
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-slate-500">Original Status:</span>
                  <span className="font-bold text-slate-800 font-mono px-2 py-0.5 rounded bg-slate-200">
                    {selectedRecord.original_status}
                  </span>
                  <span className="text-slate-400">• Current CR Prepared:</span>
                  <span className="font-bold text-slate-800 font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {selectedRecord.cr_status}
                  </span>
                </div>
              </div>

              {editError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Status Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CR-Prepared Status <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStatus('PRESENT')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer ${
                      newStatus === 'PRESENT'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    PRESENT
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('ABSENT')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer ${
                      newStatus === 'ABSENT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ABSENT
                  </button>
                </div>
              </div>

              {/* Edit Reason (Mandatory) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Correction <span className="text-red-500">* (Mandatory for Audit Trail)</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Student submitted signed medical certificate / Approved college sports duty / Teacher verified on-duty slip"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  This reason will be logged in the permanent audit trail with your name and timestamp.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading || !editReason.trim()}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {editLoading ? 'Saving...' : 'Apply Correction & Log History'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT HISTORY MODAL */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Attendance Change Audit Trail</h3>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading change log...
                </div>
              ) : auditHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No attendance changes have been logged yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {auditHistory.map((h) => (
                    <div key={h.id} className="p-3 bg-white hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                            {h.roll_number}
                          </span>
                          <span className="font-semibold text-slate-800">{h.student_name}</span>
                          <span className="text-slate-400 text-[11px]">• {h.subject_code}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          <strong>Reason:</strong> {h.reason}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Changed by: <span className="text-slate-600 font-medium">{h.changed_by}</span> on {new Date(h.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {h.previous_status}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          {h.new_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setHistoryOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
