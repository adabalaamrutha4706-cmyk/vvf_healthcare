'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Users, Search, Plus, Edit3, Trash2, ShieldAlert, CheckCircle, 
  Mail, Phone, Shield, UserX, UserCheck, X, Sparkles, Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UsersPage() {
  const { user } = useAuth();
  
  // Lists
  const [usersList, setUsersList] = useState<any[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  
  // States
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Doctor');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Frontend real-time validations errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const getInputClass = (fieldName: string, value: string) => {
    const base = "w-full bg-white border rounded-xl py-2 px-3 text-xs text-primary-text outline-none transition-all";
    if (touchedFields[fieldName]) {
      if (formErrors[fieldName]) {
        return `${base} border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500`;
      }
      if (value && value.trim() !== '') {
        return `${base} border-emerald-500/50 focus:border-primary-green focus:ring-1 focus:ring-light-green`;
      }
    }
    return `${base} border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green`;
  };

  // Real-time validations hook
  useEffect(() => {
    const errs: Record<string, string> = {};

    // Full Name
    const nameVal = name;
    if (nameVal !== '') {
      if (nameVal.length < 3 || nameVal.length > 100) {
        errs.name = 'Full Name must be between 3 and 100 characters.';
      } else if (!/^[a-zA-Z\s\.]+$/.test(nameVal)) {
        errs.name = 'Only alphabets and full stops are allowed in Full Name.';
      } else if (/^\d+$/.test(nameVal.trim())) {
        errs.name = 'Numbers-only values are not allowed in Full Name.';
      } else if ((nameVal.match(/\./g) || []).length > 2) {
        errs.name = 'Maximum 2 full stops are only allowed in Full Name.';
      } else if (/\.\./.test(nameVal)) {
        errs.name = 'Full stops cannot appear continuously in Full Name.';
      } else if (nameVal.startsWith('.') || nameVal.endsWith('.')) {
        errs.name = 'Full Name should not start or end with a full stop.';
      } else if (nameVal.startsWith(' ') || nameVal.endsWith(' ')) {
        errs.name = 'Full Name should not start or end with spaces.';
      }
    }

    // Phone Number
    const phoneVal = phone;
    if (phoneVal) {
      if (!/^\d+$/.test(phoneVal)) {
        errs.phone = 'Phone Number must contain only numeric digits.';
      } else if (phoneVal.length > 10) {
        errs.phone = 'Phone Number must not exceed 10 digits.';
      }
    }

    setFormErrors(errs);
  }, [name, phone]);

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchUsers(false);
      const interval = setInterval(() => fetchUsers(true), 10000); // silent polling every 10s
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.users.getAll();
      setUsersList(res.users || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch directory accounts.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedStaff(null);
    setTouchedFields({});
    setName('');
    setEmail('');
    setPassword('');
    setRole('Doctor');
    setPhone('');
    setIsActive(true);
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (staff: any) => {
    setSelectedStaff(staff);
    // On edit, mark fields as initially touched so their initial correct state shows success border
    setTouchedFields({
      name: true,
      phone: true
    });
    setName(staff.name);
    setEmail(staff.email);
    setPassword(''); // leave blank if no password update
    setRole(staff.role);
    setPhone(staff.phone || '');
    setIsActive(staff.is_active);
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all validation fields as touched
    const allTouched: Record<string, boolean> = {
      name: true,
      phone: true
    };
    setTouchedFields(allTouched);

    if (Object.keys(formErrors).length > 0) {
      setError('Staff registration validation failed. Please fix the highlighted fields.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    setSuccess('');

    const payload: any = {
      name,
      email,
      role,
      phone,
      is_active: isActive
    };

    if (password) {
      payload.password = password;
    }

    try {
      if (selectedStaff) {
        await api.users.update(selectedStaff.id, payload);
        setSuccess('Staff account modifications saved.');
      } else {
        if (!password) {
          setError('Password is required for new accounts.');
          setSubmitLoading(false);
          return;
        }
        await api.users.create(payload);
        setSuccess('New staff profile generated successfully.');
      }
      setIsFormOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Account registration failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === user?.id) {
      alert('Self-deletion is blocked for security.');
      return;
    }
    if (!window.confirm('Are you sure you want to deactivate/delete this staff account? This soft-deletes the record.')) return;
    try {
      await api.users.delete(id);
      setSuccess('Staff profile removed from active records.');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to remove user profile.');
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  // Guard view
  if (user?.role !== 'Admin') {
    return (
      <DashboardLayout>
        <div className="p-6 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          Access Denied. You do not have corporate administrator rights to manage users.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-primary-text flex items-center gap-2">
              Team & Staff Management
              <Users className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-secondary-text mt-0.5">
              Generate corporate accounts, update roles (RBAC overrides), and suspend profiles.
            </p>
          </div>

          <button
            id="btn-new-staff"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Staff Member
          </button>
        </div>

        {/* Global Feedback Panels */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {/* Search Panel */}
        <div className="bg-white border border-border-gray p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-secondary-text" />
            <input
              id="users-search"
              type="text"
              placeholder="Search staff by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-primary-text placeholder-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        {/* User Card list */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white/60 border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <Users className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-secondary-text text-sm font-medium">No matching staff accounts found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredUsers.map((staff) => (
              <motion.div
                key={staff.id}
                id={`user-card-${staff.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-light-green transition-all duration-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-green/10 transition-all duration-300" />
                
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-primary-text text-sm truncate leading-tight flex items-center gap-1.5">
                        {staff.name}
                        {!staff.is_active && (
                          <span className="px-1.5 py-0.5 bg-alert-bg/60 text-rose-450 border border-rose-900/30 rounded text-[8px] font-bold uppercase tracking-wider shrink-0">
                            Suspended
                          </span>
                        )}
                      </h3>
                      <span className="text-[10px] text-primary-green font-bold uppercase tracking-wider mt-0.5 block">{staff.role}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1.5 ${
                      staff.current_session_status === 'Active'
                        ? 'bg-very-light-green/60 text-primary-green border border-light-green/40' 
                        : 'bg-white text-secondary-text border border-border-gray'
                    }`}>
                      {staff.current_session_status === 'Active' ? (
                        <>
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          Online
                        </>
                      ) : (
                        'Offline'
                      )}
                    </span>
                  </div>

                  <div className="space-y-2 bg-white/60 border border-border-gray p-3 rounded-xl mb-4 text-xs">
                    <div className="flex items-center gap-2 text-secondary-text truncate">
                      <Mail className="h-3.5 w-3.5 text-secondary-text" />
                      <span>{staff.email}</span>
                    </div>
                    {staff.phone && (
                      <div className="flex items-center gap-2 text-secondary-text">
                        <Phone className="h-3.5 w-3.5 text-secondary-text" />
                        <span>{staff.phone}</span>
                      </div>
                    )}
                    {/* Live Session Tracker details */}
                    <div className="pt-2 mt-2 border-t border-border-gray/50 space-y-1 text-[10px] text-secondary-text">
                      {staff.current_session_status === 'Active' ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-secondary-text">Login Time:</span>
                            <span className="font-bold text-primary-green">{formatTime(staff.last_login_time)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-secondary-text">Session Duration:</span>
                            <span className="font-mono text-primary-green font-bold">{staff.current_session_duration}m active</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-secondary-text">Last Seen:</span>
                          <span className="font-semibold text-secondary-text">{formatDateTime(staff.last_logout_time || staff.last_login_time)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end items-center border-t border-border-gray pt-3 gap-2.5">
                  <button
                    id={`btn-edit-user-${staff.id}`}
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 text-secondary-text hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                    title="Edit profile"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    id={`btn-delete-user-${staff.id}`}
                    onClick={() => handleDelete(staff.id)}
                    className="p-1.5 text-secondary-text hover:text-alert-text hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                    title="Delete Account"
                    disabled={staff.id === user?.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal: Create/Edit Form */}
        <AnimatePresence>
          {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFormOpen(false)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-primary-green" />
                    {selectedStaff ? 'Edit Staff Account' : 'Register New Employee'}
                  </h3>
                  <button id="close-user-modal" onClick={() => setIsFormOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      id="form-user-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => { setName(e.target.value); markTouched('name'); }}
                      onBlur={() => markTouched('name')}
                      placeholder="Anil Kumar"
                      className={getInputClass('name', name)}
                    />
                    {touchedFields.name && formErrors.name && (
                      <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Corporate Email</label>
                    <input
                      id="form-user-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="anil@vvf.org"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                        {selectedStaff ? 'Update Password (Optional)' : 'Access Password'}
                      </label>
                      <input
                        id="form-user-password"
                        type="password"
                        required={!selectedStaff}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Role Permission</label>
                      <select
                        id="form-user-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                      >
                        <option value="Doctor">🩺 Doctor (Clinician)</option>
                        <option value="Chief Doctor">🏥 Chief Doctor</option>
                        <option value="Reception">📝 Reception Desk</option>
                        <option value="Telecaller">📞 Telecaller Outreach</option>
                        <option value="Executive">🏃‍♂️ Field Executive</option>
                        <option value="Admin">💼 Administrator</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input
                        id="form-user-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); markTouched('phone'); }}
                        onBlur={() => markTouched('phone')}
                        placeholder="9876543210"
                        className={getInputClass('phone', phone)}
                      />
                      {touchedFields.phone && formErrors.phone && (
                        <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.phone}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">System Access State</label>
                      <select
                        id="form-user-active"
                        value={isActive ? 'true' : 'false'}
                        onChange={(e) => setIsActive(e.target.value === 'true')}
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                      >
                        <option value="true">Active (Granted Access)</option>
                        <option value="false">Suspended (Blocked Access)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-user"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-user"
                      type="submit"
                      disabled={submitLoading || Object.keys(formErrors).length > 0}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-50"
                    >
                      {submitLoading ? 'Registering...' : 'Save Employee'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}
