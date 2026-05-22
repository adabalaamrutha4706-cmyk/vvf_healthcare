'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  User, Shield, Lock, Save, Sparkles, Phone, Mail, Award, Key, 
  CheckCircle2, AlertTriangle, RefreshCw, Palette, Eye, EyeOff
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  
  // Profile update states
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password change states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Theme configuration (UI mock choices)
  const [activeTheme, setActiveTheme] = useState('dark-teal');

  if (!user) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await api.auth.updateProfile({ name, phone });
      
      // Update global context user details
      updateUser({ name, phone });
      
      setProfileSuccess('Profile settings successfully saved.');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!password) {
      setPasswordError('Please provide a new password.');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    setPasswordLoading(true);

    try {
      await api.auth.updateProfile({ password });
      setPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password successfully updated.');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Header Title block */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            Account Settings
            <Shield className="h-5 w-5 text-cyan-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Configure your personal profile details, credentials, and user preferences.
          </p>
        </div>

        {/* Settings Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Panel: Profile Quick Summary Card */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl"
            >
              {/* Background gradient splash */}
              <div className="absolute top-0 right-0 h-28 w-28 bg-gradient-to-br from-cyan-600/10 to-blue-700/5 rounded-bl-full pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-3xl shadow-xl shadow-cyan-950/20 border-2 border-slate-800">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{user.name}</h3>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-950/50 text-cyan-400 border border-cyan-500/20 mt-1.5">
                    <Award className="h-3 w-3" />
                    {user.role}
                  </div>
                </div>

                <div className="w-full border-t border-slate-800/80 pt-4 text-left space-y-3.5 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-500" />
                    <span>{phone || 'No phone set'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-slate-500" />
                    <span>Role Access: Multi-page Dashboard</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Themes Preference Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl"
            >
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Palette className="h-4 w-4 text-cyan-400" />
                Aesthetic Theme
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'dark-teal', label: 'Cyan Teal', bg: 'from-cyan-900 to-slate-900', border: 'border-cyan-500' },
                  { id: 'dark-blue', label: 'Royal Blue', bg: 'from-blue-900 to-slate-900', border: 'border-blue-500' },
                  { id: 'dark-emerald', label: 'Emerald Mint', bg: 'from-emerald-900 to-slate-900', border: 'border-emerald-500' },
                  { id: 'dark-purple', label: 'Deep Purple', bg: 'from-purple-900 to-slate-900', border: 'border-purple-500' }
                ].map((th) => (
                  <button
                    key={th.id}
                    id={`settings-theme-btn-${th.id}`}
                    onClick={() => setActiveTheme(th.id)}
                    className={`p-3 rounded-2xl border text-xs text-left cursor-pointer transition-all ${
                      activeTheme === th.id 
                        ? `bg-slate-950 text-slate-100 ${th.border} ring-1 ring-cyan-500/20` 
                        : 'bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-850'
                    }`}
                  >
                    <div className="font-semibold">{th.label}</div>
                    <div className="text-[9px] text-slate-500 mt-1">Dark mode active</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Panel: Interactive Forms */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Profile Information Block */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-cyan-400" />
                <h3 className="font-bold text-slate-200 text-sm">Personal Profile Configuration</h3>
              </div>

              {profileError && (
                <div id="profile-error-box" className="p-4 mb-4 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5" />
                  {profileError}
                </div>
              )}

              {profileSuccess && (
                <div id="profile-success-box" className="p-4 mb-4 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 animate-bounce" />
                  {profileSuccess}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Display Name</label>
                    <input
                      id="settings-name-input"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Austin"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-200 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                    <input
                      id="settings-phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9988776655"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-200 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Registered Email Address</label>
                  <input
                    id="settings-email-disabled"
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full bg-slate-950/40 border border-slate-850 cursor-not-allowed rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Emails are locked to ensure compliance with audit log regulations.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="settings-save-profile-btn"
                    type="submit"
                    disabled={profileLoading}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-950/20"
                  >
                    {profileLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Profile Details
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Change Password Block */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-cyan-400" />
                <h3 className="font-bold text-slate-200 text-sm">Security Credentials Update</h3>
              </div>

              {passwordError && (
                <div id="password-error-box" className="p-4 mb-4 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5" />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div id="password-success-box" className="p-4 mb-4 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 animate-bounce" />
                  {passwordSuccess}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">New Password</label>
                    <div className="relative">
                      <input
                        id="settings-new-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-slate-200 outline-none transition-all"
                      />
                      <button
                        id="settings-toggle-pwd-btn"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-350 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Confirm New Password</label>
                    <input
                      id="settings-confirm-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-200 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="settings-save-password-btn"
                    type="submit"
                    disabled={passwordLoading}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-950/20"
                  >
                    {passwordLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                    Update Credentials
                  </button>
                </div>
              </form>
            </motion.div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
