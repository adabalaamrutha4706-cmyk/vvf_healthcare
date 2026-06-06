'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Clock, Calendar, Monitor, MapPin, 
  TrendingUp, ShieldAlert, CheckCircle,
  Search, Users, RefreshCw, Filter
} from 'lucide-react';

export default function AttendancePage() {
  const { user, isPunchedIn, activePunchRecord } = useAuth();
  
  // Lists
  const [records, setRecords] = useState<any[]>([]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search & Filter states
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterLateOnly, setFilterLateOnly] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Aggregated counts from backend
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);

  // Trigger fetch when parameters or page changes
  useEffect(() => {
    if (!user) return;
    fetchAttendance(false);
  }, [page, search, filterRole, filterStatus, filterStartDate, filterEndDate, filterLateOnly, isPunchedIn, user]);

  // Real-time silent refresh every 10 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchAttendance(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [page, search, filterRole, filterStatus, filterStartDate, filterEndDate, filterLateOnly, isPunchedIn, user]);

  // Live timer for active session
  useEffect(() => {
    if (!isPunchedIn || !activePunchRecord?.punch_in) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(activePunchRecord.punch_in).getTime();

    const updateElapsed = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);

    return () => clearInterval(timer);
  }, [isPunchedIn, activePunchRecord]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const fetchAttendance = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await api.auth.getAttendance({
        search: user?.role === 'Admin' ? search : undefined,
        role: user?.role === 'Admin' ? filterRole : undefined,
        status: user?.role === 'Admin' ? filterStatus : undefined,
        startDate: user?.role === 'Admin' ? filterStartDate : undefined,
        endDate: user?.role === 'Admin' ? filterEndDate : undefined,
        lateOnly: user?.role === 'Admin' ? filterLateOnly : undefined,
        page,
        limit
      });
      setRecords(res.records || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setActiveCount(res.activeCount || 0);
      setCompletedCount(res.completedCount || 0);
      setLateCount(res.lateCount || 0);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch attendance logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Calculate stats for personal view
  const personalTotalShifts = records.length;
  const personalTotalMinutes = records.reduce((acc, r) => acc + (r.duration_minutes || 0), 0);
  const personalTotalHoursStr = (personalTotalMinutes / 60).toFixed(1);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary-text flex items-center gap-2">
              {user?.role === 'Admin' ? 'Global Shift Activity Monitor' : 'Work Shift Attendance Logs'}
              <Clock className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-xs sm:text-sm text-secondary-text mt-0.5">
              {user?.role === 'Admin' 
                ? 'Centralized monitoring panel to track active sessions, verify punch times, and track team shifts.' 
                : 'Verify punched shifts, monitor active work sessions, and record duration.'}
            </p>
          </div>
          <button 
            onClick={() => fetchAttendance(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-primary-green bg-white border border-border-gray rounded-xl hover:bg-very-light-green hover:text-primary-green-hover transition-all cursor-pointer font-semibold self-start sm:self-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Now
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
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/50 text-xs text-primary-text flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {/* 3 Work shifts Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {user?.role === 'Admin' ? (
            <>
              {/* Admin Card 1: Total Logs */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group shadow-sm">
                <div className="p-3 bg-very-light-green text-primary-green rounded-xl border border-light-green/40">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Total Shift Logs (Org)</p>
                  <h3 className="text-lg sm:text-xl font-bold text-primary-text mt-0.5">{total}</h3>
                </div>
              </div>

              {/* Admin Card 2: Active Sessions */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group shadow-sm">
                <div className="p-3 bg-very-light-green text-primary-green rounded-xl border border-light-green/40">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Live Active Sessions</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h3 className="text-lg sm:text-xl font-bold text-primary-green">{activeCount}</h3>
                    {activeCount > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-green opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-green"></span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Card 3: Late Logins */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group shadow-sm sm:col-span-2 md:col-span-1">
                <div className="p-3 bg-alert-bg text-alert-text rounded-xl border border-alert-border">
                  <Clock className="h-5 w-5 text-alert-text" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Late Logins (Total)</p>
                  <h3 className="text-lg sm:text-xl font-bold text-alert-text mt-0.5">{lateCount}</h3>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Personal Card 1 */}
              <div className="bg-white border border-border-gray rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group shadow-sm">
                <div className="p-3 bg-very-light-green text-primary-green rounded-xl border border-light-green/40">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Total Shifts Logged</p>
                  <h3 className="text-lg sm:text-xl font-bold text-primary-text mt-0.5">{personalTotalShifts}</h3>
                </div>
              </div>

              {/* Personal Card 2 */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group shadow-sm">
                <div className="p-3 bg-very-light-green text-primary-green rounded-xl border border-light-green/40">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Total Work Duration</p>
                  <h3 className="text-lg sm:text-xl font-bold text-primary-green mt-0.5">{personalTotalHoursStr} Hours</h3>
                </div>
              </div>

              {/* Personal Card 3: Session Status & Live Duration */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex flex-col justify-between gap-3 min-h-[80px] sm:min-h-[92px] sm:col-span-2 md:col-span-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] bg-very-light-green border border-light-green text-primary-green px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Shift status
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isPunchedIn 
                      ? 'bg-very-light-green text-primary-green border-light-green' 
                      : 'bg-secondary-bg text-secondary-text border-border-gray'
                  }`}>
                    {isPunchedIn ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-ping" />
                        Session Active
                      </>
                    ) : (
                      'Session Inactive'
                    )}
                  </span>
                </div>
                
                <div className="flex items-end justify-between mt-1">
                  <div>
                    <p className="text-[9px] text-secondary-text uppercase tracking-wider font-bold">Live Session Time</p>
                    <p className="text-base sm:text-lg font-mono font-bold text-primary-text mt-0.5">
                      {isPunchedIn ? formatElapsed(elapsedSeconds) : '00:00:00'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-secondary-text uppercase tracking-wider font-bold">Login Timestamp</p>
                    <p className="text-xs font-bold text-primary-green mt-1">
                      {isPunchedIn && activePunchRecord?.punch_in
                        ? new Date(activePunchRecord.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Admin Advanced Filter & Search Panel */}
        {user?.role === 'Admin' && (
          <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-primary-text uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary-green" />
                Live Activity Filters
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                  className="sm:hidden text-[10px] text-primary-green border border-light-green px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
                >
                  {showFiltersMobile ? 'Hide Filters' : 'Show Filters'}
                </button>
                <button 
                  onClick={() => {
                    setSearch('');
                    setFilterRole('');
                    setFilterStatus('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterLateOnly(false);
                    setPage(1);
                  }}
                  className="text-[10px] text-secondary-text hover:text-primary-green font-bold hover:underline transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
            
            <div className={`${showFiltersMobile ? 'grid' : 'hidden sm:grid'} grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`}>
              {/* Search */}
              <div className="sm:col-span-2">
                <label className="block text-[9px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Search Employee</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-secondary-text/60" />
                  <input
                    type="text"
                    placeholder="Name, email, or user ID..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 pl-8 pr-3 text-xs text-secondary-text outline-none placeholder-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Role Select */}
              <div>
                <label className="block text-[9px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Role Permission</label>
                <select
                  value={filterRole}
                  onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-secondary-text outline-none transition-all cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Chief Doctor">Chief Doctor</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Reception">Reception</option>
                  <option value="Telecaller">Telecaller</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-[9px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Session Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-secondary-text outline-none transition-all cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active/Online</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[9px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-secondary-text outline-none transition-all cursor-pointer"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[9px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">End Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-secondary-text outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* Late Logins Toggle */}
            <div className={`flex items-center gap-2 pt-2 border-t border-border-gray/50 ${showFiltersMobile ? 'flex' : 'hidden sm:flex'}`}>
              <input
                type="checkbox"
                id="filter-late-only"
                checked={filterLateOnly}
                onChange={(e) => { setFilterLateOnly(e.target.checked); setPage(1); }}
                className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4 cursor-pointer"
              />
              <label htmlFor="filter-late-only" className="text-xs font-semibold text-secondary-text select-none cursor-pointer flex items-center gap-1.5">
                Show Late Logins Only
                <span className="text-[9px] px-1.5 py-0.5 bg-alert-bg text-alert-text border border-alert-border rounded font-bold uppercase tracking-wider">
                  After 9:30 AM
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Shifts Table */}
        <div className="bg-white border border-border-gray rounded-xl overflow-hidden min-h-[300px] flex flex-col justify-between shadow-sm">
          <div>
            <div className="px-6 py-4 border-b border-border-gray bg-secondary-bg">
              <h3 className="font-bold text-xs text-primary-text uppercase tracking-wider">
                {user?.role === 'Admin' ? 'Organization Work Shift Logs' : 'Monthly Shift Timesheet'}
              </h3>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : records.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-secondary-text">
                No shift logs found. Attendance is automatically tracked on login.
              </div>
            ) : (
              <>
                {/* Desktop/Tablet Table View (>= md screen size) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary-bg text-primary-text font-semibold border-b border-border-gray uppercase text-[9px] tracking-wider">
                      <tr>
                        {user?.role === 'Admin' && (
                          <>
                            <th className="px-5 py-3.5">Staff Member</th>
                            <th className="px-5 py-3.5">Designation</th>
                          </>
                        )}
                        <th className="px-5 py-3.5">Shift Date</th>
                        <th className="px-5 py-3.5">Login Time</th>
                        <th className="px-5 py-3.5">Logout Time</th>
                        <th className="px-5 py-3.5">Session Status</th>
                        <th className="px-5 py-3.5">Device Agent</th>
                        <th className="px-5 py-3.5 text-center">GPS Geotag</th>
                        <th className="px-5 py-3.5 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {records.map((r) => {
                        const dateStr = new Date(r.date).toLocaleDateString('en-IN', {
                          weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                        });
                        
                        const inTime = new Date(r.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                        const outTime = r.punch_out 
                          ? new Date(r.punch_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
                          : 'Active Session';
                        
                        const durationStr = r.duration_minutes !== null && r.duration_minutes !== undefined
                          ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                          : '-';

                        const punchInDate = new Date(r.punch_in);
                        const hours = punchInDate.getHours();
                        const minutes = punchInDate.getMinutes();
                        const isLate = (hours > 9) || (hours === 9 && minutes > 30);

                        return (
                          <tr key={r.id} className="hover:bg-very-light-green/30 text-secondary-text transition-colors">
                            {user?.role === 'Admin' && (
                              <>
                                <td className="px-5 py-4 font-bold text-primary-text">{r.user_name}</td>
                                <td className="px-5 py-4">
                                  <span className="text-[10px] text-primary-green font-bold uppercase tracking-wider bg-very-light-green border border-light-green/45 px-2 py-0.5 rounded">
                                    {r.user_role}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="px-5 py-4 font-bold text-secondary-text">{dateStr}</td>
                            <td className="px-5 py-4 text-primary-green font-semibold">{inTime}</td>
                            <td className="px-5 py-4 text-secondary-text/85">{outTime}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    r.status === 'active' || !r.punch_out
                                      ? 'bg-very-light-green text-primary-green border border-light-green'
                                      : 'bg-secondary-bg text-secondary-text border border-border-gray'
                                  }`}>
                                    {r.status === 'active' || !r.punch_out ? 'Active' : 'Completed'}
                                  </span>
                                  {isLate && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-alert-bg text-alert-text border border-alert-border">
                                      Late
                                    </span>
                                  )}
                                </div>
                                {r.close_reason === 'session_recovery' && (
                                  <span className="text-[9px] text-alert-text font-semibold leading-none">Auto-recovered</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-secondary-text font-medium max-w-[150px] truncate" title={r.device_info}>
                              <span className="flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5 text-secondary-text/60" />
                                {r.device_info || 'Unknown Client'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center text-primary-green">
                              {r.gps_latitude && r.gps_longitude ? (
                                <span className="inline-flex items-center gap-1 bg-very-light-green px-2 py-0.5 rounded border border-light-green/40">
                                  <MapPin className="h-3 w-3" />
                                  Synced
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-5 py-4 text-right font-bold text-primary-text">{durationStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View (< md screen size) */}
                <div className="block md:hidden divide-y divide-border-gray">
                  {records.map((r) => {
                    const dateStr = new Date(r.date).toLocaleDateString('en-IN', {
                      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                    });
                    
                    const inTime = new Date(r.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const outTime = r.punch_out 
                      ? new Date(r.punch_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
                      : 'Active Session';
                    
                    const durationStr = r.duration_minutes !== null && r.duration_minutes !== undefined
                      ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                      : '-';

                    const punchInDate = new Date(r.punch_in);
                    const hours = punchInDate.getHours();
                    const minutes = punchInDate.getMinutes();
                    const isLate = (hours > 9) || (hours === 9 && minutes > 30);

                    return (
                      <div key={r.id} className="p-4 space-y-3 hover:bg-very-light-green/10 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            {user?.role === 'Admin' ? (
                              <h4 className="font-bold text-primary-text text-sm leading-tight">{r.user_name}</h4>
                            ) : (
                              <h4 className="font-bold text-primary-text text-sm leading-tight">{dateStr}</h4>
                            )}
                            {user?.role === 'Admin' && (
                              <p className="text-[10px] text-secondary-text mt-0.5">{dateStr}</p>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              r.status === 'active' || !r.punch_out
                                ? 'bg-very-light-green text-primary-green border border-light-green'
                                : 'bg-secondary-bg text-secondary-text border border-border-gray'
                            }`}>
                              {r.status === 'active' || !r.punch_out ? 'Active' : 'Completed'}
                            </span>
                            {isLate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-alert-bg text-alert-text border border-alert-border">
                                Late
                              </span>
                            )}
                          </div>
                        </div>

                        {user?.role === 'Admin' && (
                          <div className="text-[10px] flex items-center gap-1.5">
                            <span className="text-secondary-text font-semibold uppercase">Role:</span>
                            <span className="text-primary-green font-bold uppercase text-[9px] bg-very-light-green border border-light-green/45 px-2 py-0.5 rounded">
                              {r.user_role}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 bg-secondary-bg border border-border-gray p-3 rounded-xl text-xs">
                          <div>
                            <span className="text-secondary-text block text-[9px] font-bold uppercase tracking-wider">Login Time</span>
                            <span className="text-primary-green font-bold">{inTime}</span>
                          </div>
                          <div>
                            <span className="text-secondary-text block text-[9px] font-bold uppercase tracking-wider">Logout Time</span>
                            <span className="text-secondary-text font-semibold">{outTime}</span>
                          </div>
                          <div>
                            <span className="text-secondary-text block text-[9px] font-bold uppercase tracking-wider">Session Time</span>
                            <span className="text-primary-text font-bold font-mono">{durationStr}</span>
                          </div>
                          <div>
                            <span className="text-secondary-text block text-[9px] font-bold uppercase tracking-wider">GPS Coordinates</span>
                            <span className="text-secondary-text font-medium">
                              {r.gps_latitude && r.gps_longitude ? '📍 Geotagged' : 'No Geotag'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[9px] text-secondary-text truncate" title={r.device_info}>
                          <Monitor className="h-3.5 w-3.5 text-secondary-text/60 shrink-0" />
                          <span className="truncate">{r.device_info || 'Unknown Client'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-border-gray bg-secondary-bg flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <span className="text-secondary-text text-center sm:text-left">
                Showing <span className="font-bold text-primary-text">{Math.min(total, (page - 1) * limit + 1)}-{Math.min(total, page * limit)}</span> of <span className="font-bold text-primary-text">{total}</span> records
              </span>
              <div className="flex items-center gap-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white hover:bg-secondary-bg border border-border-gray text-secondary-text rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-secondary-text select-none">
                  Page <span className="font-bold text-primary-text">{page}</span> of <span className="font-bold text-primary-text">{totalPages}</span>
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-white hover:bg-secondary-bg border border-border-gray text-secondary-text rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
