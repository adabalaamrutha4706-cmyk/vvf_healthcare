'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { api, BACKEND_URL } from '../lib/api';
import { SelectField } from './SelectField';
import { 
  Gauge, Plus, Search, Filter, Calendar, Clock, FileText, 
  Camera, ShieldAlert, CheckCircle, Trash2, Edit3, X, Image as ImageIcon,
  ArrowDownLeft, ArrowUpRight, Container, RefreshCw, Eye, Sparkles, SwitchCamera, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OxygenCylindersModule() {
  const { user } = useAuth();

  // State Lists & Stats
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    cylinders: { stockIn: 0, stockOut: 0, netAvailable: 0 },
    tanks: { stockIn: 0, stockOut: 0, netAvailable: 0 },
    today: { stockIn: 0, stockOut: 0 }
  });

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [containerFilter, setContainerFilter] = useState('All');
  const [movementFilter, setMovementFilter] = useState('All');

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Form Fields
  const [containerType, setContainerType] = useState<'Cylinder' | 'Big Liquid Tank'>('Cylinder');
  const [movementType, setMovementType] = useState<'Stock-In' | 'Stock-Out'>('Stock-In');
  const [entryDatetime, setEntryDatetime] = useState('');
  const [billDcNo, setBillDcNo] = useState('');
  const [psiPressure, setPsiPressure] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Live Camera Viewfinder States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lightbox Modal for Photo
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Camera Management Functions
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError('');
    setIsCameraOpen(true);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
      // If WebCam API is unavailable or blocked, trigger fallback native camera input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `oxygen-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.88);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [containerFilter, movementFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.oxygen.getAll({
        container_type: containerFilter !== 'All' ? containerFilter : undefined,
        movement_type: movementFilter !== 'All' ? movementFilter : undefined
      });
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load oxygen stock records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await api.oxygen.getSummary();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch oxygen summary stats:', err);
    }
  };

  const handleOpenCreate = (defaultType: 'Cylinder' | 'Big Liquid Tank' = 'Cylinder') => {
    setSelectedLog(null);
    setContainerType(defaultType);
    setMovementType('Stock-In');
    
    // Set current datetime-local
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEntryDatetime(localIso);
    
    setBillDcNo('');
    setPsiPressure('');
    setQuantity('1');
    setNotes('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (log: any) => {
    setSelectedLog(log);
    setContainerType(log.container_type || 'Cylinder');
    setMovementType(log.movement_type || 'Stock-In');
    
    if (log.entry_datetime) {
      const dt = new Date(log.entry_datetime);
      const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEntryDatetime(localIso);
    } else {
      setEntryDatetime('');
    }

    setBillDcNo(log.bill_dc_no || '');
    setPsiPressure(log.psi_pressure || '');
    setQuantity(log.quantity ? String(log.quantity) : '1');
    setNotes(log.notes || '');
    setPhotoFile(null);
    setPhotoPreview(log.photo_url ? `${BACKEND_URL}${log.photo_url}` : null);
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('container_type', containerType);
      formData.append('movement_type', movementType);
      formData.append('entry_datetime', entryDatetime ? new Date(entryDatetime).toISOString() : new Date().toISOString());
      formData.append('bill_dc_no', billDcNo);
      formData.append('psi_pressure', psiPressure);
      formData.append('quantity', quantity || '1');
      formData.append('notes', notes);
      
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      if (selectedLog) {
        await api.oxygen.update(selectedLog.id, formData);
        setSuccess('Oxygen stock entry updated successfully.');
      } else {
        await api.oxygen.create(formData);
        setSuccess(`New ${containerType} ${movementType} recorded successfully.`);
      }

      setIsFormOpen(false);
      fetchLogs();
      fetchSummary();
    } catch (err: any) {
      setError(err.message || 'Failed to save oxygen stock record. Please check inputs.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this oxygen stock record?')) return;
    try {
      await api.oxygen.delete(id);
      setSuccess('Oxygen stock record removed.');
      fetchLogs();
      fetchSummary();
    } catch (err: any) {
      setError(err.message || 'Failed to remove oxygen stock record.');
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.bill_dc_no && log.bill_dc_no.toLowerCase().includes(search.toLowerCase())) ||
      (log.psi_pressure && log.psi_pressure.toLowerCase().includes(search.toLowerCase())) ||
      (log.notes && log.notes.toLowerCase().includes(search.toLowerCase())) ||
      (log.created_by_name && log.created_by_name.toLowerCase().includes(search.toLowerCase())) ||
      (log.container_type && log.container_type.toLowerCase().includes(search.toLowerCase()));

    return matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              Oxygen Cylinders & Liquid Tanks
              <Gauge className="h-6 w-6 text-primary-green animate-pulse" />
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Track Stock-In & Stock-Out movements, PSI pressure readings, Delivery Challans, and photo evidence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-add-cylinder"
              onClick={() => handleOpenCreate('Cylinder')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
            >
              <Plus className="h-4 w-4" />
              + Cylinder Log
            </button>
            <button
              id="btn-add-tank"
              onClick={() => handleOpenCreate('Big Liquid Tank')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl cursor-pointer transition-all shadow-sm"
            >
              <Container className="h-4 w-4 text-emerald-700" />
              + Liquid Tank Log
            </button>
          </div>
        </div>

        {/* Global Alert Panels */}
        {error && (
          <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2 shadow-sm">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2 shadow-sm">
            <CheckCircle className="h-4.5 w-4.5 shrink-0" />
            {success}
          </div>
        )}

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-border-gray p-4 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cylinders Stock</span>
              <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <Gauge className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{summary.cylinders.netAvailable}</span>
              <span className="text-xs text-slate-400">Available</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-400 border-t border-border-gray/60 pt-2">
              <span className="text-emerald-600">In: +{summary.cylinders.stockIn}</span>
              <span className="text-rose-500">Out: -{summary.cylinders.stockOut}</span>
            </div>
          </div>

          <div className="bg-white border border-border-gray p-4 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Big Liquid Tanks</span>
              <span className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <Container className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{summary.tanks.netAvailable}</span>
              <span className="text-xs text-slate-400">Available</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-400 border-t border-border-gray/60 pt-2">
              <span className="text-emerald-600">In: +{summary.tanks.stockIn}</span>
              <span className="text-rose-500">Out: -{summary.tanks.stockOut}</span>
            </div>
          </div>

          <div className="bg-white border border-border-gray p-4 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Stock-In</span>
              <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <ArrowDownLeft className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">+{summary.today.stockIn}</span>
              <span className="text-xs text-slate-400">Units today</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 border-t border-border-gray/60 pt-2">
              Verified deliveries logged today
            </p>
          </div>

          <div className="bg-white border border-border-gray p-4 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Stock-Out</span>
              <span className="p-2 bg-rose-50 rounded-xl text-rose-500">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-500">-{summary.today.stockOut}</span>
              <span className="text-xs text-slate-400">Units today</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 border-t border-border-gray/60 pt-2">
              Dispatched / consumed units
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-border-gray p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Bill/DC No, PSI, Notes..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-border-gray rounded-xl text-xs outline-none focus:border-primary-green text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="w-40">
              <SelectField
                value={containerFilter}
                onChange={setContainerFilter}
                triggerClassName="py-2 text-xs"
                options={[
                  { value: 'All', label: 'All Containers' },
                  { value: 'Cylinder', label: 'Cylinders Only' },
                  { value: 'Big Liquid Tank', label: 'Liquid Tanks Only' },
                ]}
              />
            </div>

            <div className="w-40">
              <SelectField
                value={movementFilter}
                onChange={setMovementFilter}
                triggerClassName="py-2 text-xs"
                options={[
                  { value: 'All', label: 'All Movements' },
                  { value: 'Stock-In', label: 'Stock-In Only' },
                  { value: 'Stock-Out', label: 'Stock-Out Only' },
                ]}
              />
            </div>

            <button
              onClick={() => { fetchLogs(); fetchSummary(); }}
              className="p-2 text-slate-500 hover:text-primary-green hover:bg-very-light-green border border-border-gray rounded-xl transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stock Records Table / Cards */}
        {loading ? (
          <div className="p-12 text-center bg-white border border-border-gray rounded-2xl">
            <RefreshCw className="h-8 w-8 text-primary-green animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading oxygen stock records...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center bg-white border border-border-gray rounded-2xl flex flex-col items-center">
            <Gauge className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-slate-500 font-semibold text-sm">No oxygen stock records found.</p>
            <p className="text-slate-400 text-xs mt-1">Click "+ Cylinder Log" or "+ Liquid Tank Log" above to record entries.</p>
          </div>
        ) : (
          <div className="bg-white border border-border-gray rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-500">
                <thead className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Container & Movement</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Bill / DC No</th>
                    <th className="px-4 py-3">PSI Pressure</th>
                    <th className="px-4 py-3">Photo Evidence</th>
                    <th className="px-4 py-3">Logged By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-gray/60">
                  {filteredLogs.map((log) => {
                    const dt = log.entry_datetime ? new Date(log.entry_datetime) : null;
                    const dateFormatted = dt ? dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                    const timeFormatted = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded-lg ${log.movement_type === 'Stock-In' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                              {log.movement_type === 'Stock-In' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-700">{log.container_type}</span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                  log.movement_type === 'Stock-In' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                                }`}>
                                  {log.movement_type} ({log.quantity || 1})
                                </span>
                              </div>
                              {log.notes && (
                                <p className="text-[10px] text-slate-400 italic truncate max-w-xs mt-0.5">{log.notes}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium">
                          <div>{dateFormatted}</div>
                          <div className="text-[10px] text-slate-400">{timeFormatted}</div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                            {log.bill_dc_no || 'N/A'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {log.psi_pressure ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-very-light-green border border-light-green/40 px-2 py-0.5 rounded-md text-[11px]">
                              <Gauge className="h-3 w-3" />
                              {log.psi_pressure}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not set</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {log.photo_url ? (
                            <button
                              onClick={() => setLightboxPhoto({
                                url: `${BACKEND_URL}${log.photo_url}`,
                                title: `${log.container_type} ${log.movement_type} - Bill/DC: ${log.bill_dc_no || 'N/A'}`
                              })}
                              className="group relative flex items-center gap-1.5 p-1 bg-slate-100 hover:bg-emerald-50 border border-border-gray hover:border-emerald-300 rounded-lg cursor-pointer transition-all"
                            >
                              <img
                                src={`${BACKEND_URL}${log.photo_url}`}
                                alt="Photo Evidence"
                                className="h-8 w-8 object-cover rounded-md"
                              />
                              <span className="text-[10px] font-bold text-primary-green group-hover:underline flex items-center gap-0.5">
                                <Eye className="h-3 w-3" /> View
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">No photo attached</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-500 font-medium">
                          {log.created_by_name || 'Staff'}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(log)}
                              className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg transition-colors cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(log.id)}
                              className="p-1.5 text-slate-500 hover:text-alert-text hover:bg-very-light-green rounded-lg transition-colors cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Create/Edit Oxygen Stock Log */}
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
                className="w-full max-w-lg bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    {selectedLog ? 'Edit Oxygen Stock Record' : 'Record Oxygen Stock Entry'}
                  </h3>
                  <button
                    onClick={() => setIsFormOpen(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">

                  {/* 1. Container Type Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Container</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setContainerType('Cylinder')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          containerType === 'Cylinder'
                            ? 'bg-very-light-green/40 border-primary-green text-primary-green font-bold shadow-sm'
                            : 'bg-white border-border-gray text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Gauge className="h-5 w-5" />
                        <span className="text-xs">Cylinder</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setContainerType('Big Liquid Tank')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          containerType === 'Big Liquid Tank'
                            ? 'bg-blue-50/60 border-blue-500 text-blue-700 font-bold shadow-sm'
                            : 'bg-white border-border-gray text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Container className="h-5 w-5" />
                        <span className="text-xs">Big Liquid Tank</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Movement Type Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Movement Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMovementType('Stock-In')}
                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          movementType === 'Stock-In'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                            : 'bg-white border-border-gray text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <ArrowDownLeft className="h-4 w-4" />
                        <span className="text-xs">Stock-In (Added)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMovementType('Stock-Out')}
                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          movementType === 'Stock-Out'
                            ? 'bg-rose-50 border-rose-500 text-rose-600 font-bold'
                            : 'bg-white border-border-gray text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        <span className="text-xs">Stock-Out (Used/Sent)</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Date & Time and Quantity Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date & Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={entryDatetime}
                        onChange={(e) => setEntryDatetime(e.target.value)}
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantity (Units)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* 4. Bill / DC No and PSI Pressure */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bill No / DC No</label>
                      <input
                        type="text"
                        value={billDcNo}
                        onChange={(e) => setBillDcNo(e.target.value)}
                        placeholder="e.g. DC-998822 / INV-402"
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">PSI / Pressure Value</label>
                      <input
                        type="text"
                        value={psiPressure}
                        onChange={(e) => setPsiPressure(e.target.value)}
                        placeholder="e.g. 2000 PSI / 150 bar"
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* 5. Photo Evidence Upload */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Photograph Evidence (Pressure Gauge / Tank / Challan)</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-very-light-green/30 border border-dashed border-border-gray hover:border-primary-green rounded-xl cursor-pointer transition-colors text-xs text-slate-500 font-medium"
                      >
                        <Camera className="h-4 w-4 text-primary-green" />
                        <span>{photoFile ? photoFile.name : 'Capture Photo'}</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                      {photoPreview && (
                        <div className="relative shrink-0">
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="h-12 w-12 object-cover rounded-xl border border-border-gray"
                          />
                          <button
                            type="button"
                            onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                            className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. Notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Outbound / Delivery Remarks</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Delivered by agency, pressure verified..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl p-3 text-xs text-slate-500 outline-none resize-none"
                    />
                  </div>

                  {/* Modal Footer Buttons */}
                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-50 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Saving Entry...' : 'Save Stock Record'}
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Lightbox Photo Preview Modal */}
        <AnimatePresence>
          {lightboxPhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                exit={{ opacity: 0 }}
                onClick={() => setLightboxPhoto(null)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl shadow-2xl p-4 max-w-2xl w-full z-10 flex flex-col space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border-gray pb-3">
                  <h4 className="font-bold text-sm text-slate-700 truncate">{lightboxPhoto.title}</h4>
                  <button onClick={() => setLightboxPhoto(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-hidden rounded-xl bg-black flex items-center justify-center">
                  <img
                    src={lightboxPhoto.url}
                    alt={lightboxPhoto.title}
                    className="max-h-[68vh] w-auto object-contain"
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Live Camera Viewfinder Modal */}
        <AnimatePresence>
          {isCameraOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg flex flex-col relative"
              >
                {/* Modal Header */}
                <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-slate-200">Live Camera Evidence Capture</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                      title="Switch Camera"
                    >
                      <SwitchCamera className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Viewfinder Stream */}
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Framing Overlay */}
                  <div className="absolute inset-6 border-2 border-dashed border-white/40 rounded-2xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-white/70 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                      Align Pressure Gauge / Cylinder Label
                    </span>
                  </div>

                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                      <ShieldAlert className="h-10 w-10 text-rose-400 mb-2" />
                      <p className="text-xs text-rose-200 font-semibold mb-3">{cameraError}</p>
                      <button
                        type="button"
                        onClick={() => { stopCamera(); fileInputRef.current?.click(); }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        Use Native Device Camera
                      </button>
                    </div>
                  )}
                </div>

                {/* Shutter Bar */}
                <div className="p-6 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={takeSnapshot}
                    disabled={!!cameraError}
                    className="group relative flex items-center justify-center h-16 w-16 rounded-full bg-white hover:bg-emerald-400 transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Take Photo Snapshot"
                  >
                    <span className="h-12 w-12 rounded-full border-4 border-slate-900 group-hover:border-slate-900 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-slate-900" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Flip Camera"
                  >
                    <SwitchCamera className="h-5 w-5" />
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
