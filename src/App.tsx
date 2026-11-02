import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from './api/client';
import { CRUser, ClassConfig } from './utils/types';
import { Sidebar, Navbar, NavTab } from './components/Navigation';
import { LoginPage } from './components/LoginPage';
import { DashboardView } from './components/DashboardView';
import { StudentManagementView } from './components/StudentManagementView';
import { SubjectManagementView } from './components/SubjectManagementView';
import { ActualAttendanceView } from './components/ActualAttendanceView';
import { EditedAttendanceView } from './components/EditedAttendanceView';
import { AttendanceReportsView } from './components/AttendanceReportsView';
import { ExcelExportView } from './components/ExcelExportView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [user, setUser] = useState<CRUser | null>(null);
  const [config, setConfig] = useState<ClassConfig | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [authChecking, setAuthChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cross-view state actions
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [openStudentDetailsId, setOpenStudentDetailsId] = useState<string | null>(null);
  const [openAddStudentModal, setOpenAddStudentModal] = useState(false);
  const [openImportModal, setOpenImportModal] = useState(false);

  useEffect(() => {
    checkAuth();

    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('cr-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('cr-auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    if (user) {
      loadClassConfig();
      loadDashboardStats();
    }
  }, [user]);

  const checkAuth = async () => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const loadClassConfig = async () => {
    try {
      const res = await api.getSettings();
      setConfig(res.config);
    } catch (err) {
      console.error('Failed to load class configuration:', err);
    }
  };

  const loadDashboardStats = async () => {
    setDashboardLoading(true);
    try {
      const stats = await api.getDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      setStoredToken(null);
      setUser(null);
      setCurrentTab('dashboard');
    }
  };

  // Cross-component navigation handlers
  const handleSelectStudentForDetails = (studentId: string) => {
    setOpenStudentDetailsId(studentId);
    setCurrentTab('students');
  };

  const handleOpenAddStudentFromDash = () => {
    setOpenAddStudentModal(true);
    setCurrentTab('students');
  };

  const handleOpenImportFromDash = () => {
    setOpenImportModal(true);
    setCurrentTab('students');
  };

  // Tab display title mapping
  const getTabTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'dashboard':
        return 'Class Representative Dashboard';
      case 'students':
        return 'Student Roster Management';
      case 'subjects':
        return 'Course & Subject Management';
      case 'actual-attendance':
        return 'Actual Class Attendance';
      case 'edited-attendance':
        return 'Edited Attendance (CR Prepared)';
      case 'reports':
        return 'Attendance Analytics & Reports';
      case 'excel-export':
        return 'Excel Export & Teacher Dispatch';
      case 'settings':
        return 'Class & System Settings';
      default:
        return 'CR Attendance';
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-mono">Authenticating Class Representative Portal...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated, redirect / render Login Page
  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />
    );
  }

  const shortageCount = dashboardStats?.shortageCount || 0;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'dashboard') loadDashboardStats();
        }}
        config={config}
        shortageCount={shortageCount}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <Navbar
          user={user}
          config={config}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          currentTabName={getTabTitle(currentTab)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={dashboardStats}
              loading={dashboardLoading}
              onNavigate={(tab) => {
                setCurrentTab(tab);
                if (tab === 'dashboard') loadDashboardStats();
              }}
              onSelectStudent={handleSelectStudentForDetails}
              onOpenAddStudent={handleOpenAddStudentFromDash}
              onOpenImportStudents={handleOpenImportFromDash}
            />
          )}

          {currentTab === 'students' && (
            <StudentManagementView
              config={config}
              onOpenDetailsId={openStudentDetailsId}
              onClearDetailsId={() => setOpenStudentDetailsId(null)}
              openAddStudentModalDefault={openAddStudentModal}
              openImportModalDefault={openImportModal}
              onClearDefaultModals={() => {
                setOpenAddStudentModal(false);
                setOpenImportModal(false);
              }}
            />
          )}

          {currentTab === 'subjects' && (
            <SubjectManagementView config={config} />
          )}

          {currentTab === 'actual-attendance' && (
            <ActualAttendanceView config={config} />
          )}

          {currentTab === 'edited-attendance' && (
            <EditedAttendanceView />
          )}

          {currentTab === 'reports' && (
            <AttendanceReportsView
              config={config}
              onSelectStudentDetails={handleSelectStudentForDetails}
            />
          )}

          {currentTab === 'excel-export' && (
            <ExcelExportView config={config} />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              config={config}
              user={user}
              onConfigUpdated={(newCfg) => setConfig(newCfg)}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
