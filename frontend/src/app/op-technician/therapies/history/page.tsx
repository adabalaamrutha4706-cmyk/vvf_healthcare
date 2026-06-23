'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { DashboardLayout } from '../../../../components/DashboardLayout';
import { api } from '../../../../lib/api';
import { 
  Activity, Clock, Search, Calendar, RefreshCw, 
  CheckCircle, ShieldAlert, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function OPTechnicianTherapiesHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [therapyFilter, setTherapyFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      setError('');
      const params: any = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: searchTerm || undefined
      };
      if (therapyFilter !== 'All') {
        params.therapy_type = therapyFilter;
      }
      const data = await api.therapies.getAll(params);
      setSessions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load therapy session history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [therapyFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  const getCompletionStatus = (s: any) => {
    if (s.actual_start && s.end_time) {
      return { label: 'Completed ✓', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    }
    return { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 border border-amber-250' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <Link href="/op-technician/therapies" className="hover:text-primary-green transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Therapies
              </Link>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              My Therapy Session History
              <Activity className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Permanent clinical log records for all your assigned sessions.
            </p>
          </div>

          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green/35 rounded-xl cursor-pointer transition-all shadow-sm self-start sm:self-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Records
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5" />
            {error}
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white border border-border-gray rounded-2xl p-4 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Patient</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter patient name or mobile..."
                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 pl-9 pr-4 text-xs text-slate-500 outline-none"
                />
              </div>
            </div>

            {/* Modality */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Therapy Modality</label>
              <select
                value={therapyFilter}
                onChange={(e) => setTherapyFilter(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none h-[38px] cursor-pointer"
              >
                <option value="All">All Modalities</option>
                <option value="HBOT">HBOT</option>
                <option value="Hydrogen Inhalation">Hydrogen</option>
                <option value="Ozone">Ozone</option>
                <option value="Physiotherapy">Physiotherapy</option>
                <option value="Dental">Dental</option>
                <option value="Lab">Lab</option>
                <option value="Pelvic Chair Therapy">Pelvic Chair</option>
                <option value="SIPCD">SIPCD</option>
                <option value="Zero Gravity">Zero Gravity</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none h-[38px]"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none h-[38px]"
              />
            </div>
          </form>
        </div>

        {/* Table Container */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-green border-t-transparent"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center shadow-sm">
            <Activity className="h-10 w-10 text-slate-400 mb-3 opacity-50" />
            <p className="text-slate-500 text-sm font-semibold">No therapy session history records found.</p>
          </div>
        ) : (
          <div className="bg-white border border-border-gray rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-4">S.No</th>
                    <th className="py-4 px-4">Patient Name</th>
                    <th className="py-4 px-4">Therapy Modality</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4">OP Technician</th>
                    <th className="py-4 px-4">SOP Technician</th>
                    <th className="py-4 px-4">OP Verification</th>
                    <th className="py-4 px-4">SOP Verification</th>
                    <th className="py-4 px-4">Completion Status</th>
                    <th className="py-4 px-4">Final Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-gray text-slate-650">
                  {sessions.map((row, index) => {
                    const compStatus = getCompletionStatus(row);
                    const finalStatusClass = row.status === 'Verified'
                      ? 'bg-very-light-green text-primary-green border border-light-green/35'
                      : 'bg-rose-50 text-rose-500 border border-rose-100';

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{row.patient_name}</td>
                        <td className="py-3 px-4 font-semibold text-primary-green">{row.therapy_type}</td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium">{formatDateStr(row.session_date)}</td>
                        <td className="py-3 px-4 font-medium">{row.op_technician_name || '--'}</td>
                        <td className="py-3 px-4 font-medium">{row.sop_technician_name || '--'}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                            row.op_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.op_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                            row.sop_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.sop_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${compStatus.className}`}>
                            {compStatus.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${finalStatusClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'Verified' ? 'bg-primary-green animate-pulse' : 'bg-rose-500'}`} />
                            {row.status === 'Verified' ? 'Session Verified ✓' : 'Pending Verification'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
