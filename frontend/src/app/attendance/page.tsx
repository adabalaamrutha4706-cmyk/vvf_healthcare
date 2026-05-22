'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Clock, Calendar, Monitor, MapPin, 
  TrendingUp, ShieldAlert, CheckCircle
} from 'lucide-react';

export default function AttendancePage() {
  const { isPunchedIn, activePunchRecord } = useAuth();
  
  // Lists
  const [records, setRecords] = useState<any[]>([]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    fetchAttendance();
  }, [isPunchedIn]);

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

  const fetchAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.getAttendance();
      setRecords(res.records || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch attendance logs.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalShifts = records.length;
  const totalMinutes = records.reduce((acc, r) => acc + (r.duration_minutes || 0), 0);
  const totalHoursStr = (totalMinutes / 60).toFixed(1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Work Shift Attendance Logs
              <Clock className="h-5 w-5 text-cyan-400" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Verify punched shifts, monitor active work sessions, and record duration.
            </p>
          </div>
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

        {/* 3 Work shifts Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group">
            <div className="p-3 bg-cyan-950/60 text-cyan-400 rounded-xl border border-cyan-800/30">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Shifts Logged</p>
              <h3 className="text-xl font-bold text-slate-100 mt-0.5">{totalShifts}</h3>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group">
            <div className="p-3 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-800/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Work Duration</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-0.5">{totalHoursStr} Hours</h3>
            </div>
          </div>

          {/* Card 3: Session Status & Live Duration */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-3 min-h-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] bg-slate-950 border border-slate-800 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Shift status
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isPunchedIn 
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30' 
                  : 'bg-slate-950/50 text-slate-400 border-slate-850'
              }`}>
                {isPunchedIn ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-ping" />
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
                <p className="text-lg font-mono font-bold text-slate-100 mt-0.5">
                  {isPunchedIn ? formatElapsed(elapsedSeconds) : '00:00:00'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Login Timestamp</p>
                <p className="text-xs font-bold text-cyan-400 mt-1">
                  {isPunchedIn && activePunchRecord?.punch_in
                    ? new Date(activePunchRecord.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shifts Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden min-h-[300px]">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80">
            <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Monthly Shift Timesheet</h3>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-slate-500">
              No shift logs found. Attendance is automatically tracked on login.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-850 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Shift Date</th>
                    <th className="px-5 py-3.5">Login Time</th>
                    <th className="px-5 py-3.5">Logout Time</th>
                    <th className="px-5 py-3.5">Session Status</th>
                    <th className="px-5 py-3.5">Device Agent</th>
                    <th className="px-5 py-3.5 text-center">GPS Geotag</th>
                    <th className="px-5 py-3.5 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {records.map((r) => {
                    const dateStr = new Date(r.date).toLocaleDateString('en-IN', {
                      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                    });
                    const inTime = new Date(r.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const outTime = r.punch_out 
                      ? new Date(r.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : 'Active Session';
                    
                    const durationStr = r.duration_minutes !== null && r.duration_minutes !== undefined
                      ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                      : '-';

                    return (
                      <tr key={r.id} className="hover:bg-slate-850/20 text-slate-300">
                        <td className="px-5 py-4 font-bold text-slate-200">{dateStr}</td>
                        <td className="px-5 py-4 text-emerald-450 font-semibold">{inTime}</td>
                        <td className="px-5 py-4 text-slate-400">{outTime}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              r.status === 'active' || !r.punch_out
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-950/40 text-slate-450 border border-slate-800'
                            }`}>
                              {r.status === 'active' || !r.punch_out ? 'Active' : 'Completed'}
                            </span>
                            {r.close_reason === 'session_recovery' && (
                              <span className="text-[9px] text-amber-500 font-semibold leading-none">Auto-recovered</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-medium max-w-[150px] truncate" title={r.device_info}>
                          <span className="flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5" />
                            {r.device_info || 'Unknown Client'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-cyan-400">
                          {r.gps_latitude && r.gps_longitude ? (
                            <span className="inline-flex items-center gap-1 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/20">
                              <MapPin className="h-3 w-3" />
                              Synced
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-200">{durationStr}</td>
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
