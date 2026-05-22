'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Building2, Search, Plus, Edit3, Trash2, ShieldAlert, CheckCircle, 
  MapPin, Phone, User, Sparkles, X, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HospitalsPage() {
  const { user } = useAuth();
  
  // Lists
  const [hospitals, setHospitals] = useState<any[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  
  // States
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('Active');

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await api.hospitals.getAll();
      setHospitals(res.hospitals || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch partner clinic networks.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedHospital(null);
    setName('');
    setCity('');
    setState('');
    setContactPerson('');
    setPhone('');
    setStatus('Active');
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (hosp: any) => {
    setSelectedHospital(hosp);
    setName(hosp.name);
    setCity(hosp.city);
    setState(hosp.state);
    setContactPerson(hosp.contact_person || '');
    setPhone(hosp.phone || '');
    setStatus(hosp.status);
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
      name,
      city,
      state,
      contact_person: contactPerson,
      phone,
      status
    };

    try {
      if (selectedHospital) {
        await api.hospitals.update(selectedHospital.id, payload);
        setSuccess('Hospital credentials modified successfully.');
      } else {
        await api.hospitals.create(payload);
        setSuccess('New hospital registered into organization network.');
      }
      setIsFormOpen(false);
      fetchHospitals();
    } catch (err: any) {
      setError(err.message || 'Validation error. Please verify input fields.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to suspend/delete this hospital? This soft-deletes the record.')) return;
    try {
      await api.hospitals.delete(id);
      setSuccess('Hospital removed from active directory.');
      fetchHospitals();
    } catch (err: any) {
      setError(err.message || 'Failed to remove hospital record.');
    }
  };

  const filteredHospitals = hospitals.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.city.toLowerCase().includes(search.toLowerCase()) ||
    h.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Partner Hospitals Registry
              <Building2 className="h-5 w-5 text-cyan-400" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Manage clinical locations, reference branches, and field visitation networks.
            </p>
          </div>

          {user?.role === 'Admin' && (
            <button
              id="btn-new-hospital"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-950/20"
            >
              <Plus className="h-4.5 w-4.5" />
              Register Branch
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

        {/* Search Panel */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
            <input
              id="hospital-search"
              type="text"
              placeholder="Search hospitals by name, city, or state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />
          </div>
        </div>

        {/* Grid List */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-850 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <Building2 className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm font-medium">No medical centers matched your query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHospitals.map((hosp) => (
              <motion.div
                key={hosp.id}
                id={`hospital-card-${hosp.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-300" />
                
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-bold text-slate-200 text-sm truncate leading-tight">{hosp.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                      hosp.status === 'Active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                      hosp.status === 'Pending' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                      'bg-rose-950 text-rose-400 border border-rose-500/20'
                    }`}>
                      {hosp.status}
                    </span>
                  </div>

                  <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-3 rounded-xl mb-4 text-xs">
                    <div className="flex items-center gap-2 text-slate-350">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      <span>{hosp.city}, {hosp.state}</span>
                    </div>
                    {hosp.contact_person && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        <span>POC: <strong className="text-slate-300 font-semibold">{hosp.contact_person}</strong></span>
                      </div>
                    )}
                    {hosp.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>{hosp.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                {user?.role === 'Admin' && (
                  <div className="flex justify-end items-center border-t border-slate-850 pt-3 gap-2.5">
                    <button
                      id={`btn-edit-hospital-${hosp.id}`}
                      onClick={() => handleOpenEdit(hosp)}
                      className="p-1.5 text-slate-450 hover:text-cyan-400 hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors"
                      title="Edit Branch"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      id={`btn-delete-hospital-${hosp.id}`}
                      onClick={() => handleDelete(hosp.id)}
                      className="p-1.5 text-slate-450 hover:text-rose-400 hover:bg-slate-800/40 rounded-lg cursor-pointer transition-colors"
                      title="Delete Branch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
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
                    <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
                    {selectedHospital ? 'Edit Branch Credentials' : 'Register Partner Clinic'}
                  </h3>
                  <button id="close-hospital-modal" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Clinic Name</label>
                    <input
                      id="form-hosp-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Apex Heart Clinic"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">City</label>
                      <input
                        id="form-hosp-city"
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Secunderabad"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">State</label>
                      <input
                        id="form-hosp-state"
                        type="text"
                        required
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="Telangana"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Primary POC Name</label>
                    <input
                      id="form-hosp-poc"
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Dr. K. Srinivas"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contact Number</label>
                      <input
                        id="form-hosp-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="040-27894561"
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Network Status</label>
                      <select
                        id="form-hosp-status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-slate-200 outline-none"
                      >
                        <option value="Active">Active Branch</option>
                        <option value="Pending">Pending Audit</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-hosp"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs text-slate-400 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-hosp"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950/20"
                    >
                      {submitLoading ? 'Registering...' : 'Save Branch'}
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
