'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Calendar, CreditCard, Building2, MapPin, 
  ArrowRight, Users, PlusCircle, Activity, TrendingUp,
  Map, Sparkles, UserCheck, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const statsRes = await api.dashboard.getStats();
        setStats(statsRes.stats);
        setActivities(statsRes.recentActivities || []);
        
        try {
          const chartsRes = await api.dashboard.getCharts();
          setCharts(chartsRes);
        } catch (err) {
          console.error("Failed to load chart trends, using default visual mock:", err);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load system dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-400">Aggregating real-time foundation analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Fallback charts if DB has no records yet
  const mockAppointmentsTrend = charts?.appointmentsTrend?.length 
    ? charts.appointmentsTrend 
    : [
        { date: 'Mon', appointments: 4 },
        { date: 'Tue', appointments: 7 },
        { date: 'Wed', appointments: 5 },
        { date: 'Thu', appointments: 12 },
        { date: 'Fri', appointments: 9 },
        { date: 'Sat', appointments: 15 },
        { date: 'Sun', appointments: 6 }
      ];

  const mockRevenueTrend = charts?.revenueTrend?.length
    ? charts.revenueTrend
    : [
        { date: 'Mon', revenue: 12000 },
        { date: 'Tue', revenue: 18500 },
        { date: 'Wed', revenue: 9000 },
        { date: 'Thu', revenue: 25000 },
        { date: 'Fri', revenue: 14000 },
        { date: 'Sat', revenue: 32000 },
        { date: 'Sun', revenue: 19000 }
      ];

  const mockVisitsTrend = charts?.visitsTrend?.length
    ? charts.visitsTrend
    : [
        { date: 'Mon', visits: 3 },
        { date: 'Tue', visits: 5 },
        { date: 'Wed', visits: 4 },
        { date: 'Thu', visits: 8 },
        { date: 'Fri', visits: 6 },
        { date: 'Sat', visits: 10 },
        { date: 'Sun', visits: 4 }
      ];

  // Helper to draw SVG charts
  const maxAppointments = Math.max(...mockAppointmentsTrend.map((d: any) => d.appointments || 0), 10);
  const maxRevenue = Math.max(...mockRevenueTrend.map((d: any) => d.revenue || 0), 10000);
  const maxVisits = Math.max(...mockVisitsTrend.map((d: any) => d.visits || 0), 10);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">{user?.name}</span>
              <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Here is your overview of the Venkateswara Vascular Foundation operations network.
            </p>
          </div>
          
          {/* Action pill/shortcuts based on user roles */}
          <div className="flex flex-wrap gap-2.5">
            {['Admin', 'Reception', 'Chief Doctor'].includes(user?.role || '') && (
              <Link 
                id="quick-add-appointment"
                href="/appointments?new=true"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all shadow-md shadow-cyan-950/20"
              >
                <PlusCircle className="h-4 w-4" />
                New Appointment
              </Link>
            )}
            {['Admin', 'Executive'].includes(user?.role || '') && (
              <Link 
                id="quick-start-visit"
                href="/visits"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-cyan-300 bg-slate-900 hover:bg-slate-800 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl transition-all"
              >
                <MapPin className="h-4 w-4 text-cyan-400" />
                File Visit
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* 4 Core Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1 */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 transition-all duration-300 hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-950/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-300" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Appointments</p>
                <h3 className="text-2xl font-bold text-slate-100 mt-2">{stats?.totalAppointments || 0}</h3>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{stats?.todayAppointments || 0} Scheduled Today</span>
                </div>
              </div>
              <div className="p-3 bg-cyan-950/60 rounded-xl border border-cyan-800/30 text-cyan-400">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 transition-all duration-300 hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-950/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-all duration-300" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Field Exec Visits</p>
                <h3 className="text-2xl font-bold text-slate-100 mt-2">{stats?.totalVisits || 0}</h3>
                <div className="flex items-center gap-1 text-[10px] text-cyan-400 mt-1">
                  <Activity className="h-3 w-3 animate-pulse" />
                  <span>{stats?.activeExecutives || 0} Currently In Progress</span>
                </div>
              </div>
              <div className="p-3 bg-blue-950/60 rounded-xl border border-blue-800/30 text-blue-400">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-950/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Revenue Realized</p>
                <h3 className="text-2xl font-bold text-slate-100 mt-2">{formatCurrency(stats?.revenue || 0)}</h3>
                <p className="text-[10px] text-slate-400 mt-1">Cash & Digital Receipts</p>
              </div>
              <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-800/30 text-emerald-400">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 transition-all duration-300 hover:border-rose-500/30 hover:shadow-xl hover:shadow-rose-950/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/10 transition-all duration-300" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Outstandings</p>
                <h3 className="text-2xl font-bold text-slate-100 mt-2">{formatCurrency(stats?.pendingPayments || 0)}</h3>
                <p className="text-[10px] text-slate-400 mt-1">Due from Partial Payments</p>
              </div>
              <div className="p-3 bg-rose-950/60 rounded-xl border border-rose-800/30 text-rose-400">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Visualization Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SVG Appointment Line Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Appointment Trends</h3>
                <p className="text-[10px] text-slate-400">Weekly patient visits frequency</p>
              </div>
              <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-1 rounded text-cyan-400 font-bold uppercase">7 Days</span>
            </div>
            
            <div className="relative h-44 w-full flex items-end">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1" />
                <line x1="0" y1="80" x2="100" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1" />

                {/* Trend line */}
                <path
                  d={`M ${mockAppointmentsTrend.map((d: any, idx: number) => {
                    const x = (idx / (mockAppointmentsTrend.length - 1)) * 100;
                    const y = 90 - ((d.appointments || 0) / maxAppointments) * 75;
                    return `${x} ${y}`;
                  }).join(' L ')}`}
                  fill="none"
                  stroke="url(#cyan-gradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Points */}
                {mockAppointmentsTrend.map((d: any, idx: number) => {
                  const x = (idx / (mockAppointmentsTrend.length - 1)) * 100;
                  const y = 90 - ((d.appointments || 0) / maxAppointments) * 75;
                  return (
                    <circle key={idx} cx={x} cy={y} r="2" fill="#22d3ee" className="cursor-pointer hover:r-3 transition-all" />
                  );
                })}

                {/* Definitions */}
                <defs>
                  <linearGradient id="cyan-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0891b2" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            {/* Legend Labels */}
            <div className="flex justify-between items-center mt-4 border-t border-slate-800/60 pt-3">
              {mockAppointmentsTrend.map((d: any, idx: number) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-semibold">{d.date}</span>
                  <span className="text-[11px] text-slate-300 font-bold mt-0.5">{d.appointments || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SVG Revenue Bar Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Revenue Collections</h3>
                <p className="text-[10px] text-slate-400">Digital and Cash receipts realization</p>
              </div>
              <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-1 rounded text-emerald-400 font-bold uppercase">₹ INR</span>
            </div>

            <div className="h-44 flex items-end justify-between gap-2.5 px-2">
              {mockRevenueTrend.map((d: any, idx: number) => {
                const heightPct = ((d.revenue || 0) / maxRevenue) * 90;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                    <span className="text-[8px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold mb-1">
                      {Math.round(d.revenue / 1000)}k
                    </span>
                    <div 
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                      className="w-full bg-gradient-to-t from-emerald-600 to-cyan-500 rounded-t-lg group-hover:from-emerald-500 group-hover:to-cyan-400 transition-all duration-300 relative shadow-md shadow-emerald-950/20"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold mt-2.5">{d.date}</span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center items-center gap-4 mt-4 border-t border-slate-800/60 pt-3 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded bg-emerald-500" />
                <span>Cleared Payments</span>
              </div>
            </div>
          </div>

          {/* SVG Field visits Activity Area Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Executive Activity</h3>
                <p className="text-[10px] text-slate-400">Field visits logging volume</p>
              </div>
              <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-1 rounded text-blue-400 font-bold uppercase">Visits</span>
            </div>

            <div className="relative h-44 w-full flex items-end">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Area under curve */}
                <path
                  d={`M 0 100 L ${mockVisitsTrend.map((d: any, idx: number) => {
                    const x = (idx / (mockVisitsTrend.length - 1)) * 100;
                    const y = 90 - ((d.visits || 0) / maxVisits) * 75;
                    return `${x} ${y}`;
                  }).join(' L ')} L 100 100 Z`}
                  fill="url(#blue-area-gradient)"
                  opacity="0.15"
                />

                {/* Line */}
                <path
                  d={`M ${mockVisitsTrend.map((d: any, idx: number) => {
                    const x = (idx / (mockVisitsTrend.length - 1)) * 100;
                    const y = 90 - ((d.visits || 0) / maxVisits) * 75;
                    return `${x} ${y}`;
                  }).join(' L ')}`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                <defs>
                  <linearGradient id="blue-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="flex justify-between items-center mt-4 border-t border-slate-800/60 pt-3">
              {mockVisitsTrend.map((d: any, idx: number) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-semibold">{d.date}</span>
                  <span className="text-[11px] text-slate-300 font-bold mt-0.5">{d.visits || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map & Audit Log Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Executive Live Tracker (Mock Maps SVG) */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Map className="h-4.5 w-4.5 text-cyan-400" />
                  Executive GPS Map
                </h3>
                <p className="text-[10px] text-slate-400">Live coordinates log tracker</p>
              </div>
            </div>

            {/* Interactive SVG Tracking Map */}
            <div className="flex-1 bg-slate-950 rounded-xl relative overflow-hidden border border-slate-800/60 flex items-center justify-center p-4">
              {/* Map background grids */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_14px]" />
              
              {/* Central Map Contours */}
              <svg className="w-full h-full text-slate-800/60 stroke-current stroke-1 select-none pointer-events-none absolute inset-0 p-4" viewBox="0 0 100 100">
                <path d="M10,20 Q30,10 50,25 T90,15 T95,60 T40,80 Z" fill="none" strokeWidth="0.5" strokeDasharray="2" />
                <path d="M15,40 Q40,65 60,40 T85,70" fill="none" strokeWidth="0.5" strokeDasharray="1" />
              </svg>

              {/* Ping 1: Completed Visit */}
              <div className="absolute top-[25%] left-[30%] group">
                <span className="absolute inline-flex h-4 w-4 rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-950 shadow-md cursor-pointer" />
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[9px] text-slate-200 px-2 py-1.5 rounded-lg shadow-xl w-32 pointer-events-none z-10">
                  <p className="font-bold text-emerald-400 uppercase tracking-wide">Apex Heart Care</p>
                  <p className="text-slate-400">Visit Completed & Verified</p>
                  <p className="text-slate-500 mt-0.5 text-[8px]">Lat: 17.385, Lng: 78.486</p>
                </div>
              </div>

              {/* Ping 2: Active Visit */}
              <div className="absolute bottom-[35%] right-[25%] group">
                <span className="absolute inline-flex h-4 w-4 rounded-full bg-cyan-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 border-2 border-slate-950 shadow-md cursor-pointer" />
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[9px] text-slate-200 px-2 py-1.5 rounded-lg shadow-xl w-32 pointer-events-none z-10">
                  <p className="font-bold text-cyan-400 uppercase tracking-wide">Surya Hospital</p>
                  <p className="text-slate-400">Visit: In Progress</p>
                  <p className="text-slate-500 mt-0.5 text-[8px]">Lat: 17.402, Lng: 78.511</p>
                </div>
              </div>

              {/* Pin 3: Pending Visit */}
              <div className="absolute top-[60%] left-[20%] group">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-slate-950 shadow-md cursor-pointer" />
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-[9px] text-slate-200 px-2 py-1.5 rounded-lg shadow-xl w-32 pointer-events-none z-10">
                  <p className="font-bold text-amber-400 uppercase tracking-wide">Fortis City Clinic</p>
                  <p className="text-slate-400">Visit: Pending Start</p>
                </div>
              </div>

              <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-lg backdrop-blur-md flex items-center justify-between text-[9px] text-slate-400">
                <span>VVF GPS Grid Tracking Active</span>
                <span className="text-cyan-400 font-bold uppercase animate-pulse">Online</span>
              </div>
            </div>
          </div>

          {/* Centralized Activity / Audit Logs */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Live Organization Audit Logs</h3>
                <p className="text-[10px] text-slate-400">Real-time log of security events and mutations</p>
              </div>
              <span className="text-[10px] text-slate-400">Auto-refreshing</span>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800/60 rounded-xl divide-y divide-slate-800 bg-slate-950/40">
              {activities.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  No organization events recorded yet.
                </div>
              ) : (
                activities.map((act) => {
                  const dateStr = new Date(act.created_at).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  });
                  return (
                    <div key={act.id} className="p-3.5 text-xs transition-colors hover:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 mt-0.5 shrink-0">
                          <Activity className="h-3.5 w-3.5 text-cyan-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">
                            {act.description || `${act.action_type} on ${act.entity_type} #${act.entity_id}`}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Performed by: <span className="text-slate-300 font-bold">{act.user_name || 'System'}</span> ({act.user_role || 'API'})
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-500 font-medium shrink-0 self-end sm:self-center">
                        {dateStr}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
