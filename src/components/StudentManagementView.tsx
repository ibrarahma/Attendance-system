import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  UserPlus,
  FileSpreadsheet,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  FileDown,
  Archive,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { api } from '../api/client';
import { Student, ClassConfig, ImportValidationResult, ParsedStudentRow } from '../utils/types';
import { formatPercentage } from '../utils/attendanceCalculations';

interface StudentManagementViewProps {
  config: ClassConfig | null;
  onOpenDetailsId?: string | null;
  onClearDetailsId?: () => void;
  openAddStudentModalDefault?: boolean;
  openImportModalDefault?: boolean;
  onClearDefaultModals?: () => void;
}

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({
  config,
  onOpenDetailsId,
  onClearDetailsId,
  openAddStudentModalDefault = false,
  openImportModalDefault = false,
  onClearDefaultModals,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [sortField, setSortField] = useState<'roll_number' | 'student_name'>('roll_number');
  const [sortAsc, setSortAsc] = useState(true);

  // Add Student Modal State
  const [addModalOpen, setAddModalOpen] = useState(openAddStudentModalDefault);
  const [addForm, setAddForm] = useState({
    roll_number: '',
    student_name: '',
    enrollment_number: '',
    department: config?.department || 'CSE',
    semester: config?.semester || '5',
    section: config?.section || 'A',
    batch: '',
  });
  const [addFormLoading, setAddFormLoading] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Edit Student Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    roll_number: '',
    student_name: '',
    enrollment_number: '',
    department: '',
    semester: '',
    section: '',
    batch: '',
  });

  // Student Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [studentDetails, setStudentDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(openImportModalDefault);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportValidationResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Delete / Archive confirmation modal
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);
  const [archiveOptionAvailable, setArchiveOptionAvailable] = useState(false);

  useEffect(() => {
    if (openAddStudentModalDefault) setAddModalOpen(true);
    if (openImportModalDefault) setImportModalOpen(true);
    if (onClearDefaultModals) onClearDefaultModals();
  }, [openAddStudentModalDefault, openImportModalDefault]);

  useEffect(() => {
    loadStudents();
  }, [showArchived, sectionFilter]);

  useEffect(() => {
    if (onOpenDetailsId) {
      handleViewDetails(onOpenDetailsId);
      if (onClearDetailsId) onClearDetailsId();
    }
  }, [onOpenDetailsId]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await api.getStudents({
        archived: showArchived ? '1' : '0',
        section: sectionFilter || undefined,
      });
      setStudents(res.students || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load students' });
    } finally {
      setLoading(false);
    }
  };

  // Add Student Handler
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);
    setAddFormLoading(true);

    try {
      await api.addStudent(addForm);
      setMessage({ type: 'success', text: `Student ${addForm.student_name} (${addForm.roll_number}) added successfully.` });
      setAddModalOpen(false);
      setAddForm({
        roll_number: '',
        student_name: '',
        enrollment_number: '',
        department: config?.department || 'CSE',
        semester: config?.semester || '5',
        section: config?.section || 'A',
        batch: '',
      });
      loadStudents();
    } catch (err: any) {
      setAddFormError(err.message || 'Failed to add student');
    } finally {
      setAddFormLoading(false);
    }
  };

  // Edit Student Handler
  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setEditForm({
      roll_number: st.roll_number,
      student_name: st.student_name,
      enrollment_number: st.enrollment_number || '',
      department: st.department || '',
      semester: st.semester || '',
      section: st.section || '',
      batch: st.batch || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      await api.updateStudent(editingStudent.id, editForm);
      setMessage({ type: 'success', text: `Student record updated successfully.` });
      setEditModalOpen(false);
      setEditingStudent(null);
      loadStudents();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update student' });
    }
  };

  // View Details
  const handleViewDetails = async (studentId: string) => {
    setDetailsLoading(true);
    setDetailsModalOpen(true);
    try {
      const res = await api.getStudentDetails(studentId);
      setStudentDetails(res);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load student details' });
      setDetailsModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Delete or Archive
  const handleDeletePrompt = (st: Student) => {
    setDeleteConfirmStudent(st);
    setArchiveOptionAvailable(false);
  };

  const executeDelete = async (forceArchive = false) => {
    if (!deleteConfirmStudent) return;
    try {
      const res = await api.deleteStudent(deleteConfirmStudent.id, forceArchive);
      setMessage({ type: 'success', text: res.message || 'Action executed successfully.' });
      setDeleteConfirmStudent(null);
      setArchiveOptionAvailable(false);
      loadStudents();
    } catch (err: any) {
      if (err.message && err.message.includes('existing attendance')) {
        setArchiveOptionAvailable(true);
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to delete student' });
        setDeleteConfirmStudent(null);
      }
    }
  };

  const toggleArchive = async (st: Student) => {
    try {
      const res = await api.toggleArchiveStudent(st.id);
      setMessage({ type: 'success', text: res.message });
      loadStudents();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Import Workflow
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSummary(null);
    setImportPreview(null);
    setImportFile(file);

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setImportError('Invalid file type. Please upload a valid .xlsx, .xls, or .csv file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImportError('File size exceeds the 5MB limit.');
      return;
    }

    try {
      setImportLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonRows.length === 0) {
        setImportError('The uploaded spreadsheet contains no data rows.');
        setImportLoading(false);
        return;
      }

      // Send to backend validation for authoritative DB duplicate checking
      const previewRes = await api.previewImport({
        rows: jsonRows,
        filename: file.name,
      });

      setImportPreview(previewRes);
    } catch (err: any) {
      setImportError('Failed to parse spreadsheet: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.validRows.length === 0) return;

    setImportLoading(true);
    setImportError(null);
    try {
      const res = await api.confirmImport({
        validRows: importPreview.validRows,
        filename: importFile?.name || 'students.xlsx',
        totalRows: importPreview.totalParsed,
        duplicateCount: importPreview.duplicateInFileRows.length + importPreview.duplicateInDbRows.length,
        invalidCount: importPreview.invalidRows.length,
      });

      setImportSummary(res.message);
      setImportPreview(null);
      setImportFile(null);
      loadStudents();
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importPreview) return;
    const errors: Array<{ Row: string; Reason: string; Data: string }> = [];

    importPreview.invalidRows.forEach(inv => {
      errors.push({
        Row: 'Invalid Row',
        Reason: inv.reason,
        Data: JSON.stringify(inv.row),
      });
    });

    importPreview.duplicateInFileRows.forEach(dup => {
      errors.push({
        Row: `Row ${dup.row.row_number || 'N/A'}`,
        Reason: dup.reason,
        Data: `Roll: ${dup.row.roll_number}, Name: ${dup.row.student_name}`,
      });
    });

    importPreview.duplicateInDbRows.forEach(dup => {
      errors.push({
        Row: `Row ${dup.row.row_number || 'N/A'}`,
        Reason: dup.reason,
        Data: `Roll: ${dup.row.roll_number}, Name: ${dup.row.student_name}`,
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(errors);
    XLSX.utils.book_append_sheet(wb, ws, 'Import_Errors');
    XLSX.writeFile(wb, `Import_Errors_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter & Search logic
  const filteredStudents = students
    .filter(st => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        st.roll_number.toLowerCase().includes(term) ||
        st.student_name.toLowerCase().includes(term) ||
        (st.enrollment_number && st.enrollment_number.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header & Two Prominent Action Buttons */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Student Roster Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain official class enrollments, add individual students, or batch-import via Excel/CSV.
          </p>
        </div>

        {/* The Two Prominent Buttons requested by prompt */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>

          <button
            onClick={() => {
              setImportModalOpen(true);
              setImportPreview(null);
              setImportError(null);
              setImportSummary(null);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Students from Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Roll Number, Name, or Enrollment..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Section filter */}
          <select
            value={sectionFilter}
            onChange={(e) => {
              setSectionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>

          {/* Archived toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showArchived
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{showArchived ? 'Showing Archived' : 'Show Archived'}</span>
          </button>

          <button
            onClick={loadStudents}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Refresh student list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th
                  onClick={() => {
                    if (sortField === 'roll_number') setSortAsc(!sortAsc);
                    else {
                      setSortField('roll_number');
                      setSortAsc(true);
                    }
                  }}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                >
                  Roll Number {sortField === 'roll_number' && (sortAsc ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'student_name') setSortAsc(!sortAsc);
                    else {
                      setSortField('student_name');
                      setSortAsc(true);
                    }
                  }}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                >
                  Student Name {sortField === 'student_name' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3">Enrollment No.</th>
                <th className="px-4 py-3">Branch / Sem</th>
                <th className="px-4 py-3">Sec / Batch</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading students...
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <p className="font-semibold text-slate-700">No students found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {search ? 'Try clearing your search query' : 'Add your first student or import an Excel roster'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {st.roll_number}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <button
                        onClick={() => handleViewDetails(st.id)}
                        className="hover:text-blue-600 hover:underline text-left cursor-pointer"
                      >
                        {st.student_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {st.enrollment_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {st.department} • Sem {st.semester}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {st.section ? `Sec ${st.section}` : '—'} {st.batch ? `(${st.batch})` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(st.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="View Attendance Breakdown"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                          title="Edit Student"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {showArchived ? (
                          <button
                            onClick={() => toggleArchive(st)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Unarchive Student"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeletePrompt(st)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Delete or Archive Student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {filteredStudents.length > pageSize && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* A. ADD STUDENT MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Add New Student</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-3.5">
              {addFormError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roll Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.roll_number}
                  onChange={(e) => setAddForm({ ...addForm, roll_number: e.target.value })}
                  required
                  placeholder="e.g. CS2601 or 007"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
                <span className="text-[10px] text-slate-400">Must be unique; leading zeros are preserved.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.student_name}
                  onChange={(e) => setAddForm({ ...addForm, student_name: e.target.value })}
                  required
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enrollment Number <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={addForm.enrollment_number}
                  onChange={(e) => setAddForm({ ...addForm, enrollment_number: e.target.value })}
                  placeholder="e.g. EN202401"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department / Branch
                  </label>
                  <input
                    type="text"
                    value={addForm.department}
                    onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={addForm.semester}
                    onChange={(e) => setAddForm({ ...addForm, semester: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.section}
                    onChange={(e) => setAddForm({ ...addForm, section: e.target.value })}
                    placeholder="e.g. A"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batch <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.batch}
                    onChange={(e) => setAddForm({ ...addForm, batch: e.target.value })}
                    placeholder="e.g. B1"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFormLoading}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  {addFormLoading ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Edit Student: {editingStudent.student_name}</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Number</label>
                <input
                  type="text"
                  value={editForm.roll_number}
                  onChange={(e) => setEditForm({ ...editForm, roll_number: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Name</label>
                <input
                  type="text"
                  value={editForm.student_name}
                  onChange={(e) => setEditForm({ ...editForm, student_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Number</label>
                <input
                  type="text"
                  value={editForm.enrollment_number}
                  onChange={(e) => setEditForm({ ...editForm, enrollment_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <input
                    type="text"
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch</label>
                  <input
                    type="text"
                    value={editForm.batch}
                    onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. IMPORT STUDENTS MODAL (Complete Workflow) */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="font-bold text-sm">Import Students from Excel or CSV</h3>
                  <p className="text-[11px] text-emerald-200">ADD ONLY policy • Strict validation & duplicate detection</p>
                </div>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-emerald-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Template download & instructions */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-emerald-900">Standard Excel Template</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Columns: Roll Number, Student Name, Enrollment Number, Department, Semester, Section, Batch.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => api.downloadTemplate()}
                  className="px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-lg border border-emerald-300 flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template (.xlsx)</span>
                </button>
              </div>

              {/* Upload Input */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50">
                <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <label className="text-xs font-bold text-slate-800 block cursor-pointer">
                  <span>Click to select an Excel (.xlsx, .xls) or CSV file</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  {importFile ? `Selected: ${importFile.name}` : 'Supports drag-and-drop or file picker up to 5MB'}
                </p>
              </div>

              {/* Messages */}
              {importError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSummary && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSummary}</span>
                </div>
              )}

              {/* Validation & Preview Section */}
              {importPreview && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      File Validation Results ({importPreview.totalParsed} total rows parsed)
                    </h4>
                    {(importPreview.invalidRows.length > 0 ||
                      importPreview.duplicateInFileRows.length > 0 ||
                      importPreview.duplicateInDbRows.length > 0) && (
                      <button
                        type="button"
                        onClick={handleDownloadErrorReport}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Download Error Report</span>
                      </button>
                    )}
                  </div>

                  {/* Summary metric pill boxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <div className="font-bold text-lg">{importPreview.validRows.length}</div>
                      <div className="text-[11px] font-semibold">Valid & Ready</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                      <div className="font-bold text-lg">{importPreview.duplicateInDbRows.length}</div>
                      <div className="text-[11px] font-semibold">Already in DB</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                      <div className="font-bold text-lg">{importPreview.duplicateInFileRows.length}</div>
                      <div className="text-[11px] font-semibold">File Duplicates</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800">
                      <div className="font-bold text-lg">{importPreview.invalidRows.length}</div>
                      <div className="text-[11px] font-semibold">Malformed/Missing</div>
                    </div>
                  </div>

                  {/* Valid Rows Preview Table */}
                  {importPreview.validRows.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 flex justify-between">
                        <span>Preview of Valid Students to be Added</span>
                        <span>Showing first {Math.min(5, importPreview.validRows.length)} rows</span>
                      </div>
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-1.5">Roll No</th>
                            <th className="px-3 py-1.5">Name</th>
                            <th className="px-3 py-1.5">Enrollment</th>
                            <th className="px-3 py-1.5">Branch</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.validRows.slice(0, 5).map((r, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{r.roll_number}</td>
                              <td className="px-3 py-1.5 text-slate-700">{r.student_name}</td>
                              <td className="px-3 py-1.5 text-slate-500">{r.enrollment_number || '—'}</td>
                              <td className="px-3 py-1.5 text-slate-500">{r.department || config?.department}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer confirmation */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                ADD ONLY: Existing students are never overwritten.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importLoading || !importPreview || importPreview.validRows.length === 0}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {importLoading ? 'Importing...' : `Confirm Import (${importPreview ? importPreview.validRows.length : 0} Students)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DETAILS MODAL (Subject-wise Attendance Breakdown) */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {studentDetails ? `${studentDetails.student.student_name} (${studentDetails.student.roll_number})` : 'Student Details'}
                </h3>
              </div>
              <button onClick={() => setDetailsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {detailsLoading || !studentDetails ? (
                <div className="py-10 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading details...
                </div>
              ) : (
                <>
                  {/* Student Meta Pill */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Roll Number</div>
                      <div className="font-mono font-bold text-slate-800">{studentDetails.student.roll_number}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Enrollment</div>
                      <div className="font-mono text-slate-700">{studentDetails.student.enrollment_number || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Branch / Sem</div>
                      <div className="text-slate-700">{studentDetails.student.department} • Sem {studentDetails.student.semester}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Section / Batch</div>
                      <div className="text-slate-700">{studentDetails.student.section || '—'} / {studentDetails.student.batch || '—'}</div>
                    </div>
                  </div>

                  {/* Summary attendance */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="text-xs text-blue-700 font-semibold">Total Classes Held</div>
                      <div className="text-xl font-bold text-blue-900 mt-1">{studentDetails.summary.totalHeld}</div>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div className="text-xs text-indigo-700 font-semibold">Actual Attended</div>
                      <div className="text-xl font-bold text-indigo-900 mt-1">
                        {studentDetails.summary.totalActual}
                        <span className="text-xs font-normal text-indigo-600 ml-1.5">
                          ({formatPercentage(studentDetails.summary.overallActualPct)})
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <div className="text-xs text-purple-700 font-semibold">CR-Prepared Attended</div>
                      <div className="text-xl font-bold text-purple-900 mt-1">
                        {studentDetails.summary.totalCr}
                        <span className="text-xs font-normal text-purple-600 ml-1.5">
                          ({formatPercentage(studentDetails.summary.overallCrPct)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Breakdown Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Subject-Wise Attendance Breakdown
                    </h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Subject</th>
                            <th className="px-3 py-2">Held</th>
                            <th className="px-3 py-2">Actual Attended</th>
                            <th className="px-3 py-2">CR Attended</th>
                            <th className="px-3 py-2">Difference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentDetails.subjectBreakdown.map((sb: any) => (
                            <tr key={sb.subject_id}>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                <div>{sb.subject_name}</div>
                                <div className="text-[10px] font-mono text-slate-400">{sb.subject_code}</div>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{sb.classes_held}</td>
                              <td className="px-3 py-2 text-slate-700">
                                {sb.classes_attended} ({formatPercentage(sb.attendance_percentage)})
                              </td>
                              <td className="px-3 py-2 text-slate-700 font-semibold">
                                {sb.cr_classes_attended} ({formatPercentage(sb.cr_attendance_percentage)})
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    sb.difference > 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : sb.difference < 0
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {sb.difference > 0 ? `+${sb.difference}` : sb.difference}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / ARCHIVE CONFIRMATION MODAL */}
      {deleteConfirmStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-red-600 text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Confirm Student Removal</h3>
            </div>
            <div className="p-5 text-xs text-slate-700 space-y-3">
              <p>
                Are you sure you want to remove student{' '}
                <strong className="text-slate-900">
                  {deleteConfirmStudent.student_name} ({deleteConfirmStudent.roll_number})
                </strong>
                ?
              </p>
              {archiveOptionAvailable ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                  <p className="font-semibold mb-1">Historical Records Protected:</p>
                  This student has existing attendance session records. In accordance with system integrity guidelines, historical attendance records cannot be deleted. Archiving deactivates the student from future rosters while preserving all past attendance history.
                </div>
              ) : (
                <p className="text-slate-500">
                  If this student has historical attendance records, the system will prompt to archive instead of deleting past data.
                </p>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmStudent(null);
                  setArchiveOptionAvailable(false);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              {archiveOptionAvailable ? (
                <button
                  type="button"
                  onClick={() => executeDelete(true)}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
                >
                  Archive Student (Preserve History)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => executeDelete(false)}
                  className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs"
                >
                  Delete Student
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
