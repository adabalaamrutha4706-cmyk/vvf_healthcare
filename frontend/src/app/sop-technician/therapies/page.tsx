'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { 
  Activity, Clock, Edit3, ShieldAlert, CheckCircle, RefreshCw, 
  Settings, CheckSquare, X, Eye, MessageSquare, Calendar, Plus, Droplet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../../components/SelectField';

const THERAPY_TABS = [
  { id: 'HBOT', label: 'HBOT' },
  { id: 'Hydrogen Inhalation', label: 'Hydrogen' },
  { id: 'Ozone', label: 'Ozone' },
  { id: 'Physiotherapy', label: 'Physiotherapy' },
  { id: 'Dental', label: 'Dental' },
  { id: 'Lab', label: 'Lab' },
  { id: 'Pelvic Chair Therapy', label: 'Pelvic Chair' },
  { id: 'SIPCD', label: 'SIPCD' },
  { id: 'Zero Gravity', label: 'Zero Gravity' }
];

const LAB_TEST_OPTIONS = ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Blood Sugar', 'ECG', 'Others'];

function SOPTherapiesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Lists
  const [sessions, setSessions] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // States
  const [activeTab, setActiveTab] = useState('HBOT');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields (Audit/Verify)
  const [sopTechnicianId, setSopTechnicianId] = useState('');
  const [sopVerified, setSopVerified] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Form Fields (Schedule)
  const [patientName, setPatientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [timings, setTimings] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [rescheduled, setRescheduled] = useState('No');
  const [rescheduledDate, setRescheduledDate] = useState('');
  const [rescheduledTime, setRescheduledTime] = useState('');
  const [actualStart, setActualStart] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [opTechnicianId, setOpTechnicianId] = useState('');
  
  // Specific details
  const [diveSurfaceTimings, setDiveSurfaceTimings] = useState('');
  const [pressureType, setPressureType] = useState('Cylinder Pressure');
  const [pressureValue, setPressureValue] = useState('');
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [nextSessionTime, setNextSessionTime] = useState('');
  
  // Lab specific
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [labReported, setLabReported] = useState('No');
  const [labReportPrinted, setLabReportPrinted] = useState('No');
  const [labWhatsappReport, setLabWhatsappReport] = useState('Not Sent');

  // Dynamic fields
  const [formTherapyType, setFormTherapyType] = useState('');
  const [diveTime, setDiveTime] = useState('');
  const [surfaceTime, setSurfaceTime] = useState('');
  const [physiotherapistName, setPhysiotherapistName] = useState('');
  const [treatmentType, setTreatmentType] = useState('');
  const [dentistName, setDentistName] = useState('');

  // Read URL query tab
  const tabParam = searchParams.get('tab');
  const statusParam = searchParams.get('status');

  useEffect(() => {
    if (tabParam) {
      const matched = THERAPY_TABS.find(t => t.id.toLowerCase() === tabParam.toLowerCase() || t.label.toLowerCase() === tabParam.toLowerCase());
      if (matched) {
        setActiveTab(matched.id);
      }
    }
  }, [tabParam]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      setError('');
      const params: any = { therapy_type: activeTab };
      if (statusParam) {
        params.status = statusParam;
      }
      
      const [sessionsData, techsData, hospData, appsData] = await Promise.all([
        api.therapies.getAll(params),
        api.therapies.getTechnicians(),
        api.hospitals.getAll(),
        api.appointments.getAll()
      ]);
      setSessions(sessionsData || []);
      setTechnicians(techsData || []);
      setHospitals(hospData.hospitals || hospData || []);
      setAppointments(appsData.appointments || appsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load therapies page data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [activeTab, statusParam]);

  const handleOpenVerify = (session: any) => {
    setSelectedSession(session);
    setSopTechnicianId(session.sop_technician_id ? String(session.sop_technician_id) : '');
    setSopVerified(session.sop_verified === true || session.sop_verified === 'true');
    setRemarks(session.remarks || '');
    setError('');
    setSuccess('');
    setIsVerifyModalOpen(true);
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedSession(null);
    setFormTherapyType(activeTab);
    setPatientName('');
    setMobileNumber('');
    setTimings('');
    setSessionDate(new Date().toISOString().split('T')[0]);
    setRescheduled('No');
    setRescheduledDate('');
    setRescheduledTime('');
    setActualStart('');
    setEndTime('');
    setHospitalId(hospitals[0]?.id ? String(hospitals[0].id) : '');
    setOpTechnicianId('');
    setSopTechnicianId(user?.id ? String(user.id) : '');
    setDiveSurfaceTimings('');
    setDiveTime('');
    setSurfaceTime('');
    setPressureType('Cylinder Pressure');
    setPressureValue('');
    setNextSessionDate('');
    setNextSessionTime('');
    setSelectedTests([]);
    setLabReported('No');
    setLabReportPrinted('No');
    setLabWhatsappReport('Not Sent');
    setPhysiotherapistName('');
    setTreatmentType('');
    setDentistName('');
    setRemarks('');
    setError('');
    setSuccess('');
    setIsScheduleModalOpen(true);
  };

  const handleOpenEdit = (session: any) => {
    setIsEditing(true);
    setSelectedSession(session);
    setFormTherapyType(session.therapy_type || '');
    setPatientName(session.patient_name || '');
    setMobileNumber(session.mobile_number || '');
    setTimings(session.timings || '');
    setSessionDate(session.session_date ? new Date(session.session_date).toISOString().split('T')[0] : '');
    setRescheduled(session.rescheduled || 'No');
    setRescheduledDate(session.rescheduled_date || '');
    setRescheduledTime(session.rescheduled_time || '');
    setActualStart(session.actual_start || '');
    setEndTime(session.end_time || '');
    setHospitalId(session.hospital_id ? String(session.hospital_id) : '');
    setOpTechnicianId(session.op_technician_id ? String(session.op_technician_id) : '');
    setSopTechnicianId(session.sop_technician_id ? String(session.sop_technician_id) : '');
    
    // Details
    setDiveSurfaceTimings(session.dive_surface_timings || '');
    let dTime = '';
    let sTime = '';
    if (session.therapy_type === 'HBOT' && session.dive_surface_timings) {
      const match = session.dive_surface_timings.match(/Dive:\s*(.*?),\s*Surface:\s*(.*)/);
      if (match) {
        dTime = match[1];
        sTime = match[2];
      } else {
        dTime = session.dive_surface_timings;
      }
    }
    setDiveTime(dTime);
    setSurfaceTime(sTime);

    setPressureType(session.pressure_type || 'Cylinder Pressure');
    setPressureValue(session.pressure_value ? String(session.pressure_value) : '');
    setNextSessionDate(session.next_session_date || '');
    setNextSessionTime(session.next_session_time || '');
    
    // Custom mapped values
    setPhysiotherapistName(session.therapy_type === 'Physiotherapy' ? session.pressure_type || '' : '');
    setTreatmentType(session.therapy_type === 'Dental' ? session.dive_surface_timings || '' : '');
    setDentistName(session.therapy_type === 'Dental' ? session.pressure_type || '' : '');
    setRemarks(session.remarks || '');

    // Lab
    setSelectedTests(session.tests ? session.tests.split(', ') : []);
    setLabReported(session.reported || 'No');
    setLabReportPrinted(session.report_printed || 'No');
    setLabWhatsappReport(session.whatsapp_report || 'Not Sent');
    
    setError('');
    setSuccess('');
    setIsScheduleModalOpen(true);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      if (sopTechnicianId !== String(selectedSession.sop_technician_id)) {
        await api.therapies.update(selectedSession.id, {
          sop_technician_id: sopTechnicianId ? parseInt(sopTechnicianId, 10) : null
        });
      }

      await api.therapies.verify(selectedSession.id, {
        verified: sopVerified,
        remarks: remarks
      });

      setSuccess('SOP audit logs submitted and session verification completed.');
      setIsVerifyModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!remarks.trim()) {
      setError('clinical remarks/comments are required to reject the session.');
      return;
    }
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.therapies.verify(selectedSession.id, {
        verified: false,
        remarks: remarks
      });

      setSuccess('SOP audit rejection submitted successfully.');
      setIsVerifyModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to reject session.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Patient name validations
    const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;
    if (!patientName.trim()) {
      setError('Patient name is required.');
      return;
    }
    if (!nameRegex.test(patientName.trim())) {
      setError('Patient name can contain only letters.');
      return;
    }
    
    // Contact number validation
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(mobileNumber)) {
      setError('Contact number must contain exactly 10 digits.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = {
        patient_name: patientName,
        mobile_number: mobileNumber,
        therapy_type: formTherapyType,
        timings: formTherapyType === 'Lab' ? '' : timings,
        session_date: sessionDate,
        rescheduled,
        rescheduled_date: rescheduled === 'Yes' ? rescheduledDate : null,
        rescheduled_time: rescheduled === 'Yes' ? rescheduledTime : null,
        actual_start: formTherapyType === 'Lab' ? null : actualStart,
        end_time: formTherapyType === 'Lab' ? null : endTime,
        hospital_id: parseInt(hospitalId, 10),
        remarks
      };

      if (formTherapyType !== 'Lab') {
        payload.op_technician_id = opTechnicianId ? parseInt(opTechnicianId, 10) : null;
        payload.sop_technician_id = sopTechnicianId ? parseInt(sopTechnicianId, 10) : null;
      }

      // Therapy specific payloads
      if (formTherapyType === 'HBOT') {
        payload.dive_surface_timings = `Dive: ${diveTime}, Surface: ${surfaceTime}`;
        payload.pressure_type = pressureType;
        payload.pressure_value = pressureValue ? parseInt(pressureValue, 10) : null;
        payload.next_session_date = nextSessionDate;
        payload.next_session_time = nextSessionTime;
      } else if (formTherapyType === 'Ozone') {
        payload.pressure_type = pressureType;
        payload.pressure_value = pressureValue ? parseInt(pressureValue, 10) : null;
        payload.next_session_date = nextSessionDate;
        payload.next_session_time = nextSessionTime;
      } else if (formTherapyType === 'Physiotherapy') {
        payload.pressure_type = physiotherapistName;
        payload.next_session_date = nextSessionDate;
        payload.next_session_time = nextSessionTime;
      } else if (formTherapyType === 'Dental') {
        payload.dive_surface_timings = treatmentType;
        payload.pressure_type = dentistName;
        payload.next_session_date = nextSessionDate;
        payload.next_session_time = nextSessionTime;
      } else if (formTherapyType === 'Lab') {
        payload.tests = selectedTests.join(', ');
        payload.reported = labReported;
        payload.report_printed = labReportPrinted;
        payload.whatsapp_report = labWhatsappReport;
      } else if (formTherapyType !== 'Hydrogen Inhalation') {
        payload.next_session_date = nextSessionDate;
        payload.next_session_time = nextSessionTime;
      }

      if (isEditing && selectedSession) {
        await api.therapies.update(selectedSession.id, payload);
        setSuccess('Therapy session updated successfully.');
      } else {
        await api.therapies.create(payload);
        setSuccess('New therapy session scheduled successfully.');
      }
      setIsScheduleModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to save therapy session.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelSession = async (session: any) => {
    if (!window.confirm(`Are you sure you want to cancel the therapy session for patient "${session.patient_name}"?`)) return;
    try {
      setError('');
      setSuccess('');
      await api.therapies.update(session.id, { status: 'Cancelled' });
      setSuccess('Therapy session cancelled successfully.');
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel therapy session.');
    }
  };

  const handleQuickComplete = async (session: any) => {
    if (!window.confirm(`Mark session for patient "${session.patient_name}" as completed?`)) return;
    try {
      setError('');
      setSuccess('');
      
      let actualStart = '09:00 AM';
      let endTime = '10:00 AM';
      if (session.timings) {
        const parts = session.timings.split('-');
        if (parts.length === 2) {
          actualStart = parts[0].trim();
          endTime = parts[1].trim();
        }
      }
      
      const payload: any = {
        actual_start: actualStart,
        end_time: endTime,
        status: 'Completed'
      };

      await api.therapies.update(session.id, payload);
      setSuccess('Therapy session marked as completed.');
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete session.');
    }
  };

  const handleTestToggle = (testName: string) => {
    setSelectedTests(prev => 
      prev.includes(testName) ? prev.filter(t => t !== testName) : [...prev, testName]
    );
  };

  const opTechOptions = technicians
    .filter(t => t.role === 'OP Technician')
    .map(t => ({ value: String(t.id), label: t.name }));

  const sopTechOptions = technicians
    .filter(t => t.role === 'SOP Technician')
    .map(t => ({ value: String(t.id), label: t.name }));

  const hospOptions = hospitals.map(h => ({ value: String(h.id), label: h.name }));

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
            SOP Audit Station
            <Eye className="h-5 w-5 text-primary-green" />
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Review operative technician records, append clinic remarks, approve sessions, and schedule therapies.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
          >
            <Plus className="h-4 w-4" />
            Schedule Session
          </button>
          <button
            onClick={fetchInitialData}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green/35 rounded-xl cursor-pointer transition-all shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Lists
          </button>
        </div>
      </div>

      {/* Global Feedback Panels */}
      {error && (
        <div className="p-4 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5" />
          {success}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-1.5 pb-2 border-b border-border-gray no-scrollbar">
        {THERAPY_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                active 
                  ? 'bg-primary-green text-white shadow-md shadow-emerald-950/20' 
                  : 'text-slate-500 bg-white hover:bg-very-light-green hover:text-primary-green border border-border-gray'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table Container */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center shadow-sm">
          <Activity className="h-10 w-10 text-slate-400 mb-3 opacity-50" />
          <p className="text-slate-500 text-sm font-semibold">No assigned sessions found for {activeTab === 'Hydrogen Inhalation' ? 'Hydrogen' : activeTab} therapy.</p>
        </div>
      ) : (
        <div className="bg-white border border-border-gray rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                {activeTab === 'Lab' ? (
                  <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-4">S.No</th>
                    <th className="py-4 px-4">Patient Name</th>
                    <th className="py-4 px-4">Name of Tests</th>
                    <th className="py-4 px-4">Reported</th>
                    <th className="py-4 px-4">Report Printed</th>
                    <th className="py-4 px-4">WhatsApp Report</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-center">Action</th>
                  </tr>
                ) : activeTab === 'Hydrogen Inhalation' ? (
                  <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-4">S.No</th>
                    <th className="py-4 px-4">Patient Name</th>
                    <th className="py-4 px-4">Time</th>
                    <th className="py-4 px-4">Rescheduled</th>
                    <th className="py-4 px-4">Actual Start</th>
                    <th className="py-4 px-4">End Time</th>
                    <th className="py-4 px-4">OP Tech</th>
                    <th className="py-4 px-4">SOP Tech</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-center">Action</th>
                  </tr>
                ) : (
                  <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-4">S.No</th>
                    <th className="py-4 px-4">Patient Name</th>
                    <th className="py-4 px-4">Mobile</th>
                    <th className="py-4 px-4">Dive/Surface</th>
                    <th className="py-4 px-4">Timings</th>
                    <th className="py-4 px-4">Rescheduled</th>
                    <th className="py-4 px-4">Actual Start</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4">End Time</th>
                    <th className="py-4 px-4">Oxygen Level</th>
                    <th className="py-4 px-4">Next Session</th>
                    <th className="py-4 px-4">OP Tech</th>
                    <th className="py-4 px-4">SOP Tech</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-center">Action</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border-gray text-slate-650">
                {sessions.map((row, index) => {
                  const statusClass = row.status === 'Verified' 
                    ? 'bg-very-light-green text-primary-green border border-light-green/35' 
                    : row.status === 'Rejected'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : row.status === 'Cancelled'
                    ? 'bg-slate-100 text-slate-500 border border-slate-200'
                    : 'bg-rose-50 text-rose-500 border border-rose-100';

                  const actionsLayout = (
                    <div className="flex items-center justify-center gap-1.5">
                      {row.status !== 'Verified' && row.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleOpenVerify(row)}
                          className="p-1.5 text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                          title="Verify logs & sign approval"
                        >
                          <CheckSquare className="h-4 w-4" />
                        </button>
                      )}
                      {row.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleOpenEdit(row)}
                          className="p-1.5 text-slate-550 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                          title="Reschedule / Edit Session"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {row.status !== 'Verified' && row.status !== 'Completed' && row.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleQuickComplete(row)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title="Mark Completed"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {row.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleCancelSession(row)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Cancel Session"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );

                  if (activeTab === 'Lab') {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors animate-fade-in">
                        <td className="py-3 px-4 font-bold">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{row.patient_name}</td>
                        <td className="py-3 px-4 font-medium text-primary-green">{row.tests || '--'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.reported === 'Yes' ? 'bg-very-light-green text-primary-green' : 'bg-rose-55 text-rose-500'
                          }`}>{row.reported}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.report_printed === 'Yes' ? 'bg-very-light-green text-primary-green' : 'bg-rose-55 text-rose-500'
                          }`}>{row.report_printed}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.whatsapp_report === 'Sent' ? 'bg-very-light-green text-primary-green' : 'bg-rose-55 text-rose-500'
                          }`}>{row.whatsapp_report}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'Verified' ? 'bg-primary-green animate-pulse' : 'bg-rose-500'}`} />
                            {row.status === 'Verified' ? 'Verified ✓' : row.status === 'Rejected' ? 'Rejected' : row.status === 'Cancelled' ? 'Cancelled' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{actionsLayout}</td>
                      </tr>
                    );
                  }

                  if (activeTab === 'Hydrogen Inhalation') {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors animate-fade-in">
                        <td className="py-3 px-4 font-bold">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{row.patient_name}</td>
                        <td className="py-3 px-4">{row.timings || '--'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.rescheduled === 'Yes' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-500'
                          }`}>{row.rescheduled}</span>
                        </td>
                        <td className="py-3 px-4">{row.actual_start || '--'}</td>
                        <td className="py-3 px-4">{row.end_time || '--'}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{row.op_technician_name || '--'}</span>
                            {row.op_technician_name && (
                              <span className={`text-[8px] px-1 py-0.2 rounded self-start font-bold ${
                                row.op_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {row.op_verified ? 'OP Verified ✓' : 'OP Pending ✗'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{row.sop_technician_name || '--'}</span>
                            {row.sop_technician_name && (
                              <span className={`text-[8px] px-1 py-0.2 rounded self-start font-bold ${
                                row.sop_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {row.sop_verified ? 'SOP Verified ✓' : 'SOP Pending ✗'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'Verified' ? 'bg-primary-green animate-pulse' : 'bg-rose-500'}`} />
                            {row.status === 'Verified' ? 'Verified ✓' : row.status === 'Rejected' ? 'Rejected' : row.status === 'Cancelled' ? 'Cancelled' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{actionsLayout}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{row.patient_name}</td>
                      <td className="py-3 px-4">{row.mobile_number}</td>
                      <td className="py-3 px-4 whitespace-pre-line">{row.dive_surface_timings || '--'}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{row.timings || '--'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.rescheduled === 'Yes' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {row.rescheduled}
                        </span>
                      </td>
                      <td className="py-3 px-4">{row.actual_start || '--'}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{formatDateStr(row.session_date)}</td>
                      <td className="py-3 px-4">{row.end_time || '--'}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.pressure_type ? (
                          <span className="font-semibold text-slate-800">
                            {row.pressure_type === 'Cylinder Pressure' ? 'Cylinder' : 'Tank'}: {row.pressure_value} PSI
                          </span>
                        ) : '--'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.next_session_date ? (
                          <div>
                            <p className="font-bold text-[10px]">{formatDateStr(row.next_session_date)}</p>
                            <p className="text-[9px] text-slate-400 font-medium">{row.next_session_time}</p>
                          </div>
                        ) : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{row.op_technician_name || 'Select'}</span>
                          <span className={`text-[8px] px-1 py-0.2 rounded self-start font-bold ${
                            row.op_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.op_verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{row.sop_technician_name || 'Select'}</span>
                          <span className={`text-[8px] px-1 py-0.2 rounded self-start font-bold ${
                            row.sop_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.sop_verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'Verified' ? 'bg-primary-green animate-pulse' : 'bg-rose-500'}`} />
                          {row.status === 'Verified' ? 'Verified ✓' : row.status === 'Rejected' ? 'Rejected' : row.status === 'Cancelled' ? 'Cancelled' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{actionsLayout}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      <AnimatePresence>
        {isVerifyModalOpen && selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVerifyModalOpen(false)}
              className="fixed inset-0 bg-black cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-[95%] md:w-[85%] lg:w-full lg:max-w-3xl bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              <form onSubmit={handleVerifySubmit} className="flex flex-col max-h-[90vh] w-full">
                {/* Fixed Header */}
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between shrink-0 bg-white">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <Eye className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    SOP Audit & Verification: {selectedSession.patient_name}
                  </h3>
                  <button type="button" onClick={() => setIsVerifyModalOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-16">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Patient metadata */}
                    <div className="col-span-1 md:col-span-2 bg-slate-50 border border-border-gray p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Patient</span>
                        <p className="font-bold text-slate-700 truncate mt-0.5">{selectedSession.patient_name}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Mobile</span>
                        <p className="font-bold text-slate-700 mt-0.5">{selectedSession.mobile_number}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Therapy</span>
                        <p className="font-bold text-primary-green mt-0.5">{selectedSession.therapy_type}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Scheduled Date</span>
                        <p className="font-bold text-slate-700 mt-0.5">{formatDateStr(selectedSession.session_date)}</p>
                      </div>
                    </div>

                    {/* Read-Only OP Logs */}
                    <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-3 bg-slate-50/50 text-xs">
                      <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Logged Details (Read-Only Audit)</h4>
                      
                      {selectedSession.therapy_type === 'Lab' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
                          <div className="col-span-2">
                            <span className="text-slate-400 block text-[9px] font-semibold uppercase">Name of Tests</span>
                            <span className="font-semibold text-primary-green">{selectedSession.tests || '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] font-semibold uppercase">Reported</span>
                            <span className="font-semibold text-slate-700">{selectedSession.reported}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] font-semibold uppercase">Report Printed</span>
                            <span className="font-semibold text-slate-700">{selectedSession.report_printed}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] font-semibold uppercase">WhatsApp Report</span>
                            <span className="font-semibold text-slate-700">{selectedSession.whatsapp_report}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div>
                            <span className="text-slate-450 block text-[9px] font-semibold uppercase">Expected Timings Slot</span>
                            <span className="font-semibold text-slate-700">{selectedSession.timings || '--'}</span>
                          </div>
                          {selectedSession.therapy_type !== 'Hydrogen Inhalation' && (
                            <div>
                              <span className="text-slate-450 block text-[9px] font-semibold uppercase">Dive & Surface Timings</span>
                              <span className="font-semibold text-slate-700 whitespace-pre-line">{selectedSession.dive_surface_timings || '--'}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-450 block text-[9px] font-semibold uppercase">Rescheduled</span>
                            <span className="font-semibold text-slate-700">
                              {selectedSession.rescheduled}
                              {selectedSession.rescheduled === 'Yes' && ` (${formatDateStr(selectedSession.rescheduled_date)} ${selectedSession.rescheduled_time})`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-450 block text-[9px] font-semibold uppercase">Actual Start</span>
                            <span className="font-semibold text-slate-700">{selectedSession.actual_start || '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-450 block text-[9px] font-semibold uppercase">Actual End</span>
                            <span className="font-semibold text-slate-700">{selectedSession.end_time || '--'}</span>
                          </div>
                          {selectedSession.therapy_type !== 'Hydrogen Inhalation' && (
                            <div>
                              <span className="text-slate-450 block text-[9px] font-semibold uppercase">Oxygen Level / Details</span>
                              <span className="font-semibold text-slate-700">
                                {selectedSession.pressure_type ? `${selectedSession.pressure_type} = ${selectedSession.pressure_value || ''}` : '--'}
                              </span>
                            </div>
                          )}
                          {selectedSession.therapy_type !== 'Hydrogen Inhalation' && (
                            <div>
                              <span className="text-slate-450 block text-[9px] font-semibold uppercase">Next Session</span>
                              <span className="font-semibold text-slate-700">
                                {selectedSession.next_session_date ? `${formatDateStr(selectedSession.next_session_date)} at ${selectedSession.next_session_time}` : '--'}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-450 block text-[9px] font-semibold uppercase">OP Tech assigned</span>
                            <span className="font-semibold text-slate-700">{selectedSession.op_technician_name || 'None'}</span>
                          </div>
                          <div>
                            <span className="text-slate-450 block text-[9px] font-semibold uppercase">OP verification Status</span>
                            <span className={`font-bold ${selectedSession.op_verified ? 'text-primary-green' : 'text-rose-500'}`}>
                              {selectedSession.op_verified ? '🟢 Verified' : '🔴 Not Verified'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Select SOP Technician */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select SOP Auditor</label>
                      <SelectField
                        value={sopTechnicianId}
                        onChange={setSopTechnicianId}
                        disabled={true}
                        triggerClassName="py-2.5 px-3 text-xs bg-slate-50"
                        options={[
                          { value: '', label: 'Select SOP Technician' },
                          ...sopTechOptions
                        ]}
                      />
                    </div>

                    {/* Add Remarks */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        SOP Clinical Remarks / Comments *
                      </label>
                      <textarea
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Audit completed successfully. Remarks required for rejections."
                        className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
                      />
                    </div>

                    {/* SOP Verification Sign-off Box */}
                    <div className="col-span-1 md:col-span-2 bg-emerald-50/50 border border-emerald-250 p-4 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-primary-green" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">SOP Auditor Verification Approval</p>
                          <p className="text-[10px] text-slate-400">Check this box to confirm verification of operative logs and safety compliance.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={sopVerified}
                        onChange={(e) => setSopVerified(e.target.checked)}
                        className="h-5.5 w-5.5 rounded text-primary-green focus:ring-primary-green cursor-pointer"
                      />
                    </div>

                  </div>
                </div>

                {/* Fixed Footer */}
                <div className="px-6 py-4 border-t border-border-gray flex items-center justify-end gap-2.5 shrink-0 bg-white">
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={handleRejectSubmit}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl cursor-pointer transition-all mr-auto"
                  >
                    Reject Session
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVerifyModalOpen(false)}
                    className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                  >
                    {submitLoading ? 'Auditing...' : 'Sign Audit & Approve'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule & Edit Modal */}
      <AnimatePresence>
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScheduleModalOpen(false)}
              className="fixed inset-0 bg-black cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-[95%] md:w-[85%] lg:w-full lg:max-w-4xl min-h-[550px] bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              <form onSubmit={handleScheduleSubmit} className="flex flex-col flex-1 max-h-[90vh] w-full">
                {/* Fixed Header */}
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between shrink-0 bg-white">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <Settings className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    {isEditing ? `Edit ${formTherapyType === 'Hydrogen Inhalation' ? 'Hydrogen' : formTherapyType} Session Details` : `Schedule New Therapy Session`}
                  </h3>
                  <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-16">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Therapy Type Dropdown */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Therapy Type *</label>
                      <SelectField
                        disabled={isEditing}
                        value={formTherapyType}
                        onChange={setFormTherapyType}
                        triggerClassName="h-[65px] px-4 text-base sm:text-[17px] md:text-lg font-semibold text-slate-700"
                        arrowClassName="h-5 w-5"
                        optionClassName="px-4 py-3 text-base sm:text-[17px] md:text-lg"
                        options={[
                          { value: '', label: 'Select Therapy' },
                          { value: 'HBOT', label: 'HBOT' },
                          { value: 'Hydrogen Inhalation', label: 'Hydrogen' },
                          { value: 'Ozone', label: 'Ozone' },
                          { value: 'Physiotherapy', label: 'Physiotherapy' },
                          { value: 'Dental', label: 'Dental' },
                          { value: 'Lab', label: 'Lab' },
                          { value: 'Pelvic Chair Therapy', label: 'Pelvic Chair' },
                          { value: 'SIPCD', label: 'SIPCD' },
                          { value: 'Zero Gravity', label: 'Zero Gravity' }
                        ]}
                      />
                    </div>

                    {formTherapyType && (
                      <>
                        {/* Autocomplete Patient Selector */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Patient (Optional)</label>
                          <SelectField
                            value=""
                            onChange={(val) => {
                              if (val) {
                                const [name, phone] = val.split('|');
                                setPatientName(name);
                                setMobileNumber(phone);
                              }
                            }}
                            triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-750"
                            options={[
                              { value: '', label: 'Select an existing patient...' },
                              ...Array.from(new Map(appointments.map(a => [a.patient_name + '|' + a.contact_number, a])).values()).map(a => ({
                                value: `${a.patient_name}|${a.contact_number}`,
                                label: `${a.patient_name} (${a.contact_number})`
                              }))
                            ]}
                          />
                        </div>

                        {/* Patient Name */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Patient Full Name *</label>
                          <input
                            type="text"
                            required
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="Patient name..."
                            className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>

                        {/* Contact Number */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contact Number *</label>
                          <input
                            type="tel"
                            required
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            placeholder="10-digit number..."
                            className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>

                        {/* Date */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session Date *</label>
                          <input
                            type="date"
                            required
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                            className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>

                        {/* Hospital */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hospital Location *</label>
                          <SelectField
                            value={hospitalId}
                            onChange={setHospitalId}
                            triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                            options={hospOptions}
                          />
                        </div>

                        {/* Timing Slot */}
                        {formTherapyType !== 'Lab' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session Timing Slot *</label>
                            <input
                              type="text"
                              required
                              value={timings}
                              onChange={(e) => setTimings(e.target.value)}
                              placeholder="e.g. 09:00 AM - 10:00 AM"
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        )}

                        {/* Technicians */}
                        {formTherapyType !== 'Lab' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">OP Technician</label>
                              <SelectField
                                value={opTechnicianId}
                                onChange={setOpTechnicianId}
                                triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                                options={[
                                  { value: '', label: 'Select OP Technician' },
                                  ...opTechOptions
                                ]}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">SOP Technician</label>
                              <SelectField
                                value={sopTechnicianId}
                                onChange={setSopTechnicianId}
                                triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                                options={[
                                  { value: '', label: 'Select SOP Technician' },
                                  ...sopTechOptions
                                ]}
                              />
                            </div>
                          </>
                        )}

                        {/* Therapy custom fields */}
                        {formTherapyType === 'HBOT' && (
                          <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">HBOT Dive Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dive Time</label>
                                <input
                                  type="text"
                                  value={diveTime}
                                  onChange={(e) => setDiveTime(e.target.value)}
                                  placeholder="e.g. 09:00 AM"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Surface Time</label>
                                <input
                                  type="text"
                                  value={surfaceTime}
                                  onChange={(e) => setSurfaceTime(e.target.value)}
                                  placeholder="e.g. 10:15 AM"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Oxygen Level Type</label>
                                <div className="flex gap-4 pt-1">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="pressureType"
                                      checked={pressureType === 'Cylinder Pressure'}
                                      onChange={() => setPressureType('Cylinder Pressure')}
                                      className="h-4 w-4 text-primary-green focus:ring-primary-green cursor-pointer"
                                    />
                                    <span>Cylinder Pressure</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="pressureType"
                                      checked={pressureType === 'Tank Pressure'}
                                      onChange={() => setPressureType('Tank Pressure')}
                                      className="h-4 w-4 text-primary-green focus:ring-primary-green cursor-pointer"
                                    />
                                    <span>Tank Pressure</span>
                                  </label>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pressure Value (PSI)</label>
                                <input
                                  type="number"
                                  value={pressureValue}
                                  onChange={(e) => setPressureValue(e.target.value)}
                                  placeholder="e.g. 120"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formTherapyType === 'Ozone' && (
                          <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Ozone Modality Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Concentration Type</label>
                                <SelectField
                                  value={pressureType}
                                  onChange={setPressureType}
                                  triggerClassName="py-2 px-3 text-xs"
                                  options={[
                                    { value: 'Systemic Ozone', label: 'Systemic Ozone' },
                                    { value: 'Local Application', label: 'Local Application' }
                                  ]}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dosage Level (mcg/ml)</label>
                                <input
                                  type="number"
                                  value={pressureValue}
                                  onChange={(e) => setPressureValue(e.target.value)}
                                  placeholder="e.g. 40"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formTherapyType === 'Physiotherapy' && (
                          <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Physiotherapist & Routine Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physiotherapist assigned</label>
                                <input
                                  type="text"
                                  value={physiotherapistName}
                                  onChange={(e) => setPhysiotherapistName(e.target.value)}
                                  placeholder="Dr. Roy"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formTherapyType === 'Dental' && (
                          <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Dental Procedure Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Treatment routine type</label>
                                <input
                                  type="text"
                                  value={treatmentType}
                                  onChange={(e) => setTreatmentType(e.target.value)}
                                  placeholder="e.g. Root Canal Therapy"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dentist Name</label>
                                <input
                                  type="text"
                                  value={dentistName}
                                  onChange={(e) => setDentistName(e.target.value)}
                                  placeholder="Dr. Verma"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formTherapyType === 'Lab' && (
                          <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Lab Tests Checklist & Status</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Tests</label>
                                <div className="flex flex-wrap gap-2">
                                  {LAB_TEST_OPTIONS.map(test => {
                                    const selected = selectedTests.includes(test);
                                    return (
                                      <button
                                        type="button"
                                        key={test}
                                        onClick={() => handleTestToggle(test)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                                          selected 
                                            ? 'bg-primary-green text-white border-primary-green shadow-sm' 
                                            : 'bg-white text-slate-550 border-border-gray hover:bg-slate-50'
                                        }`}
                                      >
                                        {test}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tests Reported</label>
                                  <SelectField
                                    value={labReported}
                                    onChange={setLabReported}
                                    triggerClassName="py-2 px-3 text-xs"
                                    options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Report Printed</label>
                                  <SelectField
                                    value={labReportPrinted}
                                    onChange={setLabReportPrinted}
                                    triggerClassName="py-2 px-3 text-xs"
                                    options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Delivery</label>
                                  <SelectField
                                    value={labWhatsappReport}
                                    onChange={setLabWhatsappReport}
                                    triggerClassName="py-2 px-3 text-xs"
                                    options={[{ value: 'Not Sent', label: 'Not Sent' }, { value: 'Sent', label: 'Sent' }]}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {formTherapyType !== 'Lab' && (
                          <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Reschedule settings (Optional)</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rescheduled</label>
                                <SelectField
                                  value={rescheduled}
                                  onChange={setRescheduled}
                                  triggerClassName="py-2 px-3 text-xs"
                                  options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                                />
                              </div>
                              {rescheduled === 'Yes' && (
                                <>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Date</label>
                                    <input
                                      type="date"
                                      required
                                      value={rescheduledDate}
                                      onChange={(e) => setRescheduledDate(e.target.value)}
                                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Time</label>
                                    <input
                                      type="text"
                                      required
                                      value={rescheduledTime}
                                      onChange={(e) => setRescheduledTime(e.target.value)}
                                      placeholder="09:00 AM"
                                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Next schedule (Except Lab and Hydrogen) */}
                        {formTherapyType !== 'Lab' && formTherapyType !== 'Hydrogen Inhalation' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Next Session Date</label>
                              <input
                                type="date"
                                value={nextSessionDate}
                                onChange={(e) => setNextSessionDate(e.target.value)}
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Next Session Time</label>
                              <input
                                type="text"
                                value={nextSessionTime}
                                onChange={(e) => setNextSessionTime(e.target.value)}
                                placeholder="e.g. 09:00 AM"
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                          </>
                        )}

                        {/* Add Remarks / Notes */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session Remarks / Notes (Optional)</label>
                          <textarea
                            rows={3}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add administrative notes or logs remarks..."
                            className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Fixed Footer */}
                <div className="px-6 py-4 border-t border-border-gray flex items-center justify-end gap-2.5 shrink-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                  >
                    {submitLoading ? 'Saving...' : 'Save Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SOPTechnicianTherapies() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        </div>
      }>
        <SOPTherapiesContent />
      </Suspense>
    </DashboardLayout>
  );
}

