'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  CalendarDays, Search, Filter, ShieldAlert, CheckCircle2, 
  User, Phone, Calendar, Clipboard, Loader2, Sparkles, SlidersHorizontal, 
  UserCheck, AlertCircle, Edit, ChevronsUpDown, Users2, CheckSquare, Square, RefreshCw, BarChart3, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminFieldAppointments() {
  const { user, loading: authLoading } = useAuth();
  const isAuthorized = user?.role === 'Admin' || user?.role === 'Superadmin';
  
  // Leads Database State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Telecallers and Performance State
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Redistribution Logs State
  const [redistributionLogs, setRedistributionLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Bulk Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [targetTelecallerId, setTargetTelecallerId] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);

  // Rebalance State
  const [rebalancing, setRebalancing] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  // Filter Fields
  const [filters, setFilters] = useState({
    search: '',
    appointment_type: 'All',
    executive_id: 'All',
    start_date: '',
    end_date: '',
    status: 'All'
  });

  const [showFiltersPanel, setShowFiltersPanel] = useState(true);

  // Status Modifying Modal State
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // Single Lead Reassign Dropdown State
  const [reassigningLeadId, setReassigningLeadId] = useState<number | null>(null);

  // Unique Executives List (parsed from leads for filtering)
  const [executives, setExecutives] = useState<{ id: number; name: string }[]>([]);

  // Fetch Submitted Records
  const fetchAppointments = async (silent = false) => {
    if (authLoading || !isAuthorized) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.appointment_type !== 'All') params.appointment_type = filters.appointment_type;
      if (filters.status !== 'All') params.status = filters.status;
      if (filters.executive_id !== 'All') params.executive_id = filters.executive_id;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await api.fieldAppointments.getAll(params);
      const data = res.data || res || [];
      setAppointments(data);

      // Extract unique executives list dynamically for filtering
      const execMap = new Map<number, string>();
      data.forEach((item: any) => {
        if (item.executive_id && item.executive_name) {
          execMap.set(item.executive_id, item.executive_name);
        }
      });
      const uniqueExecs: { id: number; name: string }[] = [];
      execMap.forEach((name, id) => {
        uniqueExecs.push({ id, name });
      });
      setExecutives(uniqueExecs);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve patient leads.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch Telecallers and Performance statistics
  const fetchTelecallerData = async (silent = false) => {
    if (authLoading || !isAuthorized) return;
    if (!silent) setLoadingStats(true);
    try {
      // Fetch active telecallers
      const tcRes = await api.users.getTelecallers();
      const tcList = tcRes.telecallers || tcRes.data?.telecallers || tcRes || [];
      setTelecallers(tcList.filter((tc: any) => tc.is_active && !tc.is_deleted));

      // Fetch performance statistics
      const perfRes = await api.fieldAppointments.getPerformance();
      setPerformance(perfRes.data || perfRes || []);
    } catch (err) {
      console.error('Failed to retrieve telecaller and performance statistics:', err);
    } finally {
      if (!silent) setLoadingStats(false);
    }
  };

  // Fetch Redistribution Logs
  const fetchRedistributionLogs = async (silent = false) => {
    if (authLoading || !isAuthorized) return;
    if (!silent) setLoadingLogs(true);
    try {
      const res = await api.fieldAppointments.getRedistributionLogs();
      const logs = res.data || res || [];
      setRedistributionLogs(logs);
    } catch (err) {
      console.error('Failed to retrieve auto redistribution logs:', err);
    } finally {
      if (!silent) setLoadingLogs(false);
    }
  };

  const refreshAllData = async (silent = false) => {
    if (authLoading || !isAuthorized) return;
    await Promise.all([
      fetchAppointments(silent),
      fetchTelecallerData(silent),
      fetchRedistributionLogs(silent)
    ]);
  };

  useEffect(() => {
    if (!authLoading && isAuthorized) {
      refreshAllData(false);
    }
  }, [authLoading, isAuthorized, filters.appointment_type, filters.status, filters.executive_id, filters.start_date, filters.end_date]);

  useEffect(() => {
    if (authLoading || !isAuthorized) return;
    const interval = setInterval(() => {
      refreshAllData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [authLoading, isAuthorized, filters]);

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchAppointments(false);
    }
  };

  // Update Status Handler
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newStatus) return;

    setStatusUpdating(true);
    setUpdateError('');
    setUpdateSuccess('');
    try {
      await api.fieldAppointments.updateStatus(selectedLead.id, { status: newStatus });
      setUpdateSuccess(`Status transitioned to "${newStatus}" successfully!`);
      
      // Update local state list directly to prevent full reload flicker
      setAppointments(prev => prev.map(item => 
        item.id === selectedLead.id ? { ...item, status: newStatus, lead_status: newStatus, updated_at: new Date().toISOString() } : item
      ));

      setTimeout(() => {
        setSelectedLead(null);
        setUpdateSuccess('');
        fetchTelecallerData(); // Refresh stats in performance grid
      }, 1000);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to transition status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Bulk Reassignment Handler
  const handleBulkReassign = async () => {
    if (selectedLeadIds.length === 0 || !targetTelecallerId) return;

    setReassigning(true);
    setActionMessage({ text: '', type: '' });
    try {
      const tcId = parseInt(targetTelecallerId, 10);
      await api.fieldAppointments.reassign({
        leadIds: selectedLeadIds,
        telecallerId: tcId
      });

      const selectedTc = telecallers.find(tc => tc.id === tcId);
      const tcName = selectedTc ? selectedTc.name : `ID: ${tcId}`;

      setActionMessage({
        text: `Successfully assigned ${selectedLeadIds.length} leads to ${tcName}.`,
        type: 'success'
      });

      setSelectedLeadIds([]);
      setTargetTelecallerId('');
      refreshAllData();
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'Reassignment request failed.',
        type: 'error'
      });
    } finally {
      setReassigning(false);
    }
  };

  // Single Reassignment Handler
  const handleSingleReassign = async (leadId: number, tcId: number) => {
    setReassigningLeadId(null);
    setActionMessage({ text: '', type: '' });
    try {
      await api.fieldAppointments.reassign({
        leadIds: [leadId],
        telecallerId: tcId
      });

      const tc = telecallers.find(t => t.id === tcId);
      setActionMessage({
        text: `Lead reassigned to ${tc ? tc.name : 'telecaller'} successfully.`,
        type: 'success'
      });
      refreshAllData();
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'Single reassignment failed.',
        type: 'error'
      });
    }
  };

  // Auto Rebalance Handler
  const handleTriggerRebalance = async () => {
    setRebalancing(true);
    setActionMessage({ text: '', type: '' });
    try {
      await api.fieldAppointments.rebalance();
      setActionMessage({
        text: 'Successfully redistributed active leads evenly across all active telecallers.',
        type: 'success'
      });
      refreshAllData();
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'Dynamic rebalancing failed.',
        type: 'error'
      });
    } finally {
      setRebalancing(false);
    }
  };

  // Toggle selection for a single lead
  const toggleSelectLead = (id: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle select all leads shown in current filtered list
  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.length === appointments.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(appointments.map(item => item.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New Lead':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'Contacted':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'Appointment Scheduled':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'Visited':
        return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'Converted':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'Closed':
        return 'bg-slate-150 text-slate-650 border-slate-300';
      case 'Rejected':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'Follow-up Pending':
        return 'bg-pink-50 text-pink-600 border-pink-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openStatusModal = (lead: any) => {
    setSelectedLead(lead);
    setNewStatus(lead.lead_status || lead.status || 'New Lead');
    setUpdateError('');
    setUpdateSuccess('');
  };

  // Compute lead status statistics
  const totalLeads = appointments.length;
  const assignedLeadsCount = appointments.filter(l => l.assigned_telecaller_id).length;
  const unassignedLeadsCount = appointments.filter(l => !l.assigned_telecaller_id).length;
  
  const activeStatuses = ['New Lead', 'Contacted', 'Follow-up Pending', 'Appointment Scheduled'];
  const activeLeadsCount = appointments.filter(l => activeStatuses.includes(l.lead_status || l.status)).length;
  const convertedCount = appointments.filter(l => (l.lead_status || l.status) === 'Converted').length;

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 text-primary-green animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Verifying authorization...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <DashboardLayout>
        <div className="p-6 rounded-2xl bg-red-50 border border-red-250 text-xs text-red-650 flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          Access Denied. You do not have permissions to view this panel.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full min-w-0 pb-12 relative">
        {/* Action / Success Banner Notifications */}
        {actionMessage.text && (
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-fade-in ${
            actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              {actionMessage.type === 'success' ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" /> : <ShieldAlert className="h-4.5 w-4.5 text-red-600" />}
              <span>{actionMessage.text}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setActionMessage({ text: '', type: '' })}
              className="text-slate-400 hover:text-slate-600 font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary-green" />
              Field Appointments & Assignment Panel
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Distribute leads from the field to Telecallers, run round-robin balancing, and trace call activities.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerRebalance}
              disabled={rebalancing || telecallers.length === 0}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redistribute active leads equally among all active telecallers"
            >
              {rebalancing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Redistributing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Force Rebalance Leads
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => refreshAllData(false)}
              className="px-4 py-2.5 bg-primary-green hover:bg-primary-green-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Refresh Panel
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Filed Leads</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{totalLeads}</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Leads</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{assignedLeadsCount}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unassigned Leads</p>
            <p className="text-xl sm:text-2xl font-black text-amber-500 mt-1">{unassignedLeadsCount}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Outreaches</p>
            <p className="text-xl sm:text-2xl font-black text-blue-500 mt-1">{activeLeadsCount}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Converted Patients</p>
            <p className="text-xl sm:text-2xl font-black text-primary-green mt-1">{convertedCount}</p>
          </div>
        </div>

        {/* Bulk Reassignment Control Bar */}
        {selectedLeadIds.length > 0 && (
          <div className="bg-slate-800 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700 animate-slide-in">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary-green" />
              <span className="text-xs font-bold">{selectedLeadIds.length} field leads selected for reassignment</span>
            </div>
            
            <div className="flex items-center gap-2 self-end md:self-auto">
              <select
                value={targetTelecallerId}
                onChange={(e) => setTargetTelecallerId(e.target.value)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-650 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-primary-green cursor-pointer"
              >
                <option value="">Choose Target Telecaller...</option>
                {telecallers.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleBulkReassign}
                disabled={reassigning || !targetTelecallerId}
                className="px-4 py-1.5 bg-primary-green hover:bg-primary-green-hover text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {reassigning ? 'Assigning...' : 'Reassign Selected'}
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedLeadIds([])}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters and Search Console */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyDown={handleSearchKeyPress}
                placeholder="Search by Patient Name, Phone Number, Assigned Telecaller, or Executive Name (Enter)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`flex items-center gap-1.5 px-4 py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all ${
                showFiltersPanel
                  ? 'bg-very-light-green text-primary-green border-light-green'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Toggle Filters
            </button>
          </div>

          <AnimatePresence>
            {showFiltersPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-3 border-t border-slate-100"
              >
                {/* Appointment Type */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Appointment Type</label>
                  <select
                    value={filters.appointment_type}
                    onChange={(e) => setFilters({ ...filters, appointment_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 focus:outline-none focus:ring-1 focus:ring-primary-green"
                  >
                    <option value="All">All Types</option>
                    <option value="Doctor Consultation">Doctor Consultation</option>
                    <option value="Dental Consultation">Dental Consultation</option>
                    <option value="Therapy Services">Therapy Services</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lead Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 focus:outline-none focus:ring-1 focus:ring-primary-green"
                  >
                    <option value="All">All Statuses</option>
                    <option value="New Lead">New Lead</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Follow-up Pending">Follow-up Pending</option>
                    <option value="Appointment Scheduled">Appointment Scheduled</option>
                    <option value="Visited">Visited</option>
                    <option value="Converted">Converted</option>
                    <option value="Closed">Closed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Executive filter */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Executive</label>
                  <select
                    value={filters.executive_id}
                    onChange={(e) => setFilters({ ...filters, executive_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 focus:outline-none focus:ring-1 focus:ring-primary-green"
                  >
                    <option value="All">All Executives</option>
                    {executives.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date range inputs */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-green"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">End Date</label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-green"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Database Table view */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-600 flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 text-primary-green animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Querying field patient registry records...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-24 text-center text-xs text-slate-500">
              No registered patient leads found matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="px-5 py-4 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllLeads}
                        className="text-slate-400 hover:text-primary-green transition-colors cursor-pointer"
                      >
                        {selectedLeadIds.length === appointments.length ? (
                          <CheckSquare className="h-4.5 w-4.5 text-primary-green" />
                        ) : (
                          <Square className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-4">Lead ID</th>
                    <th className="px-4 py-4">Patient Name</th>
                    <th className="px-4 py-4">Age/Gender</th>
                    <th className="px-4 py-4">Phone Number</th>
                    <th className="px-4 py-4">Requirement</th>
                    <th className="px-4 py-4">Assigned Telecaller</th>
                    <th className="px-4 py-4">Follow-ups</th>
                    <th className="px-4 py-4">Executive Name</th>
                    <th className="px-4 py-4">Submission Time</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {appointments.map((item) => {
                    const isSelected = selectedLeadIds.includes(item.id);
                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors ${
                          isSelected ? 'bg-very-light-green/30 hover:bg-very-light-green/40' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectLead(item.id)}
                            className="text-slate-400 hover:text-primary-green transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4.5 w-4.5 text-primary-green" />
                            ) : (
                              <Square className="h-4.5 w-4.5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-bold text-primary-green select-all whitespace-nowrap">
                          {item.patient_lead_id}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-800">
                          {item.full_name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {item.age} yrs • {item.gender}
                        </td>
                        <td className="px-4 py-4 font-mono select-all">
                          {item.phone_number}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-150 text-slate-650 border border-slate-200">
                            {item.appointment_type}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap relative">
                          {reassigningLeadId === item.id ? (
                            <select
                              autoFocus
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleSingleReassign(item.id, parseInt(e.target.value, 10));
                                } else {
                                  setReassigningLeadId(null);
                                }
                              }}
                              onBlur={() => setTimeout(() => setReassigningLeadId(null), 200)}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 focus:outline-none"
                            >
                              <option value="">Reassign to...</option>
                              {telecallers.map(tc => (
                                <option key={tc.id} value={tc.id}>{tc.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {item.assigned_telecaller_name ? (
                                <span className="font-bold text-slate-700">{item.assigned_telecaller_name}</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">Unassigned</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setReassigningLeadId(item.id)}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                                title="Change Assigned Telecaller"
                              >
                                <ChevronsUpDown className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-[10px] space-y-0.5">
                          {item.next_followup_date && (
                            <span className="block text-slate-500 font-semibold">
                              Next: {new Date(item.next_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                          {item.last_followup_date ? (
                            <span className="block text-slate-400 font-normal">
                              Last Call: {new Date(item.last_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          ) : (
                            <span className="block text-slate-350 italic">No call history</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-bold text-slate-700">{item.executive_name}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">ID: {item.executive_id}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-400 whitespace-nowrap">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.lead_status || item.status || 'New Lead')}`}>
                            {item.lead_status || item.status || 'New Lead'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openStatusModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-very-light-green text-slate-600 hover:text-primary-green border border-slate-200 hover:border-light-green rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                            Update Status
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

        {/* Telecaller Performance Tracking Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Users2 className="h-5 w-5 text-primary-green" />
              Telecaller Lead Distribution & Performance Grid
            </h2>
            {loadingStats && <Loader2 className="h-4 w-4 animate-spin text-primary-green" />}
          </div>

          {performance.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-450 italic">
              No telecaller assignment records trace found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Telecaller Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Assigned Leads</th>
                    <th className="px-4 py-3 text-center">Contacted Leads</th>
                    <th className="px-4 py-3 text-center">Converted Leads</th>
                    <th className="px-4 py-3 text-center">Conversion Rate</th>
                    <th className="px-4 py-3 text-center">Pending Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-650">
                  {performance.map((stat) => (
                    <tr key={stat.telecaller_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {stat.telecaller_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          stat.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stat.is_active ? 'bg-emerald-500' : 'bg-slate-350'}`} />
                          {stat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                        {stat.leads_assigned}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {stat.leads_contacted}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600">
                        {stat.leads_converted}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-primary-green">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-3 w-3 text-primary-green/85" />
                          <span>{stat.conversion_rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center text-amber-500 font-semibold">
                        {stat.pending_followups}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Auto Redistribution Log */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <RefreshCw className="h-5 w-5 text-primary-green" />
              Auto Redistribution Log
            </h2>
            {loadingLogs && <Loader2 className="h-4 w-4 animate-spin text-primary-green" />}
          </div>

          {redistributionLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-450 italic">
              No redistribution events logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Trigger Reason</th>
                    <th className="px-4 py-3 text-center">Leads Moved</th>
                    <th className="px-4 py-3 text-center">Active Telecallers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-650">
                  {redistributionLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {formatDate(log.redistribution_time)}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">
                        {log.trigger_reason}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                        {log.leads_moved}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600">
                        {log.active_telecallers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transition Status Dialog Backdrop */}
        <AnimatePresence>
          {selectedLead && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Update Lead Status</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Transition status for lead {selectedLead.patient_lead_id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    className="text-slate-450 hover:text-slate-700 font-bold text-xs"
                  >
                    Close
                  </button>
                </div>

                {/* Modal Body Form */}
                <form onSubmit={handleUpdateStatus} className="p-5 space-y-4">
                  {updateError && (
                    <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-xs text-red-650 flex items-start gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{updateError}</span>
                    </div>
                  )}

                  {updateSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-xs text-emerald-750 flex items-start gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{updateSuccess}</span>
                    </div>
                  )}

                  {/* Info Row */}
                  <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-xl space-y-1 text-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Name</p>
                    <p className="font-extrabold text-slate-700">{selectedLead.full_name} ({selectedLead.age} yrs • {selectedLead.gender})</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2.5">Executive Name</p>
                    <p className="font-bold text-slate-650">{selectedLead.executive_name}</p>
                  </div>

                  {/* Status Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transition Status To</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Follow-up Pending">Follow-up Pending</option>
                      <option value="Appointment Scheduled">Appointment Scheduled</option>
                      <option value="Visited">Visited</option>
                      <option value="Converted">Converted</option>
                      <option value="Closed">Closed</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={statusUpdating}
                    className="w-full py-2.5 px-4 bg-primary-green hover:bg-primary-green-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {statusUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating Status...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
