'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { exportToExcel, exportToPDF } from '../../../lib/exportUtils';
import { 
  Activity, Clock, Plus, Edit3, ShieldAlert, CheckCircle, RefreshCw, 
  Settings, CheckSquare, X, Calendar, Filter, FileSpreadsheet, Download,
  Building2, Users, Search, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../../components/SelectField';

const ADMIN_THERAPY_TABS = [
  { id: 'HBOT', label: 'HBOT' },
  { id: 'Hydrogen Inhalation', label: 'Hydrogen Inhalation' },
  { id: 'Ozone', label: 'Ozone' },
  { id: 'Physiotherapy', label: 'Physiotherapy' },
  { id: 'Dental', label: 'Dental' },
  { id: 'Lab', label: 'Lab' },
  { id: 'Pelvic Chair Therapy', label: 'Pelvic Chair' },
  { id: 'SIPCD', label: 'SIPCD' },
  { id: 'Zero Gravity', label: 'Zero Gravity' }
];

const LAB_TEST_OPTIONS = ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Blood Sugar', 'ECG', 'Others'];

export default function AdminTherapies() {
  const { user } = useAuth();
  
  // Lists
  const [sessions, setSessions] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  
  // Tabs & Loading
  const [activeTab, setActiveTab] = useState('HBOT');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Filter States
  const [filterHospital, setFilterHospital] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterOpTech, setFilterOpTech] = useState('All');
  const [filterSopTech, setFilterSopTech] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
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
  const [sopTechnicianId, setSopTechnicianId] = useState('');
  
  // Specific fields
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

  // New Dynamic Form Fields & Mappings
  const [formTherapyType, setFormTherapyType] = useState('');
  const [diveTime, setDiveTime] = useState('');
  const [surfaceTime, setSurfaceTime] = useState('');
  const [physiotherapistName, setPhysiotherapistName] = useState('');
  const [treatmentType, setTreatmentType] = useState('');
  const [dentistName, setDentistName] = useState('');
  const [remarks, setRemarks] = useState('');

  const DEFAULT_PHYSIOTHERAPY_OPTIONS = [
    "SIPCD",
    "Zero gravity Trainer",
    "Pelvic chair",
    "TENS",
    "IFT",
    "Ultrasound",
    "Electrical stimulation",
    "Infrared lamp",
    "Facial Rejuvention therapy",
    "Shock wave theory",
    "Traction - CERVICAL TERACTION",
    "Traction - LUMBAR TRACTION",
    "BEHAVIOURAL THEARPY",
    "PARAFFIN WAX",
    "GUASHA",
    "fOOT MASAGER",
    "ROBOTIC HAND",
    "UPPER LIMB STRETCHING",
    "UPPER LIMB STRENGTHENING",
    "LOWER LIMB STRETCHING",
    "LOWER LIMB STRENGTHENING",
    "BACK STRENTHENING EXERCISES",
    "KNEE ISOMETRICS",
    "cARDIO-PULMONARY REHAB"
  ];

  const [selectedPhysioTherapies, setSelectedPhysioTherapies] = useState<string[]>([]);
  const [customPhysioTherapy, setCustomPhysioTherapy] = useState('');
  const [physioOptions, setPhysioOptions] = useState<string[]>(DEFAULT_PHYSIOTHERAPY_OPTIONS);
  const [isEditOptionModalOpen, setIsEditOptionModalOpen] = useState(false);
  const [optionToEdit, setOptionToEdit] = useState('');
  const [optionEditValue, setOptionEditValue] = useState('');

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      setError('');
      
      const params = {
        therapy_type: activeTab,
        hospital_id: filterHospital,
        status: filterStatus,
        op_technician_id: filterOpTech,
        sop_technician_id: filterSopTech,
        start_date: filterStartDate,
        end_date: filterEndDate,
        search: filterSearch
      };

      const [sessionsData, techsData, hospData] = await Promise.all([
        api.therapies.getAll(params),
        api.therapies.getTechnicians(),
        api.hospitals.getAll()
      ]);
      setSessions(sessionsData || []);
      setTechnicians(techsData || []);
      setHospitals(hospData.hospitals || hospData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load therapies page data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [activeTab, filterHospital, filterStatus, filterOpTech, filterSopTech, filterStartDate, filterEndDate, filterSearch]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedSession(null);
    setFormTherapyType('');
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
    setSopTechnicianId('');
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
    setSelectedPhysioTherapies([]);
    setCustomPhysioTherapy('');
    setPhysioOptions(DEFAULT_PHYSIOTHERAPY_OPTIONS);
    setRemarks('');
    setError('');
    setSuccess('');
    setIsModalOpen(true);
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

    // Physiotherapy custom routine selection
    const physioList = session.therapy_type === 'Physiotherapy' && session.dive_surface_timings ? session.dive_surface_timings.split(', ') : [];
    setSelectedPhysioTherapies(physioList);
    
    const combinedOptions = [...DEFAULT_PHYSIOTHERAPY_OPTIONS];
    physioList.forEach((t: string) => {
      if (t && !combinedOptions.includes(t)) {
        combinedOptions.push(t);
      }
    });
    setPhysioOptions(combinedOptions);
    setCustomPhysioTherapy('');

    // Lab
    setSelectedTests(session.tests ? session.tests.split(', ') : []);
    setLabReported(session.reported || 'No');
    setLabReportPrinted(session.report_printed || 'No');
    setLabWhatsappReport(session.whatsapp_report || 'Not Sent');
    
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Patient name validations
    const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;
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
        payload.dive_surface_timings = selectedPhysioTherapies.join(', ');
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
        setSuccess('New therapy session created successfully.');
      }
      setIsModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to save therapy session.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleTestToggle = (testName: string) => {
    setSelectedTests(prev => 
      prev.includes(testName) ? prev.filter(t => t !== testName) : [...prev, testName]
    );
  };

  // EXPORT LOGIC
  const handleExportExcel = () => {
    try {
      const activeHosp = hospitals.find(h => String(h.id) === filterHospital)?.name || 'All';
      const activeOp = technicians.find(t => String(t.id) === filterOpTech)?.name || 'All';
      const activeSop = technicians.find(t => String(t.id) === filterSopTech)?.name || 'All';

      const metadata = {
        title: `VVF Therapy Management - ${activeTab} Report`,
        filters: {
          'Modality type': activeTab,
          'Hospital unit': activeHosp,
          'OP Technician': activeOp,
          'SOP Auditor': activeSop,
          'Verification Status': filterStatus,
          'Date range': filterStartDate && filterEndDate ? `${filterStartDate} to ${filterEndDate}` : 'All Date'
        }
      };

      // Prepare excel rows
      const dataToExport = sessions.map((s, index) => {
        const row: Record<string, any> = {
          'S.No': index + 1,
          'Patient Name': s.patient_name,
          'Mobile': s.mobile_number,
          'Scheduled Time': s.timings || '--',
          'Date': formatDateStr(s.session_date),
          'Rescheduled': s.rescheduled,
          'Actual Start': s.actual_start || '--',
          'Actual End': s.end_time || '--',
        };

        if (activeTab === 'Lab') {
          row['Name of Tests'] = s.tests || '--';
          row['Reported'] = s.reported;
          row['Report Printed'] = s.report_printed;
          row['WhatsApp Report'] = s.whatsapp_report;
        } else {
          if (activeTab !== 'Hydrogen Inhalation') {
            if (activeTab === 'Physiotherapy') {
              row['Routine/Therapies'] = s.dive_surface_timings || '--';
              row['Physiotherapist'] = s.pressure_type || '--';
            } else if (activeTab === 'Dental') {
              row['Treatment Type'] = s.dive_surface_timings || '--';
              row['Dentist'] = s.pressure_type || '--';
            } else {
              row['Dive & Surface'] = s.dive_surface_timings || '--';
              row['Oxygen Level'] = s.pressure_type ? `${s.pressure_type} = ${s.pressure_value} PSI` : '--';
            }
            row['Next Session'] = s.next_session_date ? `${formatDateStr(s.next_session_date)} ${s.next_session_time}` : '--';
          }
          row['OP Technician'] = s.op_technician_name || 'None';
          row['OP Verified'] = s.op_verified ? 'Yes' : 'No';
          row['SOP Technician'] = s.sop_technician_name || 'None';
          row['SOP Verified'] = s.sop_verified ? 'Yes' : 'No';
          row['Remarks'] = s.remarks || '--';
          row['Verification Status'] = s.status;
        }
        return row;
      });

      exportToExcel(dataToExport, `vvf_therapy_${activeTab.toLowerCase().replace(/\s+/g, '_')}_report`, metadata);
    } catch (err: any) {
      setError(err.message || 'Excel export compilation failed.');
    }
  };

  const handleExportPDF = () => {
    try {
      const activeHosp = hospitals.find(h => String(h.id) === filterHospital)?.name || 'All';
      const dateRangeStr = filterStartDate && filterEndDate ? `Between: ${filterStartDate} and ${filterEndDate}` : 'All dates';
      const subtitle = `Hospital: ${activeHosp} | status: ${filterStatus} | ${dateRangeStr}`;

      let headers: string[] = [];
      let body: any[][] = [];

      if (activeTab === 'Lab') {
        headers = ['S.No', 'Patient Name', 'Name of Tests', 'Reported', 'Report Printed', 'WhatsApp'];
        body = sessions.map((s, index) => [
          index + 1,
          s.patient_name,
          s.tests || '--',
          s.reported,
          s.report_printed,
          s.whatsapp_report
        ]);
      } else if (activeTab === 'Hydrogen Inhalation') {
        headers = ['S.No', 'Patient Name', 'Time', 'Rescheduled', 'Actual Start', 'End Time', 'OP Tech', 'SOP Tech', 'Status'];
        body = sessions.map((s, index) => [
          index + 1,
          s.patient_name,
          s.timings || '--',
          s.rescheduled,
          s.actual_start || '--',
          s.end_time || '--',
          s.op_technician_name || '--',
          s.sop_technician_name || '--',
          s.status
        ]);
      } else {
        const isPhysio = activeTab === 'Physiotherapy';
        const isDental = activeTab === 'Dental';
        headers = [
          'S.No', 
          'Patient Name', 
          isPhysio ? 'Routine/Therapies' : isDental ? 'Treatment Type' : 'Dive/Surface', 
          'Timings', 
          'Actual Start', 
          'End', 
          isPhysio ? 'Physiotherapist' : isDental ? 'Dentist' : 'Pressure', 
          'Next Session', 
          'OP Tech', 
          'SOP Tech', 
          'Status'
        ];
        body = sessions.map((s, index) => [
          index + 1,
          s.patient_name,
          s.dive_surface_timings || '--',
          s.timings || '--',
          s.actual_start || '--',
          s.end_time || '--',
          isPhysio || isDental ? (s.pressure_type || '--') : (s.pressure_value ? `${s.pressure_value} PSI` : '--'),
          s.next_session_date ? `${formatDateStr(s.next_session_date)}` : '--',
          s.op_technician_name || '--',
          s.sop_technician_name || '--',
          s.status
        ]);
      }

      exportToPDF(
        headers,
        body,
        `VVF THERAPY - ${activeTab.toUpperCase()} REPORT`,
        subtitle,
        `vvf_therapy_${activeTab.toLowerCase().replace(/\s+/g, '_')}_report`
      );
    } catch (err: any) {
      setError(err.message || 'PDF export generation failed.');
    }
  };

  const handleResetFilters = () => {
    setFilterHospital('All');
    setFilterStatus('All');
    setFilterOpTech('All');
    setFilterSopTech('All');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSearch('');
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  const opTechOptions = technicians
    .filter(t => t.role === 'OP Technician')
    .map(t => ({ value: String(t.id), label: t.name }));

  const sopTechOptions = technicians
    .filter(t => t.role === 'SOP Technician')
    .map(t => ({ value: String(t.id), label: t.name }));

  const hospOptions = hospitals.map(h => ({ value: String(h.id), label: h.name }));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              Therapies Administration & Audit
              <ClipboardCheck className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Access comprehensive patient records, generate analytical reports, and audit OP/SOP technician entries.
            </p>
          </div>

          <button
            id="btn-schedule-session"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
          >
            <Plus className="h-4.5 w-4.5" />
            Schedule Therapy Session
          </button>
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

        {/* Administrative Filters */}
        <div className="bg-white border border-border-gray p-5 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-primary-green" />
            Clinical Auditing Filters
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Patient Search */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Patient / Contact</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or mobile..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 pl-9 pr-4 text-xs text-slate-500 outline-none"
                />
              </div>
            </div>

            {/* Hospital Unit */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hospital Unit</label>
              <SelectField
                value={filterHospital}
                onChange={setFilterHospital}
                triggerClassName="py-2 px-3 text-xs"
                options={[
                  { value: 'All', label: '🏥 All Hospitals' },
                  ...hospOptions
                ]}
              />
            </div>

            {/* OP Technician */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">OP Technician</label>
              <SelectField
                value={filterOpTech}
                onChange={setFilterOpTech}
                triggerClassName="py-2 px-3 text-xs"
                options={[
                  { value: 'All', label: '⚙️ All OP Technicians' },
                  ...opTechOptions
                ]}
              />
            </div>

            {/* SOP Auditor */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">SOP Auditor</label>
              <SelectField
                value={filterSopTech}
                onChange={setFilterSopTech}
                triggerClassName="py-2 px-3 text-xs"
                options={[
                  { value: 'All', label: '🔍 All SOP Technicians' },
                  ...sopTechOptions
                ]}
              />
            </div>

            {/* Verification Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Verification Status</label>
              <SelectField
                value={filterStatus}
                onChange={setFilterStatus}
                triggerClassName="py-2 px-3 text-xs"
                options={[
                  { value: 'All', label: '🟢 All statuses' },
                  { value: 'Verified', label: '🟢 Verified' },
                  { value: 'Pending Verification', label: '🔴 Pending Verification' }
                ]}
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
              />
            </div>

            {/* Export and reset buttons */}
            <div className="flex gap-2 items-end">
              <button
                onClick={handleExportExcel}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green/40 rounded-xl cursor-pointer"
                title="Download spreadsheet report"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer"
                title="Download PDF report document"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 border border-border-gray hover:bg-slate-50 text-xs text-slate-550 rounded-xl cursor-pointer font-semibold"
              >
                Reset
              </button>
            </div>

          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-1.5 pb-2 border-b border-border-gray no-scrollbar">
          {ADMIN_THERAPY_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); }}
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

        {/* Table View */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center shadow-sm">
            <Activity className="h-10 w-10 text-slate-400 mb-3 opacity-50" />
            <p className="text-slate-500 text-sm font-semibold">No therapy session records match your filter criteria.</p>
          </div>
        ) : (
          <div className="bg-white border border-border-gray rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  {activeTab === 'Lab' ? (
                    <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider animate-fade-in">
                      <th className="py-4 px-4">S.No</th>
                      <th className="py-4 px-4">Patient Name</th>
                      <th className="py-4 px-4">Name of Tests</th>
                      <th className="py-4 px-4">Reported</th>
                      <th className="py-4 px-4">Report Printed</th>
                      <th className="py-4 px-4">WhatsApp Report</th>
                      <th className="py-4 px-4 text-center">Action</th>
                    </tr>
                  ) : activeTab === 'Hydrogen Inhalation' ? (
                    <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider animate-fade-in">
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
                    <tr className="bg-slate-50 border-b border-border-gray text-[10px] font-bold text-slate-400 uppercase tracking-wider animate-fade-in">
                      <th className="py-4 px-4">S.No</th>
                      <th className="py-4 px-4">Patient Name</th>
                      <th className="py-4 px-4">Mobile</th>
                      <th className="py-4 px-4">{activeTab === 'Physiotherapy' ? 'Routine/Therapies' : activeTab === 'Dental' ? 'Treatment Type' : 'Dive/Surface'}</th>
                      <th className="py-4 px-4">Timings</th>
                      <th className="py-4 px-4">Rescheduled</th>
                      <th className="py-4 px-4">Actual Start</th>
                      <th className="py-4 px-4">Date</th>
                      <th className="py-4 px-4">End Time</th>
                      <th className="py-4 px-4">{activeTab === 'Physiotherapy' ? 'Physiotherapist' : activeTab === 'Dental' ? 'Dentist' : 'Oxygen Level'}</th>
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
                      : 'bg-rose-50 text-rose-500 border border-rose-100';

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
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                              title="Edit Lab tests/reports info"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                          </td>
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
                              {row.status === 'Verified' ? 'Session Verified ✓' : 'Pending Verification'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                              title="Edit Session"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    // Default common therapies table layout
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors animate-fade-in">
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
                          {row.therapy_type === 'Physiotherapy' || row.therapy_type === 'Dental' ? (
                            <span className="font-semibold text-slate-800">
                              {row.pressure_type || '--'}
                            </span>
                          ) : row.pressure_type ? (
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
                              {row.op_verified ? 'OP Verified ✓' : 'OP Pending ✗'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{row.sop_technician_name || 'Select'}</span>
                            <span className={`text-[8px] px-1 py-0.2 rounded self-start font-bold ${
                              row.sop_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {row.sop_verified ? 'SOP Verified ✓' : 'SOP Pending ✗'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'Verified' ? 'bg-primary-green animate-pulse' : 'bg-rose-500'}`} />
                            {row.status === 'Verified' ? 'Session Verified ✓' : 'Pending Verification'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                            title="Edit therapy session details"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule & Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="fixed inset-0 bg-black cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-[95%] md:w-[85%] lg:w-full lg:max-w-4xl min-h-[550px] bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 max-h-[90vh] w-full">
                  {/* Fixed Header */}
                  <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between shrink-0 bg-white">
                    <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                      <Settings className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                      {isEditing ? `Edit ${formTherapyType} Session Details` : `Schedule New Therapy Session`}
                    </h3>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
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
                      {/* Therapy Type * Dropdown displayed at the very top of the form */}
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
                            { value: 'Hydrogen Inhalation', label: 'Hydrogen Inhalation' },
                            { value: 'Ozone', label: 'Ozone' },
                            { value: 'Physiotherapy', label: 'Physiotherapy' },
                            { value: 'Dental', label: 'Dental' },
                            { value: 'Lab', label: 'Lab' },
                            { value: 'Pelvic Chair Therapy', label: 'Pelvic Chair Therapy' },
                            { value: 'SIPCD', label: 'SIPCD' },
                            { value: 'Zero Gravity', label: 'Zero Gravity' }
                          ]}
                        />
                      </div>

                      {/* Render fields only after therapy is selected */}
                      {formTherapyType && (
                        <>
                          {/* Common Master Fields */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Patient Full Name *</label>
                            <input
                              type="text"
                              required
                              value={patientName}
                              onChange={(e) => setPatientName(e.target.value)}
                              placeholder="Anil Rao"
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contact Number *</label>
                            <input
                              type="tel"
                              required
                              value={mobileNumber}
                              onChange={(e) => setMobileNumber(e.target.value)}
                              placeholder="9876543210"
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>

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

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hospital Location *</label>
                            <SelectField
                              value={hospitalId}
                              onChange={setHospitalId}
                              triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                              options={hospOptions}
                            />
                          </div>

                          {/* Non-Lab Session Timings Slot */}
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

                          {/* Non-Lab Technicians */}
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

                          {/* Custom Fields per Therapy */}

                          {/* 1. HBOT Form specifics */}
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

                          {/* 2. Ozone Form specifics */}
                          {formTherapyType === 'Ozone' && (
                            <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                              <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Ozone Pressure Details</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Oxygen Level Type</label>
                                  <SelectField
                                    value={pressureType}
                                    onChange={setPressureType}
                                    triggerClassName="py-2 px-3 text-xs font-semibold text-slate-700"
                                    options={[
                                      { value: 'Cylinder Pressure', label: 'Cylinder Pressure' },
                                      { value: 'Tank Pressure', label: 'Tank Pressure' }
                                    ]}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pressure Value</label>
                                  <input
                                    type="number"
                                    value={pressureValue}
                                    onChange={(e) => setPressureValue(e.target.value)}
                                    placeholder="e.g. 90"
                                    className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 3. Physiotherapy Form specifics */}
                          {formTherapyType === 'Physiotherapy' && (
                            <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                              <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Physiotherapist & Routine Details</h4>
                              <div className="grid grid-cols-1 gap-4">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physiotherapist Name</label>
                                  <input
                                    type="text"
                                    value={physiotherapistName}
                                    onChange={(e) => setPhysiotherapistName(e.target.value)}
                                    placeholder="Dr. Anand S."
                                    className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Routines / Therapies</label>
                                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                                    {physioOptions.map(opt => {
                                      const selected = selectedPhysioTherapies.includes(opt);
                                      return (
                                        <div
                                          key={opt}
                                          onClick={() => {
                                            setSelectedPhysioTherapies(prev => 
                                              prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
                                            );
                                          }}
                                          className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none ${
                                            selected 
                                              ? 'bg-primary-green text-white border-primary-green shadow-sm' 
                                              : 'bg-white text-slate-555 border-border-gray hover:bg-slate-50'
                                          }`}
                                        >
                                          <span>{opt}</span>
                                          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOptionToEdit(opt);
                                                setOptionEditValue(opt);
                                                setIsEditOptionModalOpen(true);
                                              }}
                                              className={`p-0.5 rounded transition-colors ${
                                                selected ? 'hover:bg-white/20 text-white/80' : 'hover:bg-slate-100 text-slate-400'
                                              }`}
                                              title="Edit name"
                                            >
                                              <Edit3 className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPhysioOptions(prev => prev.filter(o => o !== opt));
                                                setSelectedPhysioTherapies(prev => prev.filter(o => o !== opt));
                                              }}
                                              className={`p-0.5 rounded transition-colors ${
                                                selected ? 'hover:bg-white/20 text-white/80' : 'hover:bg-slate-100 text-rose-500/80'
                                              }`}
                                              title="Delete option"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="flex items-end gap-2">
                                  <div className="flex-1">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Add Custom Therapy / Option</label>
                                    <input
                                      type="text"
                                      value={customPhysioTherapy}
                                      onChange={(e) => setCustomPhysioTherapy(e.target.value)}
                                      placeholder="e.g. Laser Therapy"
                                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-555 outline-none"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (customPhysioTherapy.trim()) {
                                        const val = customPhysioTherapy.trim();
                                        if (!physioOptions.includes(val)) {
                                          setPhysioOptions(prev => [...prev, val]);
                                        }
                                        if (!selectedPhysioTherapies.includes(val)) {
                                          setSelectedPhysioTherapies(prev => [...prev, val]);
                                        }
                                        setCustomPhysioTherapy('');
                                      }
                                    }}
                                    className="px-4 py-2 bg-primary-green text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors h-[38px] cursor-pointer"
                                  >
                                    Add Option
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 4. Dental Form specifics */}
                          {formTherapyType === 'Dental' && (
                            <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                              <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Dental Treatment Details</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Treatment Type</label>
                                  <input
                                    type="text"
                                    value={treatmentType}
                                    onChange={(e) => setTreatmentType(e.target.value)}
                                    placeholder="e.g. Root Canal"
                                    className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Doctor Name</label>
                                  <input
                                    type="text"
                                    value={dentistName}
                                    onChange={(e) => setDentistName(e.target.value)}
                                    placeholder="Dr. Swapna"
                                    className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 5. Lab Form specifics */}
                          {formTherapyType === 'Lab' && (
                            <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                              <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Lab Report Processing Details</h4>
                              
                              {/* Name of Tests (Multi-select) */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Tests *</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5">
                                  {LAB_TEST_OPTIONS.map(opt => (
                                    <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedTests.includes(opt)}
                                        onChange={() => handleTestToggle(opt)}
                                        className="h-4 w-4 rounded text-primary-green focus:ring-primary-green cursor-pointer"
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reported</label>
                                  <SelectField
                                    value={labReported}
                                    onChange={setLabReported}
                                    triggerClassName="py-2 px-3 text-xs font-semibold text-slate-700"
                                    options={[
                                      { value: 'No', label: 'No' },
                                      { value: 'Yes', label: 'Yes' }
                                    ]}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Report Printed</label>
                                  <SelectField
                                    value={labReportPrinted}
                                    onChange={setLabReportPrinted}
                                    triggerClassName="py-2 px-3 text-xs font-semibold text-slate-700"
                                    options={[
                                      { value: 'No', label: 'No' },
                                      { value: 'Yes', label: 'Yes' }
                                    ]}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Report</label>
                                  <SelectField
                                    value={labWhatsappReport}
                                    onChange={setLabWhatsappReport}
                                    triggerClassName="py-2 px-3 text-xs font-semibold text-slate-700"
                                    options={[
                                      { value: 'Not Sent', label: 'Not Sent' },
                                      { value: 'Sent', label: 'Sent' }
                                    ]}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Common Session Actual Timings (Non-Lab only) */}
                          {formTherapyType !== 'Lab' && (
                            <>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Actual Start Time</label>
                                <input
                                  type="text"
                                  value={actualStart}
                                  onChange={(e) => setActualStart(e.target.value)}
                                  placeholder="e.g. 09:05 AM"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Actual End Time</label>
                                <input
                                  type="text"
                                  value={endTime}
                                  onChange={(e) => setEndTime(e.target.value)}
                                  placeholder="e.g. 10:05 AM"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                />
                              </div>
                            </>
                          )}

                          {/* Reschedule Logic (Non-Lab only) */}
                          {formTherapyType !== 'Lab' && (
                            <div className="col-span-1 md:col-span-2 border-t border-border-gray/50 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rescheduled</label>
                                <SelectField
                                  value={rescheduled}
                                  onChange={setRescheduled}
                                  triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                                  options={[
                                    { value: 'No', label: 'No' },
                                    { value: 'Yes', label: 'Yes' }
                                  ]}
                                />
                              </div>

                              {rescheduled === 'Yes' && (
                                <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-100">
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
                                </div>
                              )}
                            </div>
                          )}

                          {/* Next Session (Non-Lab only) */}
                          {formTherapyType !== 'Lab' && (
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

                          {/* Remarks field (Common to all) */}
                          <div className="col-span-1 md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Remarks / Notes</label>
                            <textarea
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder="Enter session notes or audit remarks..."
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3.5 text-xs text-slate-500 outline-none h-20 resize-none transition-all"
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
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-50 text-xs text-slate-550 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitLoading || !formTherapyType || !patientName.trim() || !mobileNumber || mobileNumber.length !== 10 || !/^\d+$/.test(mobileNumber) || !sessionDate || !hospitalId || (formTherapyType === 'Lab' && selectedTests.length === 0) || (formTherapyType !== 'Lab' && !timings.trim())}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-50"
                    >
                      {submitLoading ? 'Saving...' : 'Save Session'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {isEditOptionModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-border-gray shadow-xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Edit Therapy Option</h3>
            <p className="text-xs text-slate-400 mb-4">Update the name of this routine/therapy below.</p>
            <input
              type="text"
              value={optionEditValue}
              onChange={(e) => setOptionEditValue(e.target.value)}
              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-555 outline-none mb-4"
              placeholder="Therapy name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (optionEditValue.trim() && optionEditValue.trim() !== optionToEdit) {
                    const trimmed = optionEditValue.trim();
                    setPhysioOptions(prev => prev.map(o => o === optionToEdit ? trimmed : o));
                    setSelectedPhysioTherapies(prev => prev.map(o => o === optionToEdit ? trimmed : o));
                  }
                  setIsEditOptionModalOpen(false);
                } else if (e.key === 'Escape') {
                  setIsEditOptionModalOpen(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditOptionModalOpen(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (optionEditValue.trim() && optionEditValue.trim() !== optionToEdit) {
                    const trimmed = optionEditValue.trim();
                    setPhysioOptions(prev => prev.map(o => o === optionToEdit ? trimmed : o));
                    setSelectedPhysioTherapies(prev => prev.map(o => o === optionToEdit ? trimmed : o));
                  }
                  setIsEditOptionModalOpen(false);
                }}
                className="px-3.5 py-2 bg-primary-green hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
