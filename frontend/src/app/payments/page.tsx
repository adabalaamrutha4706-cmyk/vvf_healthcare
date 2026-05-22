'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  CreditCard, Search, ArrowUpRight, ArrowDownRight, IndianRupee,
  Calendar, User, PlusCircle, CheckCircle, Clock, X, ChevronRight,
  TrendingUp, Sparkles, FileText, Download, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PaymentsPage() {
  const { user } = useAuth();
  
  // Lists
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
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

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.appointments.getAll();
      setAppointments(res.appointments || []);
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
    setPayAmount((selectedApp.total_amount - selectedApp.paid_amount).toString());
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
      
      // Refresh
      const updatedRes = await api.appointments.getPayments(selectedApp.id);
      setPaymentLogs(updatedRes.payments || []);
      
      await fetchAppointments();
      
      // Update local selected state
      const found = appointments.find(a => a.id === selectedApp.id);
      if (found) {
        setSelectedApp({
          ...selectedApp,
          paid_amount: parseFloat(selectedApp.paid_amount) + parseFloat(payAmount)
        });
      }
    } catch (err: any) {
      setError(err.message || 'Payment submission failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Calculate stats
  const totalBilled = appointments.reduce((acc, app) => acc + parseFloat(app.total_amount || 0), 0);
  const totalCollected = appointments.reduce((acc, app) => acc + parseFloat(app.paid_amount || 0), 0);
  const totalDue = totalBilled - totalCollected;

  const filteredApps = appointments.filter(app => {
    const matchesSearch = app.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      app.contact_number.includes(search) ||
      (app.doctor_name && app.doctor_name.toLowerCase().includes(search.toLowerCase()));
      
    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && app.payment_status === statusFilter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Accounting Ledger & Payments
              <CreditCard className="h-5 w-5 text-cyan-400" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Track co-payments, surgeon credits, billing ledger status, and audit receipts.
            </p>
          </div>
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

        {/* 3 Accounting Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex items-center gap-4">
            <div className="p-3 bg-cyan-950/60 text-cyan-400 rounded-xl border border-cyan-800/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Billed</p>
              <h3 className="text-xl font-bold text-slate-100 mt-0.5">₹{totalBilled.toLocaleString('en-IN')}</h3>
            </div>
            <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-slate-500" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex items-center gap-4">
            <div className="p-3 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-800/30">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Collected</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-0.5">₹{totalCollected.toLocaleString('en-IN')}</h3>
            </div>
            <CheckCircle className="absolute top-4 right-4 h-4 w-4 text-emerald-500" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex items-center gap-4">
            <div className="p-3 bg-rose-950/60 text-rose-400 rounded-xl border border-rose-800/30">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Outstanding Balances</p>
              <h3 className="text-xl font-bold text-rose-400 mt-0.5">₹{totalDue.toLocaleString('en-IN')}</h3>
            </div>
            <ArrowDownRight className="absolute top-4 right-4 h-4 w-4 text-rose-500 animate-pulse" />
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
            <input
              id="payment-search"
              type="text"
              placeholder="Search patients by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Payment status:</span>
            <div className="flex gap-1">
              {['All', 'Unpaid', 'Partially Paid', 'Completed'].map((st) => (
                <button
                  key={st}
                  id={`status-filter-${st.toLowerCase().replace(/\s+/g, '-')}`}
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

        {/* Two Column Layout: Table ledger & Detailed transaction log view */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: List */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80">
              <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Patient Accounts Registry</h3>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-12">
                No accounts match active queries.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-850 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Patient Details</th>
                      <th className="px-5 py-3.5 text-right">Total Billed</th>
                      <th className="px-5 py-3.5 text-right">Total Paid</th>
                      <th className="px-5 py-3.5 text-right">Outstanding</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredApps.map((app) => {
                      const outstanding = app.total_amount - app.paid_amount;
                      const active = selectedApp?.id === app.id;
                      
                      return (
                        <tr 
                          key={app.id} 
                          id={`ledger-row-${app.id}`}
                          onClick={() => handleViewLogs(app)}
                          className={`cursor-pointer transition-colors ${
                            active 
                              ? 'bg-slate-850/80 hover:bg-slate-850 text-slate-200' 
                              : 'hover:bg-slate-850/30 text-slate-300'
                          }`}
                        >
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-200 block">{app.patient_name}</span>
                            <span className="text-[10px] text-slate-500">{app.contact_number}</span>
                          </td>
                          <td className="px-5 py-4 text-right font-medium">₹{app.total_amount}</td>
                          <td className="px-5 py-4 text-right font-bold text-emerald-400">₹{app.paid_amount}</td>
                          <td className="px-5 py-4 text-right font-bold text-rose-400">₹{outstanding}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              app.payment_status === 'Completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                              app.payment_status === 'Partially Paid' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                              'bg-rose-950 text-rose-400 border border-rose-500/20'
                            }`}>
                              {app.payment_status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Column 3: Detailed Ledger View */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col min-h-[400px]">
            {selectedApp ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Ledger Header */}
                  <div className="border-b border-slate-800 pb-4 mb-4">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Invoice Summary
                    </span>
                    <h3 className="font-bold text-base text-slate-200 mt-1">{selectedApp.patient_name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Phone: {selectedApp.contact_number}</p>
                  </div>

                  {/* Financial items */}
                  <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl mb-6 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Total Billed Fee</span>
                      <span className="text-slate-200 font-bold">₹{selectedApp.total_amount}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Amount Cleared</span>
                      <span className="text-emerald-400 font-bold">₹{selectedApp.paid_amount}</span>
                    </div>
                    <div className="h-px bg-slate-800 my-1" />
                    <div className="flex justify-between text-slate-300 font-semibold">
                      <span>Balance Outstanding</span>
                      <span className="text-rose-400 font-bold text-sm">₹{selectedApp.total_amount - selectedApp.paid_amount}</span>
                    </div>
                  </div>

                  {/* Transaction History list */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transaction History Log</h4>
                    
                    {logsLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent"></div>
                      </div>
                    ) : paymentLogs.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic bg-slate-950/20 p-4 rounded-xl border border-slate-850/40 text-center">
                        No transactions registered for this invoice.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {paymentLogs.map((log: any) => (
                          <div 
                            key={log.id} 
                            className="bg-slate-950/40 border border-slate-850/80 p-2.5 rounded-xl text-[10px] flex items-center justify-between gap-2.5"
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                                <span>₹{log.amount}</span>
                                <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                  {log.payment_method}
                                </span>
                              </div>
                              {log.transaction_ref && (
                                <p className="text-[8px] text-slate-500 mt-0.5">Ref: {log.transaction_ref}</p>
                              )}
                              {log.notes && (
                                <p className="text-[9px] text-slate-400 italic mt-0.5">"{log.notes}"</p>
                              )}
                            </div>
                            <span className="text-[8px] text-slate-500 font-medium shrink-0">
                              {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Log payment trigger */}
                {['Admin', 'Reception'].includes(user?.role || '') && selectedApp.payment_status !== 'Completed' && (
                  <button
                    id="trigger-add-payment-btn"
                    onClick={handleOpenPay}
                    className="w-full bg-emerald-960 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 font-semibold text-xs py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-6"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <IndianRupee className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
                    Clear Invoice Balance
                  </h3>
                  <button id="close-pay-form-modal" onClick={() => setIsPayOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Receipt for Patient:</span>
                    <strong className="text-sm text-slate-200 block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Amount (₹)</label>
                      <input
                        id="form-pay-amount"
                        type="number"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                      <select
                        id="form-pay-method"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="Digital (UPI/Card)">UPI / GPay / PhonePe</option>
                        <option value="Cash Receipt">Cash Desk</option>
                        <option value="Bank Transfer">Bank Wire</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">UTR / Bank Reference ID (Optional)</label>
                    <input
                      id="form-pay-reference"
                      type="text"
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="TXN987654321"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Transaction Notes</label>
                    <input
                      id="form-pay-notes"
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Consultation co-pay, surgery deposit..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-pay-txn"
                      type="button"
                      onClick={() => setIsPayOpen(false)}
                      className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-pay-txn"
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
