'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  CalendarDays, PlusCircle, Search, Filter, ShieldAlert, CheckCircle2, 
  User, Phone, Calendar, Clipboard, Loader2, Sparkles, SlidersHorizontal 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExecutiveFieldAppointments() {
  const { user } = useAuth();
  
  // Registration Form State
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: '',
    phone_number: '',
    appointment_type: '',
    medical_history: ''
  });
  
  // Submission Statuses
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Table Log & Filters State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState('');
  
  const [filters, setFilters] = useState({
    search: '',
    appointment_type: 'All',
    start_date: '',
    end_date: '',
    status: 'All'
  });

  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Fetch Submitted Records
  const fetchAppointments = async () => {
    setTableLoading(true);
    setTableError('');
    try {
      const params: any = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.appointment_type !== 'All') params.appointment_type = filters.appointment_type;
      if (filters.status !== 'All') params.status = filters.status;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await api.fieldAppointments.getAll(params);
      setAppointments(res.data || res || []);
    } catch (err: any) {
      setTableError(err.message || 'Failed to retrieve records.');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filters.appointment_type, filters.status, filters.start_date, filters.end_date]);

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchAppointments();
    }
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    
    // Frontend Validations
    const { full_name, age, gender, phone_number, appointment_type, medical_history } = formData;
    
    if (!full_name || !age || !gender || !phone_number || !appointment_type) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(full_name.trim())) {
      setFormError('Patient name can contain only letters and spaces.');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 125) {
      setFormError('Please enter a valid age.');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone_number.trim())) {
      setFormError('Phone number must be exactly 10 digits.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await api.fieldAppointments.create({
        full_name,
        age: parsedAge,
        gender,
        phone_number: phone_number.trim(),
        appointment_type,
        medical_history
      });

      setFormSuccess(`Lead registered successfully! Lead ID: ${res.data?.patient_lead_id || res.patient_lead_id}`);
      
      // Reset form fields
      setFormData({
        full_name: '',
        age: '',
        gender: '',
        phone_number: '',
        appointment_type: '',
        medical_history: ''
      });
      
      // Refresh list
      fetchAppointments();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit field appointment.');
    } finally {
      setSubmitLoading(false);
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
        return 'bg-slate-100 text-slate-600 border-slate-300';
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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full min-w-0 pb-12">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary-green" />
              Field Patient Leads Registration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Register new patient leads directly from the field and monitor validation statuses.
            </p>
          </div>
        </div>

        {/* Main Grid: Form on Left/Right, Tables on the other */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Panel */}
          <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm h-fit">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <PlusCircle className="h-4.5 w-4.5 text-primary-green" />
              New Patient Details
            </h2>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-750 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter patient full name"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Age and Gender Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Age"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="" disabled>Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Appointment Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Appointment Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.appointment_type}
                  onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all cursor-pointer"
                >
                  <option value="" disabled>Select Requirement</option>
                  <option value="Doctor Consultation">Doctor Consultation</option>
                  <option value="Dental Consultation">Dental Consultation</option>
                  <option value="Therapy Services">Therapy Services</option>
                </select>
              </div>

              {/* Medical History */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Health Background / Medical History
                </label>
                <div className="relative">
                  <Clipboard className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={4}
                    value={formData.medical_history}
                    onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                    placeholder="Allergies, chronic conditions, treatment histories, etc."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 px-4 bg-primary-green hover:bg-primary-green-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering Lead...
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Submit Lead
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Records Table Log Panel */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={handleSearchKeyPress}
                  placeholder="Search by Patient Name or Phone (Enter)"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-green focus:bg-white transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    showFiltersPanel || filters.appointment_type !== 'All' || filters.status !== 'All' || filters.start_date || filters.end_date
                      ? 'bg-very-light-green text-primary-green border-light-green'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </button>

                <button
                  type="button"
                  onClick={fetchAppointments}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
              {showFiltersPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Appointment Type */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Type</label>
                      <select
                        value={filters.appointment_type}
                        onChange={(e) => setFilters({ ...filters, appointment_type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
                      >
                        <option value="All">All Types</option>
                        <option value="Doctor Consultation">Doctor Consultation</option>
                        <option value="Dental Consultation">Dental Consultation</option>
                        <option value="Therapy Services">Therapy Services</option>
                      </select>
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
                      >
                        <option value="All">All Statuses</option>
                        <option value="New Lead">New Lead</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Appointment Scheduled">Appointment Scheduled</option>
                        <option value="Visited">Visited</option>
                        <option value="Converted">Converted</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">From Date</label>
                      <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
                      />
                    </div>

                    {/* End Date */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">To Date</label>
                      <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List Table Container */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {tableError && (
                <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-600 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  {tableError}
                </div>
              )}

              {tableLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 text-primary-green animate-spin" />
                  <p className="text-xs font-medium text-slate-400">Loading submitted leads database...</p>
                </div>
              ) : appointments.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-500">
                  No submitted field patient records match selected criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-55 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-4">Lead ID</th>
                        <th className="px-4 py-4">Patient Name</th>
                        <th className="px-4 py-4">Age / Sex</th>
                        <th className="px-4 py-4">Phone Number</th>
                        <th className="px-4 py-4">Requirement</th>
                        <th className="px-4 py-4">Created Date</th>
                        <th className="px-5 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                      {appointments.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 font-bold text-primary-green select-all">
                            {item.patient_lead_id}
                          </td>
                          <td className="px-4 py-4 font-bold text-slate-800">
                            {item.full_name}
                          </td>
                          <td className="px-4 py-4">
                            {item.age} yrs • {item.gender}
                          </td>
                          <td className="px-4 py-4 font-mono">
                            {item.phone_number}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {item.appointment_type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-400 font-medium" title={formatDate(item.created_at)}>
                            {formatDate(item.created_at).split(' ')[0]}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </DashboardLayout>
  );
}
