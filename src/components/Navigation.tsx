import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarCheck,
  FileEdit,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
  AlertTriangle,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import { ClassConfig, CRUser } from '../utils/types';

export type NavTab =
  | 'dashboard'
  | 'students'
  | 'subjects'
  | 'actual-attendance'
  | 'edited-attendance'
  | 'reports'
  | 'excel-export'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  config: ClassConfig | null;
  shortageCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  config,
  shortageCount,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students' as NavTab, label: 'Student Management', icon: Users },
    { id: 'subjects' as NavTab, label: 'Subject Management', icon: BookOpen },
    { id: 'actual-attendance' as NavTab, label: 'Actual Attendance', icon: CalendarCheck },
    {
      id: 'edited-attendance' as NavTab,
      label: 'Edited Attendance',
      icon: FileEdit,
      badge: 'CR Edit',
    },
    { id: 'reports' as NavTab, label: 'Attendance Reports', icon: BarChart3 },
    { id: 'excel-export' as NavTab, label: 'Excel Export', icon: FileSpreadsheet },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const handleSelect = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-tight">CR Attendance</h1>
              <p className="text-xs text-slate-400 font-mono">Class Rep Portal</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Class Badge */}
        {config && (
          <div className="mx-3 mt-3 p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
            <div className="font-semibold text-slate-200 truncate">{config.class_name}</div>
            <div className="text-slate-400 flex items-center justify-between mt-1">
              <span>{config.department} • Sem {config.semester}</span>
              <span className="font-mono text-blue-400">{config.section}</span>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'dashboard' && shortageCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3" />
                    {shortageCount}
                  </span>
                )}
                {item.badge && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-xs text-slate-400 text-center">
          Single-Class Edition • CR Exclusive
        </div>
      </aside>
    </>
  );
};

interface NavbarProps {
  user: CRUser | null;
  config: ClassConfig | null;
  onLogout: () => void;
  onOpenMobileMenu: () => void;
  currentTabName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  config,
  onLogout,
  onOpenMobileMenu,
  currentTabName,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-slate-800 capitalize">{currentTabName}</h2>
          <p className="text-xs text-slate-500 hidden sm:block">
            {config ? `${config.department} Sem-${config.semester} ${config.section ? `• ${config.section}` : ''}` : 'Class Representative Portal'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-slate-800">{user?.full_name || 'Class Representative'}</div>
          <div className="text-xs text-slate-500">{user?.email || 'cr@college.edu'}</div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
          title="Sign out of CR Portal"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden xs:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
