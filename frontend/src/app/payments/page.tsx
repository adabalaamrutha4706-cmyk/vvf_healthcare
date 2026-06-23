'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  CreditCard, Search, ArrowUpRight, ArrowDownRight, IndianRupee,
  Calendar, User, PlusCircle, CheckCircle, Clock, X, ChevronRight,
  TrendingUp, Sparkles, FileText, Download, ShieldAlert, Printer, Lock, Unlock, Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';
import { ReportFilterPanel } from '../../components/ReportFilterPanel';
import { exportToExcel, exportToPDF, exportPaymentsToPDF } from '../../lib/exportUtils';

export const isUPIMethod = (method: string): boolean => {
  const m = (method || '').toLowerCase().trim();
  if (m.includes('cash')) return false;
  if (m.includes('card') && !m.includes('upi')) return false;
  return (
    m.includes('upi') ||
    m.includes('gpay') ||
    m.includes('google') ||
    m.includes('phonepe') ||
    m.includes('paytm') ||
    m.includes('bank') ||
    m.includes('transfer') ||
    m.includes('wire') ||
    m.includes('digital')
  );
};

export const mapLegacyPaymentMethod = (method: string): 'Cash' | 'UPI' | 'Card' => {
  if (isUPIMethod(method)) return 'UPI';
  const m = (method || '').toLowerCase().trim();
  if (m.includes('cash')) return 'Cash';
  return 'Card';
};

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
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('All');
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
  const [upiApp, setUpiApp] = useState('');
  const [payerUpiId, setPayerUpiId] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Admin edit payment states
  const [isEditPayOpen, setIsEditPayOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editTxRef, setEditTxRef] = useState('');
  const [editUpiApp, setEditUpiApp] = useState('');
  const [editPayerUpiId, setEditPayerUpiId] = useState('');
  const [editSplits, setEditSplits] = useState<{ method: 'Cash' | 'UPI' | 'Card'; amount: string; transaction_ref: string; upi_app?: string; payer_upi_id?: string }[]>([]);

  // Split payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splits, setSplits] = useState<{ method: 'Cash' | 'UPI' | 'Card'; amount: string; transaction_ref: string; upi_app?: string; payer_upi_id?: string }[]>([
    { method: 'Cash', amount: '', transaction_ref: '', upi_app: '', payer_upi_id: '' }
  ]);
  const [reportBreakdown, setReportBreakdown] = useState({ totalCash: 0, totalUPI: 0, totalCard: 0 });

  const [hospitals, setHospitals] = useState<any[]>([]);

  // Load doctors and hospitals on mount
  useEffect(() => {
    if (!user) return;
    const fetchMetadata = async () => {
      try {
        const res = await api.users.getDoctors();
        setDoctors(res.doctors || []);
        
        const hospRes = await api.hospitals.getAll();
        setHospitals(hospRes.hospitals || []);
      } catch (err) {
        console.error('Failed to load metadata lists:', err);
      }
    };
    fetchMetadata();
  }, [user]);

  // Fetch appointments based on filters & pagination
  useEffect(() => {
    if (!user) return;
    fetchAppointments();
  }, [search, statusFilter, doctorFilter, selectedHospitalFilter, startDate, endDate, sortBy, page, user]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {
        search,
        status: statusFilter === 'All' ? '' : statusFilter,
        doctor_id: doctorFilter === 'All' ? '' : doctorFilter,
        hospital_id: selectedHospitalFilter === 'All' ? '' : selectedHospitalFilter,
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

      // Fetch report breakdown
      if (!isReceptionistOrDoctor) {
        try {
          const reportRes = await api.appointments.getPaymentsReport({ 
            start_date: startDate, 
            end_date: endDate,
            hospital_id: selectedHospitalFilter === 'All' ? '' : selectedHospitalFilter
          });
          if (reportRes && reportRes.breakdown) {
            setReportBreakdown(reportRes.breakdown);
          }
        } catch (err) {
          console.error('Failed to load report breakdown:', err);
        }
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
    const dueStr = due > 0 ? due.toString() : '';
    setPayAmount(dueStr);
    setPayMethod('Digital (UPI/Card)');
    setPayNotes('');
    setTxRef('');
    setUpiApp('');
    setPayerUpiId('');
    setIsSplitPayment(false);
    setSplits([{ method: 'Cash', amount: dueStr, transaction_ref: '', upi_app: '', payer_upi_id: '' }]);
    setIsPayOpen(true);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const targetAmount = parseFloat(payAmount);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        setError('Valid payment amount is required.');
        setSubmitLoading(false);
        return;
      }

      if (isSplitPayment) {
        let splitSum = 0;
        for (const s of splits) {
          const amt = parseFloat(s.amount);
          if (isNaN(amt) || amt <= 0) {
            setError('Each split payment must have a valid amount greater than zero.');
            setSubmitLoading(false);
            return;
          }
          splitSum += amt;
        }
        if (Math.abs(splitSum - targetAmount) > 0.01) {
          setError(`The sum of split payments (₹${splitSum.toFixed(2)}) must exactly equal the total payment amount (₹${targetAmount.toFixed(2)}).`);
          setSubmitLoading(false);
          return;
        }
      }

      // UPI Validation
      if (!isSplitPayment) {
        if (isUPIMethod(payMethod)) {
          if (!txRef || !txRef.trim()) {
            setError('UPI Transaction Reference ID is required for UPI payments.');
            setSubmitLoading(false);
            return;
          }
        }
      } else {
        for (const s of splits) {
          if (s.method === 'UPI') {
            if (!s.transaction_ref || !s.transaction_ref.trim()) {
              setError('UPI Transaction Reference ID is required for the UPI portion of the split payment.');
              setSubmitLoading(false);
              return;
            }
          }
        }
      }

      await api.appointments.addPayment(selectedApp.id, {
        amount: targetAmount,
        payment_method: isSplitPayment ? 'Split Payment' : payMethod,
        transaction_ref: isSplitPayment ? 'Split Payment' : txRef,
        notes: payNotes,
        upi_app: !isSplitPayment && isUPIMethod(payMethod) ? upiApp : undefined,
        payer_upi_id: !isSplitPayment && isUPIMethod(payMethod) ? payerUpiId : undefined,
        payment_splits: isSplitPayment
          ? splits.map(s => ({
              method: s.method,
              amount: parseFloat(s.amount),
              transaction_ref: s.transaction_ref || '',
              upi_app: s.method === 'UPI' ? s.upi_app || '' : undefined,
              payer_upi_id: s.method === 'UPI' ? s.payer_upi_id || '' : undefined
            }))
          : undefined
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

  const handleOpenEditPay = (log: any) => {
    setEditingPayment(log);
    setEditTxRef(log.transaction_ref || '');
    setEditUpiApp(log.upi_app || '');
    setEditPayerUpiId(log.payer_upi_id || '');
    setEditSplits(log.payment_splits ? (Array.isArray(log.payment_splits) ? JSON.parse(JSON.stringify(log.payment_splits)) : []) : []);
    setIsEditPayOpen(true);
  };

  const handleEditPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !selectedApp) return;
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate UPI details
      if (editSplits && editSplits.length > 0) {
        for (const s of editSplits) {
          if (s.method === 'UPI') {
            if (!s.transaction_ref || !s.transaction_ref.trim()) {
              setError('UPI Transaction Reference ID is required for UPI payments.');
              setSubmitLoading(false);
              return;
            }
          }
        }
      } else {
        const mappedMethod = mapLegacyPaymentMethod(editingPayment.payment_method);
        if (mappedMethod === 'UPI') {
          if (!editTxRef || !editTxRef.trim()) {
            setError('UPI Transaction Reference ID is required for UPI payments.');
            setSubmitLoading(false);
            return;
          }
        }
      }

      await api.appointments.updatePayment(selectedApp.id, editingPayment.id, {
        transaction_ref: editTxRef,
        upi_app: editUpiApp || undefined,
        payer_upi_id: editPayerUpiId || undefined,
        payment_splits: editSplits && editSplits.length > 0 ? editSplits : undefined
      });

      setSuccess('Transaction reference details modified successfully.');
      setIsEditPayOpen(false);

      // Refresh logs
      const updatedRes = await api.appointments.getPayments(selectedApp.id);
      setPaymentLogs(updatedRes.payments || []);
      
      // Refresh list
      await fetchAppointments();
    } catch (err: any) {
      setError(err.message || 'Payment modification failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePrintReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.appointments.getPaymentsReport({ 
        start_date: startDate, 
        end_date: endDate,
        hospital_id: selectedHospitalFilter === 'All' ? '' : selectedHospitalFilter,
        search: search || '',
        status: statusFilter === 'All' ? '' : statusFilter,
        doctor_id: doctorFilter === 'All' ? '' : doctorFilter
      });
      const paymentsList = res.payments || [];
      const breakdown = res.breakdown || { totalCash: 0, totalUPI: 0, totalCard: 0, totalOthers: 0 };

      const hospitalName = selectedHospitalFilter === 'All' 
        ? 'All Hospitals' 
        : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

      const doctorName = doctorFilter === 'All'
        ? 'All Doctors'
        : (doctors.find(d => String(d.id) === doctorFilter)?.name || 'Selected Doctor');

      const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const dateRange = formattedStartDate && formattedEndDate ? `${formattedStartDate} to ${formattedEndDate}` : 'All Time';

      exportPaymentsToPDF(
        paymentsList,
        breakdown,
        {
          hospitalName,
          dateRange,
          doctorName,
          status: statusFilter === 'All' ? 'All Statuses' : statusFilter,
          searchQuery: search
        },
        {
          name: user?.name || 'Unknown',
          role: user?.role || 'Unknown'
        },
        'open'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.appointments.getPaymentsReport({ 
        start_date: startDate, 
        end_date: endDate,
        hospital_id: selectedHospitalFilter === 'All' ? '' : selectedHospitalFilter,
        search: search || '',
        status: statusFilter === 'All' ? '' : statusFilter,
        doctor_id: doctorFilter === 'All' ? '' : doctorFilter
      });
      const paymentsList = res.payments || [];
      const breakdown = res.breakdown || { totalCash: 0, totalUPI: 0, totalCard: 0, totalOthers: 0 };

      const hospitalName = selectedHospitalFilter === 'All' 
        ? 'All Hospitals' 
        : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

      const doctorName = doctorFilter === 'All'
        ? 'All Doctors'
        : (doctors.find(d => String(d.id) === doctorFilter)?.name || 'Selected Doctor');

      const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const dateRange = formattedStartDate && formattedEndDate ? `${formattedStartDate} to ${formattedEndDate}` : 'All Time';

      exportPaymentsToPDF(
        paymentsList,
        breakdown,
        {
          hospitalName,
          dateRange,
          doctorName,
          status: statusFilter === 'All' ? 'All Statuses' : statusFilter,
          searchQuery: search
        },
        {
          name: user?.name || 'Unknown',
          role: user?.role || 'Unknown'
        },
        'download'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.appointments.getPaymentsReport({ 
        start_date: startDate, 
        end_date: endDate,
        hospital_id: selectedHospitalFilter === 'All' ? '' : selectedHospitalFilter
      });
      const paymentsList = res.payments || [];

      const data = paymentsList.map((pay: any) => ({
        'Transaction ID': pay.transaction_ref || pay.transaction_id,
        'Customer Name': pay.customer_name,
        'Amount (INR)': parseFloat(pay.amount),
        'Payment Method & UPI Details': pay.payment_splits && Array.isArray(pay.payment_splits) && pay.payment_splits.length > 0
          ? `Split (${pay.payment_splits.map((s: any) => `${s.method}: Rs. ${s.amount}${s.transaction_ref ? ` [Ref: ${s.transaction_ref}]` : ''}${s.upi_app ? ` via ${s.upi_app}` : ''}${s.payer_upi_id ? ` (${s.payer_upi_id})` : ''}`).join(', ')})`
          : `${pay.payment_method}${pay.transaction_ref ? ` [Ref: ${pay.transaction_ref}]` : ''}${pay.upi_app ? ` via ${pay.upi_app}` : ''}${pay.payer_upi_id ? ` (${pay.payer_upi_id})` : ''}`,
        'Payment Date': new Date(pay.payment_date).toLocaleString('en-IN'),
        'Status': pay.status
      }));

      const hospitalName = selectedHospitalFilter === 'All' 
        ? 'All Hospitals' 
        : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

      const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

      exportToExcel(
        data, 
        `payments_report_${startDate || 'all'}_to_${endDate || 'all'}`,
        {
          title: 'Payments Transactions Report',
          filters: {
            'Selected Hospital': hospitalName,
            'Start Date': formattedStartDate,
            'End Date': formattedEndDate,
            'Search Query': search || 'None'
          }
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate Excel report.');
    } finally {
      setLoading(false);
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
    handlePrintReport();
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
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              {isReceptionistOrDoctor ? 'Pending Payments Operational Center' : 'Accounting Ledger & Payments'}
              <CreditCard className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isReceptionistOrDoctor 
                ? 'Track patient outstandings, log co-payments, and view clinic receipt ledgers.'
                : 'Track co-payments, surgeon credits, billing ledger status, and audit receipts.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-white hover:bg-secondary-bg border border-border-gray rounded-xl transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-white hover:bg-secondary-bg border border-border-gray rounded-xl transition-all cursor-pointer"
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Outstanding Outstandings</p>
                  <h3 className="text-xl font-bold text-alert-text mt-0.5">₹{outstandingAmount.toLocaleString('en-IN')}</h3>
                </div>
                <ArrowDownRight className="absolute top-4 right-4 h-4 w-4 text-rose-500 animate-pulse" />
              </div>

              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-very-light-green/60 text-primary-green rounded-xl border border-light-green/40">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pending Invoices</p>
                  <h3 className="text-xl font-bold text-slate-500 mt-0.5">{outstandingCount} Accounts</h3>
                </div>
                <CheckCircle className="absolute top-4 right-4 h-4 w-4 text-slate-500" />
              </div>
            </>
          ) : (
            <>
              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-very-light-green/60 text-primary-green rounded-xl border border-light-green/40">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Outstanding Accounts</p>
                  <h3 className="text-xl font-bold text-slate-500 mt-0.5">{outstandingCount} Invoices</h3>
                </div>
                <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-slate-500" />
              </div>

              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-alert-bg/60 text-alert-text rounded-xl border border-rose-800/30">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Outstanding Balances</p>
                  <h3 className="text-xl font-bold text-alert-text mt-0.5">₹{outstandingAmount.toLocaleString('en-IN')}</h3>
                </div>
                <ArrowDownRight className="absolute top-4 right-4 h-4 w-4 text-rose-500 animate-pulse" />
              </div>

              <div className="bg-white border border-border-gray rounded-xl p-3 sm:p-4 relative overflow-hidden flex items-center gap-3">
                <div className="p-3 bg-very-light-green/60 text-primary-green rounded-xl border border-emerald-800/30">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Operational Focus</p>
                  <h3 className="text-base font-bold text-primary-green mt-1">Pending Follow-ups</h3>
                </div>
                <CheckCircle className="absolute top-4 right-4 h-4 w-4 text-emerald-500" />
              </div>
            </>
          )}
        </div>

        <ReportFilterPanel
          onGenerate={(start, end) => {
            setStartDate(start);
            setEndDate(end);
            setPage(1);
          }}
          onReset={() => {
            setSearch('');
            setStatusFilter('All');
            setDoctorFilter('All');
            setSelectedHospitalFilter('All');
            setStartDate('');
            setEndDate('');
            setSortBy('latest');
            setPage(1);
          }}
          isLoading={loading}
          totalRecords={totalCount}
          activeStartDate={startDate}
          activeEndDate={endDate}
          onDownloadPDF={handleDownloadPDF}
          onDownloadExcel={handleDownloadExcel}
        />

        {!isReceptionistOrDoctor && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print mt-2">
            <div className="bg-white border border-border-gray rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
                <IndianRupee className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Cash Collections</p>
                <h3 className="text-lg font-bold text-slate-700 mt-0.5">₹{reportBreakdown.totalCash.toLocaleString('en-IN')}</h3>
              </div>
            </div>

            <div className="bg-white border border-border-gray rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total UPI Collections</p>
                <h3 className="text-lg font-bold text-slate-700 mt-0.5">₹{reportBreakdown.totalUPI.toLocaleString('en-IN')}</h3>
              </div>
            </div>

            <div className="bg-white border border-border-gray rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-200">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Card Collections</p>
                <h3 className="text-lg font-bold text-slate-700 mt-0.5">₹{reportBreakdown.totalCard.toLocaleString('en-IN')}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter - Hidden in Print */}
        <div className="flex flex-col gap-3 bg-white border border-border-gray p-3 rounded-xl no-print max-w-full min-w-0 overflow-hidden">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
              <input
                id="payment-search"
                type="text"
                placeholder="Search patient name or ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-[11px] sm:text-xs text-slate-500 placeholder-slate-400 outline-none transition-all"
              />
            </div>
            <div className="w-full md:w-64">
              <SelectField
                id="hospital-filter"
                value={selectedHospitalFilter}
                onChange={(value) => { setSelectedHospitalFilter(value); setPage(1); }}
                options={[
                  { value: 'All', label: 'All Hospitals' },
                  ...hospitals.map((h) => ({ value: String(h.id), label: h.name }))
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="min-w-0">
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

            <div className="min-w-0">
              <SelectField
                value={doctorFilter}
                onChange={(value) => { setDoctorFilter(value); setPage(1); }}
                options={[
                  { value: 'All', label: 'All Doctors' },
                  ...doctors.map((d) => ({ value: String(d.id), label: d.name })),
                ]}
              />
            </div>

            <div className="min-w-0">
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
        </div>

        {/* Two Column Layout: Table ledger & Detailed transaction log view */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1 & 2: List */}
          <div className="lg:col-span-2 bg-white border border-border-gray rounded-xl overflow-hidden flex flex-col min-h-[400px] min-w-0">
            <div className="px-4 py-3 border-b border-border-gray bg-white/80 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Patient Accounts Registry</h3>
              <span className="text-[10px] text-slate-500 font-medium no-print">{totalCount} Record(s)</span>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[11px] sm:text-xs text-slate-500 py-12">
                {startDate && endDate 
                  ? 'No records found for the selected date range.' 
                  : 'No accounts match active queries.'}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/60 text-slate-500 font-semibold border-b border-border-gray uppercase text-[9px] tracking-wider">
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
                                ? 'bg-secondary-bg/80 hover:bg-secondary-bg text-slate-500' 
                                : 'hover:bg-secondary-bg/30 text-slate-500'
                            }`}
                          >
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-slate-500 block">{app.patient_name}</span>
                              <span className="text-[10px] text-slate-500">{app.contact_number}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-slate-500 block font-medium">ID: #{app.id}</span>
                              <span className="text-[10px] text-slate-500">{app.doctor_name || 'Unassigned'}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium">₹{app.total_amount}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-primary-green">₹{app.paid_amount}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-alert-text">₹{pendingAmt}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                app.payment_status === 'Completed' || app.payment_status === 'Paid' || app.payment_status === 'Fully Paid'
                                  ? 'bg-very-light-green text-primary-green border border-light-green/40' 
                                  : app.payment_status === 'Partially Paid' 
                                    ? 'bg-secondary-bg text-slate-500 border border-border-gray' 
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
                              <ChevronRight className="h-4 w-4 text-slate-500" />
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
                            : 'hover:bg-secondary-bg/30 text-slate-500'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-500 block">{app.patient_name}</span>
                            <span className="text-[10px] text-slate-500">{app.contact_number}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            app.payment_status === 'Completed' || app.payment_status === 'Paid' || app.payment_status === 'Fully Paid'
                              ? 'bg-very-light-green text-primary-green border border-light-green/40' 
                              : app.payment_status === 'Partially Paid' 
                                ? 'bg-secondary-bg text-slate-500 border border-border-gray' 
                                : 'bg-alert-bg text-alert-text border border-alert-border'
                          }`}>
                            {app.payment_status === 'Completed' ? 'Fully Paid' : app.payment_status === 'Unpaid' ? 'Pending' : app.payment_status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 bg-white/60 p-2.5 rounded-lg border border-border-gray text-[11px] text-right">
                          <div className="text-left">
                            <span className="text-slate-500 block text-[9px] font-bold uppercase">Billed</span>
                            <span className="text-slate-500 font-semibold">₹{app.total_amount}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold uppercase">Paid</span>
                            <span className="text-primary-green font-bold">₹{app.paid_amount}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] font-bold uppercase">Pending</span>
                            <span className="text-alert-text font-bold">₹{pendingAmt}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">Doctor: <strong className="text-slate-500">{app.doctor_name || 'Unassigned'}</strong></span>
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
                  <div className="px-6 py-4 border-t border-border-gray flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-white/20 no-print">
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
                    <h3 className="font-bold text-base text-slate-500 mt-1">{selectedApp.patient_name}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Phone: {selectedApp.contact_number}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Appt Date: {new Date(selectedApp.appointment_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                  </div>

                  {/* Financial items */}
                  <div className="space-y-2 bg-white/60 border border-border-gray p-3.5 rounded-xl mb-6 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Billed Fee</span>
                      <span className="text-slate-500 font-bold">₹{selectedApp.total_amount}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Amount Cleared</span>
                      <span className="text-primary-green font-bold">₹{selectedApp.paid_amount}</span>
                    </div>
                    <div className="h-px bg-border-gray my-1" />
                    <div className="flex justify-between text-slate-500 font-semibold">
                      <span>Balance Outstanding</span>
                      <span className="text-alert-text font-bold text-sm">₹{selectedApp.total_amount - selectedApp.paid_amount}</span>
                    </div>
                  </div>

                  {/* Transaction History list */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transaction History Log</h4>
                    
                    {logsLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                      </div>
                    ) : paymentLogs.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic bg-white/20 p-4 rounded-xl border border-border-gray text-center">
                        No transactions registered for this invoice.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {paymentLogs.map((log: any) => (
                          <div 
                            key={log.id} 
                            className="bg-white/40 border border-border-gray p-2.5 rounded-xl text-[10px] flex items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 font-bold text-slate-500">
                                <span>₹{log.amount}</span>
                                <span className="text-[9px] bg-white border border-border-gray text-slate-500 px-1.5 py-0.5 rounded">
                                  {log.payment_method}
                                </span>
                              </div>
                              {log.payment_splits && Array.isArray(log.payment_splits) && log.payment_splits.length > 0 ? (
                                <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-emerald-500">
                                  {log.payment_splits.map((split: any, idx: number) => (
                                    <div key={idx} className="text-[9px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold">{split.method}:</span>
                                      <span>₹{split.amount}</span>
                                      {split.transaction_ref && (
                                        <span className="text-[8px] text-slate-400">
                                          ({split.transaction_ref}
                                          {split.upi_app ? ` via ${split.upi_app}` : ''}
                                          {split.payer_upi_id ? ` • ${split.payer_upi_id}` : ''})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <>
                                  {log.transaction_ref && (
                                    <div className="text-[8px] text-slate-500 mt-0.5 space-y-0.5">
                                      <p>Ref: <strong className="text-slate-500">{log.transaction_ref}</strong></p>
                                      {log.upi_app && <p>UPI App: <span className="font-semibold text-slate-500">{log.upi_app}</span></p>}
                                      {log.payer_upi_id && <p>Payer UPI ID: <span className="font-semibold text-slate-500">{log.payer_upi_id}</span></p>}
                                    </div>
                                  )}
                                </>
                              )}
                              {log.notes && (
                                <p className="text-[9px] text-slate-500 italic mt-0.5">"{log.notes}"</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {['Admin', 'Superadmin'].includes(user?.role || '') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPay(log)}
                                  className="p-1 bg-white hover:bg-emerald-50 text-slate-400 hover:text-primary-green rounded border border-border-gray transition-colors cursor-pointer"
                                  title="Edit reference/UPI details"
                                >
                                  <Edit2 className="h-2.5 w-2.5" />
                                </button>
                              )}
                              <span className="text-[8px] text-slate-500 font-medium">
                                {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
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
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-12">
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
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <IndianRupee className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    Clear Invoice Balance
                  </h3>
                  <button id="close-pay-form-modal" onClick={() => setIsPayOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Receipt for Patient:</span>
                    <strong className="text-sm text-slate-500 block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Amount (₹)</label>
                    <input
                      id="form-pay-amount"
                      type="number"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between bg-slate-50/50 border border-border-gray p-2.5 rounded-xl">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">Split Payment</span>
                      <span className="text-[9px] text-slate-500 block">Pay using multiple modes</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !isSplitPayment;
                        setIsSplitPayment(nextVal);
                        if (nextVal) {
                          setSplits([{ method: 'Cash', amount: payAmount, transaction_ref: '' }]);
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        isSplitPayment ? 'bg-primary-green' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isSplitPayment ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {isSplitPayment ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Split Transactions</label>
                        <button
                          type="button"
                          onClick={() => setSplits([...splits, { method: 'Cash', amount: '', transaction_ref: '' }])}
                          className="text-[10px] text-primary-green hover:underline font-semibold flex items-center gap-1"
                        >
                          + Add Row
                        </button>
                      </div>

                       <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {splits.map((split, index) => {
                          const isUPI = split.method === 'UPI';
                          return (
                            <div key={index} className="bg-slate-50/50 p-3 rounded-xl border border-border-gray relative space-y-2">
                              <div className="flex gap-2 items-center">
                                <div className="w-1/3">
                                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Mode</label>
                                  <select
                                    value={split.method}
                                    onChange={(e) => {
                                      const newSplits = [...splits];
                                      newSplits[index].method = e.target.value as any;
                                      if (e.target.value !== 'UPI') {
                                        newSplits[index].transaction_ref = '';
                                        newSplits[index].upi_app = '';
                                        newSplits[index].payer_upi_id = '';
                                      }
                                      setSplits(newSplits);
                                    }}
                                    className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                  >
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Card</option>
                                  </select>
                                </div>

                                <div className="w-1/3">
                                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Amount (₹)</label>
                                  <input
                                    type="number"
                                    required
                                    value={split.amount}
                                    onChange={(e) => {
                                      const newSplits = [...splits];
                                      newSplits[index].amount = e.target.value;
                                      setSplits(newSplits);
                                    }}
                                    placeholder="0"
                                    className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                  />
                                </div>

                                {!isUPI && (
                                  <div className="w-1/3 pr-6">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Ref (Optional)</label>
                                    <input
                                      type="text"
                                      value={split.transaction_ref || ''}
                                      onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[index].transaction_ref = e.target.value;
                                        setSplits(newSplits);
                                      }}
                                      placeholder="Ref No."
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    />
                                  </div>
                                )}
                              </div>

                              {isUPI && (
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-border-gray">
                                  <div>
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Ref ID (UTR) *</label>
                                    <input
                                      type="text"
                                      required
                                      value={split.transaction_ref || ''}
                                      onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[index].transaction_ref = e.target.value;
                                        setSplits(newSplits);
                                      }}
                                      placeholder="UTR / Ref ID"
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">UPI App</label>
                                    <select
                                      value={split.upi_app || ''}
                                      onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[index].upi_app = e.target.value;
                                        setSplits(newSplits);
                                      }}
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    >
                                      <option value="">Select App</option>
                                      <option value="PhonePe">PhonePe</option>
                                      <option value="Google Pay">Google Pay</option>
                                      <option value="Paytm">Paytm</option>
                                      <option value="BHIM">BHIM</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  <div className="pr-6">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Payer UPI ID</label>
                                    <input
                                      type="text"
                                      value={split.payer_upi_id || ''}
                                      onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[index].payer_upi_id = e.target.value;
                                        setSplits(newSplits);
                                      }}
                                      placeholder="upi@handle"
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    />
                                  </div>
                                </div>
                              )}

                              {splits.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSplits = splits.filter((_, i) => i !== index);
                                    setSplits(newSplits);
                                  }}
                                  className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Display remaining / excess calculations */}
                      {(() => {
                        const splitSum = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                        const targetAmount = parseFloat(payAmount) || 0;
                        const remaining = targetAmount - splitSum;
                        return (
                          <div className="flex items-center justify-between text-[11px] p-2 bg-slate-50 border border-border-gray rounded-xl">
                            <span className="text-slate-500 font-medium">Split Total: ₹{splitSum.toFixed(2)}</span>
                            {Math.abs(remaining) <= 0.01 ? (
                              <span className="text-emerald-500 font-bold">✓ Matches total amount</span>
                            ) : remaining > 0 ? (
                              <span className="text-amber-500 font-bold">Remaining: ₹{remaining.toFixed(2)}</span>
                            ) : (
                              <span className="text-rose-500 font-bold">Excess: ₹{Math.abs(remaining).toFixed(2)}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                          <SelectField
                            id="form-pay-method"
                            value={payMethod}
                            onChange={(value) => {
                              setPayMethod(value);
                              if (!isUPIMethod(value)) {
                                setUpiApp('');
                                setPayerUpiId('');
                              }
                            }}
                            triggerClassName="py-2.5 text-xs"
                            options={[
                              { value: 'Digital (UPI/Card)', label: 'UPI / GPay / PhonePe' },
                              { value: 'Cash Receipt', label: 'Cash Desk' },
                              { value: 'Bank Transfer', label: 'Bank Wire' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            {isUPIMethod(payMethod) ? 'Ref ID (UTR) *' : 'UTR / Bank Reference ID (Optional)'}
                          </label>
                          <input
                            id="form-pay-reference"
                            type="text"
                            required={isUPIMethod(payMethod)}
                            value={txRef}
                            onChange={(e) => setTxRef(e.target.value)}
                            placeholder={isUPIMethod(payMethod) ? 'UTR / Ref ID' : 'TXN987654321'}
                            className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      {isUPIMethod(payMethod) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UPI App</label>
                            <select
                              value={upiApp}
                              onChange={(e) => setUpiApp(e.target.value)}
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                            >
                              <option value="">Select App</option>
                              <option value="PhonePe">PhonePe</option>
                              <option value="Google Pay">Google Pay</option>
                              <option value="Paytm">Paytm</option>
                              <option value="BHIM">BHIM</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payer UPI ID (Optional)</label>
                            <input
                              type="text"
                              value={payerUpiId}
                              onChange={(e) => setPayerUpiId(e.target.value)}
                              placeholder="upi@handle"
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Transaction Notes</label>
                    <input
                      id="form-pay-notes"
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Consultation co-pay, surgery deposit..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-pay-txn"
                      type="button"
                      onClick={() => setIsPayOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-pay-txn"
                      type="submit"
                      disabled={submitLoading || (isSplitPayment && Math.abs(splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) - (parseFloat(payAmount) || 0)) > 0.01)}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Logging...' : 'Clear Amount'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Edit Payment Transaction Details */}
        <AnimatePresence>
          {isEditPayOpen && editingPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditPayOpen(false)}
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
                    <ShieldAlert className="h-4.5 w-4.5 text-primary-green" />
                    Modify Transaction Details (Admin)
                  </h3>
                  <button onClick={() => setIsEditPayOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleEditPaySubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-medium">
                      {error}
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Patient Name:</span>
                    <strong className="text-sm text-slate-500 block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Total Payment Amount:</span>
                    <strong className="text-sm text-emerald-500 block">₹{editingPayment.amount}</strong>
                  </div>

                  {editingPayment.payment_method === 'Split Payment' || (editSplits && editSplits.length > 0) ? (
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Split Payment Details</label>
                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {editSplits.map((split, index) => {
                          const isUPI = split.method === 'UPI';
                          return (
                            <div key={index} className="bg-slate-50/50 p-3 rounded-xl border border-border-gray space-y-2">
                              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                                <span>Split #{index + 1} ({split.method})</span>
                                <span>₹{split.amount}</span>
                              </div>
                              {isUPI ? (
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-border-gray">
                                  <div>
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Ref ID (UTR) *</label>
                                    <input
                                      type="text"
                                      required
                                      value={split.transaction_ref || ''}
                                      onChange={(e) => {
                                        const newSplits = [...editSplits];
                                        newSplits[index].transaction_ref = e.target.value;
                                        setEditSplits(newSplits);
                                      }}
                                      placeholder="UTR / Ref ID"
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">UPI App</label>
                                    <select
                                      value={split.upi_app || ''}
                                      onChange={(e) => {
                                        const newSplits = [...editSplits];
                                        newSplits[index].upi_app = e.target.value;
                                        setEditSplits(newSplits);
                                      }}
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    >
                                      <option value="">Select App</option>
                                      <option value="PhonePe">PhonePe</option>
                                      <option value="Google Pay">Google Pay</option>
                                      <option value="Paytm">Paytm</option>
                                      <option value="BHIM">BHIM</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Payer UPI ID</label>
                                    <input
                                      type="text"
                                      value={split.payer_upi_id || ''}
                                      onChange={(e) => {
                                        const newSplits = [...editSplits];
                                        newSplits[index].payer_upi_id = e.target.value;
                                        setEditSplits(newSplits);
                                      }}
                                      placeholder="upi@handle"
                                      className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Ref (Optional)</label>
                                  <input
                                    type="text"
                                    value={split.transaction_ref || ''}
                                    onChange={(e) => {
                                      const newSplits = [...editSplits];
                                      newSplits[index].transaction_ref = e.target.value;
                                      setEditSplits(newSplits);
                                    }}
                                    placeholder="Ref No."
                                    className="w-full bg-white border border-border-gray rounded-lg py-1 px-1.5 text-[10px] text-slate-500 outline-none focus:border-primary-green"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Payment Method:</span>
                        <span className="text-xs text-slate-500 font-semibold block bg-slate-50 border border-border-gray p-2.5 rounded-xl">{editingPayment.payment_method}</span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          {isUPIMethod(editingPayment.payment_method) ? 'Ref ID (UTR) *' : 'UTR / Bank Reference ID (Optional)'}
                        </label>
                        <input
                          type="text"
                          required={isUPIMethod(editingPayment.payment_method)}
                          value={editTxRef}
                          onChange={(e) => setEditTxRef(e.target.value)}
                          placeholder="TXN987654321"
                          className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                        />
                      </div>

                      {isUPIMethod(editingPayment.payment_method) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UPI App</label>
                            <select
                              value={editUpiApp}
                              onChange={(e) => setEditUpiApp(e.target.value)}
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                            >
                              <option value="">Select App</option>
                              <option value="PhonePe">PhonePe</option>
                              <option value="Google Pay">Google Pay</option>
                              <option value="Paytm">Paytm</option>
                              <option value="BHIM">BHIM</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payer UPI ID (Optional)</label>
                            <input
                              type="text"
                              value={editPayerUpiId}
                              onChange={(e) => setEditPayerUpiId(e.target.value)}
                              placeholder="upi@handle"
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsEditPayOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Saving...' : 'Save Changes'}
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
