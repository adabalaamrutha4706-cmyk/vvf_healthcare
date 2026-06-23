'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  Target, Search, Filter, Save, CheckCircle, 
  AlertCircle, ShieldAlert, Sparkles, User, BadgeAlert 
} from 'lucide-react';
import { motion } from 'framer-motion';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  monthly_target: number;
}

const SUPPORTED_ROLES = [
  'Doctor',
  'Dental Doctor',
  'Reception',
  'Telecaller',
  'Executive',
  'OP Technician',
  'SOP Technician'
];

function getTargetMetricDescription(role: string): string {
  switch (role) {
    case 'Reception':
      return 'Appointments created';
    case 'Telecaller':
      return 'Outbound leads managed';
    case 'Executive':
      return 'Completed field visits';
    case 'Doctor':
      return 'Clinician consultations';
    case 'Dental Doctor':
      return 'Dental appointments handled';
    case 'OP Technician':
    case 'SOP Technician':
      return 'Completed therapy services';
    default:
      return 'Assigned operational tasks';
  }
}

export default function TargetManagementPage() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Editing target values state map
  const [targetValues, setTargetValues] = useState<{ [userId: number]: string }>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.users.getAll();
      const usersData = response?.users || response || [];
      // Only keep active staff matching supported roles
      const filtered = usersData.filter((u: StaffUser) => 
        u.is_active !== false && SUPPORTED_ROLES.includes(u.role)
      );
      setUsersList(filtered);
      
      // Initialize editing target inputs
      const initialValues: { [userId: number]: string } = {};
      filtered.forEach((u: StaffUser) => {
        initialValues[u.id] = u.monthly_target > 0 ? String(u.monthly_target) : "";
      });
      setTargetValues(initialValues);
    } catch (err: any) {
      setError(err.message || 'Failed to load system staff directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (userId: number, value: string) => {
    // Only allow digits
    const cleaned = value.replace(/[^0-9]/g, '');
    setTargetValues(prev => ({
      ...prev,
      [userId]: cleaned
    }));
  };

  const handleSaveTarget = async (userId: number) => {
    const rawVal = targetValues[userId];
    const targetVal = rawVal ? parseInt(rawVal, 10) : 0;
    
    if (isNaN(targetVal) || targetVal < 0) {
      setError('Please input a valid target value greater than or equal to 0.');
      return;
    }

    setSavingUserId(userId);
    setError('');
    setSuccess('');

    try {
      await api.users.update(userId, { monthly_target: targetVal });
      setSuccess('Target saved successfully!');
      
      // Update local state
      setUsersList(prev => prev.map(u => 
        u.id === userId ? { ...u, monthly_target: targetVal } : u
      ));
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user target value.');
    } finally {
      setSavingUserId(null);
    }
  };

  // Filter list
  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          `EMP-${String(u.id).padStart(3, '0')}`.includes(searchTerm);
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              Monthly Targets Management
              <Target className="h-6 w-6 text-primary-green animate-pulse" />
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure operational achievements goals and monthly targets for staff roles.
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4 rounded-2xl bg-very-light-green/45 border border-light-green/30 text-xs text-primary-green flex items-start gap-2.5">
          <Sparkles className="h-4.5 w-4.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Staff Metrics Allocation:</p>
            <p className="mt-1 leading-relaxed text-slate-650">
              Targets set here will configure goals for each employee. Their performance widgets on their individual home dashboards will automatically adapt, showing achievement percentages and outstanding goals.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green text-xs text-primary-green flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Filters Panel */}
        <div className="bg-white border border-border-gray p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border-gray rounded-xl text-xs bg-slate-50/50 focus:outline-none focus:border-primary-green focus:bg-white transition-all"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto items-center shrink-0">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-border-gray rounded-xl text-xs bg-slate-50/50 focus:outline-none focus:border-primary-green focus:bg-white transition-all w-full md:w-48 font-semibold text-slate-500 cursor-pointer"
            >
              <option value="All">All Designations</option>
              {SUPPORTED_ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Targets Grid */}
        <div className="bg-white border border-border-gray rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-green border-t-transparent"></div>
                <p className="text-xs font-semibold text-slate-400">Loading system staff registry...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No active operational staff matches your search query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-border-gray text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Designation</th>
                    <th className="px-5 py-4">Target metric</th>
                    <th className="px-5 py-4 w-48 text-center">Monthly Target</th>
                    <th className="px-5 py-4 w-28 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-gray text-xs">
                  {filteredUsers.map((item) => {
                    const empId = `EMP-${String(item.id).padStart(3, '0')}`;
                    const targetInputVal = targetValues[item.id] !== undefined ? targetValues[item.id] : "";
                    const isSaving = savingUserId === item.id;
                    
                    const currentTargetVal = item.monthly_target || 0;
                    const inputVal = targetInputVal ? parseInt(targetInputVal, 10) : 0;
                    const isModified = currentTargetVal !== inputVal;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-700">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{empId} • {item.email}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-very-light-green text-primary-green border border-light-green/35">
                            {item.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-medium">
                          {getTargetMetricDescription(item.role)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                            <input
                              type="number"
                              min="0"
                              placeholder="Enter Monthly Target"
                              value={targetInputVal}
                              onChange={e => handleInputChange(item.id, e.target.value)}
                              onFocus={e => {
                                if (e.target.value === "0") {
                                  handleInputChange(item.id, "");
                                }
                              }}
                              className="w-36 text-center py-1.5 border border-border-gray rounded-lg text-xs font-bold bg-slate-50 focus:outline-none focus:border-primary-green focus:bg-white focus:ring-1 focus:ring-primary-green transition-all"
                            />
                            <span className="text-[10px] font-semibold text-slate-405">units</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleSaveTarget(item.id)}
                            disabled={isSaving || !isModified}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              isSaving 
                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                : !isModified
                                  ? 'bg-slate-50 text-slate-450 border border-border-gray cursor-default'
                                  : 'bg-primary-green text-white hover:bg-primary-green-hover shadow-sm cursor-pointer'
                            }`}
                          >
                            {isSaving ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
