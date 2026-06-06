'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { 
  ShieldAlert, Users, Clock, Database, Calendar, TrendingUp, AlertTriangle, 
  Trash2, RotateCcw, Plus, Edit2, Search, Check, X, Eye, IndianRupee, MapPin, 
  FileText, Activity, RefreshCw, KeyRound, Monitor, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../../components/SelectField';

export default function SuperadminDashboard() {
  const { user } = useAuth();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'attendance' | 'audit' | 'appointments'>('overview');
  
  // States
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Forms
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Doctor',
    password: '',
    is_active: true
  });

  useEffect(() => {
    if (user?.role === 'Superadmin') {
      loadTabContent();
    }
  }, [activeTab, user]);

  const loadTabContent = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'overview') {
        const data = await api.superadmin.getStats();
        setStats(data.stats);
        setRecentActivities(data.recentActivities || []);
      } else if (activeTab === 'users') {
        const data = await api.superadmin.getUsers();
        setUsersList(data.users || []);
      } else if (activeTab === 'attendance') {
        const data = await api.superadmin.getAttendance();
        setAttendanceLogs(data.records || []);
      } else if (activeTab === 'audit') {
        const data = await api.superadmin.getAuditLogs();
        setAuditLogs(data.auditLogs || []);
      } else if (activeTab === 'appointments') {
        const data = await api.superadmin.getAppointments();
        setAppointmentsList(data.appointments || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load panel contents.');
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      phone: '',
      role: 'Doctor',
      password: '',
      is_active: true
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: any) => {
    setEditingUser(u);
    setUserForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      password: '', // leave empty to not change
      is_active: u.is_active
    });
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      if (editingUser) {
        // update user
        const payload: any = {
          name: userForm.name,
          email: userForm.email,
          phone: userForm.phone,
          role: userForm.role,
          is_active: userForm.is_active
        };
        if (userForm.password) {
          payload.password = userForm.password;
        }
        await api.users.update(editingUser.id, payload);
        setSuccess('User updated successfully.');
      } else {
        // create user
        if (!userForm.password) {
          throw new Error('Password is required for new users.');
        }
        await api.users.create(userForm);
        setSuccess('New user account created successfully.');
      }
      setIsUserModalOpen(false);
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Failed to submit user form.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to deactivate and soft-delete this user?')) return;
    setActionLoading(true);
    try {
      await api.users.delete(id);
      setSuccess('User soft-deleted successfully.');
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Soft delete user failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreUser = async (id: number) => {
    setActionLoading(true);
    try {
      await api.users.restore(id);
      setSuccess('User account restored successfully.');
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Restore user failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteUser = async (id: number) => {
    if (!window.confirm('CRITICAL ACTION: Are you sure you want to permanently PURGE this user? This deletes attendance records and is irreversible.')) return;
    setActionLoading(true);
    try {
      await api.superadmin.deleteUserPermanent(id);
      setSuccess('User account permanently purged.');
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Permanent delete user failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Appointment Actions
  const handleSoftDeleteAppointment = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel and soft-delete this appointment?')) return;
    setActionLoading(true);
    try {
      await api.appointments.delete(id);
      setSuccess('Appointment soft-deleted.');
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Soft delete appointment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreAppointment = async (id: number) => {
    setActionLoading(true);
    try {
      await api.appointments.restore(id);
      setSuccess('Appointment successfully recovered.');
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Restore appointment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteAppointment = async (id: number) => {
    if (!window.confirm('CRITICAL ACTION: Are you sure you want to permanently PURGE this appointment? This deletes related payments and is irreversible.')) return;
    setActionLoading(true);
    try {
      await api.superadmin.deleteAppointmentPermanent(id);
      setSuccess('Appointment record permanently purged.');
      loadTabContent();
    } catch (err: any) {
      setError(err.message || 'Permanent delete appointment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to format changedFields diff
  const renderAuditDiff = (metadata: any) => {
    if (!metadata || !metadata.changedFields) return null;
    const diffs = metadata.changedFields;
    return (
      <div className="mt-2 p-3 bg-white/80 border border-border-gray rounded-xl text-[11px] font-mono text-secondary-text space-y-1">
        <span className="text-[10px] uppercase font-bold text-secondary-text block mb-1">State Modifications:</span>
        {Object.entries(diffs).map(([field, delta]: any) => (
          <div key={field} className="flex flex-wrap gap-1 items-center">
            <span className="text-primary-green font-semibold">{field}</span>:
            <span className="line-through text-alert-text/80 px-1">{JSON.stringify(delta.old)}</span>
            <span className="text-secondary-text">→</span>
            <span className="text-primary-green font-semibold">{JSON.stringify(delta.new)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (user?.role !== 'Superadmin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white text-primary-text">
        <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/20 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 text-alert-text mx-auto mb-3" />
          <h2 className="text-lg font-bold text-primary-text">Access Denied</h2>
          <p className="text-xs text-secondary-text mt-2">
            You do not possess the required Superadmin authentication context. Standard admins are blocked from loading this portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Banner Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary-text flex items-center gap-2">
              Superadmin Command Center
              <ShieldCheck className="h-6 w-6 text-primary-green" />
            </h1>
            <p className="text-sm text-secondary-text mt-0.5">
              Unfiltered system metrics, audit trails, and raw administrative overrides.
            </p>
          </div>

          <button
            onClick={loadTabContent}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-border-gray text-secondary-text hover:text-primary-green rounded-xl transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Content
          </button>
        </div>

        {/* Feedback Panels */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-alert-text" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2 animate-pulse">
            <Check className="h-4.5 w-4.5 text-primary-green" />
            {success}
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex flex-wrap gap-1 bg-white/60 border border-border-gray p-1 rounded-xl">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'attendance', label: 'Workforce Attendance', icon: Clock },
            { id: 'audit', label: 'System Logs', icon: Database },
            { id: 'appointments', label: 'Appointments Registry', icon: Calendar }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active 
                    ? 'bg-very-light-green/60 text-emerald-500 border border-emerald-500/30' 
                    : 'text-secondary-text hover:text-primary-text hover:bg-secondary-bg/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : (
          <div>
            
            {/* TAB 1: OVERVIEW METRICS */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  
                  {/* Revenue Card */}
                  <div className="bg-white border border-border-gray p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-emerald-500/20"><IndianRupee className="h-10 w-10" /></div>
                    <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">Total System Revenue</span>
                    <h3 className="text-2xl font-black text-primary-text mt-1">₹{stats.revenue.toLocaleString('en-IN')}</h3>
                    <p className="text-[10px] text-primary-green mt-2 font-bold">Unfiltered billing collections</p>
                  </div>

                  {/* Pending Payments Card */}
                  <div className="bg-white border border-border-gray p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-alert-text/20"><TrendingUp className="h-10 w-10" /></div>
                    <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">Pending Outstandings</span>
                    <h3 className="text-2xl font-black text-primary-text mt-1">₹{stats.pendingPayments.toLocaleString('en-IN')}</h3>
                    <p className="text-[10px] text-secondary-text mt-2 font-bold">Pending surgery/copay balances</p>
                  </div>

                  {/* Appointments Count Card */}
                  <div className="bg-white border border-border-gray p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-primary-green/20"><Calendar className="h-10 w-10" /></div>
                    <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">Total Appointments</span>
                    <h3 className="text-2xl font-black text-primary-text mt-1">{stats.totalAppointments}</h3>
                    <p className="text-[10px] text-secondary-text mt-2 font-bold">{stats.todayAppointments} scheduled today</p>
                  </div>

                  {/* Active Workforce Session */}
                  <div className="bg-white border border-border-gray p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-primary-green/20"><Users className="h-10 w-10" /></div>
                    <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">Workforce Sessions</span>
                    <h3 className="text-2xl font-black text-primary-text mt-1">{stats.activeUsers}</h3>
                    <p className="text-[10px] text-emerald-500 mt-2 font-bold">Employees punched in</p>
                  </div>

                  {/* Field Visits Count Card */}
                  <div className="bg-white border border-border-gray p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-primary-green/20"><MapPin className="h-10 w-10" /></div>
                    <span className="text-[10px] text-secondary-text font-bold uppercase tracking-wider">Field Visits</span>
                    <h3 className="text-2xl font-black text-primary-text mt-1">{stats.totalVisits}</h3>
                    <p className="text-[10px] text-secondary-text mt-2 font-bold">{stats.activeExecutives} active executives on maps</p>
                  </div>
                </div>

                {/* Recent Unfiltered Activity Audit */}
                <div className="bg-white border border-border-gray rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-primary-text mb-4 flex items-center gap-1.5 border-b border-border-gray pb-3">
                    <Activity className="h-4 w-4 text-primary-green" />
                    Live System Audit Trail (Last 15 Operations)
                  </h3>
                  
                  <div className="space-y-4">
                    {recentActivities.map((log) => (
                      <div key={log.id} className="p-3 bg-white/40 border border-border-gray rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-very-light-green text-primary-green border border-light-green/40 font-bold font-mono">
                              {log.action}
                            </span>
                            <span className="text-secondary-text font-medium">
                              Table: <strong className="text-secondary-text">{log.table_name}</strong> • Record: <strong className="text-secondary-text">#{log.record_id}</strong>
                            </span>
                          </div>
                          <span className="text-secondary-text">
                            {new Date(log.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                        
                        <p className="text-secondary-text font-semibold">{log.description}</p>
                        
                        <div className="text-[10px] text-secondary-text">
                          Actor: <strong className="text-secondary-text">{log.user_name || 'System / Guest'}</strong> 
                          {log.user_role && <span className="ml-1 text-primary-green font-bold">({log.user_role})</span>}
                        </div>

                        {renderAuditDiff(log.metadata)}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: USER DIRECTORY CRUD */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                
                {/* Search & Actions Panel */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-border-gray p-4 rounded-xl">
                  <div className="w-full sm:max-w-md relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary-text" />
                    <input
                      type="text"
                      placeholder="Search accounts by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-border-gray rounded-lg py-2 pl-9 pr-4 text-xs text-primary-text outline-none focus:border-primary-green"
                    />
                  </div>
                  
                  <button
                    onClick={handleOpenCreateUser}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-green hover:bg-primary-green-hover text-xs font-bold text-white rounded-lg transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Add Account
                  </button>
                </div>

                {/* Users Table - Desktop */}
                <div className="hidden md:block bg-white border border-border-gray rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-border-gray text-secondary-text font-bold">
                        <th className="p-4">Account ID</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Joined Date</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {usersList
                        .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((u) => (
                          <tr key={u.id} className="hover:bg-white/40">
                            <td className="p-4 font-mono font-bold text-secondary-text">#{u.id}</td>
                            <td className="p-4 font-semibold text-primary-text">{u.name}</td>
                            <td className="p-4 text-secondary-text">{u.email}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.role === 'Superadmin' ? 'bg-secondary-bg text-secondary-text border border-border-gray' :
                                u.role === 'Admin' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                                u.role === 'Doctor' || u.role === 'Chief Doctor' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                                'bg-secondary-bg text-secondary-text border border-border-gray'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4">
                              {u.is_deleted ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-alert-bg text-alert-text border border-alert-border">
                                  Soft-Deleted
                                </span>
                              ) : u.is_active ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-very-light-green text-primary-green border border-light-green/40">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-secondary-text border border-border-gray">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-secondary-text">
                              {new Date(u.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 bg-secondary-bg hover:bg-very-light-green text-secondary-text hover:text-primary-green rounded-lg transition-colors cursor-pointer"
                                  title="Edit role/status"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                
                                {u.is_deleted ? (
                                  <button
                                    onClick={() => handleRestoreUser(u.id)}
                                    className="p-1.5 bg-very-light-green/60 hover:bg-emerald-900/60 border border-emerald-900/30 text-primary-green rounded-lg transition-colors cursor-pointer"
                                    title="Restore account"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSoftDeleteUser(u.id)}
                                    className="p-1.5 bg-alert-bg hover:bg-[#fee2e2] border border-alert-border text-alert-text rounded-lg transition-colors cursor-pointer"
                                    title="Soft-Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handlePermanentDeleteUser(u.id)}
                                  className="p-1.5 bg-alert-bg border border-alert-border hover:bg-[#fee2e2] text-alert-text hover:text-alert-text rounded-lg transition-colors cursor-pointer"
                                  title="PURGE PERMANENTLY"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Users - Mobile Cards */}
                <div className="block md:hidden divide-y divide-border-gray max-h-[60vh] overflow-y-auto bg-white border border-border-gray rounded-xl">
                  {usersList
                    .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((u) => (
                      <div key={u.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-primary-text block">{u.name}</span>
                            <span className="text-[10px] text-secondary-text font-mono">ID: #{u.id}</span>
                          </div>
                          <div className="flex flex-col gap-1.5 items-end">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              u.role === 'Superadmin' ? 'bg-secondary-bg text-secondary-text border border-border-gray' :
                              u.role === 'Admin' ? 'bg-very-light-green text-primary-green border border-light-green/45 px-2 py-0.5 rounded' :
                              'bg-very-light-green text-primary-green border border-light-green/45 px-2 py-0.5 rounded'
                            }`}>
                              {u.role}
                            </span>
                            {u.is_deleted ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-alert-bg text-alert-text border border-alert-border">
                                Soft-Deleted
                              </span>
                            ) : u.is_active ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-very-light-green text-primary-green border border-light-green/45 px-2 py-0.5 rounded">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white text-secondary-text border border-border-gray">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs text-secondary-text space-y-1 bg-secondary-bg p-2.5 rounded-lg border border-border-gray/50">
                          <p><span className="font-semibold text-primary-text">Email:</span> {u.email}</p>
                          <p><span className="font-semibold text-primary-text">Joined:</span> {new Date(u.created_at).toLocaleDateString('en-IN')}</p>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border-gray">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-secondary-bg hover:bg-very-light-green text-secondary-text hover:text-primary-green rounded-xl border border-border-gray transition-colors cursor-pointer text-xs font-semibold"
                            title="Edit role/status"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          
                          {u.is_deleted ? (
                            <button
                              onClick={() => handleRestoreUser(u.id)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-very-light-green/60 hover:bg-emerald-900/60 border border-emerald-900/30 text-primary-green rounded-xl transition-colors cursor-pointer text-xs font-semibold"
                              title="Restore account"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSoftDeleteUser(u.id)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-alert-bg hover:bg-[#fee2e2] border border-alert-border text-alert-text rounded-xl transition-colors cursor-pointer text-xs font-semibold"
                              title="Soft-Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}

                          <button
                            onClick={() => handlePermanentDeleteUser(u.id)}
                            className="min-h-[44px] px-3 flex items-center justify-center bg-alert-bg border border-alert-border hover:bg-[#fee2e2] text-alert-text hover:text-alert-text rounded-xl transition-colors cursor-pointer"
                            title="PURGE PERMANENTLY"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

              </div>
            )}

            {/* TAB 3: WORKFORCE ATTENDANCE LOGS */}
            {activeTab === 'attendance' && (
              <div className="space-y-4">
                
                {/* Search bar */}
                <div className="flex justify-between items-center bg-white border border-border-gray p-4 rounded-xl">
                  <div className="w-full max-w-md relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary-text" />
                    <input
                      type="text"
                      placeholder="Search attendance by employee name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-border-gray rounded-lg py-2 pl-9 pr-4 text-xs text-primary-text outline-none focus:border-primary-green"
                    />
                  </div>
                </div>

                {/* Attendance table - Desktop */}
                <div className="hidden md:block bg-white border border-border-gray rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-border-gray text-secondary-text font-bold">
                        <th className="p-4">Record ID</th>
                        <th className="p-4">Employee</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Punch In</th>
                        <th className="p-4">Punch Out</th>
                        <th className="p-4">Session Status</th>
                        <th className="p-4">Device / IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {attendanceLogs
                        .filter(log => log.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-white/40">
                            <td className="p-4 font-mono text-secondary-text">#{log.id}</td>
                            <td className="p-4 font-semibold text-primary-text">{log.user_name}</td>
                            <td className="p-4 text-secondary-text">{log.user_email}</td>
                            <td className="p-4 text-secondary-text">{log.user_role}</td>
                            <td className="p-4 text-secondary-text">
                              {new Date(log.punch_in).toLocaleString('en-IN')}
                            </td>
                            <td className="p-4 text-secondary-text">
                              {log.punch_out ? new Date(log.punch_out).toLocaleString('en-IN') : 'Active Session'}
                            </td>
                            <td className="p-4">
                              {log.status === 'active' || !log.punch_out ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-very-light-green text-primary-green border border-light-green/40">
                                  Punched In
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-secondary-text border border-border-gray">
                                  Punched Out
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-secondary-text font-mono text-[10px] truncate max-w-[200px]" title={log.device_info}>
                              IP: {log.ip_address || 'N/A'} • {log.device_info || 'Unknown Device'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Attendance - Mobile Cards */}
                <div className="block md:hidden divide-y divide-border-gray max-h-[60vh] overflow-y-auto bg-white border border-border-gray rounded-xl">
                  {attendanceLogs
                    .filter(log => log.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((log) => (
                      <div key={log.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-primary-text block">{log.user_name}</span>
                            <span className="text-[10px] text-secondary-text font-mono">Record: #{log.id}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            log.status === 'active' || !log.punch_out
                              ? 'bg-very-light-green text-primary-green border border-light-green/45 px-2 py-0.5 rounded'
                              : 'bg-white text-secondary-text border border-border-gray'
                          }`}>
                            {log.status === 'active' || !log.punch_out ? 'Punched In' : 'Punched Out'}
                          </span>
                        </div>
                        
                        <div className="text-xs text-secondary-text space-y-1 bg-secondary-bg p-2.5 rounded-lg border border-border-gray/50">
                          <p><span className="font-semibold text-primary-text">Role:</span> {log.user_role} ({log.user_email})</p>
                          <p><span className="font-semibold text-primary-text">In:</span> {new Date(log.punch_in).toLocaleString('en-IN')}</p>
                          <p><span className="font-semibold text-primary-text">Out:</span> {log.punch_out ? new Date(log.punch_out).toLocaleString('en-IN') : 'Active Session'}</p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[9px] text-secondary-text truncate" title={log.device_info}>
                          <Monitor className="h-3.5 w-3.5 text-secondary-text/60 shrink-0" />
                          <span className="truncate">IP: {log.ip_address || 'N/A'} • {log.device_info || 'Unknown Device'}</span>
                        </div>
                      </div>
                    ))}
                </div>

              </div>
            )}

            {/* TAB 4: SYSTEM LOGS AUDIT */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                
                {/* Search bar */}
                <div className="flex justify-between items-center bg-white border border-border-gray p-4 rounded-xl">
                  <div className="w-full max-w-md relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary-text" />
                    <input
                      type="text"
                      placeholder="Search system logs (Action, Actor, or description)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-border-gray rounded-lg py-2 pl-9 pr-4 text-xs text-primary-text outline-none focus:border-primary-green"
                    />
                  </div>
                </div>

                {/* Audit Logs Table - Desktop */}
                <div className="hidden md:block bg-white border border-border-gray rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-border-gray text-secondary-text font-bold">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Actor</th>
                        <th className="p-4">Component</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Modifications Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {auditLogs
                        .filter(log => 
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        )
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-white/40 align-top">
                            <td className="p-4 text-secondary-text whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString('en-IN')}
                            </td>
                            <td className="p-4 font-mono font-bold text-primary-green">{log.action}</td>
                            <td className="p-4 font-semibold text-primary-text">
                              {log.user_name || 'System / Guest'} 
                              {log.user_role && <span className="block text-[10px] text-secondary-text font-bold uppercase">{log.user_role}</span>}
                            </td>
                            <td className="p-4 text-secondary-text font-medium whitespace-nowrap">
                              {log.table_name} #{log.record_id}
                            </td>
                            <td className="p-4 text-secondary-text font-medium max-w-sm">{log.description}</td>
                            <td className="p-4 max-w-md">
                              {log.metadata?.changedFields ? renderAuditDiff(log) : <span className="text-slate-600 italic">No Diff Metadata</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Audit Logs - Mobile Cards */}
                <div className="block md:hidden divide-y divide-border-gray max-h-[60vh] overflow-y-auto bg-white border border-border-gray rounded-xl">
                  {auditLogs
                    .filter(log => 
                      log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      log.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .map((log) => (
                      <div key={log.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono font-bold text-primary-green text-xs">{log.action}</span>
                            <span className="text-[10px] text-secondary-text block">
                              {new Date(log.created_at).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-primary-text block">{log.user_name || 'System / Guest'}</span>
                            {log.user_role && (
                              <span className="text-[9px] text-secondary-text font-bold uppercase tracking-wider">
                                {log.user_role}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs text-secondary-text space-y-1 bg-secondary-bg p-2.5 rounded-lg border border-border-gray/50">
                          <p><span className="font-semibold text-primary-text">Component:</span> {log.table_name} #{log.record_id}</p>
                          <p><span className="font-semibold text-primary-text">Description:</span> {log.description}</p>
                        </div>

                        {log.metadata?.changedFields && (
                          <div className="pt-1">
                            {renderAuditDiff(log)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>

              </div>
            )}

            {/* TAB 5: APPOINTMENTS REGISTRY */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                
                {/* Search bar */}
                <div className="flex justify-between items-center bg-white border border-border-gray p-4 rounded-xl">
                  <div className="w-full max-w-md relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary-text" />
                    <input
                      type="text"
                      placeholder="Search appointments by Patient name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-border-gray rounded-lg py-2 pl-9 pr-4 text-xs text-primary-text outline-none focus:border-primary-green"
                    />
                  </div>
                            {/* Appointments Table - Desktop */}
                <div className="hidden md:block bg-white border border-border-gray rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-border-gray text-secondary-text font-bold">
                        <th className="p-4">Appt ID</th>
                        <th className="p-4">Patient</th>
                        <th className="p-4">Assigned Doctor</th>
                        <th className="p-4">Hospital Location</th>
                        <th className="p-4">Scheduled Date</th>
                        <th className="p-4">Billing Fee</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Registry Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {appointmentsList
                        .filter(app => app.patient_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((app) => (
                          <tr key={app.id} className="hover:bg-white/40">
                            <td className="p-4 font-mono font-bold text-secondary-text">#{app.id}</td>
                            <td className="p-4 font-semibold text-primary-text">{app.patient_name}</td>
                            <td className="p-4 text-secondary-text font-semibold">{app.doctor_name || 'Unassigned'}</td>
                            <td className="p-4 text-secondary-text">{app.hospital_name || 'N/A'}</td>
                            <td className="p-4 text-secondary-text">
                              {new Date(app.appointment_date).toLocaleString('en-IN')}
                            </td>
                            <td className="p-4 font-bold text-secondary-text">₹{app.total_amount}</td>
                            <td className="p-4">
                              {app.is_deleted ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-alert-bg text-alert-text border border-rose-900/30">
                                  Soft-Deleted
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  app.payment_status === 'Completed' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                                  'bg-secondary-bg text-secondary-text'
                                }}`}>
                                  Active ({app.payment_status})
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1.5">
                                {app.is_deleted ? (
                                  <button
                                    onClick={() => handleRestoreAppointment(app.id)}
                                    className="p-1.5 bg-very-light-green/60 hover:bg-emerald-900/60 border border-emerald-900/30 text-primary-green rounded-lg transition-colors cursor-pointer"
                                    title="Restore Appointment"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSoftDeleteAppointment(app.id)}
                                    className="p-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-900/30 text-alert-text rounded-lg transition-colors cursor-pointer"
                                    title="Soft-Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handlePermanentDeleteAppointment(app.id)}
                                  className="p-1.5 bg-alert-bg border border-rose-900/40 hover:bg-rose-900 text-alert-text hover:text-primary-green rounded-lg transition-colors cursor-pointer"
                                  title="PURGE APPOINTMENT PERMANENTLY"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Appointments Registry - Mobile Cards */}
                <div className="block md:hidden divide-y divide-border-gray max-h-[60vh] overflow-y-auto bg-white border border-border-gray rounded-xl">
                  {appointmentsList
                    .filter(app => app.patient_name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((app) => (
                      <div key={app.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-primary-text block">{app.patient_name}</span>
                            <span className="text-[10px] text-secondary-text font-mono">ID: #{app.id}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            app.is_deleted ? 'bg-alert-bg text-alert-text border border-rose-900/30' :
                            app.payment_status === 'Completed' ? 'bg-very-light-green text-primary-green border border-light-green/45 px-2 py-0.5 rounded font-bold' :
                            'bg-secondary-bg text-secondary-text border border-border-gray'
                          }`}>
                            {app.is_deleted ? 'Soft-Deleted' : `Active (${app.payment_status})`}
                          </span>
                        </div>
                        
                        <div className="text-xs text-secondary-text space-y-1 bg-secondary-bg p-2.5 rounded-lg border border-border-gray/50">
                          <p><span className="font-semibold text-primary-text">Doctor:</span> {app.doctor_name || 'Unassigned'}</p>
                          <p><span className="font-semibold text-primary-text">Hospital:</span> {app.hospital_name || 'N/A'}</p>
                          <p><span className="font-semibold text-primary-text">Scheduled:</span> {new Date(app.appointment_date).toLocaleString('en-IN')}</p>
                          <p><span className="font-semibold text-primary-text">Billing Fee:</span> ₹{app.total_amount}</p>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border-gray">
                          {app.is_deleted ? (
                            <button
                              onClick={() => handleRestoreAppointment(app.id)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-very-light-green/60 hover:bg-emerald-900/60 border border-emerald-900/30 text-primary-green rounded-xl transition-colors cursor-pointer text-xs font-semibold"
                              title="Restore Appointment"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore Appt
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSoftDeleteAppointment(app.id)}
                              className="flex-1 min-h-[44px] flex items-center justify-center gap-1 bg-alert-bg hover:bg-[#fee2e2] border border-alert-border text-alert-text rounded-xl transition-colors cursor-pointer text-xs font-semibold"
                              title="Soft-Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Cancel Appt
                            </button>
                          )}

                          <button
                            onClick={() => handlePermanentDeleteAppointment(app.id)}
                            className="min-h-[44px] px-3 flex items-center justify-center bg-alert-bg border border-rose-900/40 hover:bg-rose-900 text-alert-text hover:text-primary-green rounded-xl transition-colors cursor-pointer"
                            title="PURGE APPOINTMENT PERMANENTLY"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>        </div>

              </div>
            )}

          </div>
        )}

        {/* User edit/create modal */}
        <AnimatePresence>
          {isUserModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsUserModalOpen(false)}
                className="fixed inset-0 bg-black"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-primary-green" />
                    {editingUser ? `Configure User: ${editingUser.name}` : 'Register New User Account'}
                  </h3>
                  <button onClick={() => setIsUserModalOpen(false)} className="text-secondary-text hover:text-primary-green">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="jane@vvf.org"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Contact Phone</label>
                    <input
                      type="text"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      placeholder="+91 9999999999"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Access Role</label>
                    <SelectField
                      value={userForm.role}
                      onChange={(value) => setUserForm({ ...userForm, role: value })}
                      triggerClassName="py-2 px-3 text-xs"
                      options={[
                        { value: 'Doctor', label: 'Doctor' },
                        { value: 'Chief Doctor', label: 'Chief Doctor' },
                        { value: 'Reception', label: 'Reception' },
                        { value: 'Telecaller', label: 'Telecaller' },
                        { value: 'Executive', label: 'Executive' },
                        { value: 'Admin', label: 'Admin' },
                        { value: 'Superadmin', label: 'Superadmin' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">
                      {editingUser ? 'New Password (leave empty to retain current)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  {editingUser && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="user-is-active"
                        checked={userForm.is_active}
                        onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                        className="rounded border-border-gray bg-white text-primary-green focus:ring-light-green h-4 w-4"
                      />
                      <label htmlFor="user-is-active" className="text-xs text-secondary-text font-semibold cursor-pointer">
                        Account Active / Allowed Login
                      </label>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUserModalOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-secondary-text rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      {actionLoading ? 'Saving...' : 'Save Account'}
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
