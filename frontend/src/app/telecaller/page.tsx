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

export default function TelecallerPage() {
  const { user } = useAuth();
  
  // Lists
  const [leads, setLeads] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
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

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await api.leads.getAll();
      setLeads(res.leads || []);

      // Also get telecallers list from backend user listing for assignment options
      const userRes = await api.users.getAll();
      const telecallers = (userRes.users || []).filter((u: any) => ['Telecaller', 'Admin'].includes(u.role));
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

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && l.status === statusFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Telecalling & Patient Outreach
              <PhoneCall className="h-5 w-5 text-cyan-400" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Outbound patient lead checklists, appointment callback schedules, and logs.
            </p>
          </div>

          <button
            id="btn-new-lead"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-950/20"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Patient Lead
          </button>
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

        {/* Search Panel */}
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
            <input
              id="lead-search"
              type="text"
              placeholder="Search leads by name, phone, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Outreach Status:</span>
            <div className="flex flex-wrap gap-1">
              {['All', 'Interested', 'Follow-up', 'Confirmed', 'Not Responding'].map((st) => (
                <button
                  key={st}
                  id={`status-${st.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    statusFilter === st
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-850'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid List */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-850 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <PhoneCall className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm font-medium">No patient outreach logs matched queries.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredLeads.map((lead) => {
              const callback = lead.callback_time ? new Date(lead.callback_time) : null;
              
              return (
                <motion.div
                  key={lead.id}
                  id={`lead-card-${lead.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-200"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <h3 className="font-bold text-slate-200 text-sm truncate leading-tight">{lead.patient_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                        lead.status === 'Confirmed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                        lead.status === 'Follow-up' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                        lead.status === 'Interested' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/20' :
                        'bg-rose-950 text-rose-400 border border-rose-500/20'
                      }`}>
                        {lead.status}
                      </span>
                    </div>

                    <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-3 rounded-xl mb-4 text-xs">
                      <div className="flex items-center gap-2 text-slate-350 font-semibold">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>{lead.contact_number}</span>
                      </div>
                      {callback && (
                        <div className="flex items-center gap-2 text-amber-400 font-semibold">
                          <Calendar className="h-3.5 w-3.5 text-amber-500" />
                          <span>
                            Callback: {callback.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {callback.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 border-t border-slate-850/80 pt-2 truncate">
                        Outreach Agent: <span className="text-slate-400 font-semibold">{lead.assigned_name || 'Unassigned'}</span>
                      </div>
                    </div>

                    {lead.notes && (
                      <p className="text-[10px] text-slate-450 italic mb-4 bg-slate-950/20 p-2.5 rounded-lg border border-slate-850/40 leading-normal">
                        "{lead.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-850 pt-3.5">
                    {/* Action buttons */}
                    <a
                      href={`tel:${lead.contact_number}`}
                      className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 border border-cyan-850 px-2 py-1 rounded-md"
                    >
                      <PhoneCall className="h-3 w-3" />
                      Place Call
                    </a>

                    <div className="flex items-center gap-1.5">
                      <button
                        id={`btn-edit-lead-${lead.id}`}
                        onClick={() => handleOpenEdit(lead)}
                        className="p-1.5 text-slate-450 hover:text-cyan-400 hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors"
                        title="Edit Outreach details"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        id={`btn-delete-lead-${lead.id}`}
                        onClick={() => handleDelete(lead.id)}
                        className="p-1.5 text-slate-450 hover:text-rose-400 hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors"
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
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                    {selectedLead ? 'Edit Lead Observations' : 'New Patient Referral'}
                  </h3>
                  <button id="close-lead-modal" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Patient Name</label>
                    <input
                      id="form-lead-name"
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Jane Austin"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input
                        id="form-lead-phone"
                        type="tel"
                        required
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="9988776655"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Outreach Status</label>
                      <select
                        id="form-lead-status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="Interested">Interested</option>
                        <option value="Follow-up">Callback Follow-up</option>
                        <option value="Confirmed">Confirmed Appointment</option>
                        <option value="Not Responding">Not Responding</option>
                        <option value="Completed">Outreach Complete</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Callback Schedule</label>
                      <input
                        id="form-lead-callback"
                        type="datetime-local"
                        value={callbackTime}
                        onChange={(e) => setCallbackTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Agent</label>
                      <select
                        id="form-lead-assignee"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="">Choose Agent</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Outbound Notes</label>
                    <textarea
                      id="form-lead-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Suffering from varicose veins, wants weekend consult..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl p-3 text-xs text-slate-200 outline-none resize-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-lead"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-lead"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/20"
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
