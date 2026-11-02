import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Tag,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client';
import { Subject, ClassConfig } from '../utils/types';

interface SubjectManagementViewProps {
  config: ClassConfig | null;
}

export const SubjectManagementView: React.FC<SubjectManagementViewProps> = ({ config }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState({
    subject_code: '',
    subject_name: '',
    faculty_name: '',
    semester: config?.semester || '5',
    subject_type: 'Theory',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm
  const [deleteSubjectItem, setDeleteSubjectItem] = useState<Subject | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.getSubjects();
      setSubjects(res.subjects || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load subjects' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setForm({
      subject_code: '',
      subject_name: '',
      faculty_name: '',
      semester: config?.semester || '5',
      subject_type: 'Theory',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setForm({
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      faculty_name: sub.faculty_name,
      semester: sub.semester,
      subject_type: sub.subject_type || 'Theory',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      if (editingSubject) {
        await api.updateSubject(editingSubject.id, form);
        setMessage({ type: 'success', text: `Subject ${form.subject_code} updated successfully.` });
      } else {
        await api.createSubject(form);
        setMessage({ type: 'success', text: `Subject ${form.subject_code} created successfully.` });
      }
      setModalOpen(false);
      loadSubjects();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteSubjectItem) return;
    try {
      const res = await api.deleteSubject(deleteSubjectItem.id);
      setMessage({ type: 'success', text: res.message || 'Subject updated' });
      setDeleteSubjectItem(null);
      loadSubjects();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete subject' });
      setDeleteSubjectItem(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Class Subjects & Course Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define curriculum subjects, assign faculty names, course codes, and types for accurate session logs.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Subject</span>
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

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading subjects...
          </div>
        ) : subjects.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700 text-sm">No Subjects Configured</h3>
            <p className="text-xs text-slate-400 mt-1">Create course subjects to start taking attendance sessions.</p>
          </div>
        ) : (
          subjects.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    {sub.subject_code}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      sub.subject_type === 'Practical'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {sub.subject_type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 leading-snug">{sub.subject_name}</h3>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{sub.faculty_name}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Semester {sub.semester}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-1">
                <button
                  onClick={() => handleOpenEdit(sub)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setDeleteSubjectItem(sub)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingSubject ? `Edit Subject: ${editingSubject.subject_code}` : 'Add New Subject'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.subject_code}
                  onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
                  required
                  placeholder="e.g. CS501"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-mono text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.subject_name}
                  onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                  required
                  placeholder="e.g. Operating Systems"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Faculty Name
                </label>
                <input
                  type="text"
                  value={form.faculty_name}
                  onChange={(e) => setForm({ ...form, faculty_name: e.target.value })}
                  placeholder="e.g. Prof. R. K. Sharma"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject Type
                  </label>
                  <select
                    value={form.subject_type}
                    onChange={(e) => setForm({ ...form, subject_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Theory">Theory</option>
                    <option value="Practical">Practical / Lab</option>
                    <option value="Tutorial">Tutorial</option>
                    <option value="Elective">Elective</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                >
                  {formLoading ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteSubjectItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-red-600 text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Delete Subject?</h3>
            </div>
            <div className="p-5 text-xs text-slate-700">
              Are you sure you want to delete <strong className="text-slate-900">{deleteSubjectItem.subject_name} ({deleteSubjectItem.subject_code})</strong>?
              If this subject has existing attendance sessions, it will be safely archived to protect past logs.
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteSubjectItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
