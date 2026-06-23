'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { Activity, Clock, Award, ShieldAlert, ArrowRight, CheckCircle, RefreshCw, Eye, Calendar } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MyPerformanceWidget } from '../../../components/MyPerformanceWidget';

export default function SOPTechnicianDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeListTab, setActiveListTab] = useState<'assigned' | 'pending' | 'verified' | 'history'>('assigned');
  const [serviceAppointments, setServiceAppointments] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>(null);

  const fetchDashboardData = async () => {
    try {
      setError('');
      const [therapyRes, apptRes, statsRes] = await Promise.all([
        api.therapies.getAll(),
        api.appointments.getAll(),
        api.dashboard.getStats()
      ]);
      setSessions(therapyRes || []);
      setServiceAppointments(apptRes?.appointments || []);
      setPerformance(statsRes?.stats?.myPerformance || null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Calculate statistics according to requirements
  const totalAssigned = sessions.filter(s => s.status !== 'Cancelled').length;
  const pendingSOPVerification = sessions.filter(s => !s.sop_verified && s.status !== 'Cancelled' && s.status !== 'Completed').length;
  const verifiedSOP = sessions.filter(s => s.sop_verified && s.status !== 'Cancelled').length;
  const completedSessions = sessions.filter(s => (s.actual_start && s.end_time) || s.status === 'Completed' || s.status === 'Verified').length;

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  const getFilteredSessions = () => {
    switch (activeListTab) {
      case 'pending':
        return sessions.filter(s => !s.sop_verified);
      case 'verified':
        return sessions.filter(s => s.sop_verified);
      case 'history':
        return sessions.filter(s => s.actual_start && s.end_time);
      case 'assigned':
      default:
        return sessions;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              SOP Technician Portal
              <Eye className="h-6 w-6 text-primary-green animate-pulse" />
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Welcome, <span className="font-semibold text-primary-green">{user?.name}</span>. Perform sign-offs, verify OP technician logs, and append remarks.
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchDashboardData(); }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green/35 rounded-xl transition-all shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Overview
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </div>
        )}

        <MyPerformanceWidget performance={performance} role={user?.role || ''} />

        {/* Stats Grid with increased contrast and custom color styles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div style={{ background: 'white', border: '1px solid #E2E8F0' }} className="rounded-2xl p-5 relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p style={{ color: '#475569', fontWeight: 600 }} className="text-xs uppercase tracking-wider">Total Sessions</p>
                <h3 style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A' }} className="mt-2 leading-none">{totalAssigned}</h3>
                <p className="text-[10px] text-slate-455 mt-2">Assigned overall</p>
              </div>
              <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </div>

          <Link href="/sop-technician/therapies" style={{ background: 'white', border: '1px solid #E2E8F0' }} className="rounded-2xl p-5 relative overflow-hidden group shadow-sm hover:border-rose-350 transition-all cursor-pointer">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p style={{ color: '#475569', fontWeight: 600 }} className="text-xs uppercase tracking-wider">Pending Log / Verify</p>
                <h3 style={{ fontSize: '36px', fontWeight: 700, color: '#DC2626' }} className="mt-2 leading-none">{pendingSOPVerification}</h3>
                <p className="text-[10px] text-rose-500/70 mt-2">Requires your signature</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </Link>

          <div style={{ background: 'white', border: '1px solid #E2E8F0' }} className="rounded-2xl p-5 relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p style={{ color: '#475569', fontWeight: 600 }} className="text-xs uppercase tracking-wider">Your Verified</p>
                <h3 style={{ fontSize: '36px', fontWeight: 700, color: '#059669' }} className="mt-2 leading-none">{verifiedSOP}</h3>
                <p className="text-[10px] text-emerald-605 mt-2">Signed by you</p>
              </div>
              <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #E2E8F0' }} className="rounded-2xl p-5 relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p style={{ color: '#475569', fontWeight: 600 }} className="text-xs uppercase tracking-wider">Session History</p>
                <h3 style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A' }} className="mt-2 leading-none">{completedSessions}</h3>
                <p className="text-[10px] text-slate-455 mt-2">Completed sessions</p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100 text-cyan-500">
                <Award className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Service Appointments Stats */}
        <div className="bg-white border border-border-gray rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                Service Appointments
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Assigned to you</p>
            </div>
            <Link
              href="/appointments"
              className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-border-gray rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Scheduled</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{serviceAppointments.filter(a => a.status === 'Scheduled').length}</p>
            </div>
            <div className="bg-very-light-green border border-light-green/30 rounded-xl p-3 text-center">
              <p className="text-[10px] text-primary-green font-semibold uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-primary-green mt-1">{serviceAppointments.filter(a => a.status === 'Completed').length}</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
              <p className="text-[10px] text-rose-500 font-semibold uppercase tracking-wider">Cancelled</p>
              <p className="text-2xl font-bold text-rose-500 mt-1">{serviceAppointments.filter(a => a.status === 'Cancelled').length}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{serviceAppointments.length}</p>
            </div>
          </div>
        </div>

        {/* Today's Schedule & Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Sessions List with Tabs */}
          <div className="lg:col-span-2 bg-white border border-border-gray rounded-2xl p-5 shadow-sm flex flex-col h-[480px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">My Clinical Worklists</h3>
                <p className="text-xs text-slate-400">Manage, log, and audit your sessions</p>
              </div>
              <div className="flex flex-wrap gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                <button
                  onClick={() => setActiveListTab('assigned')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    activeListTab === 'assigned'
                      ? 'bg-primary-green text-white shadow-sm'
                      : 'text-slate-500 hover:text-primary-green'
                  }`}
                >
                  Assigned ({totalAssigned})
                </button>
                <button
                  onClick={() => setActiveListTab('pending')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    activeListTab === 'pending'
                      ? 'bg-primary-green text-white shadow-sm'
                      : 'text-slate-500 hover:text-primary-green'
                  }`}
                >
                  Pending ({pendingSOPVerification})
                </button>
                <button
                  onClick={() => setActiveListTab('verified')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    activeListTab === 'verified'
                      ? 'bg-primary-green text-white shadow-sm'
                      : 'text-slate-500 hover:text-primary-green'
                  }`}
                >
                  Your Verified ({verifiedSOP})
                </button>
                <button
                  onClick={() => setActiveListTab('history')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    activeListTab === 'history'
                      ? 'bg-primary-green text-white shadow-sm'
                      : 'text-slate-500 hover:text-primary-green'
                  }`}
                >
                  History ({completedSessions})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border-gray bg-slate-50/50 rounded-xl border border-border-gray p-2">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-green border-t-transparent"></div>
                </div>
              ) : getFilteredSessions().length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-slate-400 text-xs">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  No therapy sessions found for the active filter.
                </div>
              ) : (
                getFilteredSessions().map((session) => (
                  <Link 
                    href={`/sop-technician/therapies?tab=${encodeURIComponent(session.therapy_type)}`}
                    key={session.id} 
                    className="p-3 hover:bg-very-light-green/45 transition-colors flex justify-between items-center gap-3 block"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-700">{session.patient_name}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-500">{session.therapy_type}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatDateStr(session.session_date)} | {session.timings}
                        </span>
                      </div>
                      {session.actual_start && session.end_time && (
                        <p className="text-[9px] text-slate-400 mt-0.5">Logged Time: {session.actual_start} - {session.end_time}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
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
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white border border-border-gray rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Quick Shortcuts</h3>
            <p className="text-xs text-slate-400">Navigate directly to clinical screens.</p>
            
            <div className="space-y-2.5 pt-2">
              <Link
                href="/appointments"
                className="w-full flex items-center justify-between p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl transition-all font-semibold text-xs group"
              >
                <span>📅 Service Appointments</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/sop-technician/therapies"
                className="w-full flex items-center justify-between p-3.5 bg-very-light-green hover:bg-light-green/40 border border-light-green/30 text-primary-green rounded-xl transition-all font-semibold text-xs group"
              >
                <span>⚙️ Manage Therapies</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/sop-technician/attendance"
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-150 border border-border-gray text-slate-550 rounded-xl transition-all font-semibold text-xs group"
              >
                <span>⏰ Log Attendance Shift</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/sop-technician/settings"
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-150 border border-border-gray text-slate-550 rounded-xl transition-all font-semibold text-xs group"
              >
                <span>🔧 Account Settings</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
