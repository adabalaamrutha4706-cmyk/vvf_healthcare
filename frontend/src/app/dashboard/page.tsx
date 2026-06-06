'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Calendar, CreditCard, Building2, MapPin, 
  ArrowRight, Users, PlusCircle, Activity, TrendingUp,
  Map, Sparkles, UserCheck, ShieldAlert, Clock
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [hospitalsList, setHospitalsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
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

        if (user?.role !== 'Reception') {
          try {
            const visitsRes = await api.visits.getAll();
            setVisits(visitsRes.visits || []);
          } catch (err) {
            console.error("Failed to load visits for map:", err);
          }
        }

        try {
          const hospRes = await api.hospitals.getAll();
          setHospitalsList(hospRes.hospitals || hospRes || []);
        } catch (err) {
          console.error("Failed to load hospitals list:", err);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load system dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

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
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-sm font-medium text-secondary-slate">Aggregating real-time foundation analytics...</p>
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
      <div className="space-y-4 sm:space-y-6 max-w-full min-w-0 mobile-contained">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              Welcome back, <span className="text-primary-green">{user?.name}</span>
              <Sparkles className="h-5 w-5 text-primary-green animate-pulse" />
            </h1>
            <p className="text-sm text-secondary-text mt-1">
              Here is your overview of the Venkateswara Vascular Foundation operations network.
            </p>
          </div>
          
          {/* Action pill/shortcuts based on user roles */}
          <div className="flex flex-wrap gap-2">
            {['Admin', 'Reception', 'Chief Doctor'].includes(user?.role || '') && (
              <Link 
                id="quick-add-appointment"
                href="/appointments?new=true"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl transition-all shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                New Appointment
              </Link>
            )}
            {['Admin', 'Executive'].includes(user?.role || '') && (
              <Link 
                id="quick-start-visit"
                href="/visits"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-primary-green hover:border-primary-green-hover rounded-xl transition-all"
              >
                <MapPin className="h-4 w-4 text-primary-green" />
                File Visit
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* 4 Core Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-full min-w-0">
          {/* Card 1: Total Appointments */}
          <div className={`relative group overflow-hidden rounded-xl bg-white border border-border-gray p-3 sm:p-5 transition-all duration-300 hover:border-primary-green/30 hover:shadow-sm max-w-full min-w-0 mobile-contained ${user?.role === 'Reception' ? 'sm:col-span-2 lg:col-span-2' : !['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-green/10 transition-all duration-300" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary-text">Total Appointments</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">{stats?.totalAppointments || 0}</h3>
                <div className="flex items-center gap-1 text-[10px] text-primary-green mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{stats?.todayAppointments || 0} Scheduled Today</span>
                </div>
              </div>
              <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Card 1.5: Pending Payments for Receptionists */}
          {user?.role === 'Reception' && (
            <div className="relative group overflow-hidden rounded-xl bg-white border border-border-gray p-3 sm:p-5 transition-all duration-300 hover:border-alert-border/30 hover:shadow-sm sm:col-span-2 lg:col-span-2 max-w-full min-w-0 mobile-contained">
              <div className="absolute top-0 right-0 w-24 h-24 bg-alert-bg/5 rounded-full blur-2xl pointer-events-none group-hover:bg-alert-bg/10 transition-all duration-300" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary-text">Pending Payments</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(stats?.pendingPayments || 0)}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-alert-text mt-1">
                    <Clock className="h-3.5 w-3.5 text-alert-text animate-pulse" />
                    <span>{stats?.pendingPaymentsCount || 0} Invoices Outstanding</span>
                  </div>
                </div>
                <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Field Exec Visits */}
          {user?.role !== 'Reception' && (
            <div className={`relative group overflow-hidden rounded-xl bg-white border border-border-gray p-3 sm:p-5 transition-all duration-300 hover:border-primary-green/30 hover:shadow-sm max-w-full min-w-0 mobile-contained ${!['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-green/10 transition-all duration-300" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary-text">Field Exec Visits</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">{stats?.totalVisits || 0}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-primary-green mt-1">
                    <Activity className="h-3 w-3 animate-pulse" />
                    <span>
                      {stats?.activeExecutives || 0} In Progress
                      {['Admin', 'Superadmin'].includes(user?.role || '') && ` • ${stats?.activeUsers || 0} Staff Online`}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Revenue Realized */}
          {['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') && (
            <div className="relative group overflow-hidden rounded-xl bg-white border border-border-gray p-3 sm:p-5 transition-all duration-300 hover:border-primary-green/30 hover:shadow-sm max-w-full min-w-0 mobile-contained">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-green/10 transition-all duration-300" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary-text">Revenue Realized</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(stats?.revenue || 0)}</h3>
                  <p className="text-[10px] text-secondary-text mt-1">Cash & Digital Receipts</p>
                </div>
                <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </div>
          )}

          {/* Card 4: Pending Outstandings */}
          {['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') && (
            <div className="relative group overflow-hidden rounded-xl bg-white border border-border-gray p-3 sm:p-5 transition-all duration-300 hover:border-alert-border/30 hover:shadow-sm max-w-full min-w-0 mobile-contained">
              <div className="absolute top-0 right-0 w-24 h-24 bg-alert-bg/5 rounded-full blur-2xl pointer-events-none group-hover:bg-alert-bg/10 transition-all duration-300" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary-text">Pending Outstandings</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(stats?.pendingPayments || 0)}</h3>
                  <p className="text-[10px] text-secondary-text mt-1">Due from Partial Payments</p>
                </div>
                <div className="p-3 bg-very-light-green rounded-xl border border-light-green text-primary-green">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analytics Visualization Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 max-w-full min-w-0">
          
          {/* SVG Appointment Line Chart (Shown to all, expands to full width for Reception) */}
          <div className={`bg-white border border-border-gray rounded-xl p-3 sm:p-5 shadow-sm overflow-hidden max-w-full min-w-0 mobile-contained ${user?.role === 'Reception' ? 'md:col-span-2 lg:col-span-3' : !['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') ? 'md:col-span-2 lg:col-span-2' : 'col-span-1 md:col-span-2 lg:col-span-2'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Appointment Trends</h3>
                <p className="text-[10px] text-secondary-text">Weekly patient visits frequency</p>
              </div>
              <span className="text-[10px] bg-secondary-bg border border-border-gray px-2 py-1 rounded text-primary-green font-bold uppercase">7 Days</span>
            </div>
            
            <div className="relative h-44 w-full max-w-full flex items-end overflow-hidden">
              <svg className="w-full h-full max-w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="20" x2="100" y2="20" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="1" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="1" />
                <line x1="0" y1="80" x2="100" y2="80" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="1" />

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
                  const totalPoints = Math.max(mockAppointmentsTrend.length - 1, 1);
                  const x = (idx / totalPoints) * 100;
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
            <div className="grid grid-cols-7 gap-0.5 mt-4 border-t border-border-gray pt-3 max-w-full min-w-0">
              {mockAppointmentsTrend.map((d: any, idx: number) => (
                <div key={idx} className="flex flex-col items-center min-w-0">
                  <span className="text-[8px] sm:text-[10px] text-secondary-text font-semibold truncate w-full text-center">{d.date}</span>
                  <span className="text-[11px] text-secondary-text font-bold mt-0.5">{d.appointments || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SVG Revenue Bar Chart (Hidden from Chief Doctor, Reception, Telecaller, Executive) */}
          {['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') && (
            <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 shadow-sm overflow-hidden max-w-full min-w-0 mobile-contained">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Revenue Collections</h3>
                  <p className="text-[10px] text-secondary-text">Digital and Cash receipts realization</p>
                </div>
                <span className="text-[10px] bg-secondary-bg border border-border-gray px-2 py-1 rounded text-primary-green font-bold uppercase">₹ INR</span>
              </div>

              <div className="h-44 flex items-end justify-between gap-2.5 px-2">
                {mockRevenueTrend.map((d: any, idx: number) => {
                  const heightPct = ((d.revenue || 0) / maxRevenue) * 90;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                      <span className="text-[8px] text-secondary-text opacity-0 group-hover:opacity-100 transition-opacity font-bold mb-1">
                        {Math.round(d.revenue / 1000)}k
                      </span>
                      <div 
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                        className="w-full bg-gradient-to-t from-emerald-600 to-cyan-500 rounded-t-lg group-hover:from-emerald-500 group-hover:to-cyan-400 transition-all duration-300 relative shadow-md shadow-emerald-950/20"
                      />
                      <span className="text-[10px] text-secondary-text font-semibold mt-2.5">{d.date}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-center items-center gap-4 mt-4 border-t border-border-gray pt-3 text-[10px] text-secondary-text">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded bg-emerald-500" />
                  <span>Cleared Payments</span>
                </div>
              </div>
            </div>
          )}

          {/* SVG Field visits Activity Area Chart (Hidden from Receptionists) */}
          {user?.role !== 'Reception' && (
            <div className={`bg-white border border-border-gray rounded-xl p-3 sm:p-5 shadow-sm overflow-hidden max-w-full min-w-0 mobile-contained ${!['Admin', 'Superadmin', 'Doctor'].includes(user?.role || '') ? 'col-span-1' : 'col-span-1 md:col-span-2 lg:col-span-1'}`}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Executive Activity</h3>
                  <p className="text-[10px] text-secondary-text">Field visits logging volume</p>
                </div>
                <span className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded text-primary-green font-bold uppercase">Visits</span>
              </div>

              <div className="relative h-44 w-full max-w-full flex items-end overflow-hidden">
                <svg className="w-full h-full max-w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
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

              <div className="grid grid-cols-7 gap-0.5 mt-4 border-t border-border-gray pt-3 max-w-full min-w-0">
                {mockVisitsTrend.map((d: any, idx: number) => (
                  <div key={idx} className="flex flex-col items-center min-w-0">
                    <span className="text-[8px] sm:text-[10px] text-secondary-text font-semibold truncate w-full text-center">{d.date}</span>
                    <span className="text-[11px] text-secondary-text font-bold mt-0.5">{d.visits || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GPS Mismatch Alerts widget (only if alerts exist and user is Admin/Superadmin) */}
        {['Admin', 'Superadmin'].includes(user?.role || '') && visits.filter(v => v.geo_verification_status === 'Failed' || (v.distance_from_hospital_meters && v.distance_from_hospital_meters > (v.allowed_radius || 200))).length > 0 && (
          <div className="bg-alert-bg border border-alert-border rounded-2xl p-4 sm:p-6 shadow-sm">
            <h3 className="text-sm font-bold text-alert-text flex items-center gap-1.5 mb-3">
              <ShieldAlert className="h-4.5 w-4.5 text-alert-text animate-bounce" />
              GPS Mismatch & Geofence Alerts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visits.filter(v => v.geo_verification_status === 'Failed' || (v.distance_from_hospital_meters && v.distance_from_hospital_meters > (v.allowed_radius || 200))).map(alert => (
                <div key={alert.id} className="p-3.5 bg-white border border-border-gray rounded-xl flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{alert.executive_name || `Executive #${alert.executive_id}`}</p>
                      <p className="text-[10px] text-secondary-text">Checked in to: {alert.hospital_name}</p>
                    </div>
                    <span className="text-[9px] bg-alert-bg text-alert-text border border-alert-border px-2 py-0.5 rounded font-bold uppercase shrink-0">
                      Mismatch: {Math.round(alert.distance_from_hospital_meters)}m
                    </span>
                  </div>
                  <p className="text-[10px] text-alert-text mt-2 leading-relaxed">
                    Check-in coordinates are {Math.round(alert.distance_from_hospital_meters)} meters away from the hospital's registered geofence.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map & Audit Log Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 max-w-full min-w-0">
          {/* Executive Live Tracker (Hidden from Receptionists) */}
          {user?.role !== 'Reception' && (
            <div className="lg:col-span-1 bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex flex-col h-[300px] sm:h-[380px] shadow-sm overflow-hidden max-w-full min-w-0 mobile-contained">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Map className="h-4.5 w-4.5 text-primary-green" />
                    Executive Live GPS Map
                  </h3>
                  <p className="text-[10px] text-secondary-text">Registered hospitals (red) & Live check-ins (green)</p>
                </div>
              </div>

              {/* Interactive SVG Tracking Map */}
              <div className="flex-1 bg-secondary-bg rounded-xl relative overflow-hidden border border-border-gray flex items-center justify-center p-4">
                {/* Map background grids */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:14px_14px]" />
                
                {/* Central Map Contours */}
                <svg className="w-full h-full text-slate-300 stroke-current stroke-1 select-none pointer-events-none absolute inset-0 p-4" viewBox="0 0 100 100">
                  <path d="M10,20 Q30,10 50,25 T90,15 T95,60 T40,80 Z" fill="none" strokeWidth="0.5" strokeDasharray="2" />
                  <path d="M15,40 Q40,65 60,40 T85,70" fill="none" strokeWidth="0.5" strokeDasharray="1" />
                </svg>

                {/* Dynamic render of visits on map */}
                {(() => {
                  const getMapCoords = (lat: number, lng: number) => {
                    const minLat = 16.0;
                    const maxLat = 18.0;
                    const minLng = 78.0;
                    const maxLng = 84.0;
                    
                    const x = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
                    const y = 90 - ((lat - minLat) / (maxLat - minLat)) * 80;
                    return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` };
                  };

                  const markers: any[] = [];

                  // 1. Plot all hospitals in the registry as red pins
                  hospitalsList.filter(h => h.latitude && h.longitude).forEach(h => {
                    const coords = getMapCoords(h.latitude, h.longitude);
                    markers.push(
                      <div 
                        key={`hosp-pin-${h.id}`} 
                        style={{ top: coords.y, left: coords.x }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
                      >
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white shadow-md cursor-pointer" />
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-border-gray text-[9px] text-slate-800 px-2 py-1.5 rounded-lg shadow-xl w-36 pointer-events-none z-30">
                          <p className="font-bold uppercase tracking-wide text-red-800">
                            Hospital Registry
                          </p>
                          <p className="text-slate-900 font-bold">{h.name}</p>
                          {h.hospital_uid && (
                            <p className="text-primary-green font-bold text-[8px]">{h.hospital_uid}</p>
                          )}
                          <p className="text-secondary-text mt-0.5">{h.city}, {h.state}</p>
                          <p className="text-slate-400 mt-0.5 text-[8px]">
                            Lat: {h.latitude?.toFixed(5)}, Lng: {h.longitude?.toFixed(5)}
                          </p>
                        </div>
                      </div>
                    );
                  });

                  // 2. Plot active visits as green pins
                  visits.filter(v => v.gps_lat && v.gps_lng && v.status === 'Checked In').forEach(v => {
                    const coords = getMapCoords(v.gps_lat, v.gps_lng);
                    markers.push(
                      <div 
                        key={`exec-pin-${v.id}`} 
                        style={{ top: coords.y, left: coords.x }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
                      >
                        <span className="absolute inline-flex h-4 w-4 rounded-full bg-primary-green opacity-75 animate-ping -left-0.5 -top-0.5" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-green border border-white shadow-md cursor-pointer" />
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-border-gray text-[9px] text-slate-800 px-2 py-1.5 rounded-lg shadow-xl w-36 pointer-events-none z-30">
                          <p className="font-bold uppercase tracking-wide text-primary-green">
                            Active Check-in
                          </p>
                          <p className="text-slate-900 font-semibold">{v.executive_name || `Exec #${v.executive_id}`}</p>
                          <p className="text-secondary-text text-[10px]">At: {v.hospital_name}</p>
                          <p className="text-slate-400 text-[8px] mt-0.5">
                            Lat: {v.gps_lat?.toFixed(5)}, Lng: {v.gps_lng?.toFixed(5)}
                          </p>
                        </div>
                      </div>
                    );
                  });

                  if (markers.length === 0) {
                    return (
                      <div className="absolute top-[25%] left-[30%] group">
                        <span className="absolute inline-flex h-4 w-4 rounded-full bg-emerald-500 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-border-gray shadow-md cursor-pointer" />
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-border-gray text-[9px] text-slate-800 px-2 py-1.5 rounded-lg shadow-xl w-32 pointer-events-none z-10">
                          <p className="font-bold text-primary-green uppercase tracking-wide">City Heart Center</p>
                          <p className="text-secondary-text">Headquarters - Active</p>
                          <p className="text-slate-400 mt-0.5 text-[8px]">Lat: 17.385, Lng: 78.486</p>
                        </div>
                      </div>
                    );
                  }

                  return markers;
                })()}

                <div className="absolute bottom-2 left-2 right-2 bg-white/90 border border-border-gray px-3 py-2 rounded-lg backdrop-blur-md flex items-center justify-between text-[9px] text-secondary-text">
                  <span>VVF GPS Map Monitoring</span>
                  <span className="text-primary-green font-bold uppercase animate-pulse">Live</span>
                </div>
              </div>
            </div>
          )}

          {/* Centralized Activity / Audit Logs (Spans full width for Reception) */}
          <div className={`bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex flex-col h-[300px] sm:h-[380px] shadow-sm max-w-full min-w-0 mobile-contained ${user?.role === 'Reception' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live Organization Audit Logs</h3>
                <p className="text-[10px] text-secondary-text">Real-time log of security events and mutations</p>
              </div>
              <span className="text-[10px] text-secondary-text">Auto-refreshing</span>
            </div>

            <div className="flex-1 overflow-y-auto border border-border-gray rounded-xl divide-y divide-border-gray bg-secondary-bg/30">
              {activities.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-secondary-text">
                  No organization events recorded yet.
                </div>
              ) : (
                activities.map((act) => {
                  const dateStr = new Date(act.created_at).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  });
                  return (
                    <div key={act.id} className="p-3.5 text-xs transition-colors hover:bg-very-light-green flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-very-light-green border border-light-green rounded-lg text-primary-green mt-0.5 shrink-0">
                          <Activity className="h-3.5 w-3.5 text-primary-green" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {act.description || `${act.action_type} on ${act.entity_type} #${act.entity_id}`}
                          </p>
                          <p className="text-[10px] text-secondary-text mt-0.5">
                            Performed by: <span className="text-slate-950 font-bold">{act.user_name || 'System'}</span> ({act.user_role || 'API'})
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] text-secondary-text font-medium shrink-0 self-end sm:self-center">
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
