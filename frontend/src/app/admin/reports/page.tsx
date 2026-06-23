'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { 
  exportToExcel, 
  exportToPDF, 
  exportToCSV 
} from '../../../lib/exportUtils';
import { 
  BarChart3, Calendar, CalendarDays, PhoneCall, MapPin, 
  Activity, Users, UserCheck, ChevronDown, ChevronUp, 
  Search, ShieldAlert, Download, FileSpreadsheet, FileText, 
  Sparkles, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../../components/SelectField';

export default function DailyReportsPage() {
  const { user } = useAuth();

  // Filters State
  const defaultStartDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const defaultEndDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedUserId, setSelectedUserId] = useState('All');
  const [searchText, setSearchText] = useState('');

  // Dropdown list states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // Report results states
  const [reportData, setReportData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Accordion Expand/Collapse sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Reception': true,
    'Telecaller': true,
    'Executive': true,
    'Doctor': true,
    'Dental Doctor': true,
    'OP Technician': true,
    'SOP Technician': true,
  });

  // Load user profiles once on mount for filter options
  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const res = await api.users.getAll();
        setAllUsers(res.users || []);
      } catch (err) {
        console.error('Failed to load user list for dropdown:', err);
      }
    };
    fetchAllUsers();
  }, []);

  // Filtered list of users for dropdown based on selected role
  const dropdownUsersList = allUsers.filter(u => {
    if (selectedRole === 'All') return true;
    return u.role === selectedRole;
  });

  // Reset user filter if the selected user doesn't belong to the newly selected role
  useEffect(() => {
    if (selectedUserId !== 'All') {
      const exists = dropdownUsersList.some(u => String(u.id) === selectedUserId);
      if (!exists) {
        setSelectedUserId('All');
      }
    }
  }, [selectedRole, dropdownUsersList]);

  // Main reports fetching effect
  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.reports.getDaily({
        startDate,
        endDate,
        role: selectedRole,
        userId: selectedUserId,
        page: currentPage,
        limit: 50
      });
      if (res) {
        setReportData(res.rolesData || {});
        setStats(res.stats || {});
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalRecords(res.pagination?.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch productivity report statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, selectedRole, selectedUserId, currentPage]);

  const handleRoleChange = (val: string) => {
    setSelectedRole(val);
    setCurrentPage(1);
  };

  const handleUserChange = (val: string) => {
    setSelectedUserId(val);
    setCurrentPage(1);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setCurrentPage(1);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setStartDate(defaultStartDate());
    setEndDate(defaultEndDate());
    setSelectedRole('All');
    setSelectedUserId('All');
    setSearchText('');
    setCurrentPage(1);
  };

  // Toggles collapsible sections
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Local user name search filter
  const filterRoleUsers = (usersList: any[]) => {
    if (!searchText) return usersList;
    const lower = searchText.toLowerCase();
    return usersList.filter(u => 
      u.name.toLowerCase().includes(lower) || 
      u.employeeId.toLowerCase().includes(lower)
    );
  };

  // Fetches full filtered dataset ignoring pagination limits (e.g. for exports)
  const fetchExportData = async () => {
    setExportLoading(true);
    try {
      const res = await api.reports.getDaily({
        startDate,
        endDate,
        role: selectedRole,
        userId: selectedUserId,
        page: 1,
        limit: 1000 // Get all records matching filters
      });
      return res.rolesData || {};
    } finally {
      setExportLoading(false);
    }
  };

  // Helper to compile a flat array representing all records for Excel / CSV exports
  const prepareFlatData = (data: any) => {
    const flat: any[] = [];
    const roles = Object.keys(data);
    roles.forEach(roleName => {
      const list = data[roleName] || [];
      list.forEach((u: any) => {
        const row: any = {
          'Role': roleName,
          'Employee ID': u.employeeId,
          'Name': u.name,
          'Daily Count': u.dailyCount,
          'Monthly Count': u.monthlyCount,
          'Monthly Target': u.monthlyTarget || 0,
          'Achievement %': `${u.achievementPercentage || 0}%`,
          'Range Count': u.rangeCount,
          'Last Activity': u.lastActivityTime ? new Date(u.lastActivityTime).toLocaleString('en-IN') : 'No activity',
          
          // Columns placeholder for Receptionists
          'Appointments Created': '',
          'Patients Registered': '',
          
          // Columns placeholder for Telecallers
          'Calls Made': '',
          'Connected Calls': '',
          'Follow-up Calls': '',
          
          // Columns placeholder for Executives
          'Visits Logged': '',
          'Visits Completed': '',
          'Visits Pending': '',
          
          // Columns placeholder for Doctors
          'Appointments Assigned': '',
          'Appointments Handled': '',
          'Appointments Completed': '',
          'Appointments Cancelled': '',
          
          // Columns placeholder for Dental Doctors
          'Dental Appointments Assigned': '',
          'Dental Appointments Handled': '',
          'Dental Appointments Completed': '',
          'Dental Appointments Cancelled': '',
          
          // Columns placeholder for Technicians
          'Service Appointments Assigned': '',
          'Service Appointments Completed': '',
          'Service Appointments Pending': '',
        };

        if (roleName === 'Reception') {
          row['Appointments Created'] = u.totalAppointmentsCreated;
          row['Patients Registered'] = u.totalPatientsRegistered;
        } else if (roleName === 'Telecaller') {
          row['Calls Made'] = u.totalCallsMade;
          row['Connected Calls'] = u.connectedCalls;
          row['Follow-up Calls'] = u.followupCalls;
        } else if (roleName === 'Executive') {
          row['Visits Logged'] = u.totalVisitsLogged;
          row['Visits Completed'] = u.visitsCompleted;
          row['Visits Pending'] = u.visitsPending;
        } else if (roleName === 'Doctor') {
          row['Appointments Assigned'] = u.appointmentsAssigned;
          row['Appointments Handled'] = u.appointmentsHandled;
          row['Appointments Completed'] = u.appointmentsCompleted;
          row['Appointments Cancelled'] = u.appointmentsCancelled;
        } else if (roleName === 'Dental Doctor') {
          row['Dental Appointments Assigned'] = u.dentalAppointmentsAssigned;
          row['Dental Appointments Handled'] = u.dentalAppointmentsHandled;
          row['Dental Appointments Completed'] = u.dentalAppointmentsCompleted;
          row['Dental Appointments Cancelled'] = u.dentalAppointmentsCancelled;
        } else if (roleName === 'OP Technician' || roleName === 'SOP Technician') {
          row['Service Appointments Assigned'] = u.serviceAppointmentsAssigned;
          row['Service Appointments Completed'] = u.serviceAppointmentsCompleted;
          row['Service Appointments Pending'] = u.serviceAppointmentsPending;
        }
        
        flat.push(row);
      });
    });
    return flat;
  };

  // Exporters execution handlers
  const handleExcelExport = async () => {
    try {
      const rawData = await fetchExportData();
      const flatData = prepareFlatData(rawData);
      exportToExcel(flatData, `vvf_daily_productivity_${startDate}_to_${endDate}`, {
        title: 'VVF Healthcare - Daily Productivity Report',
        filters: {
          'Start Date': startDate || 'All',
          'End Date': endDate || 'All',
          'Role Filter': selectedRole,
          'User Filter': selectedUserId !== 'All' 
            ? allUsers.find(u => String(u.id) === selectedUserId)?.name || selectedUserId
            : 'All'
        }
      });
    } catch (err: any) {
      alert(err.message || 'Excel export failed.');
    }
  };

  const handleCSVExport = async () => {
    try {
      const rawData = await fetchExportData();
      const flatData = prepareFlatData(rawData);
      exportToCSV(flatData, `vvf_daily_productivity_${startDate}_to_${endDate}`);
    } catch (err: any) {
      alert(err.message || 'CSV export failed.');
    }
  };

  const handlePDFExport = async () => {
    try {
      const rawData = await fetchExportData();
      const flatData = prepareFlatData(rawData);
      
      const headers = ['Role', 'ID', 'Name', 'Daily', 'Monthly', 'Target', 'Achievement %', 'Range', 'Last Activity', 'Metrics Detail'];
      const body = flatData.map(row => {
        const metricsText = Object.entries(row)
          .filter(([k]) => !['Role', 'Employee ID', 'Name', 'Daily Count', 'Monthly Count', 'Monthly Target', 'Achievement %', 'Range Count', 'Last Activity'].includes(k))
          .filter(([_, v]) => v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');

        return [
          row['Role'],
          row['Employee ID'],
          row['Name'],
          String(row['Daily Count']),
          String(row['Monthly Count']),
          String(row['Monthly Target']),
          row['Achievement %'],
          String(row['Range Count']),
          row['Last Activity'],
          metricsText || 'None'
        ];
      });

      const filterText = `Dates: ${startDate} to ${endDate} | Filter: Role=${selectedRole}, User=${selectedUserId === 'All' ? 'All' : 'Selected'}`;
      exportToPDF(
        headers,
        body,
        'VVF Healthcare - Productivity Report',
        filterText,
        `vvf_productivity_${startDate}_to_${endDate}`
      );
    } catch (err: any) {
      alert(err.message || 'PDF export failed.');
    }
  };

  // Guard: Admin & Superadmin only
  const isAuthorized = user?.role === 'Admin' || user?.role === 'Superadmin';
  if (!isAuthorized) {
    return (
      <DashboardLayout>
        <div className="p-6 rounded-2xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          Access Denied. You do not have permissions to view productivity reports.
        </div>
      </DashboardLayout>
    );
  }

  // Render collapsible role sections
  const renderRoleSection = (roleKey: string, title: string, icon: React.ReactNode) => {
    const rawUsers = reportData?.[roleKey] || [];
    const users = filterRoleUsers(rawUsers);
    const isExpanded = expandedSections[roleKey];
    
    // Hide if filtering by a single role and it doesn't match
    if (selectedRole !== 'All' && selectedRole !== roleKey) return null;
    
    return (
      <div key={roleKey} className="bg-white border border-border-gray rounded-2xl overflow-hidden shadow-sm transition-all duration-200">
        <button
          onClick={() => toggleSection(roleKey)}
          className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-border-gray hover:bg-slate-100/50 transition-colors cursor-pointer outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-very-light-green rounded-xl text-primary-green shrink-0">
              {icon}
            </div>
            <div className="text-left">
              <h3 className="font-bold text-sm text-slate-800">{title}</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {rawUsers.length} logged records
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {users.length !== rawUsers.length && (
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                {users.length} filtered
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4.5 w-4.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-4.5 w-4.5 text-slate-400" />
            )}
          </div>
        </button>
        
        {isExpanded && (
          <div className="p-4 sm:p-6 overflow-x-auto">
            {users.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No productivity metrics logged for this role matching current filters.
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-border-gray text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                    <th className="py-3 px-4 w-24">Employee ID</th>
                    <th className="py-3 px-4">Name</th>
                    
                    {/* Role specific headers */}
                    {roleKey === 'Reception' && (
                      <>
                        <th className="py-3 px-4">Total Appts Created</th>
                        <th className="py-3 px-4">Patients Registered</th>
                      </>
                    )}
                    {roleKey === 'Telecaller' && (
                      <>
                        <th className="py-3 px-4">Total Calls Made</th>
                        <th className="py-3 px-4">Connected Calls</th>
                        <th className="py-3 px-4">Follow-up Calls</th>
                      </>
                    )}
                    {roleKey === 'Executive' && (
                      <>
                        <th className="py-3 px-4">Total Visits Logged</th>
                        <th className="py-3 px-4">Visits Completed</th>
                        <th className="py-3 px-4">Visits Pending</th>
                      </>
                    )}
                    {roleKey === 'Doctor' && (
                      <>
                        <th className="py-3 px-4">Appts Assigned</th>
                        <th className="py-3 px-4">Handled</th>
                        <th className="py-3 px-4">Completed</th>
                        <th className="py-3 px-4">Cancelled</th>
                      </>
                    )}
                    {roleKey === 'Dental Doctor' && (
                      <>
                        <th className="py-3 px-4">Dental Appts Assigned</th>
                        <th className="py-3 px-4">Handled</th>
                        <th className="py-3 px-4">Completed</th>
                        <th className="py-3 px-4">Cancelled</th>
                      </>
                    )}
                    {(roleKey === 'OP Technician' || roleKey === 'SOP Technician') && (
                      <>
                        <th className="py-3 px-4">Service Assigned</th>
                        <th className="py-3 px-4">Completed</th>
                        <th className="py-3 px-4">Pending</th>
                      </>
                    )}
                    
                     <th className="py-3 px-4 w-24">Today's Count</th>
                    <th className="py-3 px-4 w-24">Monthly Count</th>
                    <th className="py-3 px-4 w-24 text-center">Monthly Target</th>
                    <th className="py-3 px-4 w-24 text-center">Achievement %</th>
                    <th className="py-3 px-4 bg-very-light-green/60 text-primary-green w-28 text-center">Selected Range</th>
                    <th className="py-3 px-4 w-40">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-gray">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors text-slate-600 font-medium">
                      <td className="py-3.5 px-4 font-mono font-bold text-[10px] text-slate-500">{u.employeeId}</td>
                      <td className="py-3.5 px-4 text-slate-800 font-bold">{u.name}</td>
                      
                      {/* Role specific values */}
                      {roleKey === 'Reception' && (
                        <>
                          <td className="py-3.5 px-4 font-semibold">{u.totalAppointmentsCreated}</td>
                          <td className="py-3.5 px-4 font-semibold">{u.totalPatientsRegistered}</td>
                        </>
                      )}
                      {roleKey === 'Telecaller' && (
                        <>
                          <td className="py-3.5 px-4 font-semibold">{u.totalCallsMade}</td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-600">{u.connectedCalls}</td>
                          <td className="py-3.5 px-4 font-semibold text-blue-600">{u.followupCalls}</td>
                        </>
                      )}
                      {roleKey === 'Executive' && (
                        <>
                          <td className="py-3.5 px-4 font-semibold">{u.totalVisitsLogged}</td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-600">{u.visitsCompleted}</td>
                          <td className="py-3.5 px-4 font-semibold text-amber-600">{u.visitsPending}</td>
                        </>
                      )}
                      {roleKey === 'Doctor' && (
                        <>
                          <td className="py-3.5 px-4 font-semibold">{u.appointmentsAssigned}</td>
                          <td className="py-3.5 px-4 font-semibold">{u.appointmentsHandled}</td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-600">{u.appointmentsCompleted}</td>
                          <td className="py-3.5 px-4 font-semibold text-rose-600">{u.appointmentsCancelled}</td>
                        </>
                      )}
                      {roleKey === 'Dental Doctor' && (
                        <>
                          <td className="py-3.5 px-4 font-semibold">{u.dentalAppointmentsAssigned}</td>
                          <td className="py-3.5 px-4 font-semibold">{u.dentalAppointmentsHandled}</td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-600">{u.dentalAppointmentsCompleted}</td>
                          <td className="py-3.5 px-4 font-semibold text-rose-600">{u.dentalAppointmentsCancelled}</td>
                        </>
                      )}
                      {(roleKey === 'OP Technician' || roleKey === 'SOP Technician') && (
                        <>
                          <td className="py-3.5 px-4 font-semibold">{u.serviceAppointmentsAssigned}</td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-600">{u.serviceAppointmentsCompleted}</td>
                          <td className="py-3.5 px-4 font-semibold text-amber-600">{u.serviceAppointmentsPending}</td>
                        </>
                      )}
                      
                      <td className="py-3.5 px-4">{u.dailyCount}</td>
                      <td className="py-3.5 px-4">{u.monthlyCount}</td>
                      <td className="py-3.5 px-4 text-center font-bold">{u.monthlyTarget}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">{u.achievementPercentage}%</td>
                      <td className="py-3.5 px-4 bg-very-light-green/40 text-primary-green font-bold text-center text-sm">{u.rangeCount}</td>
                      <td className="py-3.5 px-4 text-slate-450 font-mono text-[10px]">
                        {u.lastActivityTime ? new Date(u.lastActivityTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'No activity'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              Daily Operations & Productivity Reports
              <Sparkles className="h-5 w-5 text-primary-green animate-pulse" />
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track real-time productivity statistics, calls, visits, registrations, and appointments across VVF healthcare staffs.
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleExcelExport}
              disabled={loading || exportLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl cursor-pointer transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel Export
            </button>
            
            <button
              onClick={handleCSVExport}
              disabled={loading || exportLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl cursor-pointer transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              CSV Export
            </button>
            
            <button
              onClick={handlePDFExport}
              disabled={loading || exportLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl cursor-pointer transition-all disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5" />
            {error}
          </div>
        )}

        {/* Filters Panel */}
        <div className="bg-white border border-border-gray p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-600 outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-600 outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role Filter</label>
              <SelectField
                id="filter-role-select"
                value={selectedRole}
                onChange={handleRoleChange}
                triggerClassName="py-2 px-3 text-xs text-slate-600"
                options={[
                  { value: 'All', label: 'All Roles' },
                  { value: 'Reception', label: 'Reception Desk' },
                  { value: 'Telecaller', label: 'Telecaller' },
                  { value: 'Executive', label: 'Field Executive' },
                  { value: 'Doctor', label: 'General Doctor' },
                  { value: 'Dental Doctor', label: 'Dental Doctor' },
                  { value: 'OP Technician', label: 'OP Technician' },
                  { value: 'SOP Technician', label: 'SOP Technician' }
                ]}
              />
            </div>

            {/* User Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">User Filter</label>
              <SelectField
                id="filter-user-select"
                value={selectedUserId}
                onChange={handleUserChange}
                triggerClassName="py-2 px-3 text-xs text-slate-600"
                options={[
                  { value: 'All', label: 'All Staff Users' },
                  ...dropdownUsersList.map(u => ({
                    value: String(u.id),
                    label: `${u.name} (${u.role})`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Sub Search & Reset */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 justify-between items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search matching users name..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 pl-9 pr-4 text-xs text-slate-600 outline-none"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={handleResetFilters}
                className="flex items-center justify-center gap-1.5 px-4 py-2 border border-border-gray hover:bg-slate-50 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-bold w-full sm:w-auto"
              >
                Reset Filters
              </button>
              
              <button
                onClick={fetchReport}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl transition-all cursor-pointer font-bold w-full sm:w-auto disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Top Summary Metrics Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Appointments Today */}
          <div className="bg-white border border-border-gray rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
            <div className="flex justify-between items-start gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Appts Today</span>
              <CalendarDays className="h-4 w-4 text-primary-green" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                  {stats?.totalAppointmentsToday ?? 0}
                </h3>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Assigned general & dental</p>
            </div>
          </div>

          {/* Calls Today */}
          <div className="bg-white border border-border-gray rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
            <div className="flex justify-between items-start gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Calls Today</span>
              <PhoneCall className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                  {stats?.totalCallsToday ?? 0}
                </h3>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Outreach leads processed</p>
            </div>
          </div>

          {/* Visits Today */}
          <div className="bg-white border border-border-gray rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
            <div className="flex justify-between items-start gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Visits Today</span>
              <MapPin className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                  {stats?.totalVisitsToday ?? 0}
                </h3>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Executives field visits</p>
            </div>
          </div>

          {/* Service Appts Today */}
          <div className="bg-white border border-border-gray rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition-all pointer-events-none" />
            <div className="flex justify-between items-start gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Service Appts</span>
              <Activity className="h-4 w-4 text-violet-600" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                  {stats?.totalServiceAppointmentsToday ?? 0}
                </h3>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Lab / therapy sessions</p>
            </div>
          </div>

          {/* Active Users Today */}
          <div className="bg-white border border-border-gray rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all pointer-events-none" />
            <div className="flex justify-between items-start gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Staff</span>
              <UserCheck className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                  {stats?.activeUsersToday ?? 0}
                </h3>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Staff punched in today</p>
            </div>
          </div>

          {/* Month Activities */}
          <div className="bg-white border border-border-gray rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
            <div className="flex justify-between items-start gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Month Activities</span>
              <BarChart3 className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
                  {stats?.totalActivitiesThisMonth ?? 0}
                </h3>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Cumulative activities</p>
            </div>
          </div>
        </div>

        {/* Collapsible Tables Section */}
        {loading && !reportData ? (
          <div className="flex h-64 items-center justify-center bg-white border border-border-gray rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              <p className="text-xs font-semibold text-slate-500">Compiling productivity reports...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {renderRoleSection('Reception', 'Receptionist Desk', <CalendarDays className="h-5 w-5" />)}
            {renderRoleSection('Telecaller', 'Telecalling Team', <PhoneCall className="h-5 w-5" />)}
            {renderRoleSection('Executive', 'Field Executives', <MapPin className="h-5 w-5" />)}
            {renderRoleSection('Doctor', 'Doctor Clinicians', <UserCheck className="h-5 w-5" />)}
            {renderRoleSection('Dental Doctor', 'Dental Doctors', <Sparkles className="h-5 w-5" />)}
            {renderRoleSection('OP Technician', 'OP Technician Support', <Activity className="h-5 w-5" />)}
            {renderRoleSection('SOP Technician', 'SOP Technician Support', <BarChart3 className="h-5 w-5" />)}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-white border border-border-gray px-6 py-4 rounded-2xl shadow-sm">
            <div className="text-xs text-slate-500">
              Showing page <strong className="text-slate-800">{currentPage}</strong> of <strong className="text-slate-800">{totalPages}</strong> ({totalRecords} total staff records)
            </div>
            
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-4 py-2 border border-border-gray hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-4 py-2 border border-border-gray hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
