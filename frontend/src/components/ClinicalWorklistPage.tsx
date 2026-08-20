'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { api } from '../lib/api';
import { 
  Activity, Clock, ShieldAlert, ArrowRight, CheckCircle, 
  RefreshCw, Award, Search, Filter, ClipboardList 
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface ClinicalWorklistPageProps {
  role: 'OP' | 'SOP';
}

export default function ClinicalWorklistPage({ role }: ClinicalWorklistPageProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'assigned' | 'pending' | 'verified' | 'history'>('assigned');
  
  // Advanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [therapyFilter, setTherapyFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const fetchWorklistData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.therapies.getAll();
      setSessions(res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clinical worklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorklistData();
  }, []);

  const getRolePrefix = () => {
    return role === 'OP' ? '/op-technician' : '/sop-technician';
  };

  // Helper stats
  const totalAssigned = sessions.filter(s => s.status !== 'Cancelled').length;
  
  const pendingVerification = sessions.filter(s => {
    const isPending = role === 'OP' ? !s.op_verified : !s.sop_verified;
    return isPending && s.status !== 'Cancelled' && s.status !== 'Completed';
  }).length;

  const verifiedCount = sessions.filter(s => {
    const isVerified = role === 'OP' ? s.op_verified : s.sop_verified;
    return isVerified && s.status !== 'Cancelled';
  }).length;

  const completedCount = sessions.filter(s => {
    return (s.actual_start && s.end_time) || s.status === 'Completed' || s.status === 'Verified';
  }).length;

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  // Therapy types present in the list
  const therapyTypes = ['All', ...Array.from(new Set(sessions.map(s => s.therapy_type)))];

  // Filtering logic
  const getFilteredSessions = () => {
    let filtered = [...sessions];

    // 1. Tab filtering
    switch (activeTab) {
      case 'pending':
        filtered = filtered.filter(s => role === 'OP' ? !s.op_verified : !s.sop_verified);
        break;
      case 'verified':
        filtered = filtered.filter(s => role === 'OP' ? s.op_verified : s.sop_verified);
        break;
      case 'history':
        filtered = filtered.filter(s => s.actual_start && s.end_time);
        break;
      case 'assigned':
      default:
        break;
    }

    // 2. Search query filtering (by patient name or ID or type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => 
        (s.patient_name || '').toLowerCase().includes(q) ||
        (s.id || '').toString().includes(q) ||
        (s.therapy_type || '').toLowerCase().includes(q)
      );
    }

    // 3. Therapy type filtering
    if (therapyFilter !== 'All') {
      filtered = filtered.filter(s => s.therapy_type === therapyFilter);
    }

    // 4. Date range filtering
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(s => new Date(s.session_date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.session_date) <= end);
    }

    return filtered;
  };

  const filteredSessions = getFilteredSessions();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary-green" />
              Clinical Worklist ({role === 'OP' ? 'OP Technician' : 'SOP Technician'})
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage, search, and audit your assigned patient clinical worklists. Toggle tabs to filter by verification states.
            </p>
          </div>
          <button
            onClick={fetchWorklistData}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green/35 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Queue
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Clinical Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Assigned */}
          <div 
            onClick={() => setActiveTab('assigned')}
            className={`rounded-2xl p-5 border relative overflow-hidden group shadow-sm cursor-pointer transition-all ${
              activeTab === 'assigned' ? 'border-primary-green bg-very-light-green/20' : 'border-slate-200 bg-white hover:border-slate-350'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Sessions</p>
                <h3 className="text-3xl font-extrabold text-slate-800 mt-2 leading-none">{totalAssigned}</h3>
                <p className="text-[10px] text-slate-400 mt-2">Active queue overall</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 2: Pending */}
          <div 
            onClick={() => setActiveTab('pending')}
            className={`rounded-2xl p-5 border relative overflow-hidden group shadow-sm cursor-pointer transition-all ${
              activeTab === 'pending' ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white hover:border-slate-350'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</p>
                <h3 className="text-3xl font-extrabold text-rose-600 mt-2 leading-none">{pendingVerification}</h3>
                <p className="text-[10px] text-rose-500/70 mt-2">Requires signature</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-500">
                <Clock className="h-5 w-5 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Card 3: Verified */}
          <div 
            onClick={() => setActiveTab('verified')}
            className={`rounded-2xl p-5 border relative overflow-hidden group shadow-sm cursor-pointer transition-all ${
              activeTab === 'verified' ? 'border-emerald-400 bg-emerald-50/20' : 'border-slate-200 bg-white hover:border-slate-350'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Verified</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 leading-none">{verifiedCount}</h3>
                <p className="text-[10px] text-emerald-500/75 mt-2">Successfully signed</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-500">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 4: History */}
          <div 
            onClick={() => setActiveTab('history')}
            className={`rounded-2xl p-5 border relative overflow-hidden group shadow-sm cursor-pointer transition-all ${
              activeTab === 'history' ? 'border-cyan-400 bg-cyan-50/20' : 'border-slate-200 bg-white hover:border-slate-350'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session History</p>
                <h3 className="text-3xl font-extrabold text-cyan-600 mt-2 leading-none">{completedCount}</h3>
                <p className="text-[10px] text-slate-455 mt-2">Completed & Timed</p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100 text-cyan-500">
                <Award className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Patient Clinical Worklists Registry Card */}
        <div className="bg-white border border-border-gray rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Top Panel: Title, Tabs and Search */}
          <div className="p-5 border-b border-border-gray space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Clinical Sessions Queue</h3>
                <p className="text-xs text-slate-400 mt-0.5">Showing {filteredSessions.length} record(s) matching queries</p>
              </div>

              {/* Text Search & Filter Toggle */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search patient name, therapy or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 focus:border-primary-green focus:ring-1 focus:ring-primary-green rounded-xl py-2 pl-9 pr-4 text-xs placeholder-slate-400 transition-all outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-1 px-3 py-2 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    showAdvancedFilters || therapyFilter !== 'All' || startDate || endDate
                      ? 'border-primary-green bg-very-light-green text-primary-green font-bold'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                </button>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-dashed border-slate-200">
                    {/* Therapy type */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Therapy Category</label>
                      <select
                        value={therapyFilter}
                        onChange={(e) => setTherapyFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green"
                      >
                        {therapyTypes.map(t => (
                          <option key={t} value={t}>{t === 'All' ? 'All Therapies' : t}</option>
                        ))}
                      </select>
                    </div>
                    {/* Start Date */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Session From Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green"
                      />
                    </div>
                    {/* End Date */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Session To Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Registry List / Table */}
          <div className="overflow-x-auto w-full">
            {loading ? (
              <div className="flex py-20 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-green border-t-transparent"></div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex py-20 flex-col items-center justify-center text-slate-400 text-xs">
                <ClipboardList className="h-12 w-12 mb-3 opacity-40 text-slate-500" />
                <p className="font-bold text-slate-500">No therapy sessions found.</p>
                <p className="text-slate-400 mt-1">Try resetting filters or checking back later.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-border-gray">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Therapy Category</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Session Date & Timings</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Log Info</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Status Indicators</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-gray text-xs">
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-700">{session.patient_name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Session #{session.session_number || session.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-650 font-semibold uppercase text-[10px]">
                          {session.therapy_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-550">
                        <p className="font-semibold">{formatDateStr(session.session_date)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{session.timings}</p>
                      </td>
                      <td className="px-6 py-4">
                        {session.actual_start && session.end_time ? (
                          <div className="text-slate-550 font-medium">
                            <p>Start: <span className="font-semibold text-slate-600">{session.actual_start}</span></p>
                            <p className="text-[10px] text-slate-400">End: {session.end_time}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Not Logged</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row gap-1.5 items-center justify-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            session.status === 'Cancelled' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                            session.status === 'Rejected' ? 'bg-rose-100 text-rose-750 border border-rose-200' :
                            session.op_verified 
                              ? 'bg-very-light-green text-primary-green border border-light-green/35' 
                              : 'bg-rose-50 text-rose-500 border border-rose-100'
                          }`}>
                            {session.status === 'Cancelled' ? 'Cancelled' : session.status === 'Rejected' ? 'Rejected' : session.op_verified ? 'OP Verified ✓' : 'OP Pending ✗'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            session.status === 'Cancelled' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                            session.status === 'Rejected' ? 'bg-rose-100 text-rose-750 border border-rose-200' :
                            session.sop_verified 
                              ? 'bg-very-light-green text-primary-green border border-light-green/35' 
                              : 'bg-rose-50 text-rose-500 border border-rose-100'
                          }`}>
                            {session.status === 'Cancelled' ? 'Cancelled' : session.status === 'Rejected' ? 'Rejected' : session.sop_verified ? 'SOP Verified ✓' : 'SOP Pending ✗'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`${getRolePrefix()}/therapies?tab=${encodeURIComponent(session.therapy_type)}`}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-primary-green uppercase tracking-wider bg-very-light-green border border-light-green/35 px-3 py-1.5 rounded-lg hover:bg-light-green/45 transition-colors cursor-pointer"
                        >
                          Manage
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
