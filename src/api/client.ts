/**
 * Type-safe frontend API client for CR Attendance Management System
 */

const TOKEN_KEY = 'cr_attendance_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Session expired or unauthorized
    setStoredToken(null);
    window.dispatchEvent(new CustomEvent('cr-auth-expired'));
    const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
    throw new Error(errorData.error || 'Session expired. Please log in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  // Handle binary or blob if header specifies
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('spreadsheet') || contentType.includes('octet-stream')) {
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    let filename = response.headers.get('X-Filename') || 'attendance_report.xlsx';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
    return { blob, filename } as unknown as T;
  }

  return response.json();
}

function buildQueryString(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
      q.append(k, String(v));
    }
  }
  return q.toString();
}

export const api = {
  // AUTH
  login: (credentials: { username: string; password: string }) =>
    apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  logout: () =>
    apiRequest('/api/auth/logout', { method: 'POST' }),

  getMe: () =>
    apiRequest('/api/auth/me', { method: 'GET' }),

  recoverQuestion: (identifier: string) =>
    apiRequest('/api/auth/recover-question', { method: 'POST', body: JSON.stringify({ identifier }) }),

  recoverReset: (payload: { username: string; answer: string; newPassword: string }) =>
    apiRequest('/api/auth/recover-reset', { method: 'POST', body: JSON.stringify(payload) }),

  updateProfile: (payload: { full_name?: string; email?: string; current_password?: string; new_password?: string }) =>
    apiRequest('/api/auth/update-profile', { method: 'PUT', body: JSON.stringify(payload) }),

  // SETTINGS
  getSettings: () =>
    apiRequest('/api/settings', { method: 'GET' }),

  updateSettings: (payload: any) =>
    apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  downloadBackup: async () => {
    const token = getStoredToken();
    const res = await fetch('/api/settings/backup', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CR_Attendance_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  restoreBackup: (backupJson: any) =>
    apiRequest('/api/settings/restore', { method: 'POST', body: JSON.stringify(backupJson) }),

  // DASHBOARD
  getDashboardStats: () =>
    apiRequest('/api/dashboard/stats', { method: 'GET' }),

  // STUDENTS
  getStudents: (params: { search?: string; archived?: string; department?: string; semester?: string; section?: string } = {}) => {
    const q = buildQueryString(params);
    return apiRequest(`/api/students?${q}`, { method: 'GET' });
  },

  addStudent: (data: any) =>
    apiRequest('/api/students', { method: 'POST', body: JSON.stringify(data) }),

  updateStudent: (id: string, data: any) =>
    apiRequest(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteStudent: (id: string, force = false) =>
    apiRequest(`/api/students/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' }),

  toggleArchiveStudent: (id: string) =>
    apiRequest(`/api/students/${id}/archive`, { method: 'POST' }),

  getStudentDetails: (id: string) =>
    apiRequest(`/api/students/${id}/details`, { method: 'GET' }),

  downloadTemplate: async () => {
    const res = await fetch('/api/students/template');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CR_Student_Import_Template.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  },

  previewImport: (payload: { rows: any[]; filename: string }) =>
    apiRequest('/api/students/import-preview', { method: 'POST', body: JSON.stringify(payload) }),

  confirmImport: (payload: { validRows: any[]; filename: string; totalRows: number; duplicateCount: number; invalidCount: number }) =>
    apiRequest('/api/students/import-confirm', { method: 'POST', body: JSON.stringify(payload) }),

  getImportHistory: () =>
    apiRequest('/api/students/import-history', { method: 'GET' }),

  // SUBJECTS
  getSubjects: () =>
    apiRequest('/api/subjects', { method: 'GET' }),

  createSubject: (data: any) =>
    apiRequest('/api/subjects', { method: 'POST', body: JSON.stringify(data) }),

  updateSubject: (id: string, data: any) =>
    apiRequest(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSubject: (id: string) =>
    apiRequest(`/api/subjects/${id}`, { method: 'DELETE' }),

  // ACTUAL ATTENDANCE
  getAttendanceSessions: (params: { subject_id?: string; date?: string; start_date?: string; end_date?: string } = {}) => {
    const q = buildQueryString(params);
    return apiRequest(`/api/attendance/sessions?${q}`, { method: 'GET' });
  },

  createAttendanceSession: (data: {
    subject_id: string;
    session_date: string;
    session_name: string;
    notes?: string;
    attendance: Array<{ student_id: string; status: 'PRESENT' | 'ABSENT' }>;
  }) => apiRequest('/api/attendance/sessions', { method: 'POST', body: JSON.stringify(data) }),

  getSessionDetails: (id: string) =>
    apiRequest(`/api/attendance/sessions/${id}`, { method: 'GET' }),

  toggleCancelSession: (id: string) =>
    apiRequest(`/api/attendance/sessions/${id}/cancel`, { method: 'PUT' }),

  // EDITED ATTENDANCE
  getEditedRecords: (params: { subject_id?: string; date?: string; roll_number?: string; student_name?: string; changed_only?: boolean } = {}) => {
    const q = buildQueryString(params);
    return apiRequest(`/api/attendance/edited-records?${q}`, { method: 'GET' });
  },

  prepareEdit: (payload: { session_id: string; student_id: string; new_status: 'PRESENT' | 'ABSENT'; reason: string }) =>
    apiRequest('/api/attendance/prepare-edit', { method: 'POST', body: JSON.stringify(payload) }),

  getChangeHistory: (params: { student_id?: string; session_id?: string } = {}) => {
    const q = buildQueryString(params);
    return apiRequest(`/api/attendance/change-history?${q}`, { method: 'GET' });
  },

  // REPORTS
  getReports: (params: {
    type?: string;
    subject_id?: string;
    start_date?: string;
    end_date?: string;
    student_id?: string;
    search?: string;
  } = {}) => {
    const q = buildQueryString(params);
    return apiRequest(`/api/reports?${q}`, { method: 'GET' });
  },

  // EXCEL EXPORT
  exportExcel: async (payload: {
    report_type: 'cr_prepared' | 'actual' | 'comparison';
    subject_id?: string;
    start_date?: string;
    end_date?: string;
    period_label?: string;
  }): Promise<{ blob: Blob; filename: string }> => {
    return apiRequest('/api/export/excel', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
