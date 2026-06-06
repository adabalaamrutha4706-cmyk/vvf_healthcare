'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Calendar as CalendarIcon, User, Search, Filter, Plus, Edit3, Trash2, 
  Lock, CheckCircle, Clock, IndianRupee, ShieldAlert, Sparkles, X, HeartHandshake,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';

function AppointmentsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  if (user?.role === 'Executive') {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center p-6 bg-white border border-border-gray rounded-2xl max-w-sm shadow-sm">
            <ShieldAlert className="h-10 w-10 text-alert-text mx-auto mb-3" />
            <h3 className="font-bold text-primary-text text-sm">Access Denied</h3>
            <p className="text-xs text-secondary-text mt-2">Field Executives do not have access to appointments scheduling records.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
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

  // Validation states
  const [patientNameError, setPatientNameError] = useState('');
  const [contactNumberError, setContactNumberError] = useState('');
  const [appointmentDateError, setAppointmentDateError] = useState('');
  const [totalAmountError, setTotalAmountError] = useState('');

  // Details Modal & History states
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAppForDetails, setSelectedAppForDetails] = useState<any | null>(null);
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Validation functions
  const validatePatientName = (val: string): boolean => {
    if (!val) {
      setPatientNameError('Patient Name is required.');
      return false;
    }
    const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;
    if (!nameRegex.test(val)) {
      setPatientNameError('Patient name can contain only letters.');
      return false;
    }
    setPatientNameError('');
    return true;
  };

  const validateContactNumber = (val: string): boolean => {
    if (!val) {
      setContactNumberError('Contact Number is required.');
      return false;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(val)) {
      setContactNumberError('Contact number must contain exactly 10 digits.');
      return false;
    }
    setContactNumberError('');
    return true;
  };

  const validateAppointmentDate = (val: string): boolean => {
    if (!val) {
      setAppointmentDateError('Appointment Date is required.');
      return false;
    }
    const selectedDate = new Date(val);
    if (isNaN(selectedDate.getTime())) {
      setAppointmentDateError('Invalid date format.');
      return false;
    }
    const today = new Date();
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (!selectedApp && selectedDateOnly < todayDateOnly) {
      setAppointmentDateError('Past appointment dates are not allowed.');
      return false;
    }
    setAppointmentDateError('');
    return true;
  };

  const validateTotalAmount = (val: string): boolean => {
    if (val === undefined || val === null || val === '') {
      setTotalAmountError('Consultation fee is required.');
      return false;
    }
    const feeRegex = /^\d+$/;
    if (!feeRegex.test(val)) {
      setTotalAmountError('Consultation fee must contain only numbers.');
      return false;
    }
    const num = parseFloat(val);
    if (num < 0 || num > 99999999) {
      setTotalAmountError('Consultation fee must contain only numbers.');
      return false;
    }
    setTotalAmountError('');
    return true;
  };

  const handlePatientNameChange = (val: string) => {
    setPatientName(val);
    validatePatientName(val);
  };

  const handleContactNumberChange = (val: string) => {
    setContactNumber(val);
    validateContactNumber(val);
  };

  const handleAppointmentDateChange = (val: string) => {
    setAppointmentDate(val);
    validateAppointmentDate(val);
  };

  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    validateTotalAmount(val);
  };

  const resetFormErrors = () => {
    setPatientNameError('');
    setContactNumberError('');
    setAppointmentDateError('');
    setTotalAmountError('');
  };

  const getTodayMinStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00`;
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

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
    resetFormErrors();
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
    resetFormErrors();
    setIsFormOpen(true);
  };

  const handleOpenDetails = async (app: any) => {
    setSelectedAppForDetails(app);
    setEditHistory([]);
    setHistoryLoading(true);
    setIsDetailsOpen(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.appointments.getHistory(app.id);
      setEditHistory(res.history || []);
    } catch (err: any) {
      console.error('Failed to load edit history:', err);
    } finally {
      setHistoryLoading(false);
    }
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

    const isNameValid = validatePatientName(patientName);
    const isPhoneValid = validateContactNumber(contactNumber);
    const isDateValid = validateAppointmentDate(appointmentDate);
    const isFeeValid = validateTotalAmount(totalAmount);

    if (!isNameValid || !isPhoneValid || !isDateValid || !isFeeValid) {
      setSubmitLoading(false);
      return;
    }

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
    if (['Admin', 'Superadmin'].includes(user?.role || '')) {
      return { locked: false, countdown: '', reason: 'Permanent edit access' };
    }
    if (['Telecaller', 'Executive'].includes(user?.role || '')) {
      return { locked: true, countdown: '', reason: 'Unauthorized role' };
    }

    if (user?.role === 'Reception') {
      const outstanding = parseFloat(app.total_amount || 0) - parseFloat(app.paid_amount || 0);
      const isPaid = ['Paid', 'Fully Cleared', 'Completed'].includes(app.payment_status) || (parseFloat(app.total_amount) > 0 && outstanding <= 0);
      if (isPaid) {
        return { locked: true, countdown: '', reason: 'Editing locked because payment has been fully cleared.' };
      }
      return { locked: false, countdown: 'Editable (Payment pending/partial)', reason: 'Editable' };
    }

    const elapsedMs = Date.now() - new Date(app.created_at).getTime();
    let limitMs = 0;
    let label = '';

    if (user?.role === 'Doctor') {
      limitMs = 24 * 60 * 60 * 1000;
      label = 'Doctor';
    } else if (user?.role === 'Chief Doctor') {
      limitMs = 72 * 60 * 60 * 1000;
      label = 'Chief Doctor';
    } else {
      return { locked: true, countdown: '', reason: 'Access locked' };
    }

    const remainingMs = limitMs - elapsedMs;
    if (remainingMs <= 0) {
      return { locked: true, countdown: '', reason: `Locked (${label} limit elapsed)` };
    }

    // Format remaining time
    const totalMinutes = Math.floor(remainingMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    let countdownStr = '';
    if (hours > 0) {
      countdownStr = `Editable for next ${hours}h ${minutes}m`;
    } else {
      countdownStr = `Editable for next ${minutes}m`;
    }

    return { locked: false, countdown: countdownStr, reason: `Editable within ${label} window` };
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
      <div className="space-y-4">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-primary-text flex items-center gap-2">
              Appointment Scheduling
              <HeartHandshake className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-secondary-text mt-0.5">
              Book consultations, handle clinic receipts, and manage clinical assignments.
            </p>
          </div>

          {['Admin', 'Reception', 'Chief Doctor'].includes(user?.role || '') && (
            <button
              id="btn-new-appointment"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-sm"
            >
              <Plus className="h-4.5 w-4.5" />
              Schedule Appointment
            </button>
          )}
        </div>

        {/* Global Feedback Panels */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/50 text-xs text-primary-text flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {/* Search and filter panel */}
        <div className="flex flex-col gap-3 bg-white border border-border-gray p-3 rounded-xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-secondary-text/60" />
            <input
              id="search-input"
              type="text"
              placeholder="Search by Patient name, Phone number, or Doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-secondary-text placeholder-slate-400 outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-secondary-text font-medium">
              <Filter className="h-3.5 w-3.5 text-secondary-text/60" />
              <span>Status Filter:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {['All', 'Unpaid', 'Partially Paid', 'Completed'].map((opt) => (
                <button
                  key={opt}
                  id={`filter-${opt.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setPaymentFilter(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    paymentFilter === opt
                      ? 'bg-light-green text-primary-green border border-primary-green/30'
                      : 'bg-white text-secondary-text border border-border-gray hover:bg-very-light-green hover:text-primary-green'
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
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <CalendarIcon className="h-10 w-10 text-secondary-text/40 mb-3" />
            <p className="text-secondary-text text-sm font-medium">No matching appointments found.</p>
            <p className="text-xs text-secondary-text/80 mt-1">Book your first patient consultation using the Schedule button.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAppointments.map((app) => {
              const editStatus = getEditLockStatus(app);
              const appDate = new Date(app.appointment_date);
              
              return (
                <motion.div
                  key={app.id}
                  id={`appointment-card-${app.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-light-green hover:shadow-sm transition-all duration-200"
                >
                  <div>
                    {/* Header: Name and Lock Status */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <h3 
                          onClick={() => handleOpenDetails(app)} 
                          className="font-bold text-primary-text text-sm leading-tight truncate cursor-pointer hover:text-primary-green hover:underline decoration-2"
                        >
                          {app.patient_name}
                        </h3>
                        <p className="text-[10px] text-secondary-text mt-0.5 font-medium">
                          {app.age} yrs • {app.gender} • {app.contact_number}
                        </p>
                      </div>
                      
                      {editStatus.locked ? (
                        <div className="p-1 bg-alert-bg rounded-lg text-alert-text border border-alert-border/40" title={editStatus.reason}>
                          <Lock className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 bg-very-light-green rounded-lg text-primary-green border border-light-green/40" title={editStatus.reason}>
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Date and Clinical Assignment */}
                    <div className="space-y-2.5 bg-secondary-bg border border-border-gray p-2.5 sm:p-3 rounded-xl mb-3">
                      <div className="flex items-center gap-2 text-xs text-secondary-text">
                        <CalendarIcon className="h-3.5 w-3.5 text-primary-green" />
                        <span>
                          {appDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} • {appDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-secondary-text">
                        <User className="h-3.5 w-3.5 text-secondary-text/60" />
                        <span>Doctor: <strong className="text-primary-text">{app.doctor_name || 'Unassigned'}</strong></span>
                      </div>
                      <div className="text-[10px] text-secondary-text/80 border-t border-border-gray pt-2 truncate">
                        Hospital: <span className="text-secondary-text font-medium">{app.hospital_name || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex items-center justify-between p-2.5 bg-secondary-bg border border-border-gray rounded-lg text-xs mb-3">
                      <div>
                        <span className="text-[10px] text-secondary-text block font-semibold">Total Fee</span>
                        <strong className="text-primary-text">₹{app.total_amount}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-secondary-text block font-semibold">Paid</span>
                        <strong className="text-primary-green">₹{app.paid_amount}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-secondary-text block font-semibold">Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          app.payment_status === 'Completed' ? 'bg-very-light-green text-primary-green border border-light-green' :
                          app.payment_status === 'Partially Paid' ? 'bg-secondary-bg text-secondary-text border border-border-gray' :
                          'bg-alert-bg text-alert-text border border-alert-border'
                        }`}>
                          {app.payment_status}
                        </span>
                      </div>
                    </div>

                    {app.notes && (
                      <p className="text-[10px] text-secondary-text italic mb-3 leading-normal bg-secondary-bg p-2.5 rounded-lg border border-border-gray/40">
                        "{app.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions Drawer */}
                  <div className="flex items-center justify-between border-t border-border-gray pt-3.5 gap-2">
                    
                    {/* Add Payment action for Reception/Admin */}
                    {['Admin', 'Reception'].includes(user?.role || '') && app.payment_status !== 'Completed' ? (
                      <button
                        id={`btn-pay-${app.id}`}
                        onClick={() => handleOpenPayment(app)}
                        className="flex items-center gap-1 text-[10px] font-bold text-primary-green hover:text-primary-green-hover bg-very-light-green border border-light-green px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        <IndianRupee className="h-3 w-3" />
                        Log Payment
                      </button>
                    ) : <div />}

                    <div className="flex items-center gap-1.5">
                      {editStatus.countdown && (
                        <span className="text-[10px] text-primary-green font-semibold animate-pulse bg-very-light-green border border-light-green/40 px-2.5 py-1 rounded-lg">
                          {editStatus.countdown}
                        </span>
                      )}
                      {editStatus.locked && (
                        <span className="text-[10px] text-secondary-text/60 font-semibold bg-secondary-bg border border-border-gray px-2.5 py-1 rounded-lg" title={editStatus.reason}>
                          Locked
                        </span>
                      )}
                      <button
                        id={`btn-details-${app.id}`}
                        onClick={() => handleOpenDetails(app)}
                        className="p-2 text-secondary-text hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-all border border-transparent"
                        title="View Details & History"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        id={`btn-edit-${app.id}`}
                        onClick={() => !editStatus.locked && handleOpenEdit(app)}
                        disabled={editStatus.locked}
                        className={`p-2 rounded-lg transition-all ${
                          editStatus.locked 
                            ? 'text-secondary-text/30 cursor-not-allowed bg-secondary-bg border border-border-gray' 
                            : 'text-secondary-text hover:text-primary-green hover:bg-very-light-green cursor-pointer'
                        }`}
                        title={editStatus.locked ? editStatus.reason : 'Edit Appointment'}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {['Admin', 'Chief Doctor', 'Superadmin'].includes(user?.role || '') && (
                        <button
                          id={`btn-delete-${app.id}`}
                          onClick={() => handleDelete(app.id)}
                          className="p-2 text-secondary-text hover:text-alert-text hover:bg-alert-bg rounded-lg cursor-pointer transition-all border border-transparent hover:border-alert-border"
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
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFormOpen(false)}
                className="fixed inset-0 bg-slate-900"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between bg-secondary-bg">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    {selectedApp ? 'Modify Appointment Record' : 'Create Appointment Record'}
                  </h3>
                  <button id="close-form-modal" onClick={() => setIsFormOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Grid 1: Name and Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Patient Name</label>
                      <input
                        id="form-patient-name"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => handlePatientNameChange(e.target.value)}
                        placeholder="John Doe"
                        className={`w-full bg-white border ${patientNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-secondary-text outline-none`}
                      />
                      {patientNameError && (
                        <p className="text-[10px] text-rose-700 mt-1 font-semibold">{patientNameError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Contact Number</label>
                      <input
                        id="form-contact-number"
                        type="tel"
                        required
                        value={contactNumber}
                        onChange={(e) => handleContactNumberChange(e.target.value)}
                        placeholder="9876543210"
                        className={`w-full bg-white border ${contactNumberError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-secondary-text outline-none`}
                      />
                      {contactNumberError && (
                        <p className="text-[10px] text-rose-700 mt-1 font-semibold">{contactNumberError}</p>
                      )}
                    </div>
                  </div>

                  {/* Grid 2: Age and Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Patient Age</label>
                      <input
                        id="form-age"
                        type="number"
                        required
                        min="0"
                        max="130"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="35"
                        className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-secondary-text outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Gender</label>
                      <SelectField
                        id="form-gender"
                        value={gender}
                        onChange={setGender}
                        triggerClassName="py-2 px-3 text-xs text-secondary-text"
                        options={[
                          { value: 'Male', label: 'Male' },
                          { value: 'Female', label: 'Female' },
                          { value: 'Other', label: 'Other' },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Grid 3: Doctor and Hospital */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Assigned Clinician</label>
                      <SelectField
                        id="form-doctor-id"
                        value={doctorId}
                        onChange={setDoctorId}
                        triggerClassName="py-2 px-3 text-xs text-secondary-text"
                        options={doctors.map((d) => ({
                          value: String(d.id),
                          label: `🩺 ${d.name} (${d.role})`,
                        }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Foundation Hospital</label>
                      <SelectField
                        id="form-hospital-id"
                        value={hospitalId}
                        onChange={setHospitalId}
                        triggerClassName="py-2 px-3 text-xs text-secondary-text"
                        options={hospitals.map((h) => ({
                          value: String(h.id),
                          label: `🏥 ${h.name} (${h.hospital_uid || 'UID Pending'} - ${h.city})`,
                        }))}
                      />
                    </div>
                  </div>

                  {/* Grid 4: Consultation Date & Fee */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Appointment Schedule</label>
                      <input
                        id="form-appointment-date"
                        type="datetime-local"
                        required
                        min={selectedApp ? undefined : getTodayMinStr()}
                        value={appointmentDate}
                        onChange={(e) => handleAppointmentDateChange(e.target.value)}
                        className={`w-full bg-white border ${appointmentDateError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-secondary-text outline-none`}
                      />
                      {appointmentDateError && (
                        <p className="text-[10px] text-rose-700 mt-1 font-semibold">{appointmentDateError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Consultation Total Fee (₹)</label>
                      <input
                        id="form-total-amount"
                        type="text"
                        required
                        value={totalAmount}
                        onChange={(e) => handleTotalAmountChange(e.target.value)}
                        className={`w-full bg-white border ${totalAmountError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-secondary-text outline-none`}
                      />
                      {totalAmountError && (
                        <p className="text-[10px] text-rose-700 mt-1 font-semibold">{totalAmountError}</p>
                      )}
                    </div>
                  </div>

                  {/* Notes Area */}
                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Diagnostic / Visit Notes</label>
                    <textarea
                      id="form-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Symptoms, previous records reference, clinical indications..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl p-3 text-xs text-secondary-text outline-none resize-none"
                    />
                  </div>

                  {/* Action row */}
                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-form"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-form"
                      type="submit"
                      disabled={submitLoading || !!patientNameError || !!contactNumberError || !!appointmentDateError || !!totalAmountError}
                      className={`px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl transition-all flex items-center gap-1.5 ${
                        (submitLoading || !!patientNameError || !!contactNumberError || !!appointmentDateError || !!totalAmountError)
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
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
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPaymentOpen(false)}
                className="fixed inset-0 bg-slate-900"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between bg-secondary-bg">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <IndianRupee className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    Log Consultation Transaction
                  </h3>
                  <button id="close-payment-modal" onClick={() => setIsPaymentOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
 
                <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <span className="text-[10px] text-secondary-text block mb-1">Receipt for Patient:</span>
                    <strong className="text-sm text-primary-text block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Payment Amount (₹)</label>
                      <input
                        id="payment-amount"
                        type="number"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-secondary-text outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Payment Method</label>
                      <SelectField
                        id="payment-method"
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        triggerClassName="py-2.5 px-3 text-xs text-secondary-text"
                        options={[
                          { value: 'Digital (UPI/Card)', label: 'UPI / GPay / PhonePe' },
                          { value: 'Cash Receipt', label: 'Cash Desk' },
                          { value: 'Bank Transfer', label: 'Bank Wire' },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Reference Transaction ID / UTR (Optional)</label>
                    <input
                      id="payment-reference"
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="TXN987654321"
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-secondary-text outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Transaction Notes</label>
                    <input
                      id="payment-notes"
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Consultation co-pay, surgery deposit..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-secondary-text outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-payment"
                      type="button"
                      onClick={() => setIsPaymentOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-payment"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      {submitLoading ? 'Logging...' : 'Clear Amount'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Appointment Details & Edit History */}
        <AnimatePresence>
          {isDetailsOpen && selectedAppForDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDetailsOpen(false)}
                className="fixed inset-0 bg-slate-900"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between bg-secondary-bg">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <Eye className="h-4.5 w-4.5 text-primary-green" />
                    Appointment Details & Audit Trail
                  </h3>
                  <button id="close-details-modal" onClick={() => setIsDetailsOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Grid Layout: Details Left, History Right */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Patient Details */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-2">Patient Information</h4>
                        <div className="bg-secondary-bg border border-border-gray p-4 rounded-xl space-y-3">
                          <div>
                            <span className="text-[10px] text-secondary-text block">Name</span>
                            <span className="text-sm font-bold text-primary-text">{selectedAppForDetails.patient_name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-secondary-text block">Age & Gender</span>
                              <span className="text-xs font-semibold text-primary-text">{selectedAppForDetails.age} yrs • {selectedAppForDetails.gender}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block">Contact</span>
                              <span className="text-xs font-semibold text-primary-text">{selectedAppForDetails.contact_number}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-2">Clinical Assignment</h4>
                        <div className="bg-secondary-bg border border-border-gray p-4 rounded-xl space-y-3">
                          <div>
                            <span className="text-[10px] text-secondary-text block">Assigned Doctor</span>
                            <span className="text-xs font-semibold text-primary-text">🩺 {selectedAppForDetails.doctor_name || 'Unassigned'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-secondary-text block">Foundation Hospital</span>
                            <span className="text-xs font-semibold text-primary-text">🏥 {selectedAppForDetails.hospital_name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-secondary-text block">Schedule Date</span>
                            <span className="text-xs font-semibold text-primary-text">
                              📅 {new Date(selectedAppForDetails.appointment_date).toLocaleString('en-IN', {
                                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-2">Financial Status</h4>
                        <div className="bg-secondary-bg border border-border-gray p-4 rounded-xl">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[10px] text-secondary-text block">Total Fee</span>
                              <span className="text-xs font-bold text-primary-text">₹{selectedAppForDetails.total_amount}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block">Paid</span>
                              <span className="text-xs font-bold text-primary-green">₹{selectedAppForDetails.paid_amount}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block">Outstanding</span>
                              <span className="text-xs font-bold text-alert-text">₹{selectedAppForDetails.total_amount - selectedAppForDetails.paid_amount}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-border-gray/50 flex justify-between items-center">
                            <span className="text-[10px] text-secondary-text">Payment Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              selectedAppForDetails.payment_status === 'Completed' ? 'bg-very-light-green text-primary-green border border-light-green' :
                              selectedAppForDetails.payment_status === 'Partially Paid' ? 'bg-secondary-bg text-secondary-text border border-border-gray' :
                              'bg-alert-bg text-alert-text border border-alert-border'
                            }`}>
                              {selectedAppForDetails.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {selectedAppForDetails.notes && (
                        <div>
                          <h4 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-2">Diagnostic Notes</h4>
                          <div className="bg-secondary-bg border border-border-gray p-3 rounded-xl text-xs text-secondary-text italic">
                            "{selectedAppForDetails.notes}"
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Edit History Timeline */}
                    <div className="flex flex-col h-full border-t md:border-t-0 md:border-l border-border-gray pt-4 md:pt-0 md:pl-6">
                      <h4 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-3">Audit Logs & Edit History</h4>
                      
                      <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] pr-1 space-y-4">
                        {historyLoading ? (
                          <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                          </div>
                        ) : editHistory.length === 0 ? (
                          <div className="text-center py-8 bg-secondary-bg/50 border border-dashed border-border-gray rounded-xl">
                            <p className="text-xs text-secondary-text italic">No edit history recorded.</p>
                            <p className="text-[10px] text-secondary-text/80 mt-1">Updates to this appointment will be tracked here.</p>
                          </div>
                        ) : (
                          <div className="relative pl-4 border-l border-border-gray space-y-4">
                            {editHistory.map((log: any) => {
                              const summaries = log.change_summary 
                                ? log.change_summary.split('\n').map((s: string) => s.replace(/^•\s*/, '')).filter(Boolean)
                                : [];
                              return (
                                <div key={log.id} className="relative text-xs">
                                  {/* Dot */}
                                  <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary-green ring-4 ring-white" />
                                  
                                  <div className="bg-secondary-bg/60 border border-border-gray/50 rounded-xl p-3 space-y-1.5 hover:border-light-green transition-all">
                                    <div className="flex items-center justify-between text-[10px] text-secondary-text flex-wrap gap-1">
                                      <span className="font-bold text-primary-text">{log.edited_by_name}</span>
                                      <span className="text-[9px] bg-white border border-border-gray/80 px-1.5 py-0.5 rounded text-secondary-text uppercase font-semibold">
                                        {log.edited_by_designation}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-secondary-text">
                                      {new Date(log.edited_at).toLocaleString('en-IN')}
                                    </p>
                                    
                                    <ul className="space-y-1 pt-1 border-t border-border-gray/40">
                                      {summaries.map((s: string, idx: number) => (
                                        <li key={idx} className="text-[10px] text-secondary-text list-disc pl-0.5 ml-3">
                                          {s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-border-gray flex items-center justify-end bg-secondary-bg gap-2.5">
                  <button
                    id="btn-close-details"
                    type="button"
                    onClick={() => setIsDetailsOpen(false)}
                    className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Close
                  </button>
                </div>
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        </div>
      </DashboardLayout>
    }>
      <AppointmentsContent />
    </Suspense>
  );
}
