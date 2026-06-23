'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  CalendarDays, Search, Filter, ShieldAlert, CheckCircle2, 
  User, Phone, Calendar, Clipboard, Loader2, Sparkles, SlidersHorizontal, 
  UserCheck, AlertCircle, Edit, CalendarPlus, FileText, PhoneCall, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TelecallerFieldAppointments() {
  const { user } = useAuth();
  
  // Leads Database State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter Fields
  const [filters, setFilters] = useState({
    search: '',
    appointment_type: 'All',
    start_date: '',
    end_date: '',
    status: 'All'
  });

  const [showFiltersPanel, setShowFiltersPanel] = useState(true);

  // Status/Interaction Modal State
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Fetch Assigned Records
  const fetchAppointments = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.appointment_type !== 'All') params.appointment_type = filters.appointment_type;
      if (filters.status !== 'All') params.status = filters.status;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await api.fieldAppointments.getAll(params);
      const data = res.data || res || [];
      setAppointments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve your assigned leads.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments(false);
  }, [filters.appointment_type, filters.status, filters.start_date, filters.end_date]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAppointments(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [filters]);

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchAppointments(false);
    }
  };

  // Submit Telecaller Action (notes, status, next followup date)
  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setActionSaving(true);
    setActionError('');
    setActionSuccess('');
    try {
      const payload: any = {
        status: newStatus,
        notes: notes.trim(),
        next_followup_date: nextFollowupDate ? new Date(nextFollowupDate).toISOString() : null
      };

      const res = await api.fieldAppointments.telecallerAction(selectedLead.id, payload);
      const updatedLead = res.data || res;

      setActionSuccess('Lead updated successfully!');
      
      // Update local state list
      setAppointments(prev => prev.map(item => 
        item.id === selectedLead.id ? { 
          ...item, 
          status: updatedLead.status, 
          lead_status: updatedLead.lead_status,
          telecaller_notes: updatedLead.telecaller_notes,
          next_followup_date: updatedLead.next_followup_date,
          last_followup_date: updatedLead.last_followup_date,
          updated_at: updatedLead.updated_at
        } : item
      ));

      setTimeout(() => {
        setSelectedLead(null);
        setActionSuccess('');
      }, 1000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit telecaller notes and status.');
    } finally {
      setActionSaving(false);
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
      case 'Follow-up Pending':
        return 'bg-pink-50 text-pink-600 border-pink-200';
      case 'Visited':
        return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'Converted':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'Closed':
        return 'bg-slate-150 text-slate-650 border-slate-300';
      case 'Rejected':
        return 'bg-red-50 text-red-650 border-red-200';
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

  const openActionModal = (lead: any) => {
    setSelectedLead(lead);
    setNewStatus(lead.lead_status || lead.status || 'New Lead');
    setNotes(lead.telecaller_notes || '');
    if (lead.next_followup_date) {
      const dateVal = new Date(lead.next_followup_date).toISOString().substring(0, 16);
      setNextFollowupDate(dateVal);
    } else {
      setNextFollowupDate('');
    }
    setActionError('');
    setActionSuccess('');
  };

  // Stats for the Telecaller
  const totalMyLeads = appointments.length;
  const pendingLeadsCount = appointments.filter(l => (l.lead_status || l.status) === 'New Lead').length;
  const followupsLeadsCount = appointments.filter(l => (l.lead_status || l.status) === 'Follow-up Pending').length;
  const scheduledLeadsCount = appointments.filter(l => (l.lead_status || l.status) === 'Appointment Scheduled').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full min-w-0 pb-12 relative">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary-green" />
              My Field Leads ({totalMyLeads})
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Trace and interact with patient registrations assigned to you. Schedule follow-ups, save calling notes, and record conversion outcomes.
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => fetchAppointments(false)}
            className="self-start sm:self-center px-4 py-2 bg-primary-green hover:bg-primary-green-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Refresh Leads
          </button>
        </div>

        {/* Local Mini-Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Leads</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{totalMyLeads}</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Leads</p>
            <p className="text-xl sm:text-2xl font-black text-blue-500 mt-1">{pendingLeadsCount}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow-ups</p>
            <p className="text-xl sm:text-2xl font-black text-pink-500 mt-1">{followupsLeadsCount}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Appointments</p>
            <p className="text-xl sm:text-2xl font-black text-purple-650 mt-1">{scheduledLeadsCount}</p>
          </div>
        </div>

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
                placeholder="Search by Patient Name, Phone Number, or Executive Name (Enter)"
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
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100"
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
            <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-650 flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 text-primary-green animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Querying your assigned field leads...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-24 text-center text-xs text-slate-500">
              No leads currently assigned to you matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-4">Lead ID</th>
                    <th className="px-4 py-4">Patient Name</th>
                    <th className="px-4 py-4">Age/Gender</th>
                    <th className="px-4 py-4">Phone Number</th>
                    <th className="px-4 py-4">Requirement</th>
                    <th className="px-4 py-4">Follow-ups</th>
                    <th className="px-4 py-4 text-max-w-xs">Telecaller Notes</th>
                    <th className="px-4 py-4 font-normal">Executive Name</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-5 py-4 text-center">Interact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {appointments.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 font-bold text-primary-green select-all whitespace-nowrap">
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
                      <td className="px-4 py-4 whitespace-nowrap text-[10px] space-y-0.5">
                        {item.next_followup_date && (
                          <span className="block text-slate-500 font-semibold">
                            Next: {new Date(item.next_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                        {item.last_followup_date ? (
                          <span className="block text-slate-450">
                            Last Call: {new Date(item.last_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        ) : (
                          <span className="block text-slate-350 italic">No calls made yet</span>
                        )}
                      </td>
                      <td className="px-4 py-4 max-w-xs truncate" title={item.telecaller_notes || 'No remarks'}>
                        {item.telecaller_notes || <span className="text-slate-300 italic">No notes</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-450">
                        {item.executive_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.lead_status || item.status || 'New Lead')}`}>
                          {item.lead_status || item.status || 'New Lead'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openActionModal(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-green hover:bg-primary-green-hover text-white rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                        >
                          <PhoneCall className="h-3 w-3" />
                          Call & Note
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead Interaction Dialog Backdrop */}
        <AnimatePresence>
          {selectedLead && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <PhoneCall className="h-4 w-4 text-primary-green" />
                      Lead Action Console
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Record outreach result and callback notes for lead {selectedLead.patient_lead_id}</p>
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
                <form onSubmit={handleSaveAction} className="p-5 space-y-4">
                  {actionError && (
                    <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-xs text-red-650 flex items-start gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{actionError}</span>
                    </div>
                  )}

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-xs text-emerald-750 flex items-start gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{actionSuccess}</span>
                    </div>
                  )}

                  {/* Info Section */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200/50 p-4 rounded-xl text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Name</p>
                      <p className="font-extrabold text-slate-700 mt-0.5">{selectedLead.full_name}</p>
                      <p className="text-slate-500 font-medium mt-0.5">{selectedLead.age} yrs • {selectedLead.gender}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Phone</p>
                      <p className="font-extrabold text-slate-750 mt-0.5 flex items-center gap-1 select-all">
                        <Phone className="h-3.5 w-3.5 text-primary-green" />
                        {selectedLead.phone_number}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Requirement: {selectedLead.appointment_type}</p>
                    </div>
                    
                    {selectedLead.medical_history && (
                      <div className="col-span-2 border-t border-slate-200/50 pt-2 mt-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Executive Health Notes</p>
                        <p className="text-slate-600 mt-0.5 font-medium">{selectedLead.medical_history}</p>
                      </div>
                    )}
                  </div>

                  {/* Calling Status Transition selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lead Outreach Status</label>
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

                  {/* Next Followup Date Picker */}
                  {['Follow-up Pending', 'Appointment Scheduled'].includes(newStatus) && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                        <CalendarPlus className="h-3.5 w-3.5 text-primary-green" />
                        Schedule Next Follow-up Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={nextFollowupDate}
                        onChange={(e) => setNextFollowupDate(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white"
                      />
                    </div>
                  )}

                  {/* Telecaller Notes / Call Remarks */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-primary-green" />
                      Call Remarks / Follow-up Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Type important details about this phone outreach or callbacks..."
                      rows={4}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={actionSaving}
                    className="w-full py-2.5 px-4 bg-primary-green hover:bg-primary-green-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Call Details...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-4 w-4" />
                        Save Call Outcomes
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
