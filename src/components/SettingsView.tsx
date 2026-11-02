import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  FileJson,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { api } from '../api/client';
import { ClassConfig, CRUser } from '../utils/types';
import { NavTab } from './Navigation';

interface SettingsViewProps {
  config: ClassConfig | null;
  user: CRUser | null;
  onConfigUpdated: (newConfig: ClassConfig) => void;
  onNavigate: (tab: NavTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  user,
  onConfigUpdated,
  onNavigate,
}) => {
  const [form, setForm] = useState({
    class_name: config?.class_name || 'B.Tech Computer Science & Engineering',
    department: config?.department || 'CSE',
    semester: config?.semester || '5',
    section: config?.section || 'Section A',
    academic_year: config?.academic_year || '2026-2027',
    attendance_threshold: config?.attendance_threshold || 75.0,
    default_period: config?.default_period || 'all',
    enrollment_unique: config?.enrollment_unique ? 1 : 0,
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CR Profile & Password change
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Backup & Restore
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState(false);
  const [restoreJsonData, setRestoreJsonData] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        class_name: config.class_name,
        department: config.department,
        semester: config.semester,
        section: config.section,
        academic_year: config.academic_year,
        attendance_threshold: config.attendance_threshold,
        default_period: config.default_period,
        enrollment_unique: config.enrollment_unique,
      });
    }
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
    }
  }, [config, user]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setMessage(null);

    try {
      const res = await api.updateSettings(form);
      onConfigUpdated(res.config);
      setMessage({ type: 'success', text: 'Class configuration updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setProfileMessage({ type: 'error', text: 'New passwords do not match' });
      setSavingProfile(false);
      return;
    }

    try {
      await api.updateProfile({
        full_name: fullName,
        email,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });
      setProfileMessage({ type: 'success', text: 'CR profile updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.students || !parsed.subjects || !parsed.sessions) {
          setMessage({ type: 'error', text: 'Invalid backup file: Essential database schemas are missing.' });
          return;
        }
        setRestoreJsonData(parsed);
        setRestoreConfirmModal(true);
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Corrupted JSON backup file: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const executeRestore = async () => {
    if (!restoreJsonData) return;
    setRestoring(true);
    try {
      const res = await api.restoreBackup(restoreJsonData);
      setMessage({ type: 'success', text: res.message || 'Backup restored successfully!' });
      setRestoreConfirmModal(false);
      // Reload page to reflect completely restored database
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Restore failed' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Class & System Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure academic class details, shortage threshold, CR security profile, and database backups.
          </p>
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
        </div>
      )}

      {/* 1. Class Configuration */}
      <form onSubmit={handleSaveConfig} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Class & Academic Details</h3>
            <p className="text-xs text-slate-500">Defines defaults for rosters, session logs, and Excel headers.</p>
          </div>
          <button
            type="submit"
            disabled={savingConfig}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Degree Name</label>
            <input
              type="text"
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department / Branch</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
            <input
              type="text"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
            <input
              type="text"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year</label>
            <input
              type="text"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Attendance Shortage Threshold (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              step="0.5"
              value={form.attendance_threshold}
              onChange={(e) => setForm({ ...form, attendance_threshold: parseFloat(e.target.value) || 75 })}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold"
            />
            <span className="text-[10px] text-slate-400">Standard college threshold is 75.0%</span>
          </div>
        </div>

        <div className="pt-2">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.enrollment_unique === 1}
              onChange={(e) => setForm({ ...form, enrollment_unique: e.target.checked ? 1 : 0 })}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Enforce strict uniqueness on Student Enrollment Numbers</span>
          </label>
        </div>
      </form>

      {/* 2. CR Profile & Security Settings */}
      <form onSubmit={handleSaveProfile} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Class Representative Account Profile</h3>
            <p className="text-xs text-slate-500">Authorized CR credentials, email, and password updates.</p>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-blue-400" />
            <span>{savingProfile ? 'Updating...' : 'Update CR Profile'}</span>
          </button>
        </div>

        {profileMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              profileMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {profileMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{profileMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">CR Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">CR Registered Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 mb-2">Change Password (Leave blank to keep current)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required for password change"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New secure password"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>
      </form>

      {/* 3. Database Backup & Restore */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Database Backup & Disaster Recovery</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Export a full JSON database snapshot containing all students, courses, attendance sessions, and CR modification audit trails.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-slate-800 mb-1 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-blue-600" />
                <span>Export Full Database Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Generates an encrypted/structured JSON archive of the entire database for offline safekeeping.
              </p>
            </div>
            <button
              onClick={() => api.downloadBackup()}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backup File (.json)</span>
            </button>
          </div>

          {/* Restore */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-slate-800 mb-1 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Restore Database from Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Validates schema structure before restoring. Note: Will require explicit confirmation to avoid accidental data loss.
              </p>
            </div>
            <label className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Select Backup File to Restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreConfirmModal && restoreJsonData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-600 text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Confirm Database Restore</h3>
            </div>
            <div className="p-5 text-xs text-slate-700 space-y-3">
              <p className="font-semibold text-slate-900">
                Are you sure you want to restore the database from this backup?
              </p>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1 text-[11px]">
                <div>• Students: <strong>{restoreJsonData.students?.length || 0}</strong></div>
                <div>• Subjects: <strong>{restoreJsonData.subjects?.length || 0}</strong></div>
                <div>• Sessions: <strong>{restoreJsonData.sessions?.length || 0}</strong></div>
                <div>• Exported At: <strong>{restoreJsonData.exported_at || 'Unknown'}</strong></div>
              </div>
              <p className="text-red-600">
                Warning: Restoring will overwrite the current live database state with the contents of this verified backup.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                disabled={restoring}
                className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
              >
                {restoring ? 'Restoring Database...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
