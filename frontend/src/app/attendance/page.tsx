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
import { SelectField } from '../../components/SelectField';
import { ReportFilterPanel } from '../../components/ReportFilterPanel';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

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
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterLateOnly, setFilterLateOnly] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [hospitals, setHospitals] = useState<any[]>([]);

  // Load hospitals on mount
  useEffect(() => {
    if (!user) return;
    const fetchHospitals = async () => {
      try {
        const res = await api.hospitals.getAll();
        setHospitals(res.hospitals || []);
      } catch (err) {
        console.error('Failed to load hospitals list:', err);
      }
    };
    fetchHospitals();
  }, [user]);

  // Aggregated counts from backend
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);

  // Trigger fetch when parameters or page changes
  useEffect(() => {
    if (!user) return;
    fetchAttendance(false);
  }, [page, search, filterRole, filterStatus, selectedHospitalFilter, filterStartDate, filterEndDate, filterLateOnly, isPunchedIn, user]);

  // Real-time silent refresh every 10 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchAttendance(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [page, search, filterRole, filterStatus, selectedHospitalFilter, filterStartDate, filterEndDate, filterLateOnly, isPunchedIn, user]);

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
        hospital_id: selectedHospitalFilter === 'All' ? undefined : selectedHospitalFilter,
        startDate: filterStartDate,
        endDate: filterEndDate,
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

  const handleDownloadPDF = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.getAttendance({
        search: user?.role === 'Admin' ? search : undefined,
        role: user?.role === 'Admin' ? filterRole : undefined,
        status: user?.role === 'Admin' ? filterStatus : undefined,
        hospital_id: selectedHospitalFilter === 'All' ? undefined : selectedHospitalFilter,
        startDate: filterStartDate,
        endDate: filterEndDate,
        lateOnly: user?.role === 'Admin' ? filterLateOnly : undefined,
        page: 1,
        limit: 100000
      });
      const attendanceList = res.records || [];

      const headers = ['Employee Name', 'Employee ID', 'Check-In Time', 'Check-Out Time', 'Attendance Status', 'Date'];
      const body = attendanceList.map((r: any) => {
        const inTime = new Date(r.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const outTime = r.punch_out 
          ? new Date(r.punch_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
          : 'Active Session';
        const dateStr = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        
        return [
          r.user_name,
          r.user_id,
          inTime,
          outTime,
          r.status === 'active' || !r.punch_out ? 'Active' : 'Completed',
          dateStr
        ];
      });

      const hospitalName = selectedHospitalFilter === 'All' 
        ? 'All Hospitals' 
        : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

      const formattedStartDate = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      const formattedEndDate = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

      exportToPDF(
        headers,
        body,
        'Attendance Timesheet Report',
        `Hospital: ${hospitalName} | Date Range: ${formattedStartDate} to ${formattedEndDate} | Search Query: "${search || 'None'}" | Total Records: ${attendanceList.length}`,
        `attendance_report_${filterStartDate || 'all'}_to_${filterEndDate || 'all'}`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.getAttendance({
        search: user?.role === 'Admin' ? search : undefined,
        role: user?.role === 'Admin' ? filterRole : undefined,
        status: user?.role === 'Admin' ? filterStatus : undefined,
        hospital_id: selectedHospitalFilter === 'All' ? undefined : selectedHospitalFilter,
        startDate: filterStartDate,
        endDate: filterEndDate,
        lateOnly: user?.role === 'Admin' ? filterLateOnly : undefined,
        page: 1,
        limit: 100000
      });
      const attendanceList = res.records || [];

      const data = attendanceList.map((r: any) => {
        const inTime = new Date(r.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const outTime = r.punch_out 
          ? new Date(r.punch_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
          : 'Active Session';
        
        return {
          'Employee Name': r.user_name,
          'Employee ID': r.user_id,
          'Check-In Time': inTime,
          'Check-Out Time': outTime,
          'Attendance Status': r.status === 'active' || !r.punch_out ? 'Active' : 'Completed',
          'Date': r.date
        };
      });

      const hospitalName = selectedHospitalFilter === 'All' 
        ? 'All Hospitals' 
        : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

      const formattedStartDate = filterStartDate ? new Date(filterStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      const formattedEndDate = filterEndDate ? new Date(filterEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

      exportToExcel(
        data, 
        `attendance_report_${filterStartDate || 'all'}_to_${filterEndDate || 'all'}`,
        {
          title: 'Attendance Timesheet Report',
          filters: {
            'Selected Hospital': hospitalName,
            'Start Date': formattedStartDate,
            'End Date': formattedEndDate,
            'Search Query': search || 'None'
          }
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate Excel report.');
    } finally {
      setLoading(false);
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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              {user?.role === 'Admin' ? 'Global Shift Activity Monitor' : 'Work Shift Attendance Logs'}
              <Clock className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
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
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/50 text-xs text-slate-500 flex items-center gap-2">
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Shift Logs (Org)</p>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-500 mt-0.5">{total}</h3>
                </div>
              </div>

              {/* Admin Card 2: Active Sessions */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group shadow-sm">
                <div className="p-3 bg-very-light-green text-primary-green rounded-xl border border-light-green/40">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live Active Sessions</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Late Logins (Total)</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Shifts Logged</p>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-500 mt-0.5">{personalTotalShifts}</h3>
                </div>
              </div>

              {/* Personal Card 2 */}
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group shadow-sm">
                <div className="p-3 bg-very-light-green text-primary-green rounded-xl border border-light-green/40">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Work Duration</p>
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
                      : 'bg-secondary-bg text-slate-500 border-border-gray'
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
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Live Session Time</p>
                    <p className="text-base sm:text-lg font-mono font-bold text-slate-500 mt-0.5">
                      {isPunchedIn ? formatElapsed(elapsedSeconds) : '00:00:00'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Login Timestamp</p>
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
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
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
                    setSelectedHospitalFilter('All');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterLateOnly(false);
                    setPage(1);
                  }}
                  className="text-[10px] text-slate-500 hover:text-primary-green font-bold hover:underline transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
            
            <div className={`${showFiltersMobile ? 'flex' : 'hidden sm:flex'} flex-col gap-3`}>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Employee</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Name, email, or user ID..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 pl-8 pr-3 text-xs text-slate-500 outline-none placeholder-slate-400 transition-all"
                    />
                  </div>
                </div>

                <div className="w-full md:w-64 font-medium">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Hospital</label>
                  <SelectField
                    id="hospital-filter"
                    value={selectedHospitalFilter}
                    onChange={(value) => { setSelectedHospitalFilter(value); setPage(1); }}
                    triggerClassName="py-2 text-xs text-slate-500"
                    options={[
                      { value: 'All', label: 'All Hospitals' },
                      ...hospitals.map((h) => ({ value: String(h.id), label: h.name }))
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Role Select */}
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role Permission</label>
                  <SelectField
                    value={filterRole}
                    onChange={(value) => { setFilterRole(value); setPage(1); }}
                    triggerClassName="py-2 text-xs text-slate-500"
                    options={[
                      { value: '', label: 'All Roles' },
                      { value: 'Admin', label: 'Admin' },
                      { value: 'Dental Doctor', label: 'Dental Doctor' },
                      { value: 'Doctor', label: 'Doctor' },
                      { value: 'Reception', label: 'Reception' },
                      { value: 'Telecaller', label: 'Telecaller' },
                      { value: 'Executive', label: 'Executive' },
                    ]}
                  />
                </div>

                {/* Status Select */}
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session Status</label>
                  <SelectField
                    value={filterStatus}
                    onChange={(value) => { setFilterStatus(value); setPage(1); }}
                    triggerClassName="py-2 text-xs text-slate-500"
                    options={[
                      { value: '', label: 'All Statuses' },
                      { value: 'active', label: 'Active/Online' },
                      { value: 'completed', label: 'Completed' },
                    ]}
                  />
                </div>
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
              <label htmlFor="filter-late-only" className="text-xs font-semibold text-slate-500 select-none cursor-pointer flex items-center gap-1.5">
                Show Late Logins Only
                <span className="text-[9px] px-1.5 py-0.5 bg-alert-bg text-alert-text border border-alert-border rounded font-bold uppercase tracking-wider">
                  After 9:30 AM
                </span>
              </label>
            </div>
          </div>
        )}

        <ReportFilterPanel
          onGenerate={(start, end) => {
            setFilterStartDate(start);
            setFilterEndDate(end);
            setPage(1);
          }}
          onReset={() => {
            setSearch('');
            setFilterRole('');
            setFilterStatus('');
            setSelectedHospitalFilter('All');
            setFilterStartDate('');
            setFilterEndDate('');
            setFilterLateOnly(false);
            setPage(1);
          }}
          isLoading={loading}
          totalRecords={total}
          activeStartDate={filterStartDate}
          activeEndDate={filterEndDate}
          onDownloadPDF={handleDownloadPDF}
          onDownloadExcel={handleDownloadExcel}
        />

        {/* Shifts Table */}
        <div className="bg-white border border-border-gray rounded-xl overflow-hidden min-h-[300px] flex flex-col justify-between shadow-sm">
          <div>
            <div className="px-6 py-4 border-b border-border-gray bg-secondary-bg">
              <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">
                {user?.role === 'Admin' ? 'Organization Work Shift Logs' : 'Monthly Shift Timesheet'}
              </h3>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : records.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                {filterStartDate && filterEndDate 
                  ? 'No records found for the selected date range.' 
                  : 'No shift logs found. Attendance is automatically tracked on login.'}
              </div>
            ) : (
              <>
                {/* Desktop/Tablet Table View (>= md screen size) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary-bg text-slate-500 font-semibold border-b border-border-gray uppercase text-[9px] tracking-wider">
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
                          <tr key={r.id} className="hover:bg-very-light-green/30 text-slate-500 transition-colors">
                            {user?.role === 'Admin' && (
                              <>
                                <td className="px-5 py-4 font-bold text-slate-500">{r.user_name}</td>
                                <td className="px-5 py-4">
                                  <span className="text-[10px] text-primary-green font-bold uppercase tracking-wider bg-very-light-green border border-light-green/45 px-2 py-0.5 rounded">
                                    {r.user_role}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="px-5 py-4 font-bold text-slate-500">{dateStr}</td>
                            <td className="px-5 py-4 text-primary-green font-semibold">{inTime}</td>
                            <td className="px-5 py-4 text-slate-500">{outTime}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    r.status === 'active' || !r.punch_out
                                      ? 'bg-very-light-green text-primary-green border border-light-green'
                                      : 'bg-secondary-bg text-slate-500 border border-border-gray'
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
                            <td className="px-5 py-4 text-slate-500 font-medium max-w-[150px] truncate" title={r.device_info}>
                              <span className="flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5 text-slate-500" />
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
                            <td className="px-5 py-4 text-right font-bold text-slate-500">{durationStr}</td>
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
                              <h4 className="font-bold text-slate-500 text-sm leading-tight">{r.user_name}</h4>
                            ) : (
                              <h4 className="font-bold text-slate-500 text-sm leading-tight">{dateStr}</h4>
                            )}
                            {user?.role === 'Admin' && (
                              <p className="text-[10px] text-slate-500 mt-0.5">{dateStr}</p>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              r.status === 'active' || !r.punch_out
                                ? 'bg-very-light-green text-primary-green border border-light-green'
                                : 'bg-secondary-bg text-slate-500 border border-border-gray'
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
                            <span className="text-slate-500 font-semibold uppercase">Role:</span>
                            <span className="text-primary-green font-bold uppercase text-[9px] bg-very-light-green border border-light-green/45 px-2 py-0.5 rounded">
                              {r.user_role}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 bg-secondary-bg border border-border-gray p-3 rounded-xl text-xs">
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Login Time</span>
                            <span className="text-primary-green font-bold">{inTime}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Logout Time</span>
                            <span className="text-slate-500 font-semibold">{outTime}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Session Time</span>
                            <span className="text-slate-500 font-bold font-mono">{durationStr}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">GPS Coordinates</span>
                            <span className="text-slate-500 font-medium">
                              {r.gps_latitude && r.gps_longitude ? '📍 Geotagged' : 'No Geotag'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 truncate" title={r.device_info}>
                          <Monitor className="h-3.5 w-3.5 text-slate-500 shrink-0" />
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
              <span className="text-slate-500 text-center sm:text-left">
                Showing <span className="font-bold text-slate-500">{Math.min(total, (page - 1) * limit + 1)}-{Math.min(total, page * limit)}</span> of <span className="font-bold text-slate-500">{total}</span> records
              </span>
              <div className="flex items-center gap-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white hover:bg-secondary-bg border border-border-gray text-slate-500 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-slate-500 select-none">
                  Page <span className="font-bold text-slate-500">{page}</span> of <span className="font-bold text-slate-500">{totalPages}</span>
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-white hover:bg-secondary-bg border border-border-gray text-slate-500 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer"
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
