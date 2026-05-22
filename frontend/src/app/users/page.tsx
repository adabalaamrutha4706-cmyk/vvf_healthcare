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

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.users.getAll();
      setUsersList(res.users || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch directory accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedStaff(null);
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
        <div className="p-6 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          Access Denied. You do not have corporate administrator rights to manage users.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Team & Staff Management
              <Users className="h-5 w-5 text-cyan-400" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Generate corporate accounts, update roles (RBAC overrides), and suspend profiles.
            </p>
          </div>

          <button
            id="btn-new-staff"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-950/20"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Staff Member
          </button>
        </div>

        {/* Global Feedback Panels */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {/* Search Panel */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
            <input
              id="users-search"
              type="text"
              placeholder="Search staff by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />
          </div>
        </div>

        {/* User Card list */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-850 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <Users className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm font-medium">No matching staff accounts found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map((staff) => (
              <motion.div
                key={staff.id}
                id={`user-card-${staff.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-300" />
                
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm truncate leading-tight">{staff.name}</h3>
                      <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-0.5 block">{staff.role}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1 ${
                      staff.is_active 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-950 text-rose-450 border border-rose-900/20'
                    }`}>
                      {staff.is_active ? <UserCheck className="h-2.5 w-2.5" /> : <UserX className="h-2.5 w-2.5" />}
                      {staff.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>

                  <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-3 rounded-xl mb-4 text-xs">
                    <div className="flex items-center gap-2 text-slate-350 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-500" />
                      <span>{staff.email}</span>
                    </div>
                    {staff.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>{staff.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end items-center border-t border-slate-850 pt-3 gap-2.5">
                  <button
                    id={`btn-edit-user-${staff.id}`}
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 text-slate-450 hover:text-cyan-400 hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors"
                    title="Edit profile"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    id={`btn-delete-user-${staff.id}`}
                    onClick={() => handleDelete(staff.id)}
                    className="p-1.5 text-slate-450 hover:text-rose-400 hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors"
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
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
                    {selectedStaff ? 'Edit Staff Account' : 'Register New Employee'}
                  </h3>
                  <button id="close-user-modal" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      id="form-user-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Anil Kumar"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Corporate Email</label>
                    <input
                      id="form-user-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="anil@vvf.org"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        {selectedStaff ? 'Update Password (Optional)' : 'Access Password'}
                      </label>
                      <input
                        id="form-user-password"
                        type="password"
                        required={!selectedStaff}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Role Permission</label>
                      <select
                        id="form-user-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input
                        id="form-user-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">System Access State</label>
                      <select
                        id="form-user-active"
                        value={isActive ? 'true' : 'false'}
                        onChange={(e) => setIsActive(e.target.value === 'true')}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="true">Active (Granted Access)</option>
                        <option value="false">Suspended (Blocked Access)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-user"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-user"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/20"
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
