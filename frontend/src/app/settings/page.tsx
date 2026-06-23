'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api, BACKEND_URL } from '../../lib/api';
import { 
  User, Shield, Lock, Save, Sparkles, Phone, Mail, Award, Key, 
  CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff, Palette, Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SelectField } from '../../components/SelectField';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  
  // Profile update states
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [personalEmail, setPersonalEmail] = useState(user?.personal_email || '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [dateOfBirth, setDateOfBirth] = useState(
    user?.date_of_birth ? String(user.date_of_birth).split('T')[0] : ''
  );
  const [gender, setGender] = useState(user?.gender || 'Male');
  const [about, setAbout] = useState(user?.about || '');
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



  if (!user) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await api.auth.updateProfile({
        name,
        phone,
        personal_email: personalEmail,
        age: age ? parseInt(age, 10) : undefined,
        date_of_birth: dateOfBirth || undefined,
        gender,
        about,
      });
      
      updateUser(res.user || { name, phone, personal_email: personalEmail, age: age ? parseInt(age, 10) : null, date_of_birth: dateOfBirth, gender, about });
      
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
      <div className="space-y-4">
        
        {/* Header Title block */}
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
            Account Settings
            <Shield className="h-5 w-5 text-primary-green" />
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure your personal profile details, credentials, and user preferences.
          </p>
        </div>

        {/* Settings Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          
          {/* Left Panel: Profile Quick Summary Card */}
          <div className="space-y-4 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-border-gray rounded-xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden shadow-sm sm:shadow-xl"
            >
              {/* Background gradient splash */}
              <div className="absolute top-0 right-0 h-28 w-28 bg-very-light-green/30 rounded-bl-full pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-primary-green flex items-center justify-center font-bold text-white text-2xl sm:text-3xl shadow-xl shadow-emerald-950/20 border-2 border-border-gray overflow-hidden">
                  {user.photo_url ? (
                    <img src={`${BACKEND_URL}${user.photo_url}`} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-slate-500">{user.name}</h3>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-very-light-green/50 text-primary-green border border-light-green/40 mt-1.5">
                    <Award className="h-3 w-3" />
                    {user.role}
                  </div>
                </div>

                <div className="w-full border-t border-border-gray/80 pt-4 text-left space-y-3.5 text-xs text-slate-500">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="truncate">{personalEmail || user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>{phone || 'No phone set'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>{user.role} · {gender || 'Gender not set'}</span>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Right Panel: Interactive Forms */}
          <div className="xl:col-span-2 space-y-4 min-w-0">
            
            {/* Profile Information Block */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-border-gray rounded-xl sm:rounded-3xl p-4 sm:p-6 shadow-sm sm:shadow-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-primary-green" />
                <h3 className="font-bold text-slate-500 text-sm">Personal Profile Configuration</h3>
              </div>

              {profileError && (
                <div id="profile-error-box" className="p-4 mb-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5" />
                  {profileError}
                </div>
              )}

              {profileSuccess && (
                <div id="profile-success-box" className="p-4 mb-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 animate-bounce" />
                  {profileSuccess}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-full min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                    <input
                      id="settings-name-input"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Austin"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Designation</label>
                    <input
                      type="text"
                      disabled
                      value={user.role}
                      className="w-full bg-white/40 border border-border-gray cursor-not-allowed rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                    <input
                      id="settings-phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9988776655"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Personal Email</label>
                    <input
                      id="settings-personal-email-input"
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      placeholder="you.personal@email.com"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Age</label>
                    <input
                      id="settings-age-input"
                      type="number"
                      min={18}
                      max={100}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="30"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</label>
                    <input
                      id="settings-dob-input"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all"
                    />
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                    <SelectField
                      id="settings-gender-select"
                      value={gender}
                      onChange={setGender}
                      triggerClassName="py-2.5 px-3.5 text-xs"
                      options={[
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                        { value: 'Other', label: 'Other' },
                      ]}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Work Email (Login)</label>
                  <input
                    id="settings-email-disabled"
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full bg-white/40 border border-border-gray cursor-not-allowed rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Login email is locked for audit compliance.</p>
                </div>

                <div className="min-w-0">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">About</label>
                  <textarea
                    id="settings-about-input"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    rows={4}
                    placeholder="Brief professional summary..."
                    className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all resize-y min-h-[96px]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="settings-save-profile-btn"
                    type="submit"
                    disabled={profileLoading}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
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
              className="bg-white border border-border-gray rounded-xl sm:rounded-3xl p-4 sm:p-6 shadow-sm sm:shadow-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-primary-green" />
                <h3 className="font-bold text-slate-500 text-sm">Security Credentials Update</h3>
              </div>

              {passwordError && (
                <div id="password-error-box" className="p-4 mb-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5" />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div id="password-success-box" className="p-4 mb-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 animate-bounce" />
                  {passwordSuccess}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                    <div className="relative">
                      <input
                        id="settings-new-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-slate-500 outline-none transition-all"
                      />
                      <button
                        id="settings-toggle-pwd-btn"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-500 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                    <input
                      id="settings-confirm-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    id="settings-save-password-btn"
                    type="submit"
                    disabled={passwordLoading}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
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
