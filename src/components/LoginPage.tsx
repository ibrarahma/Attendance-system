import React, { useState } from 'react';
import { GraduationCap, Lock, User, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api, setStoredToken } from '../api/client';
import { CRUser } from '../utils/types';

interface LoginPageProps {
  onLoginSuccess: (user: CRUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('cr_admin');
  const [password, setPassword] = useState('crattendance2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery modal state
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ username, password });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryIdentifier.trim()) {
      setRecoveryError('Please enter your CR username or registered email');
      return;
    }

    try {
      const res = await api.recoverQuestion(recoveryIdentifier.trim());
      setSecurityQuestion(res.question);
      setRecoveryUsername(res.username);
      setRecoveryStep(2);
    } catch (err: any) {
      setRecoveryError(err.message || 'No CR account found with that identifier.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryAnswer.trim()) {
      setRecoveryError('Security answer is required');
      return;
    }
    if (newPassword.length < 8) {
      setRecoveryError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError('Passwords do not match');
      return;
    }

    try {
      await api.recoverReset({
        username: recoveryUsername,
        answer: recoveryAnswer.trim(),
        newPassword,
      });
      setRecoverySuccess('Password reset successfully. You can now log in with your new password.');
      setTimeout(() => {
        setRecoveryOpen(false);
        setRecoveryStep(1);
        setPassword(newPassword);
        setRecoverySuccess(null);
      }, 1800);
    } catch (err: any) {
      setRecoveryError(err.message || 'Failed to reset password. Verify your security answer.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-xs border border-white/20">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CR Attendance Management System</h1>
          <p className="text-xs text-blue-100 mt-1">Authorized Class Representative Portal</p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          <div className="mb-5 text-center">
            <h2 className="text-lg font-bold text-slate-800">Class Representative Sign In</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict access control: Only the authorized CR can sign in to mark and manage attendance.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="username">
                CR Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                  placeholder="e.g. cr_admin"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryOpen(true);
                    setRecoveryStep(1);
                    setRecoveryError(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                  placeholder="Enter CR password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Sign In as Class Representative</span>
                </>
              )}
            </button>
          </form>

          {/* Single Class Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-mono">
              Class Representative Access • Single Class Unit
            </span>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {recoveryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">CR Password Recovery</h3>
              </div>
              <button
                onClick={() => setRecoveryOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {recoverySuccess && (
                <div className="p-3 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{recoverySuccess}</span>
                </div>
              )}

              {recoveryError && (
                <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoveryStep === 1 ? (
                <form onSubmit={handleStartRecovery} className="space-y-4">
                  <p className="text-xs text-slate-600">
                    Enter your CR username or registered email address. We will verify your identity using your designated security question.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      value={recoveryIdentifier}
                      onChange={(e) => setRecoveryIdentifier(e.target.value)}
                      required
                      placeholder="e.g. cr_admin or cr@college.edu"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep(1)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider">
                      Security Question:
                    </div>
                    <div className="text-xs font-medium text-blue-950 mt-1">{securityQuestion}</div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Answer
                    </label>
                    <input
                      type="text"
                      value={recoveryAnswer}
                      onChange={(e) => setRecoveryAnswer(e.target.value)}
                      required
                      placeholder="Enter security answer (e.g. computer science)"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      New Password (min 8 characters)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                    >
                      Reset Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
