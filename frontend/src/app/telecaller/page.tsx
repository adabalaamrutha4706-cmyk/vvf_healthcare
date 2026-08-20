'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  PhoneCall, Search, Plus, Edit3, Trash2, ShieldAlert, CheckCircle, 
  User, Calendar, Clock, X, Sparkles, Phone, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';

export default function TelecallerPage() {
  const { user } = useAuth();
  
  // Lists
  const [leads, setLeads] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedTelecallerFilter, setSelectedTelecallerFilter] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('All');
  
  // States
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [patientName, setPatientName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [status, setStatus] = useState('Interested');
  const [notes, setNotes] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Sync with URL query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const paramTcId = searchParams.get('telecallerId');
      if (paramTcId) {
        const parsed = parseInt(paramTcId, 10);
        if (!isNaN(parsed)) {
          setSelectedTelecallerFilter(parsed);
        }
      }
    }
    fetchLeads();
  }, []);

  const handleSelectTelecaller = (id: number | null) => {
    setSelectedTelecallerFilter(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set('telecallerId', id.toString());
      } else {
        url.searchParams.delete('telecallerId');
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await api.leads.getAll();
      setLeads(res.leads || []);

      // Get telecallers list from backend dedicated endpoint
      const userRes = await api.users.getTelecallers();
      const telecallers = userRes.telecallers || [];
      setStaff(telecallers);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch customer/leads records.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedLead(null);
    setPatientName('');
    setContactNumber('');
    setStatus('Interested');
    setNotes('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);
    setCallbackTime(tomorrow.toISOString().slice(0, 16));
    setAssignedTo(user?.id?.toString() || '');
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (lead: any) => {
    setSelectedLead(lead);
    setPatientName(lead.patient_name);
    setContactNumber(lead.contact_number);
    setStatus(lead.status);
    setNotes(lead.notes || '');
    setCallbackTime(lead.callback_time ? new Date(lead.callback_time).toISOString().slice(0, 16) : '');
    setAssignedTo(lead.assigned_to?.toString() || '');
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      patient_name: patientName,
      contact_number: contactNumber,
      status,
      notes,
      callback_time: callbackTime ? new Date(callbackTime).toISOString() : null,
      assigned_to: assignedTo ? parseInt(assignedTo) : null
    };

    try {
      if (selectedLead) {
        await api.leads.update(selectedLead.id, payload);
        setSuccess('Lead observations details saved.');
      } else {
        await api.leads.create(payload);
        setSuccess('Outbound call lead created successfully.');
      }
      setIsFormOpen(false);
      fetchLeads();
    } catch (err: any) {
      setError(err.message || 'Validation error. Please verify input fields.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this lead? This soft-deletes the record.')) return;
    try {
      await api.leads.delete(id);
      setSuccess('Lead removed from active checklist.');
      fetchLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to remove lead record.');
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      l.contact_number.includes(search) ||
      (l.notes && l.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;

    // Telecaller filter
    const matchesTelecaller = !selectedTelecallerFilter || l.assigned_to === selectedTelecallerFilter;

    // Date filter
    let matchesDate = true;
    if (dateFilter !== 'All') {
      if (l.callback_time) {
        const cbDate = new Date(l.callback_time);
        const today = new Date();
        
        const isSameDay = cbDate.getDate() === today.getDate() &&
          cbDate.getMonth() === today.getMonth() &&
          cbDate.getFullYear() === today.getFullYear();

        if (dateFilter === 'Today') {
          matchesDate = isSameDay;
        } else if (dateFilter === 'Overdue') {
          const isPast = cbDate < today && !isSameDay;
          matchesDate = isPast && l.status !== 'Completed' && l.status !== 'Confirmed';
        } else if (dateFilter === 'Upcoming') {
          matchesDate = cbDate > today && !isSameDay;
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesStatus && matchesTelecaller && matchesDate;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              Telecalling & Patient Outreach
              <PhoneCall className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Outbound patient lead checklists, appointment callback schedules, and logs.
            </p>
          </div>

          <button
            id="btn-new-lead"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Patient Lead
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
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start">
          {/* Sidebar / Left Column: Telecallers List */}
          {user?.role !== 'Telecaller' && (
            <div className="lg:col-span-1 space-y-4 min-w-0">
              <div className="bg-white border border-border-gray p-3 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-gray">
                  <User className="h-4.5 w-4.5 text-primary-green" />
                  <h2 className="text-sm font-bold text-primary-green">Telecallers Team</h2>
                </div>
                <div className="space-y-2 max-h-[300px] lg:max-h-[500px] overflow-y-auto pr-1">
                  {/* All Telecallers option */}
                  <button
                    id="btn-telecaller-all"
                    onClick={() => handleSelectTelecaller(null)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-200 border cursor-pointer ${
                      !selectedTelecallerFilter
                        ? 'bg-very-light-green/70 text-primary-green border-primary-green'
                        : 'bg-white text-slate-500 border-border-gray hover:bg-secondary-bg hover:text-primary-green'
                    }`}
                  >
                    <span>All Assignments</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      !selectedTelecallerFilter ? 'bg-primary-green text-white' : 'bg-secondary-bg text-slate-500 border border-border-gray'
                    }`}>
                      {leads.length}
                    </span>
                  </button>

                  {/* Telecallers list */}
                  {staff.map((tc) => {
                    const tcLeadsCount = leads.filter((l) => l.assigned_to === tc.id).length;
                    const isSelected = selectedTelecallerFilter === tc.id;
                    return (
                      <button
                        key={tc.id}
                        id={`btn-telecaller-${tc.id}`}
                        onClick={() => handleSelectTelecaller(tc.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all duration-200 border cursor-pointer ${
                          isSelected
                            ? 'bg-very-light-green/70 text-primary-green border-primary-green shadow-sm'
                            : 'bg-white text-slate-500 border-border-gray hover:bg-secondary-bg hover:text-primary-green'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected ? 'bg-primary-green text-white' : 'bg-very-light-green text-primary-green border border-light-green'
                          }`}>
                            {tc.name.charAt(0)}
                          </div>
                          <div className="text-left truncate">
                            <p className="font-semibold truncate">{tc.name}</p>
                            <p className="text-[9px] text-slate-400 truncate">{tc.phone || tc.email}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isSelected ? 'bg-primary-green text-white' : 'bg-secondary-bg text-slate-500 border border-border-gray'
                        }`}>
                          {tcLeadsCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Main / Right Column: Leads List & Date Filters */}
          <div className={`${user?.role === 'Telecaller' ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-4 min-w-0`}>
            {/* Search Panel */}
            <div className="flex flex-col gap-3 bg-white border border-border-gray p-3 rounded-xl shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  id="lead-search"
                  type="text"
                  placeholder="Search leads by name, phone, or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-500 placeholder-slate-400 outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Outreach Status:</span>
                <div className="flex flex-wrap gap-1">
                  {['All', 'Interested', 'Follow-up', 'Confirmed', 'Not Responding'].map((st) => (
                    <button
                      key={st}
                      id={`status-${st.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        statusFilter === st
                          ? 'bg-very-light-green/60 text-emerald-500 border border-emerald-500/30'
                          : 'bg-white text-slate-500 border border-border-gray hover:bg-secondary-bg'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-border-gray p-3 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">Callback Period:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { name: 'All Days', value: 'All' },
                    { name: 'Today', value: 'Today' },
                    { name: 'Overdue', value: 'Overdue' },
                    { name: 'Upcoming', value: 'Upcoming' }
                  ].map((df) => (
                    <button
                      key={df.value}
                      id={`date-filter-${df.value.toLowerCase()}`}
                      onClick={() => setDateFilter(df.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        dateFilter === df.value
                          ? 'bg-very-light-green/60 text-emerald-500 border border-emerald-500/30'
                          : 'bg-white text-slate-500 border border-border-gray hover:bg-secondary-bg'
                      }`}
                    >
                      {df.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTelecallerFilter && (
                <div className="text-xs text-slate-500 bg-secondary-bg px-3 py-1.5 rounded-lg border border-border-gray font-medium flex items-center gap-1.5 animate-fadeIn">
                  <span>Showing:</span>
                  <span className="text-primary-green font-semibold">
                    {staff.find((tc) => tc.id === selectedTelecallerFilter)?.name || 'Telecaller'}
                  </span>
                  <button
                    onClick={() => handleSelectTelecaller(null)}
                    className="text-slate-400 hover:text-alert-text ml-1 cursor-pointer transition-colors"
                    title="Clear telecaller filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Grid List */}
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="bg-white/60 border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center">
                <PhoneCall className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-slate-500 text-sm font-medium">No patient outreach logs matched queries.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredLeads.map((lead) => {
                  const callback = lead.callback_time ? new Date(lead.callback_time) : null;
                  
                  return (
                    <motion.div
                      key={lead.id}
                      id={`lead-card-${lead.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-light-green transition-all duration-200"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <h3 className="font-bold text-slate-500 text-sm truncate leading-tight">{lead.patient_name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                            lead.status === 'Confirmed' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                            lead.status === 'Follow-up' ? 'bg-secondary-bg text-slate-500 border border-border-gray' :
                            lead.status === 'Interested' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                            'bg-alert-bg text-alert-text border border-alert-border'
                          }`}>
                            {lead.status}
                          </span>
                        </div>

                        <div className="space-y-2 bg-white/60 border border-border-gray p-3 rounded-xl mb-4 text-xs">
                          <div className="flex items-center gap-2 text-slate-500 font-semibold">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span>{lead.contact_number}</span>
                          </div>
                          {callback && (
                            <div className="flex items-center gap-2 text-slate-500 font-semibold">
                              <Calendar className="h-3.5 w-3.5 text-alert-text" />
                              <span>
                                Callback: {callback.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {callback.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 border-t border-border-gray pt-2 truncate">
                            Assigned Telecaller: <span className="text-slate-500 font-semibold">{lead.assigned_name || 'Unassigned'}</span>
                          </div>
                        </div>

                        {lead.notes && (
                          <p className="text-[10px] text-slate-500 italic mb-4 bg-white/20 p-2.5 rounded-lg border border-border-gray leading-normal">
                            "{lead.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-center border-t border-border-gray pt-3.5">
                        {/* Action buttons */}
                        <a
                          href={`tel:${lead.contact_number}`}
                          className="flex items-center gap-1 text-[10px] font-bold text-primary-green hover:text-emerald-500 bg-very-light-green/30 border border-light-green px-2 py-1 rounded-md"
                        >
                          <PhoneCall className="h-3 w-3" />
                          Place Call
                        </a>

                        <div className="flex items-center gap-1.5">
                          <button
                            id={`btn-edit-lead-${lead.id}`}
                            onClick={() => handleOpenEdit(lead)}
                            className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                            title="Edit Outreach details"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            id={`btn-delete-lead-${lead.id}`}
                            onClick={() => handleDelete(lead.id)}
                            className="p-1.5 text-slate-500 hover:text-alert-text hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal: Create/Edit Form */}
        <AnimatePresence>
          {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFormOpen(false)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    {selectedLead ? 'Edit Lead Observations' : 'New Patient Referral'}
                  </h3>
                  <button id="close-lead-modal" onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Patient Name</label>
                    <input
                      id="form-lead-name"
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Jane Austin"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input
                        id="form-lead-phone"
                        type="tel"
                        required
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="9988776655"
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Outreach Status</label>
                      <SelectField
                        id="form-lead-status"
                        value={status}
                        onChange={setStatus}
                        triggerClassName="py-2 px-3 text-xs"
                        options={[
                          { value: 'Interested', label: 'Interested' },
                          { value: 'Follow-up', label: 'Callback Follow-up' },
                          { value: 'Confirmed', label: 'Confirmed Appointment' },
                          { value: 'Not Responding', label: 'Not Responding' },
                          { value: 'Completed', label: 'Outreach Complete' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Callback Schedule</label>
                      <input
                        id="form-lead-callback"
                        type="datetime-local"
                        value={callbackTime}
                        onChange={(e) => setCallbackTime(e.target.value)}
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Telecaller</label>
                      <SelectField
                        id="form-lead-assignee"
                        value={assignedTo}
                        disabled={user?.role === 'Telecaller'}
                        onChange={setAssignedTo}
                        triggerClassName="py-2 px-3 text-xs disabled:bg-slate-50 disabled:text-slate-500"
                        options={
                          user?.role === 'Telecaller'
                            ? [{ value: String(user.id), label: `${user.name} (${user.role})` }]
                            : [
                                { value: '', label: 'Choose Telecaller' },
                                ...staff.map((s) => ({
                                  value: String(s.id),
                                  label: `${s.name} (${s.role})`,
                                })),
                              ]
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Outbound Notes</label>
                    <textarea
                      id="form-lead-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Suffering from varicose veins, wants weekend consult..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl p-3 text-xs text-slate-500 outline-none resize-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-lead"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-lead"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Saving...' : 'Save Lead'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}
