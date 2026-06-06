'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  CreditCard, Search, ArrowUpRight, ArrowDownRight, IndianRupee,
  Calendar, User, PlusCircle, CheckCircle, Clock, X, ChevronRight,
  TrendingUp, Sparkles, FileText, Download, ShieldAlert, Printer, Lock, Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';

export default function PaymentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Route check
  useEffect(() => {
    if (user && !['Admin', 'Superadmin', 'Reception', 'Doctor'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Lists
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [doctorFilter, setDoctorFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  
  // Stats for Receptionist
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [outstandingAmount, setOutstandingAmount] = useState(0);

  // States
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Digital (UPI/Card)');
  const [payNotes, setPayNotes] = useState('');
  const [txRef, setTxRef] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load doctors on mount
  useEffect(() => {
    if (!user) return;
    const fetchDoctors = async () => {
      try {
        const res = await api.users.getDoctors();
        setDoctors(res.doctors || []);
      } catch (err) {
        console.error('Failed to load doctors list:', err);
      }
    };
    fetchDoctors();
  }, [user]);

  // Fetch appointments based on filters & pagination
  useEffect(() => {
    if (!user) return;
    fetchAppointments();
  }, [search, statusFilter, doctorFilter, startDate, endDate, sortBy, page, user]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {
        search,
        status: statusFilter === 'All' ? '' : statusFilter,
        doctor_id: doctorFilter === 'All' ? '' : doctorFilter,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortBy,
        page,
        limit
      };

      const res = await api.appointments.getPendingPayments(params);
      setAppointments(res.appointments || []);
      
      if (res.pagination) {
        setTotalPages(res.pagination.pages || 1);
        setTotalCount(res.pagination.total || 0);
      }

      // Fetch dashboard summary stats to update summary cards
      const statsRes = await api.dashboard.getStats();
      if (statsRes && statsRes.stats) {
        setOutstandingCount(statsRes.stats.pendingPaymentsCount || 0);
        setOutstandingAmount(statsRes.stats.pendingPayments || 0);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch financial accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async (app: any) => {
    setSelectedApp(app);
    setLogsLoading(true);
    setError('');
    try {
      const res = await api.appointments.getPayments(app.id);
      setPaymentLogs(res.payments || []);
    } catch (e: any) {
      setError('Failed to fetch payment ledger history.');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenPay = () => {
    if (!selectedApp) return;
    const due = parseFloat(selectedApp.total_amount) - parseFloat(selectedApp.paid_amount);
    setPayAmount(due > 0 ? due.toString() : '');
    setPayMethod('Digital (UPI/Card)');
    setPayNotes('');
    setTxRef('');
    setIsPayOpen(true);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.appointments.addPayment(selectedApp.id, {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        transaction_ref: txRef,
        notes: payNotes
      });
      
      setSuccess('Transaction logged successfully.');
      setIsPayOpen(false);
      
      // Refresh logs
      const updatedRes = await api.appointments.getPayments(selectedApp.id);
      setPaymentLogs(updatedRes.payments || []);
      
      // Refresh list
      await fetchAppointments();
      
      // Update selected app state
      const updatedAppRes = await api.appointments.getById(selectedApp.id);
      setSelectedApp(updatedAppRes.appointment || null);
    } catch (err: any) {
      setError(err.message || 'Payment submission failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (appointments.length === 0) {
      setError('No payment data available to export.');
      return;
    }
    const headers = [
      'Appointment ID',
      'Patient Name',
      'Contact Number',
      'Doctor Name',
      'Appointment Date',
      'Total Amount',
      'Paid Amount',
      'Pending Amount',
      'Payment Status',
      'Last Payment Date'
    ];
    
    const rows = appointments.map(app => [
      app.id,
      `"${app.patient_name.replace(/"/g, '""')}"`,
      app.contact_number,
      `"${(app.doctor_name || 'Unassigned').replace(/"/g, '""')}"`,
      new Date(app.appointment_date).toLocaleDateString('en-IN'),
      app.total_amount,
      app.paid_amount,
      app.total_amount - app.paid_amount,
      app.payment_status,
      app.last_payment_date ? new Date(app.last_payment_date).toLocaleDateString('en-IN') : 'N/A'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vvf_operational_payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Page
  const handlePrint = () => {
    window.print();
  };

  const getLockLabel = (app: any) => {
    const outstanding = parseFloat(app.total_amount) - parseFloat(app.paid_amount);
    const isPaid = ['Paid', 'Fully Cleared', 'Completed'].includes(app.payment_status) || outstanding <= 0;
    if (isPaid) {
      return { label: 'Locked', color: 'text-alert-text bg-alert-bg/40 border-rose-900/30', icon: Lock };
    }
    return { label: 'Editable', color: 'text-primary-green bg-very-light-green border-light-green/40', icon: Unlock };
  };

  // Check if receptionist or doctor role (hides core revenue summaries)
  const isReceptionistOrDoctor = ['Reception', 'Doctor'].includes(user?.role || '');

  return (
    <DashboardLayout>
        <div className="space-y-4 print-container">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-primary-text flex items-center gap-2">
              {isReceptionistOrDoctor ? 'Pending Payments Operational Center' : 'Accounting Ledger & Payments'}
              <CreditCard className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-secondary-text mt-0.5">
              {isReceptionistOrDoctor 
                ? 'Track patient outstandings, log co-payments, and view clinic receipt ledgers.'
                : 'Track co-payments, surgeon credits, billing ledger status, and audit receipts.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-secondary-text bg-white hover:bg-secondary-bg border border-border-gray rounded-xl transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-secondary-text bg-white hover:bg-secondary-bg border border-border-gray rounded-xl transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Global Feedback Panels */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2 no-print">
            <ShieldAlert className="h-4.5 w-4.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2 no-print">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {/* 3 Accounting Cards or Operational Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 no-print">
          {isReceptionistOrDoctor ? (
            <>
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3 md:col-span-2">
                <div className="p-3 bg-alert-bg/60 text-alert-text rounded-xl border border-rose-900/30">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Total Outstanding Outstandings</p>
                  <h3 className="text-xl font-bold text-alert-text mt-0.5">₹{outstandingAmount.toLocaleString('en-IN')}</h3>
                </div>
                <ArrowDownRight className="absolute top-4 right-4 h-4 w-4 text-rose-500 animate-pulse" />
              </div>

              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-very-light-green/60 text-primary-green rounded-xl border border-light-green/40">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Pending Invoices</p>
                  <h3 className="text-xl font-bold text-primary-text mt-0.5">{outstandingCount} Accounts</h3>
                </div>
                <CheckCircle className="absolute top-4 right-4 h-4 w-4 text-secondary-text" />
              </div>
            </>
          ) : (
            <>
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-very-light-green/60 text-primary-green rounded-xl border border-light-green/40">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Total Outstanding Accounts</p>
                  <h3 className="text-xl font-bold text-primary-text mt-0.5">{outstandingCount} Invoices</h3>
                </div>
                <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-secondary-text" />
              </div>

              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-alert-bg/60 text-alert-text rounded-xl border border-rose-800/30">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Outstanding Balances</p>
                  <h3 className="text-xl font-bold text-alert-text mt-0.5">₹{outstandingAmount.toLocaleString('en-IN')}</h3>
                </div>
                <ArrowDownRight className="absolute top-4 right-4 h-4 w-4 text-rose-500 animate-pulse" />
              </div>

              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-very-light-green/60 text-primary-green rounded-xl border border-emerald-800/30">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Operational Focus</p>
                  <h3 className="text-base font-bold text-primary-green mt-1">Pending Follow-ups</h3>
                </div>
                <CheckCircle className="absolute top-4 right-4 h-4 w-4 text-emerald-500" />
              </div>
            </>
          )}
        </div>

        {/* Search & Filter - Hidden in Print */}
        <div className="grid grid-cols-1 gap-2 bg-white border border-border-gray p-3 rounded-xl no-print max-w-full min-w-0 overflow-hidden">
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-secondary-text" />
            <input
              id="payment-search"
              type="text"
              placeholder="Search patient name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-[11px] sm:text-xs text-primary-text placeholder-slate-400 outline-none transition-all"
            />
          </div>

          <div className="md:col-span-2 min-w-0">
            <SelectField
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Pending', label: 'Pending (Unpaid)' },
                { value: 'Partially Paid', label: 'Partially Paid' },
                { value: 'Fully Paid', label: 'Fully Paid' },
              ]}
            />
          </div>

          <div className="md:col-span-2 min-w-0">
            <SelectField
              value={doctorFilter}
              onChange={(value) => { setDoctorFilter(value); setPage(1); }}
              options={[
                { value: 'All', label: 'All Doctors' },
                ...doctors.map((d) => ({ value: String(d.id), label: d.name })),
              ]}
            />
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 sm:py-2.5 px-2 text-[10px] text-primary-text outline-none transition-all"
              title="Start Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 sm:py-2.5 px-2 text-[10px] text-primary-text outline-none transition-all"
              title="End Date"
            />
          </div>

          <div className="md:col-span-2 min-w-0">
            <SelectField
              value={sortBy}
              onChange={(value) => { setSortBy(value); setPage(1); }}
              options={[
                { value: 'latest', label: 'Latest Appts' },
                { value: 'highest_pending', label: 'Highest Pending' },
                { value: 'oldest_pending', label: 'Oldest Pending' },
              ]}
            />
          </div>
        </div>

        {/* Two Column Layout: Table ledger & Detailed transaction log view */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1 & 2: List */}
          <div className="lg:col-span-2 bg-white border border-border-gray rounded-xl overflow-hidden flex flex-col min-h-[400px] min-w-0">
            <div className="px-4 py-3 border-b border-border-gray bg-white/80 flex items-center justify-between">
              <h3 className="font-bold text-xs text-primary-text uppercase tracking-wider">Patient Accounts Registry</h3>
              <span className="text-[10px] text-secondary-text font-medium no-print">{totalCount} Record(s)</span>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-secondary-text py-12">
                No accounts match active queries.
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/60 text-secondary-text font-semibold border-b border-border-gray uppercase text-[9px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Patient Details</th>
                        <th className="px-4 py-3">ID & Doctor</th>
                        <th className="px-4 py-3 text-right">Fee</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Pending</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center no-print">Edit access</th>
                        <th className="px-4 py-3 no-print" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {appointments.map((app) => {
                        const pendingAmt = parseFloat(app.total_amount) - parseFloat(app.paid_amount);
                        const active = selectedApp?.id === app.id;
                        const lockStatus = getLockLabel(app);
                        const LockIcon = lockStatus.icon;
                        
                        return (
                          <tr 
                            key={app.id} 
                            id={`ledger-row-${app.id}`}
                            onClick={() => handleViewLogs(app)}
                            className={`cursor-pointer transition-colors ${
                              active 
                                ? 'bg-secondary-bg/80 hover:bg-secondary-bg text-primary-text' 
                                : 'hover:bg-secondary-bg/30 text-secondary-text'
                            }`}
                          >
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-primary-text block">{app.patient_name}</span>
                              <span className="text-[10px] text-secondary-text">{app.contact_number}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-secondary-text block font-medium">ID: #{app.id}</span>
                              <span className="text-[10px] text-secondary-text">{app.doctor_name || 'Unassigned'}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium">₹{app.total_amount}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-primary-green">₹{app.paid_amount}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-alert-text">₹{pendingAmt}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                app.payment_status === 'Completed' || app.payment_status === 'Paid' || app.payment_status === 'Fully Paid'
                                  ? 'bg-very-light-green text-primary-green border border-light-green/40' 
                                  : app.payment_status === 'Partially Paid' 
                                    ? 'bg-secondary-bg text-secondary-text border border-border-gray' 
                                    : 'bg-alert-bg text-alert-text border border-alert-border'
                              }`}>
                                {app.payment_status === 'Completed' ? 'Fully Paid' : app.payment_status === 'Unpaid' ? 'Pending' : app.payment_status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center no-print">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] border font-bold ${lockStatus.color}`}>
                                <LockIcon className="h-2.5 w-2.5" />
                                {lockStatus.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right no-print">
                              <ChevronRight className="h-4 w-4 text-secondary-text" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Cards */}
                <div className="block md:hidden divide-y divide-border-gray">
                  {appointments.map((app) => {
                    const pendingAmt = parseFloat(app.total_amount) - parseFloat(app.paid_amount);
                    const active = selectedApp?.id === app.id;
                    const lockStatus = getLockLabel(app);
                    const LockIcon = lockStatus.icon;

                    return (
                      <div
                        key={app.id}
                        onClick={() => handleViewLogs(app)}
                        className={`p-3.5 sm:p-4 space-y-3 cursor-pointer transition-colors ${
                          active 
                            ? 'bg-secondary-bg/80 border-l-2 border-primary-green' 
                            : 'hover:bg-secondary-bg/30 text-secondary-text'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-primary-text block">{app.patient_name}</span>
                            <span className="text-[10px] text-secondary-text">{app.contact_number}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            app.payment_status === 'Completed' || app.payment_status === 'Paid' || app.payment_status === 'Fully Paid'
                              ? 'bg-very-light-green text-primary-green border border-light-green/40' 
                              : app.payment_status === 'Partially Paid' 
                                ? 'bg-secondary-bg text-secondary-text border border-border-gray' 
                                : 'bg-alert-bg text-alert-text border border-alert-border'
                          }`}>
                            {app.payment_status === 'Completed' ? 'Fully Paid' : app.payment_status === 'Unpaid' ? 'Pending' : app.payment_status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 bg-white/60 p-2.5 rounded-lg border border-border-gray text-[11px] text-right">
                          <div className="text-left">
                            <span className="text-secondary-text block text-[9px] font-bold uppercase">Billed</span>
                            <span className="text-primary-text font-semibold">₹{app.total_amount}</span>
                          </div>
                          <div>
                            <span className="text-secondary-text block text-[9px] font-bold uppercase">Paid</span>
                            <span className="text-primary-green font-bold">₹{app.paid_amount}</span>
                          </div>
                          <div>
                            <span className="text-secondary-text block text-[9px] font-bold uppercase">Pending</span>
                            <span className="text-alert-text font-bold">₹{pendingAmt}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-secondary-text">Doctor: <strong className="text-primary-text">{app.doctor_name || 'Unassigned'}</strong></span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] border font-bold ${lockStatus.color}`}>
                            <LockIcon className="h-2.5 w-2.5" />
                            {lockStatus.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-border-gray flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary-text bg-white/20 no-print">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-border-gray bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary-bg cursor-pointer text-[10px]"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-border-gray bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary-bg cursor-pointer text-[10px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Column 3: Detailed Ledger View */}
          <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-5 flex flex-col min-h-[300px]">
            {selectedApp ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Ledger Header */}
                  <div className="border-b border-border-gray pb-4 mb-4">
                    <span className="text-[10px] text-primary-green font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Invoice Summary
                    </span>
                    <h3 className="font-bold text-base text-primary-text mt-1">{selectedApp.patient_name}</h3>
                    <p className="text-[10px] text-secondary-text mt-0.5">Phone: {selectedApp.contact_number}</p>
                    <p className="text-[9px] text-secondary-text mt-0.5">Appt Date: {new Date(selectedApp.appointment_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                  </div>

                  {/* Financial items */}
                  <div className="space-y-2 bg-white/60 border border-border-gray p-3.5 rounded-xl mb-6 text-xs">
                    <div className="flex justify-between text-secondary-text">
                      <span>Total Billed Fee</span>
                      <span className="text-primary-text font-bold">₹{selectedApp.total_amount}</span>
                    </div>
                    <div className="flex justify-between text-secondary-text">
                      <span>Amount Cleared</span>
                      <span className="text-primary-green font-bold">₹{selectedApp.paid_amount}</span>
                    </div>
                    <div className="h-px bg-border-gray my-1" />
                    <div className="flex justify-between text-secondary-text font-semibold">
                      <span>Balance Outstanding</span>
                      <span className="text-alert-text font-bold text-sm">₹{selectedApp.total_amount - selectedApp.paid_amount}</span>
                    </div>
                  </div>

                  {/* Transaction History list */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider">Transaction History Log</h4>
                    
                    {logsLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                      </div>
                    ) : paymentLogs.length === 0 ? (
                      <p className="text-[10px] text-secondary-text italic bg-white/20 p-4 rounded-xl border border-border-gray text-center">
                        No transactions registered for this invoice.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {paymentLogs.map((log: any) => (
                          <div 
                            key={log.id} 
                            className="bg-white/40 border border-border-gray p-2.5 rounded-xl text-[10px] flex items-center justify-between gap-2.5"
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-primary-text">
                                <span>₹{log.amount}</span>
                                <span className="text-[9px] bg-white border border-border-gray text-secondary-text px-1.5 py-0.5 rounded">
                                  {log.payment_method}
                                </span>
                              </div>
                              {log.transaction_ref && (
                                <p className="text-[8px] text-secondary-text mt-0.5">Ref: {log.transaction_ref}</p>
                              )}
                              {log.notes && (
                                <p className="text-[9px] text-secondary-text italic mt-0.5">"{log.notes}"</p>
                              )}
                            </div>
                            <span className="text-[8px] text-secondary-text font-medium shrink-0">
                              {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Log payment trigger - Authorized for Admin, Superadmin, and Receptionists */}
                {['Admin', 'Superadmin', 'Reception'].includes(user?.role || '') && 
                 selectedApp.payment_status !== 'Completed' && 
                 selectedApp.payment_status !== 'Paid' && 
                 selectedApp.payment_status !== 'Fully Paid' && 
                 (selectedApp.total_amount - selectedApp.paid_amount) > 0 && (
                  <button
                    id="trigger-add-payment-btn"
                    onClick={handleOpenPay}
                    className="w-full bg-emerald-960 hover:bg-emerald-900 text-emerald-300 border border-light-green/40 hover:border-emerald-500/40 font-semibold text-xs py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-6 no-print"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Record Co-Payment Receipt
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-secondary-text py-12">
                <FileText className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-sm font-medium">Invoice Ledger Details</p>
                <p className="text-xs text-slate-650 mt-1 max-w-[200px]">Select a patient account from the registry to view billing statements and cash records.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Quick Pay Submission Dialog */}
        <AnimatePresence>
          {isPayOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPayOpen(false)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <IndianRupee className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    Clear Invoice Balance
                  </h3>
                  <button id="close-pay-form-modal" onClick={() => setIsPayOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
                  <div>
                    <span className="text-[10px] text-secondary-text block mb-1">Receipt for Patient:</span>
                    <strong className="text-sm text-primary-text block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Payment Amount (₹)</label>
                      <input
                        id="form-pay-amount"
                        type="number"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-primary-text outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Payment Method</label>
                      <SelectField
                        id="form-pay-method"
                        value={payMethod}
                        onChange={setPayMethod}
                        triggerClassName="py-2.5 text-xs"
                        options={[
                          { value: 'Digital (UPI/Card)', label: 'UPI / GPay / PhonePe' },
                          { value: 'Cash Receipt', label: 'Cash Desk' },
                          { value: 'Bank Transfer', label: 'Bank Wire' },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">UTR / Bank Reference ID (Optional)</label>
                    <input
                      id="form-pay-reference"
                      type="text"
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="TXN987654321"
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Transaction Notes</label>
                    <input
                      id="form-pay-notes"
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Consultation co-pay, surgery deposit..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-pay-txn"
                      type="button"
                      onClick={() => setIsPayOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-pay-txn"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Logging...' : 'Clear Amount'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Print-Only Styles */}
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border: 1px solid #cbd5e1 !important;
              padding: 8px !important;
              color: black !important;
            }
            span, strong {
              color: black !important;
            }
          }
        `}</style>

      </div>
    </DashboardLayout>
  );
}
