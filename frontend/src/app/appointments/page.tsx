'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Calendar as CalendarIcon, User, Search, Filter, Plus, Edit3, Trash2, 
  Lock, CheckCircle, Clock, IndianRupee, ShieldAlert, Sparkles, X, HeartHandshake
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function AppointmentsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  // Lists
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  
  // Modals & States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Payment Quick Log Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Digital (UPI/Card)');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [transactionRef, setTransactionRef] = useState('');

  // Form Fields
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [contactNumber, setContactNumber] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // If query string has new=true, auto-open form
    if (searchParams.get('new') === 'true') {
      handleOpenCreate();
    }
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const appRes = await api.appointments.getAll();
      setAppointments(appRes.appointments || []);

      const docRes = await api.users.getDoctors();
      setDoctors(docRes.doctors || []);

      const hospRes = await api.hospitals.getAll();
      setHospitals(hospRes.hospitals || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch appointment metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedApp(null);
    setPatientName('');
    setAge('');
    setGender('Male');
    setContactNumber('');
    setHospitalId(hospitals[0]?.id?.toString() || '');
    setDoctorId(doctors[0]?.id?.toString() || '');
    // Default tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setAppointmentDate(tomorrow.toISOString().slice(0, 16));
    setNotes('');
    setTotalAmount('1500'); // default consult fee
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (app: any) => {
    setSelectedApp(app);
    setPatientName(app.patient_name);
    setAge(app.age.toString());
    setGender(app.gender);
    setContactNumber(app.contact_number);
    setHospitalId(app.hospital_id?.toString() || '');
    setDoctorId(app.doctor_id?.toString() || '');
    setAppointmentDate(new Date(app.appointment_date).toISOString().slice(0, 16));
    setNotes(app.notes || '');
    setTotalAmount(app.total_amount.toString());
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenPayment = (app: any) => {
    setSelectedApp(app);
    setPaymentAmount((app.total_amount - app.paid_amount).toString());
    setPaymentMethod('Digital (UPI/Card)');
    setPaymentNotes('');
    setTransactionRef('');
    setIsPaymentOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      patient_name: patientName,
      age: parseInt(age),
      gender,
      contact_number: contactNumber,
      hospital_id: parseInt(hospitalId),
      doctor_id: parseInt(doctorId),
      appointment_date: new Date(appointmentDate).toISOString(),
      notes,
      total_amount: parseFloat(totalAmount)
    };

    try {
      if (selectedApp) {
        await api.appointments.update(selectedApp.id, payload);
        setSuccess('Appointment details modified successfully.');
      } else {
        await api.appointments.create(payload);
        setSuccess('New appointment booked successfully.');
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Validation error. Please verify input fields.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.appointments.addPayment(selectedApp.id, {
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
        notes: paymentNotes
      });
      setSuccess('Transaction logged successfully.');
      setIsPaymentOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Transaction logging failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this appointment? This soft-deletes the record.')) return;
    try {
      await api.appointments.delete(id);
      setSuccess('Appointment cancelled successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment.');
    }
  };

  // Helper to determine if an appointment is editable based on user role and elapsed time
  const getEditLockStatus = (app: any) => {
    if (['Admin', 'Chief Doctor'].includes(user?.role || '')) {
      return { locked: false, reason: 'Unrestricted Chief access override' };
    }
    if (['Telecaller', 'Executive'].includes(user?.role || '')) {
      return { locked: true, reason: 'Role unauthorized' };
    }

    const elapsedMs = Date.now() - new Date(app.created_at).getTime();
    const elapsedHrs = elapsedMs / (1000 * 60 * 60);

    if (user?.role === 'Reception') {
      if (elapsedHrs > 3) {
        return { locked: true, reason: `Locked (3h window elapsed. Current: ${elapsedHrs.toFixed(1)}h)` };
      }
      return { locked: false, reason: 'Within 3h Reception edit window' };
    }

    if (user?.role === 'Doctor') {
      if (elapsedHrs > 24) {
        return { locked: true, reason: `Locked (24h window elapsed. Current: ${elapsedHrs.toFixed(1)}h)` };
      }
      return { locked: false, reason: 'Within 24h Doctor edit window' };
    }

    return { locked: true, reason: 'Access locked' };
  };

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = app.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      app.contact_number.includes(search) ||
      (app.doctor_name && app.doctor_name.toLowerCase().includes(search.toLowerCase()));
      
    if (paymentFilter === 'All') return matchesSearch;
    return matchesSearch && app.payment_status === paymentFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Appointment Scheduling
              <HeartHandshake className="h-5 w-5 text-cyan-400" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Book consultations, handle clinic receipts, and manage clinical assignments.
            </p>
          </div>

          {['Admin', 'Reception', 'Chief Doctor'].includes(user?.role || '') && (
            <button
              id="btn-new-appointment"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-950/20"
            >
              <Plus className="h-4.5 w-4.5" />
              Schedule Appointment
            </button>
          )}
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

        {/* Search and filter panel */}
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
            <input
              id="search-input"
              type="text"
              placeholder="Search by Patient name, Phone number, or Doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Status Filter:</span>
            </div>
            <div className="flex gap-1">
              {['All', 'Unpaid', 'Partially Paid', 'Completed'].map((opt) => (
                <button
                  key={opt}
                  id={`filter-${opt.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setPaymentFilter(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    paymentFilter === opt
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-850'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of Appointments (Desktop/Tablet Card list) */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-850 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <CalendarIcon className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm font-medium">No matching appointments found.</p>
            <p className="text-xs text-slate-500 mt-1">Book your first patient consultation using the Schedule button.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAppointments.map((app) => {
              const editStatus = getEditLockStatus(app);
              const appDate = new Date(app.appointment_date);
              
              return (
                <motion.div
                  key={app.id}
                  id={`appointment-card-${app.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-200"
                >
                  <div>
                    {/* Header: Name and Lock Status */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-slate-200 text-sm leading-tight truncate">{app.patient_name}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          {app.age} yrs • {app.gender} • {app.contact_number}
                        </p>
                      </div>
                      
                      {editStatus.locked ? (
                        <div className="p-1 bg-slate-950 rounded-lg text-rose-400 border border-rose-900/20" title={editStatus.reason}>
                          <Lock className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 bg-slate-950 rounded-lg text-cyan-400 border border-cyan-900/20" title={editStatus.reason}>
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Date and Clinical Assignment */}
                    <div className="space-y-2.5 bg-slate-950/60 border border-slate-850 p-3 rounded-xl mb-4">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <CalendarIcon className="h-3.5 w-3.5 text-cyan-400" />
                        <span>
                          {appDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} • {appDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        <span>Doctor: <strong className="text-slate-300">{app.doctor_name || 'Unassigned'}</strong></span>
                      </div>
                      <div className="text-[10px] text-slate-500 border-t border-slate-850/80 pt-2 truncate">
                        Hospital: <span className="text-slate-400">{app.hospital_name || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-950/20 border border-slate-850 rounded-lg text-xs mb-4">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold">Total Fee</span>
                        <strong className="text-slate-200">₹{app.total_amount}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-semibold">Paid</span>
                        <strong className="text-emerald-400">₹{app.paid_amount}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-semibold">Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          app.payment_status === 'Completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                          app.payment_status === 'Partially Paid' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                          'bg-rose-950 text-rose-400 border border-rose-500/20'
                        }`}>
                          {app.payment_status}
                        </span>
                      </div>
                    </div>

                    {app.notes && (
                      <p className="text-[10px] text-slate-400 italic mb-4 leading-normal bg-slate-950/20 p-2.5 rounded-lg border border-slate-850/40">
                        "{app.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions Drawer */}
                  <div className="flex items-center justify-between border-t border-slate-850/80 pt-3.5 gap-2">
                    
                    {/* Add Payment action for Reception/Admin */}
                    {['Admin', 'Reception'].includes(user?.role || '') && app.payment_status !== 'Completed' ? (
                      <button
                        id={`btn-pay-${app.id}`}
                        onClick={() => handleOpenPayment(app)}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/30 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        <IndianRupee className="h-3 w-3" />
                        Log Payment
                      </button>
                    ) : <div />}

                    <div className="flex items-center gap-1.5">
                      {!editStatus.locked && (
                        <button
                          id={`btn-edit-${app.id}`}
                          onClick={() => handleOpenEdit(app)}
                          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-all"
                          title="Edit Appointment"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {['Admin', 'Chief Doctor'].includes(user?.role || '') && (
                        <button
                          id={`btn-delete-${app.id}`}
                          onClick={() => handleDelete(app.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-all"
                          title="Cancel/Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Modal: Form Dialog (Create / Edit) */}
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
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                    {selectedApp ? 'Modify Appointment Record' : 'Create Appointment Record'}
                  </h3>
                  <button id="close-form-modal" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Grid 1: Name and Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Patient Name</label>
                      <input
                        id="form-patient-name"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contact Number</label>
                      <input
                        id="form-contact-number"
                        type="tel"
                        required
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="9876543210"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  {/* Grid 2: Age and Gender */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Patient Age</label>
                      <input
                        id="form-age"
                        type="number"
                        required
                        min="0"
                        max="130"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="35"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Gender</label>
                      <select
                        id="form-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Grid 3: Doctor and Hospital */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Clinician</label>
                      <select
                        id="form-doctor-id"
                        required
                        value={doctorId}
                        onChange={(e) => setDoctorId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>🩺 {d.name} ({d.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Foundation Hospital</label>
                      <select
                        id="form-hospital-id"
                        required
                        value={hospitalId}
                        onChange={(e) => setHospitalId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        {hospitals.map(h => (
                          <option key={h.id} value={h.id}>🏥 {h.name} ({h.city})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Grid 4: Consultation Date & Fee */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Appointment Schedule</label>
                      <input
                        id="form-appointment-date"
                        type="datetime-local"
                        required
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Consultation Total Fee (₹)</label>
                      <input
                        id="form-total-amount"
                        type="number"
                        required
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes Area */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Diagnostic / Visit Notes</label>
                    <textarea
                      id="form-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Symptoms, previous records reference, clinical indications..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl p-3 text-xs text-slate-200 outline-none resize-none"
                    />
                  </div>

                  {/* Action row */}
                  <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-form"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-form"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      {submitLoading ? 'Submitting...' : 'Register Record'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Quick Log Payment Transaction */}
        <AnimatePresence>
          {isPaymentOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPaymentOpen(false)}
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
                    <IndianRupee className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
                    Log Consultation Transaction
                  </h3>
                  <button id="close-payment-modal" onClick={() => setIsPaymentOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Receipt for Patient:</span>
                    <strong className="text-sm text-slate-200 block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Amount (₹)</label>
                      <input
                        id="payment-amount"
                        type="number"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="Digital (UPI/Card)">UPI / GPay / PhonePe</option>
                        <option value="Cash Receipt">Cash Desk</option>
                        <option value="Bank Transfer">Bank Wire</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reference Transaction ID / UTR (Optional)</label>
                    <input
                      id="payment-reference"
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="TXN987654321"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Transaction Notes</label>
                    <input
                      id="payment-notes"
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Consultation co-pay, surgery deposit..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-payment"
                      type="button"
                      onClick={() => setIsPaymentOpen(false)}
                      className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-payment"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Logging...' : 'Clear Amount'}
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

export default function AppointmentsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
        </div>
      </DashboardLayout>
    }>
      <AppointmentsContent />
    </Suspense>
  );
}
