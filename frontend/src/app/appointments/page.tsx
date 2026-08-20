'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Calendar as CalendarIcon, User, Search, Filter, Plus, Edit3, Trash2, 
  Lock, CheckCircle, Clock, IndianRupee, ShieldAlert, Sparkles, X, HeartHandshake,
  Eye, MoreVertical, PhoneCall, Activity, Droplet, Settings, CheckSquare, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';
import { ReportFilterPanel } from '../../components/ReportFilterPanel';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

const isUPIMethod = (method: string): boolean => {
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

const mapLegacyPaymentMethod = (method: string): 'Cash' | 'UPI' | 'Card' => {
  if (isUPIMethod(method)) return 'UPI';
  const m = (method || '').toLowerCase().trim();
  if (m.includes('cash')) return 'Cash';
  return 'Card';
};

const formatDesignation = (role?: string) => {
  if (!role) return 'Not Available';
  const r = role.trim();
  if (r === 'Reception') return 'Receptionist';
  if (r === 'Telecaller') return 'Telecaller';
  if (r === 'Executive') return 'Executive';
  if (r === 'Admin') return 'Admin';
  if (r === 'Superadmin') return 'Superadmin';
  if (r === 'Doctor') return 'Doctor';
  if (r === 'Dental Doctor') return 'Dental Doctor';
  if (r === 'Dentist Junior') return 'Dentist Junior';
  if (r === 'Dental Assistant') return 'Dental Assistant';
  if (r === 'OP Technician') return 'OP Technician';
  if (r === 'SOP Technician') return 'SOP Technician';
  return r;
};

function AppointmentsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const getRolePrefix = (role: string): string => {
    const r = role.toLowerCase().trim();
    if (r === 'admin' || r === 'superadmin' || r === 'co-admin') return '/admin';
    if (r === 'dental doctor') return '/dental-doctor';
    if (r === 'dentist junior') return '/dentist-junior';
    if (r === 'dental assistant') return '/dental-assistant';
    if (r === 'doctor') return '/doctor';
    if (r === 'executive') return '/executive';
    if (r === 'reception') return '/reception';
    if (r === 'telecaller') return '/telecaller';
    if (r === 'op technician') return '/op-technician';
    if (r === 'sop technician') return '/sop-technician';
    return '';
  };
  
  // Lists
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [dentists, setDentists] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [therapySessions, setTherapySessions] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [serviceTechnicians, setServiceTechnicians] = useState<any[]>([]);
  
  // Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'appointments' | 'therapies'>('appointments');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('All');

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Report & Date Filter state
  const [activeStartDate, setActiveStartDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');
  
  // Modals & States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Details Tab
  const [detailsTab, setDetailsTab] = useState<'audit' | 'therapy' | 'payment'>('audit');
  const [detailsPayments, setDetailsPayments] = useState<any[]>([]);

  // Therapy scheduling form states
  const [isTherapyModalOpen, setIsTherapyModalOpen] = useState(false);
  const [selectedTherapy, setSelectedTherapy] = useState<any | null>(null);
  const [isEditingTherapy, setIsEditingTherapy] = useState(false);
  const [formTherapyType, setFormTherapyType] = useState('HBOT');
  const [patientNameTherapy, setPatientNameTherapy] = useState('');
  const [mobileNumberTherapy, setMobileNumberTherapy] = useState('');
  const [timingsTherapy, setTimingsTherapy] = useState('');
  const [sessionDateTherapy, setSessionDateTherapy] = useState('');
  const [rescheduledTherapy, setRescheduledTherapy] = useState('No');
  const [rescheduledDateTherapy, setRescheduledDateTherapy] = useState('');
  const [rescheduledTimeTherapy, setRescheduledTimeTherapy] = useState('');
  const [actualStartTherapy, setActualStartTherapy] = useState('');
  const [endTimeTherapy, setEndTimeTherapy] = useState('');
  const [hospitalIdTherapy, setHospitalIdTherapy] = useState('');
  const [opTechnicianIdTherapy, setOpTechnicianIdTherapy] = useState('');
  const [sopTechnicianIdTherapy, setSopTechnicianIdTherapy] = useState('');
  const [remarksTherapy, setRemarksTherapy] = useState('');

  // Therapy specific details
  const [diveTimeTherapy, setDiveTimeTherapy] = useState('');
  const [surfaceTimeTherapy, setSurfaceTimeTherapy] = useState('');
  const [pressureTypeTherapy, setPressureTypeTherapy] = useState('Cylinder Pressure');
  const [pressureValueTherapy, setPressureValueTherapy] = useState('');
  const [nextSessionDateTherapy, setNextSessionDateTherapy] = useState('');
  const [nextSessionTimeTherapy, setNextSessionTimeTherapy] = useState('');

  // Lab specific
  const [selectedTestsTherapy, setSelectedTestsTherapy] = useState<string[]>([]);
  const [labReportedTherapy, setLabReportedTherapy] = useState('No');
  const [labReportPrintedTherapy, setLabReportPrintedTherapy] = useState('No');
  const [labWhatsappReportTherapy, setLabWhatsappReportTherapy] = useState('Not Sent');

  // Dynamic fields for Dental/Physiotherapy
  const [physiotherapistNameTherapy, setPhysiotherapistNameTherapy] = useState('');
  const [treatmentTypeTherapy, setTreatmentTypeTherapy] = useState('');
  const [dentistNameTherapy, setDentistNameTherapy] = useState('');

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

  const [selectedPhysioTherapiesTherapy, setSelectedPhysioTherapiesTherapy] = useState<string[]>([]);
  const [customPhysioTherapyTherapy, setCustomPhysioTherapyTherapy] = useState('');
  const [physioOptionsTherapy, setPhysioOptionsTherapy] = useState<string[]>(DEFAULT_PHYSIOTHERAPY_OPTIONS);
  const [isEditOptionModalOpen, setIsEditOptionModalOpen] = useState(false);
  const [optionToEdit, setOptionToEdit] = useState('');
  const [optionEditValue, setOptionEditValue] = useState('');

  const LAB_TEST_OPTIONS = ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Blood Sugar', 'ECG', 'Others'];

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  // Payment Quick Log Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Digital (UPI/Card)');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [upiApp, setUpiApp] = useState('');
  const [payerUpiId, setPayerUpiId] = useState('');

  // Split payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splits, setSplits] = useState<{ method: 'Cash' | 'UPI' | 'Card'; amount: string; transaction_ref: string; upi_app?: string; payer_upi_id?: string }[]>([
    { method: 'Cash', amount: '', transaction_ref: '', upi_app: '', payer_upi_id: '' }
  ]);

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

  // New Fields
  const [coRelation, setCoRelation] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [reference, setReference] = useState('');
  const [consultationCharges, setConsultationCharges] = useState('');
  const [testsCharges, setTestsCharges] = useState('');
  const [medicineCharges, setMedicineCharges] = useState('');

  // Category specific fields
  const [formCategory, setFormCategory] = useState<'doctor' | 'dental' | 'services' | null>(null);
  const [patientId, setPatientId] = useState('');
  const [department, setDepartment] = useState('');
  const [visitType, setVisitType] = useState('New');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [dentalConcern, setDentalConcern] = useState('');
  const [treatmentType, setTreatmentType] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [numberOfSessions, setNumberOfSessions] = useState('');
  const [sessionDuration, setSessionDuration] = useState('');
  const [packageType, setPackageType] = useState('');
  const [serviceRemarks, setServiceRemarks] = useState('');
  const [serviceName, setServiceName] = useState('HBOT');

  // List Advanced Filters
  const [categoryFilter, setCategoryFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vvf_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.role === 'Doctor') return 'doctor';
          if (u.role === 'Dental Doctor' || u.role === 'Dentist Junior' || u.role === 'Dental Assistant') return 'dental';
          if (u.role === 'OP Technician' || u.role === 'SOP Technician') return 'services';
        } catch (e) {}
      }
    }
    return 'All';
  });
  const [statusFilter, setStatusFilter] = useState('All');
  const [doctorFilter, setDoctorFilter] = useState('All');
  const [technicianFilter, setTechnicianFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');

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

  // Kebab Dropdown & Telecalling Workflow states
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [telecallersList, setTelecallersList] = useState<any[]>([]);
  
  // Telecalling Form Fields
  const [movePhoneNumber, setMovePhoneNumber] = useState('');
  const [moveOutreachStatus, setMoveOutreachStatus] = useState('Interested');
  const [moveCallbackDate, setMoveCallbackDate] = useState('');
  const [moveCallbackTime, setMoveCallbackTime] = useState('');
  const [moveTelecallerId, setMoveTelecallerId] = useState('');
  const [moveOutboundNotes, setMoveOutboundNotes] = useState('');
  
  // Telecalling Validation Errors
  const [movePhoneError, setMovePhoneError] = useState('');
  const [moveCallbackError, setMoveCallbackError] = useState('');
  const [moveTelecallerError, setMoveTelecallerError] = useState('');

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

  useEffect(() => {
    const fetchPatientData = async () => {
      if (selectedApp) return; // Only auto-fill for new appointments
      const cleanName = patientName.trim();
      const cleanPhone = contactNumber.trim();
      const isNameValid = cleanName.length >= 3 && /^[A-Za-z\s\.]*$/.test(cleanName);
      const isPhoneValid = /^\d{10}$/.test(cleanPhone);
      
      if (isNameValid && isPhoneValid) {
        try {
          const res = await api.appointments.lookupPatient({ name: cleanName, phone: cleanPhone });
          if (res && res.patient) {
            const p = res.patient;
            if (p.patient_id) setPatientId(p.patient_id);
            if (p.age) setAge(p.age.toString());
            if (p.gender) setGender(p.gender);
          }
        } catch (err) {
          console.error('Failed to lookup patient:', err);
        }
      }
    };
    fetchPatientData();
  }, [patientName, contactNumber, selectedApp]);

  const handlePatientIdSearch = async () => {
    const cleanId = patientId.trim();
    if (!cleanId) {
      alert('Please enter a Patient ID to search.');
      return;
    }
    try {
      const res = await api.appointments.lookupPatient({ patient_id: cleanId });
      if (res && res.patient) {
        const p = res.patient;
        setPatientName(p.name || '');
        setContactNumber(p.phone || '');
        setAge(p.age ? p.age.toString() : '');
        setGender(p.gender || 'Male');
        setPatientNameError('');
        setContactNumberError('');
      } else {
        alert('No patient found with this ID.');
      }
    } catch (err) {
      console.error('Failed to lookup patient by ID:', err);
      alert('Error searching for patient ID.');
    }
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
    fetchData(activeStartDate || undefined, activeEndDate || undefined);
  }, [user, selectedHospitalFilter, categoryFilter, statusFilter, doctorFilter, technicianFilter, serviceFilter, debouncedSearch]);

  useEffect(() => {
    // If query string has new=true, auto-open form
    if (searchParams.get('new') === 'true') {
      handleOpenCreate();
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      if (user.role === 'Doctor') {
        setCategoryFilter('doctor');
      } else if (user.role === 'Dental Doctor' || user.role === 'Dentist Junior' || user.role === 'Dental Assistant') {
        setCategoryFilter('dental');
      } else if (user.role === 'OP Technician' || user.role === 'SOP Technician') {
        setCategoryFilter('services');
      }
    }
  }, [user]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeDropdownId !== null) {
        const target = e.target as HTMLElement;
        if (!target.closest('.kebab-container')) {
          setActiveDropdownId(null);
        }
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeDropdownId]);

  const fetchData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (start && end) {
        params.start_date = start;
        params.end_date = end;
      }
      if (selectedHospitalFilter && selectedHospitalFilter !== 'All') {
        params.hospital_id = selectedHospitalFilter;
      }
      if (categoryFilter && categoryFilter !== 'All') {
        params.appointment_type = categoryFilter;
      }
      if (statusFilter && statusFilter !== 'All') {
        params.status = statusFilter;
      }
      if (doctorFilter && doctorFilter !== 'All') {
        params.doctor_id = doctorFilter;
      }
      if (technicianFilter && technicianFilter !== 'All') {
        params.technician_id = technicianFilter;
      }
      if (serviceFilter && serviceFilter !== 'All') {
        params.service_name = serviceFilter;
      }
      if (debouncedSearch && debouncedSearch.trim() !== '') {
        params.search = debouncedSearch.trim();
      }
      
      const appRes = await api.appointments.getAll(params);
      setAppointments(appRes.appointments || []);

      const docRes = await api.users.getDoctors();
      setDoctors(docRes.doctors || []);

      const dentistsRes = await api.users.getDentists();
      setDentists(dentistsRes.dentists || []);

      const hospRes = await api.hospitals.getAll();
      const uniqueHospitals: any[] = [];
      const seenHospIds = new Set();
      (hospRes.hospitals || []).forEach((h: any) => {
        if (!seenHospIds.has(h.id)) {
          seenHospIds.add(h.id);
          uniqueHospitals.push(h);
        }
      });
      setHospitals(uniqueHospitals);

      const telecallersRes = await api.users.getTelecallers();
      setTelecallersList(telecallersRes.telecallers || []);

      const [therapyRes, techsRes, serviceTechsRes] = await Promise.all([
        api.therapies.getAll(params),
        api.therapies.getTechnicians(),
        api.users.getTechnicians()
      ]);
      setTherapySessions(therapyRes || []);
      setTechnicians(techsRes || []);
      setServiceTechnicians(serviceTechsRes?.technicians || serviceTechsRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch appointment metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (start: string, end: string) => {
    setActiveStartDate(start);
    setActiveEndDate(end);
    await fetchData(start, end);
  };

  const handleResetReport = async () => {
    setSearch('');
    setPaymentFilter('All');
    setCategoryFilter('All');
    setStatusFilter('All');
    setDoctorFilter('All');
    setTechnicianFilter('All');
    setServiceFilter('All');
    setActiveStartDate('');
    setActiveEndDate('');
    setSelectedHospitalFilter('All');
    await fetchData(undefined, undefined);
  };

  const handleDownloadPDF = () => {
    const headers = [
      'ID',
      'Patient Name',
      'Patient ID',
      'Hospital',
      'Category',
      'Clinician / Tech',
      'Date & Time',
      'Payment Status',
      'Appt Status'
    ];
    const body = filteredAppointments.map((app) => {
      const dateStr = new Date(app.appointment_date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const cat = app.appointment_type || 'doctor';
      const staffName = cat === 'services' ? app.technician_name : app.doctor_name;
      return [
        app.id,
        app.patient_name,
        app.patient_id || 'N/A',
        app.hospital_name || 'N/A',
        cat.charAt(0).toUpperCase() + cat.slice(1),
        staffName || 'Unassigned',
        dateStr,
        app.payment_status,
        app.status || 'Scheduled'
      ];
    });

    const hospitalName = selectedHospitalFilter === 'All' 
      ? 'All Hospitals' 
      : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

    const formattedStartDate = activeStartDate ? new Date(activeStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const formattedEndDate = activeEndDate ? new Date(activeEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

    exportToPDF(
      headers,
      body,
      'Appointments Report',
      `Hospital: ${hospitalName} | Date Range: ${formattedStartDate} to ${formattedEndDate} | Search Query: "${search || 'None'}" | Total Records: ${filteredAppointments.length}`,
      `appointments_report_${activeStartDate || 'all'}_to_${activeEndDate || 'all'}`
    );
  };

  const handleDownloadExcel = () => {
    const data = filteredAppointments.map((app) => {
      const dateStr = new Date(app.appointment_date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const cat = app.appointment_type || 'doctor';
      const staffName = cat === 'services' ? app.technician_name : app.doctor_name;
      return {
        'Appointment ID': app.id,
        'Patient Name': app.patient_name,
        'Patient ID': app.patient_id || 'N/A',
        'Hospital': app.hospital_name || 'N/A',
        'Category': cat.charAt(0).toUpperCase() + cat.slice(1),
        'Clinician / Tech': staffName || 'Unassigned',
        'Date & Time': dateStr,
        'Payment Status': app.payment_status,
        'Appointment Status': app.status || 'Scheduled'
      };
    });

    const hospitalName = selectedHospitalFilter === 'All' 
      ? 'All Hospitals' 
      : (hospitals.find(h => String(h.id) === selectedHospitalFilter)?.name || 'Selected Hospital');

    const formattedStartDate = activeStartDate ? new Date(activeStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const formattedEndDate = activeEndDate ? new Date(activeEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

    exportToExcel(
      data, 
      `appointments_report_${activeStartDate || 'all'}_to_${activeEndDate || 'all'}`,
      {
        title: 'Appointments Operational Report',
        filters: {
          'Selected Hospital': hospitalName,
          'Start Date': formattedStartDate,
          'End Date': formattedEndDate,
          'Search Query': search || 'None'
        }
      }
    );
  };

  const handleOpenCreate = () => {
    setSelectedApp(null);

    const qDoctorId = searchParams.get('doctorId');
    const qTechnicianId = searchParams.get('technicianId');
    const qRole = searchParams.get('role');

    let initialCategory: 'doctor' | 'dental' | 'services' | null = null;
    if (qRole) {
      if (qRole === 'Doctor') initialCategory = 'doctor';
      else if (['Dental Doctor', 'Dentist Junior', 'Dental Assistant'].includes(qRole)) initialCategory = 'dental';
      else if (['OP Technician', 'SOP Technician'].includes(qRole)) initialCategory = 'services';
    }

    setFormCategory(initialCategory);
    setPatientName('');
    setPatientId('');
    setAge('');
    setGender('Male');
    setContactNumber('');
    setHospitalId(hospitals[0]?.id?.toString() || '');
    setDoctorId(qDoctorId || doctors[0]?.id?.toString() || '');
    // Category specific fields
    setDepartment('');
    setVisitType('New');
    setChiefComplaint('');
    setDentalConcern('');
    setTreatmentType('');
    setTechnicianId(qTechnicianId || technicians[0]?.id?.toString() || '');
    setNumberOfSessions('');
    setSessionDuration('');
    setPackageType('');
    setServiceRemarks('');
    setServiceName('HBOT');
    
    // New Fields
    setCoRelation('');
    setDateOfBirth('');
    setBloodGroup('');
    setCity('');
    setAddress('');
    setDiagnosis('');
    setReference('');
    setConsultationCharges('');
    setTestsCharges('');
    setMedicineCharges('');

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
    setFormCategory(app.appointment_type || 'doctor');
    setPatientName(app.patient_name);
    setPatientId(app.patient_id || '');
    setAge(app.age.toString());
    setGender(app.gender);
    setContactNumber(app.contact_number);
    setHospitalId(app.hospital_id?.toString() || '');
    setDoctorId(app.doctor_id?.toString() || '');
    setAppointmentDate(new Date(app.appointment_date).toISOString().slice(0, 16));
    setNotes(app.notes || '');
    setTotalAmount(app.total_amount.toString());
    
    // Category specific fields
    setDepartment(app.department || '');
    setVisitType(app.visit_type || 'New');
    setChiefComplaint(app.chief_complaint || '');
    setDentalConcern(app.dental_concern || '');
    setTreatmentType(app.treatment_type || '');
    setTechnicianId(app.technician_id?.toString() || '');
    setNumberOfSessions(app.number_of_sessions?.toString() || '');
    setSessionDuration(app.session_duration?.toString() || '');
    setPackageType(app.package_type || '');
    setServiceRemarks(app.service_remarks || '');
    setServiceName(app.service_name || 'HBOT');

    // New Fields
    setCoRelation(app.co_relation || '');
    setDateOfBirth(app.date_of_birth ? new Date(app.date_of_birth).toISOString().split('T')[0] : '');
    setBloodGroup(app.blood_group || '');
    setCity(app.city || '');
    setAddress(app.address || '');
    setDiagnosis(app.diagnosis || '');
    setReference(app.reference || '');
    setConsultationCharges(app.consultation_charges ? app.consultation_charges.toString() : '');
    setTestsCharges(app.tests_charges ? app.tests_charges.toString() : '');
    setMedicineCharges(app.medicine_charges ? app.medicine_charges.toString() : '');

    setError('');
    setSuccess('');
    resetFormErrors();
    setIsFormOpen(true);
  };

  const handleOpenDetails = async (app: any) => {
    setSelectedAppForDetails(app);
    setEditHistory([]);
    setDetailsPayments([]);
    setHistoryLoading(true);
    setIsDetailsOpen(true);
    setDetailsTab('audit');
    setError('');
    setSuccess('');
    try {
      const [histRes, payRes] = await Promise.all([
        api.appointments.getHistory(app.id),
        api.appointments.getPayments(app.id)
      ]);
      setEditHistory(histRes.history || []);
      setDetailsPayments(payRes.payments || []);
    } catch (err: any) {
      console.error('Failed to load edit history and payments:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenCreateTherapy = () => {
    setIsEditingTherapy(false);
    setSelectedTherapy(null);
    setFormTherapyType('HBOT');
    setPatientNameTherapy('');
    setMobileNumberTherapy('');
    setTimingsTherapy('');
    setSessionDateTherapy(new Date().toISOString().split('T')[0]);
    setRescheduledTherapy('No');
    setRescheduledDateTherapy('');
    setRescheduledTimeTherapy('');
    setActualStartTherapy('');
    setEndTimeTherapy('');
    setHospitalIdTherapy(hospitals[0]?.id ? String(hospitals[0].id) : '');
    setOpTechnicianIdTherapy('');
    setSopTechnicianIdTherapy('');
    setDiveTimeTherapy('');
    setSurfaceTimeTherapy('');
    setPressureTypeTherapy('Cylinder Pressure');
    setPressureValueTherapy('');
    setNextSessionDateTherapy('');
    setNextSessionTimeTherapy('');
    setSelectedTestsTherapy([]);
    setLabReportedTherapy('No');
    setLabReportPrintedTherapy('No');
    setLabWhatsappReportTherapy('Not Sent');
    setPhysiotherapistNameTherapy('');
    setTreatmentTypeTherapy('');
    setDentistNameTherapy('');
    setSelectedPhysioTherapiesTherapy([]);
    setCustomPhysioTherapyTherapy('');
    setPhysioOptionsTherapy(DEFAULT_PHYSIOTHERAPY_OPTIONS);
    setRemarksTherapy('');
    setError('');
    setSuccess('');
    setIsTherapyModalOpen(true);
  };

  const handleOpenEditTherapy = (session: any) => {
    setIsEditingTherapy(true);
    setSelectedTherapy(session);
    setFormTherapyType(session.therapy_type || '');
    setPatientNameTherapy(session.patient_name || '');
    setMobileNumberTherapy(session.mobile_number || '');
    setTimingsTherapy(session.timings || '');
    setSessionDateTherapy(session.session_date ? new Date(session.session_date).toISOString().split('T')[0] : '');
    setRescheduledTherapy(session.rescheduled || 'No');
    setRescheduledDateTherapy(session.rescheduled_date || '');
    setRescheduledTimeTherapy(session.rescheduled_time || '');
    setActualStartTherapy(session.actual_start || '');
    setEndTimeTherapy(session.end_time || '');
    setHospitalIdTherapy(session.hospital_id ? String(session.hospital_id) : '');
    setOpTechnicianIdTherapy(session.op_technician_id ? String(session.op_technician_id) : '');
    setSopTechnicianIdTherapy(session.sop_technician_id ? String(session.sop_technician_id) : '');
    
    // Details
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
    setDiveTimeTherapy(dTime);
    setSurfaceTimeTherapy(sTime);

    setPressureTypeTherapy(session.pressure_type || 'Cylinder Pressure');
    setPressureValueTherapy(session.pressure_value ? String(session.pressure_value) : '');
    setNextSessionDateTherapy(session.next_session_date || '');
    setNextSessionTimeTherapy(session.next_session_time || '');
    
    // Custom mapped values
    setPhysiotherapistNameTherapy(session.therapy_type === 'Physiotherapy' ? session.pressure_type || '' : '');
    setTreatmentTypeTherapy(session.therapy_type === 'Dental' ? session.dive_surface_timings || '' : '');
    setDentistNameTherapy(session.therapy_type === 'Dental' ? session.pressure_type || '' : '');
    setRemarksTherapy(session.remarks || '');

    // Physiotherapy custom routine selection
    const physioList = session.therapy_type === 'Physiotherapy' && session.dive_surface_timings ? session.dive_surface_timings.split(', ') : [];
    setSelectedPhysioTherapiesTherapy(physioList);
    
    const combinedOptions = [...DEFAULT_PHYSIOTHERAPY_OPTIONS];
    physioList.forEach((t: string) => {
      if (t && !combinedOptions.includes(t)) {
        combinedOptions.push(t);
      }
    });
    setPhysioOptionsTherapy(combinedOptions);
    setCustomPhysioTherapyTherapy('');

    // Lab
    setSelectedTestsTherapy(session.tests ? session.tests.split(', ') : []);
    setLabReportedTherapy(session.reported || 'No');
    setLabReportPrintedTherapy(session.report_printed || 'No');
    setLabWhatsappReportTherapy(session.whatsapp_report || 'Not Sent');

    setError('');
    setSuccess('');
    setIsTherapyModalOpen(true);
  };

  const handleTherapyScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;
    if (!patientNameTherapy.trim()) {
      setError('Patient name is required.');
      return;
    }
    if (!nameRegex.test(patientNameTherapy.trim())) {
      setError('Patient name can contain only letters.');
      return;
    }
    
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(mobileNumberTherapy)) {
      setError('Contact number must contain exactly 10 digits.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = {
        patient_name: patientNameTherapy,
        mobile_number: mobileNumberTherapy,
        therapy_type: formTherapyType,
        timings: formTherapyType === 'Lab' ? '' : timingsTherapy,
        session_date: sessionDateTherapy,
        rescheduled: rescheduledTherapy,
        rescheduled_date: rescheduledTherapy === 'Yes' ? rescheduledDateTherapy : null,
        rescheduled_time: rescheduledTherapy === 'Yes' ? rescheduledTimeTherapy : null,
        actual_start: formTherapyType === 'Lab' ? null : actualStartTherapy,
        end_time: formTherapyType === 'Lab' ? null : endTimeTherapy,
        hospital_id: parseInt(hospitalIdTherapy, 10),
        remarks: remarksTherapy
      };

      if (formTherapyType !== 'Lab') {
        payload.op_technician_id = opTechnicianIdTherapy ? parseInt(opTechnicianIdTherapy, 10) : null;
        payload.sop_technician_id = sopTechnicianIdTherapy ? parseInt(sopTechnicianIdTherapy, 10) : null;
      }

      if (formTherapyType === 'HBOT') {
        payload.dive_surface_timings = `Dive: ${diveTimeTherapy}, Surface: ${surfaceTimeTherapy}`;
        payload.pressure_type = pressureTypeTherapy;
        payload.pressure_value = pressureValueTherapy ? parseInt(pressureValueTherapy, 10) : null;
        payload.next_session_date = nextSessionDateTherapy;
        payload.next_session_time = nextSessionTimeTherapy;
      } else if (formTherapyType === 'Ozone') {
        payload.pressure_type = pressureTypeTherapy;
        payload.pressure_value = pressureValueTherapy ? parseInt(pressureValueTherapy, 10) : null;
        payload.next_session_date = nextSessionDateTherapy;
        payload.next_session_time = nextSessionTimeTherapy;
      } else if (formTherapyType === 'Physiotherapy') {
        payload.pressure_type = physiotherapistNameTherapy;
        payload.dive_surface_timings = selectedPhysioTherapiesTherapy.join(', ');
        payload.next_session_date = nextSessionDateTherapy;
        payload.next_session_time = nextSessionTimeTherapy;
      } else if (formTherapyType === 'Dental') {
        payload.dive_surface_timings = treatmentTypeTherapy;
        payload.pressure_type = dentistNameTherapy;
        payload.next_session_date = nextSessionDateTherapy;
        payload.next_session_time = nextSessionTimeTherapy;
      } else if (formTherapyType === 'Lab') {
        payload.tests = selectedTestsTherapy.join(', ');
        payload.reported = labReportedTherapy;
        payload.report_printed = labReportPrintedTherapy;
        payload.whatsapp_report = labWhatsappReportTherapy;
      } else if (formTherapyType !== 'Hydrogen Inhalation') {
        payload.next_session_date = nextSessionDateTherapy;
        payload.next_session_time = nextSessionTimeTherapy;
      }

      if (isEditingTherapy && selectedTherapy) {
        await api.therapies.update(selectedTherapy.id, payload);
        setSuccess('Therapy session updated successfully.');
      } else {
        await api.therapies.create(payload);
        setSuccess('New therapy session scheduled successfully.');
      }
      setIsTherapyModalOpen(false);
      fetchData();

      const prefix = getRolePrefix(user?.role || '');
      const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
      setTimeout(() => {
        router.push(dashboardHref);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save therapy session.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelTherapySession = async (session: any) => {
    if (!window.confirm(`Are you sure you want to cancel the therapy session for patient "${session.patient_name}"?`)) return;
    try {
      setError('');
      setSuccess('');
      await api.therapies.update(session.id, { status: 'Cancelled' });
      setSuccess('Therapy session cancelled successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel therapy session.');
    }
  };

  const handleQuickCompleteTherapy = async (session: any) => {
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
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete session.');
    }
  };

  const handleTherapyTestToggle = (testName: string) => {
    setSelectedTestsTherapy(prev => 
      prev.includes(testName) ? prev.filter(t => t !== testName) : [...prev, testName]
    );
  };

  const handleOpenPayment = (app: any) => {
    setSelectedApp(app);
    const due = app.total_amount - app.paid_amount;
    const dueStr = due > 0 ? due.toString() : '';
    setPaymentAmount(dueStr);
    setPaymentMethod('Digital (UPI/Card)');
    setPaymentNotes('');
    setTransactionRef('');
    setUpiApp('');
    setPayerUpiId('');
    setIsSplitPayment(false);
    setSplits([{ method: 'Cash', amount: dueStr, transaction_ref: '', upi_app: '', payer_upi_id: '' }]);
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

    const type = formCategory || 'doctor';

    const payload: any = {
      patient_name: patientName,
      age: parseInt(age),
      gender,
      contact_number: contactNumber,
      hospital_id: parseInt(hospitalId),
      appointment_date: new Date(appointmentDate).toISOString(),
      notes,
      total_amount: parseFloat(totalAmount || '0'),
      appointment_type: type,
      patient_id: patientId || null,
      co_relation: coRelation || null,
      date_of_birth: dateOfBirth || null,
      blood_group: bloodGroup || null,
      city: city || null,
      address: address || null,
      diagnosis: diagnosis || null,
      reference: reference || null,
      consultation_charges: consultationCharges ? parseFloat(consultationCharges) : null,
      tests_charges: testsCharges ? parseFloat(testsCharges) : null,
      medicine_charges: medicineCharges ? parseFloat(medicineCharges) : null
    };

    if (type === 'doctor') {
      payload.doctor_id = parseInt(doctorId);
      payload.department = department || null;
      payload.visit_type = visitType;
      payload.chief_complaint = chiefComplaint || null;
    } else if (type === 'dental') {
      payload.doctor_id = parseInt(doctorId); // dentist selection
      payload.dental_concern = dentalConcern || null;
      payload.treatment_type = treatmentType || null;
    } else if (type === 'services') {
      payload.service_name = serviceName;
      payload.technician_id = parseInt(technicianId);
      payload.number_of_sessions = numberOfSessions ? parseInt(numberOfSessions) : null;
      payload.session_duration = sessionDuration ? parseInt(sessionDuration) : null;
      payload.package_type = packageType || null;
      payload.service_remarks = serviceRemarks || null;
    }

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

      const prefix = getRolePrefix(user?.role || '');
      const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
      setTimeout(() => {
        router.push(dashboardHref);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Validation error. Please verify input fields.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelAppointment = async (app: any) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      if (['Admin', 'Superadmin'].includes(user?.role || '')) {
        await api.appointments.delete(app.id);
      } else {
        await api.appointments.update(app.id, { ...app, status: 'Cancelled' });
      }
      setSuccess('Appointment cancelled successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment.');
    }
  };

  const handleCompleteAppointment = async (app: any) => {
    try {
      await api.appointments.update(app.id, { ...app, status: 'Completed' });
      setSuccess('Appointment marked as completed.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete appointment.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const targetAmount = parseFloat(paymentAmount);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        setError('Valid payment amount is required.');
        setSubmitLoading(false);
        return;
      }

      if (!isSplitPayment) {
        if (isUPIMethod(paymentMethod)) {
          if (!transactionRef || !transactionRef.trim()) {
            setError('UPI Transaction Reference ID is required for UPI payments.');
            setSubmitLoading(false);
            return;
          }
        }
      } else {
        let splitSum = 0;
        for (const s of splits) {
          const amt = parseFloat(s.amount);
          if (isNaN(amt) || amt <= 0) {
            setError('Each split payment must have a valid amount greater than zero.');
            setSubmitLoading(false);
            return;
          }
          if (s.method === 'UPI') {
            if (!s.transaction_ref || !s.transaction_ref.trim()) {
              setError('UPI Transaction Reference ID is required for the UPI portion of the split payment.');
              setSubmitLoading(false);
              return;
            }
          }
          splitSum += amt;
        }
        if (Math.abs(splitSum - targetAmount) > 0.01) {
          setError(`The sum of split payments (₹${splitSum.toFixed(2)}) must exactly equal the total payment amount (₹${targetAmount.toFixed(2)}).`);
          setSubmitLoading(false);
          return;
        }
      }

      await api.appointments.addPayment(selectedApp.id, {
        amount: targetAmount,
        payment_method: isSplitPayment ? 'Split Payment' : paymentMethod,
        transaction_ref: isSplitPayment ? 'Split Payment' : transactionRef,
        notes: paymentNotes,
        upi_app: !isSplitPayment && isUPIMethod(paymentMethod) ? upiApp : undefined,
        payer_upi_id: !isSplitPayment && isUPIMethod(paymentMethod) ? payerUpiId : undefined,
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

  const handleOpenMoveToTelecalling = (app: any) => {
    setSelectedApp(app);
    setMovePhoneNumber(app.contact_number || '');
    setMoveOutreachStatus('Interested');
    setMoveCallbackDate('');
    setMoveCallbackTime('');
    setMoveTelecallerId(telecallersList[0]?.id?.toString() || '');
    setMoveOutboundNotes('');
    setMovePhoneError('');
    setMoveCallbackError('');
    setMoveTelecallerError('');
    setIsMoveModalOpen(true);
  };

  const validateMovePhone = (val: string): boolean => {
    if (!val) {
      setMovePhoneError('Phone Number is required.');
      return false;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(val)) {
      setMovePhoneError('Contact number must contain exactly 10 digits.');
      return false;
    }
    setMovePhoneError('');
    return true;
  };

  const validateMoveCallback = (status: string, date: string, time: string): boolean => {
    if (status === 'Callback Requested') {
      if (!date || !time) {
        setMoveCallbackError('Callback date and time are required.');
        return false;
      }
    }
    setMoveCallbackError('');
    return true;
  };

  const validateMoveTelecaller = (val: string): boolean => {
    if (!val) {
      setMoveTelecallerError('Assigned Telecaller is required.');
      return false;
    }
    setMoveTelecallerError('');
    return true;
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    const isPhoneValid = validateMovePhone(movePhoneNumber);
    const isCallbackValid = validateMoveCallback(moveOutreachStatus, moveCallbackDate, moveCallbackTime);
    const isTelecallerValid = validateMoveTelecaller(moveTelecallerId);

    if (!isPhoneValid || !isCallbackValid || !isTelecallerValid) {
      setSubmitLoading(false);
      return;
    }

    let callback_date_iso = undefined;
    if (moveOutreachStatus === 'Callback Requested') {
      callback_date_iso = new Date(`${moveCallbackDate}T${moveCallbackTime}`).toISOString();
    }

    const payload = {
      phone_number: movePhoneNumber,
      outreach_status: moveOutreachStatus,
      callback_date: callback_date_iso,
      telecaller_id: parseInt(moveTelecallerId, 10),
      outbound_notes: moveOutboundNotes
    };

    try {
      const res = await api.appointments.moveToTelecalling(selectedApp.id, payload);
      setSuccess(res.message || 'Lead successfully moved to Telecalling Queue.');
      setIsMoveModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to transfer lead. Please verify input fields.');
    } finally {
      setSubmitLoading(false);
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

    if (user?.role === 'Doctor' || user?.role === 'Dental Doctor') {
      limitMs = 24 * 60 * 60 * 1000;
      label = user.role;
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
      (app.doctor_name && app.doctor_name.toLowerCase().includes(search.toLowerCase())) ||
      (app.patient_id && app.patient_id.toLowerCase().includes(search.toLowerCase())) ||
      (app.creator_name && app.creator_name.toLowerCase().includes(search.toLowerCase())) ||
      (app.creator_role && formatDesignation(app.creator_role).toLowerCase().includes(search.toLowerCase()));
      
    const matchesHospital = selectedHospitalFilter === 'All' || !selectedHospitalFilter || String(app.hospital_id) === selectedHospitalFilter;

    const matchesPayment = paymentFilter === 'All' ? true : app.payment_status === paymentFilter;

    const matchesCategory = categoryFilter === 'All' ? true : (app.appointment_type || 'doctor') === categoryFilter;

    const matchesStatus = statusFilter === 'All' ? true : (app.status || 'Scheduled') === statusFilter;

    const matchesDoctor = doctorFilter === 'All' ? true : String(app.doctor_id) === doctorFilter;

    const matchesTechnician = technicianFilter === 'All' ? true : String(app.technician_id) === technicianFilter;

    const matchesService = serviceFilter === 'All' ? true : app.service_name === serviceFilter;

    return matchesSearch && matchesHospital && matchesPayment && matchesCategory && matchesStatus && matchesDoctor && matchesTechnician && matchesService;
  });

  const filteredTherapySessions = therapySessions.filter(ts => {
    const matchesSearch = ts.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      ts.mobile_number.includes(search) ||
      ts.therapy_type.toLowerCase().includes(search.toLowerCase());
      
    const matchesHospital = selectedHospitalFilter === 'All' || !selectedHospitalFilter || String(ts.hospital_id) === selectedHospitalFilter;

    return matchesSearch && matchesHospital;
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              Appointment Scheduling
              <HeartHandshake className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Book consultations, handle clinic receipts, and manage clinical assignments.
            </p>
          </div>

          {(user?.role) && (
            activeSubTab === 'appointments' ? (
              <button
                id="btn-new-appointment"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-sm"
              >
                <Plus className="h-4.5 w-4.5" />
                Schedule Appointment
              </button>
            ) : (
              <button
                id="btn-new-therapy"
                onClick={handleOpenCreateTherapy}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-sm"
              >
                <Plus className="h-4.5 w-4.5" />
                Schedule Therapy Session
              </button>
            )
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
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/50 text-xs text-slate-500 flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        <ReportFilterPanel
          onGenerate={handleGenerateReport}
          onReset={handleResetReport}
          isLoading={loading}
          totalRecords={activeSubTab === 'appointments' ? filteredAppointments.length : filteredTherapySessions.length}
          activeStartDate={activeStartDate}
          activeEndDate={activeEndDate}
          onDownloadPDF={handleDownloadPDF}
          onDownloadExcel={handleDownloadExcel}
          showSearch={true}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search patient, doctor, creator, phone number..."
        />

        {/* Sub-Tabs Toggle */}
        {!(user?.role === 'Doctor' || user?.role === 'Dental Doctor') && (
          <div className="flex gap-2 border-b border-border-gray pb-2 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('appointments')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'appointments'
                  ? 'bg-primary-green text-white shadow-md shadow-emerald-950/20'
                  : 'text-slate-500 bg-white hover:bg-very-light-green border border-border-gray'
              }`}
            >
              {(user?.role === 'OP Technician' || user?.role === 'SOP Technician') ? 'Service Appointments' : 'Doctor Appointments'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('therapies')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'therapies'
                  ? 'bg-primary-green text-white shadow-md shadow-emerald-950/20'
                  : 'text-slate-500 bg-white hover:bg-very-light-green border border-border-gray'
              }`}
            >
              Therapy Sessions
            </button>
          </div>
        )}

        {/* Search and filter panel */}
        <div className="flex flex-col gap-3 bg-white border border-border-gray p-3.5 rounded-xl">
          {activeSubTab === 'appointments' && (
            <>
              {/* Category Filter selector row */}
              {['Admin', 'Superadmin', 'Reception'].includes(user?.role || '') && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border-gray/30 pb-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <span>Category Filter:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { value: 'All', label: 'All Categories' },
                      { value: 'doctor', label: 'Doctor Appointment' },
                      { value: 'dental', label: 'Dental Appointment' },
                      { value: 'services', label: 'Services Appointment' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategoryFilter(opt.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          categoryFilter === opt.value
                            ? 'bg-primary-green text-white border-primary-green shadow-sm'
                            : 'bg-white text-slate-500 border-border-gray hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={`grid grid-cols-1 ${(user?.role === 'Doctor' || user?.role === 'Dental Doctor') ? 'sm:grid-cols-2' : 'sm:grid-cols-2 md:grid-cols-5'} gap-3 pt-1`}>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hospital</label>
                  <SelectField
                    id="hospital-filter"
                    value={selectedHospitalFilter}
                    onChange={(value) => setSelectedHospitalFilter(value)}
                    options={[
                      { value: 'All', label: 'All Hospitals' },
                      ...hospitals.map((h) => ({ value: String(h.id), label: h.name }))
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Appointment Status</label>
                  <SelectField
                    id="status-filter"
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val)}
                    triggerClassName="py-2.5 px-3 text-xs text-slate-555"
                    options={[
                      { value: 'All', label: 'All Statuses' },
                      { value: 'Scheduled', label: 'Scheduled' },
                      { value: 'Completed', label: 'Completed' },
                      { value: 'Cancelled', label: 'Cancelled' }
                    ]}
                  />
                </div>
                {!(user?.role === 'Doctor' || user?.role === 'Dental Doctor') && (
                  <>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Doctor / Dentist</label>
                      <SelectField
                        id="doctor-filter"
                        value={doctorFilter}
                        onChange={(val) => setDoctorFilter(val)}
                        triggerClassName="py-2.5 px-3 text-xs text-slate-555"
                        options={[
                          { value: 'All', label: 'All Clinicians' },
                          ...doctors.map(d => ({ value: String(d.id), label: d.name }))
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Tech</label>
                      <SelectField
                        id="technician-filter"
                        value={technicianFilter}
                        onChange={(val) => setTechnicianFilter(val)}
                        triggerClassName="py-2.5 px-3 text-xs text-slate-555"
                        options={[
                          { value: 'All', label: 'All Technicians' },
                          ...technicians.map(t => ({ value: String(t.id), label: t.name }))
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Service / Therapy</label>
                      <SelectField
                        id="service-filter"
                        value={serviceFilter}
                        onChange={(val) => setServiceFilter(val)}
                        triggerClassName="py-2.5 px-3 text-xs text-slate-555"
                        options={[
                          { value: 'All', label: 'All Services' },
                          { value: 'HBOT', label: 'HBOT' },
                          { value: 'Ozone', label: 'Ozone' },
                          { value: 'Physiotherapy', label: 'Physiotherapy' },
                          { value: 'Dental', label: 'Dental' },
                          { value: 'Pelvic Chair', label: 'Pelvic Chair' },
                          { value: 'SIPCD', label: 'SIPCD' },
                          { value: 'Zero Gravity', label: 'Zero Gravity' },
                          { value: 'Hydrogen', label: 'Hydrogen' },
                          { value: 'Lab', label: 'Lab' }
                        ]}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border-gray/30 pt-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Payment Filter:</span>
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
                      : 'bg-white text-slate-500 border border-border-gray hover:bg-very-light-green hover:text-primary-green'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of Appointments or Therapy Sessions */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : activeSubTab === 'appointments' ? (
          filteredAppointments.length === 0 ? (
            <div className="bg-white border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center">
              <CalendarIcon className="h-10 w-10 text-slate-500 mb-3" />
              <p className="text-slate-500 text-sm font-medium">
                {activeStartDate && activeEndDate 
                  ? 'No records found for the selected date range.' 
                  : 'No matching appointments found.'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {activeStartDate && activeEndDate 
                  ? 'Try adjusting your start date or end date filters.' 
                  : 'Book your first patient consultation using the Schedule button.'}
              </p>
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="space-y-1">
                              <h3 
                                onClick={() => handleOpenDetails(app)} 
                                className="font-bold text-slate-500 text-sm leading-tight truncate cursor-pointer hover:text-primary-green hover:underline decoration-2"
                              >
                                {app.patient_name}
                              </h3>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Category Badge */}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                  (app.appointment_type || 'doctor') === 'doctor' ? 'bg-emerald-50 text-primary-green border-light-green/30' :
                                  (app.appointment_type || 'doctor') === 'dental' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                  'bg-amber-50 text-amber-700 border-amber-250'
                                }`}>
                                  {app.appointment_type || 'doctor'}
                                </span>

                                {/* Status Badge */}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                  (app.status || 'Scheduled') === 'Completed' ? 'bg-emerald-50 text-primary-green border-light-green/30' :
                                  (app.status || 'Scheduled') === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-250' :
                                  'bg-sky-50 text-sky-600 border-sky-200'
                                }`}>
                                  {app.status || 'Scheduled'}
                                </span>
                              </div>
                            </div>
                            {app.moved_to_telecalling && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-very-light-green text-primary-green border border-light-green/60 uppercase tracking-wide flex items-center gap-0.5 shrink-0" title={`Moved to telecalling outreach at ${new Date(app.moved_to_telecalling_at).toLocaleString()}`}>
                                <PhoneCall className="h-2.5 w-2.5" />
                                outreach
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
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
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary-green" />
                          <span>
                            {appDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} • {appDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          <span>
                            {(app.appointment_type || 'doctor') === 'services' ? (
                              <>Technician: <strong className="text-slate-550">{app.technician_name || 'Unassigned'}</strong></>
                            ) : (
                              <>Doctor: <strong className="text-slate-550">{app.doctor_name || 'Unassigned'}</strong></>
                            )}
                          </span>
                        </div>
                        
                        {/* Category-specific inline info */}
                        {app.appointment_type === 'services' && (
                          <div className="text-[10px] text-slate-500 bg-amber-50/40 border border-amber-200/40 p-2 rounded-lg space-y-1">
                            <span className="font-extrabold text-amber-700 uppercase tracking-wider text-[8px] block">Service Details</span>
                            <div className="grid grid-cols-2 gap-x-2">
                              <div>Service: <span className="font-semibold text-slate-600">{app.service_name}</span></div>
                              {app.number_of_sessions && <div>Sessions: <span className="font-semibold text-slate-600">{app.number_of_sessions}</span></div>}
                              {app.session_duration && <div>Duration: <span className="font-semibold text-slate-600">{app.session_duration}m</span></div>}
                              {app.package_type && <div>Package: <span className="font-semibold text-slate-600">{app.package_type}</span></div>}
                            </div>
                          </div>
                        )}
                        {app.appointment_type === 'dental' && (app.treatment_type || app.dental_concern) && (
                          <div className="text-[10px] text-slate-500 bg-blue-50/40 border border-blue-200/40 p-2 rounded-lg space-y-1">
                            <span className="font-extrabold text-blue-700 uppercase tracking-wider text-[8px] block">Dental Details</span>
                            {app.treatment_type && <div>Treatment: <span className="font-semibold text-slate-600">{app.treatment_type}</span></div>}
                            {app.dental_concern && <div className="truncate">Concern: <span className="font-semibold text-slate-600 italic">"{app.dental_concern}"</span></div>}
                          </div>
                        )}
                        {app.appointment_type === 'doctor' && (app.department || app.chief_complaint) && (
                          <div className="text-[10px] text-slate-500 bg-emerald-50/40 border border-emerald-200/40 p-2 rounded-lg space-y-1">
                            <span className="font-extrabold text-emerald-800 uppercase tracking-wider text-[8px] block">Clinical Details</span>
                            {app.department && <div>Dept: <span className="font-semibold text-slate-600">{app.department}</span></div>}
                            {app.chief_complaint && <div className="truncate">Complaint: <span className="font-semibold text-slate-600 italic">"{app.chief_complaint}"</span></div>}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 border-t border-border-gray pt-2 space-y-1">
                          <div className="truncate">Hospital: <span className="text-slate-500 font-medium">{app.hospital_name || 'N/A'}</span></div>
                          <div className="truncate">Scheduled By: <span className="text-slate-500 font-medium">{app.creator_name || 'Unknown'}</span></div>
                          <div className="truncate">Designation: <span className="text-slate-500 font-medium">{formatDesignation(app.creator_role)}</span></div>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="flex items-center justify-between p-2.5 bg-secondary-bg border border-border-gray rounded-lg text-xs mb-3">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-semibold">Total Fee</span>
                          <strong className="text-slate-500">₹{app.total_amount}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block font-semibold">Paid</span>
                          <strong className="text-primary-green">₹{app.paid_amount}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block font-semibold">Status</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            app.payment_status === 'Completed' ? 'bg-very-light-green text-primary-green border border-light-green' :
                            app.payment_status === 'Partially Paid' ? 'bg-secondary-bg text-slate-500 border border-border-gray' :
                            'bg-alert-bg text-alert-text border border-alert-border'
                          }`}>
                            {app.payment_status}
                          </span>
                        </div>
                      </div>

                      {app.notes && (
                        <p className="text-[10px] text-slate-500 italic mb-3 leading-normal bg-secondary-bg p-2.5 rounded-lg border border-border-gray/40">
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

                      <div className="flex items-center gap-1.5 relative kebab-container">
                        {editStatus.countdown && (
                          <span className="text-[10px] text-primary-green font-semibold animate-pulse bg-very-light-green border border-light-green/40 px-2.5 py-1 rounded-lg">
                            {editStatus.countdown}
                          </span>
                        )}
                        {editStatus.locked && (
                          <span className="text-[10px] text-slate-500 font-semibold bg-secondary-bg border border-border-gray px-2.5 py-1 rounded-lg" title={editStatus.reason}>
                            Locked
                          </span>
                        )}
                        
                        <button
                          id={`btn-kebab-${app.id}`}
                          onClick={() => setActiveDropdownId(activeDropdownId === app.id ? null : app.id)}
                          className="p-2 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-all border border-transparent"
                          title="Actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        <AnimatePresence>
                          {activeDropdownId === app.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-border-gray rounded-xl shadow-lg z-30 py-1 overflow-hidden"
                            >
                              <button
                                id={`dropdown-details-${app.id}`}
                                onClick={() => {
                                  handleOpenDetails(app);
                                  setActiveDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-500 hover:text-primary-green hover:bg-very-light-green flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View Details & History
                              </button>

                              <button
                                id={`dropdown-edit-${app.id}`}
                                onClick={() => {
                                  if (!editStatus.locked) {
                                    handleOpenEdit(app);
                                    setActiveDropdownId(null);
                                  }
                                }}
                                disabled={editStatus.locked}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                                  editStatus.locked 
                                    ? 'text-slate-500 cursor-not-allowed bg-slate-50' 
                                    : 'text-slate-500 hover:text-primary-green hover:bg-very-light-green cursor-pointer'
                                }`}
                                title={editStatus.locked ? editStatus.reason : 'Edit Appointment'}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit Appointment
                              </button>

                              {app.status !== 'Completed' && app.status !== 'Cancelled' && (
                                <button
                                  id={`dropdown-complete-${app.id}`}
                                  onClick={() => {
                                    handleCompleteAppointment(app);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-500 hover:text-primary-green hover:bg-very-light-green flex items-center gap-2 cursor-pointer transition-colors border-t border-border-gray/50"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 text-primary-green" />
                                  Mark as Completed
                                </button>
                              )}

                              {['Admin', 'Superadmin', 'Doctor', 'Dental Doctor', 'Reception'].includes(user?.role || '') && app.status !== 'Cancelled' && (
                                <button
                                  id={`dropdown-delete-${app.id}`}
                                  onClick={() => {
                                    handleCancelAppointment(app);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-500 hover:text-alert-text hover:bg-alert-bg flex items-center gap-2 cursor-pointer transition-colors border-t border-border-gray/50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Cancel Appointment
                                </button>
                              )}

                              <button
                                id={`dropdown-telecalling-${app.id}`}
                                onClick={() => {
                                  handleOpenMoveToTelecalling(app);
                                  setActiveDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-500 hover:text-primary-green hover:bg-very-light-green flex items-center gap-2 cursor-pointer transition-colors border-t border-border-gray/50"
                              >
                                <PhoneCall className="h-3.5 w-3.5 text-primary-green" />
                                Move to Telecalling
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          filteredTherapySessions.length === 0 ? (
            <div className="bg-white border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center shadow-sm">
              <Activity className="h-10 w-10 text-slate-400 mb-3 opacity-50" />
              <p className="text-slate-500 text-sm font-semibold">No therapy sessions scheduled.</p>
              <p className="text-xs text-slate-550 mt-1">Schedule a session to start tracking compliance.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTherapySessions.map((ts: any) => {
                const dateStr = new Date(ts.session_date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const statusClass = ts.status === 'Verified' 
                  ? 'bg-very-light-green text-primary-green border border-light-green/35' 
                  : ts.status === 'Completed'
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : ts.status === 'Rejected'
                  ? 'bg-rose-100 text-rose-700 border border-rose-250'
                  : ts.status === 'Cancelled'
                  ? 'bg-slate-100 text-slate-500 border border-slate-200'
                  : 'bg-rose-50 text-rose-500 border border-rose-100';

                return (
                  <motion.div
                    key={ts.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-light-green hover:shadow-sm transition-all duration-200 animate-fade-in"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div>
                          <h3 className="font-bold text-slate-500 text-sm leading-tight truncate">
                            {ts.patient_name}
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {ts.mobile_number}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusClass}`}>
                          {ts.status}
                        </span>
                      </div>

                      <div className="space-y-2 bg-secondary-bg border border-border-gray p-2.5 sm:p-3 rounded-xl mb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary-green" />
                          <span>{dateStr} • {ts.timings || 'Time Slot Pending'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Activity className="h-3.5 w-3.5 text-primary-green" />
                          <span>Therapy: <strong className="text-slate-500">{ts.therapy_type}</strong></span>
                        </div>
                        {ts.op_technician_name && (
                          <div className="text-[10px] text-slate-550 font-medium">
                            OP Tech: <span className="font-semibold text-slate-500">{ts.op_technician_name}</span>
                          </div>
                        )}
                        {ts.sop_technician_name && (
                          <div className="text-[10px] text-slate-550 font-medium">
                            SOP Tech: <span className="font-semibold text-slate-500">{ts.sop_technician_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-border-gray pt-3 gap-2">
                      {ts.status !== 'Verified' && ts.status !== 'Completed' && ts.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleQuickCompleteTherapy(ts)}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Complete
                        </button>
                      )}
                      {ts.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleOpenEditTherapy(ts)}
                          className="p-1.5 text-slate-550 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors animate-pulse"
                          title="Reschedule / Edit Session"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {ts.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleCancelTherapySession(ts)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Cancel Session"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* Modal: Form Dialog (Create / Edit) */}
        <AnimatePresence>
          {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsFormOpen(false);
                  const prefix = getRolePrefix(user?.role || '');
                  const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
                  router.push(dashboardHref);
                }}
                className="fixed inset-0 bg-slate-900 cursor-pointer"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between bg-secondary-bg">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    {selectedApp ? 'Modify Appointment Record' : 'Create Appointment Record'}
                  </h3>
                  <button
                    id="close-form-modal"
                    onClick={() => {
                      setIsFormOpen(false);
                      const prefix = getRolePrefix(user?.role || '');
                      const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
                      router.push(dashboardHref);
                    }}
                    className="text-slate-500 hover:text-primary-green cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                  {!formCategory && !selectedApp ? (
                    <div className="space-y-4 py-4">
                      <p className="text-xs font-semibold text-slate-500 text-center mb-2">Select the type of appointment you wish to schedule:</p>
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setFormCategory('doctor');
                            setTotalAmount('1500');
                          }}
                          className="flex items-center gap-4 p-4 border border-border-gray hover:border-primary-green hover:bg-very-light-green rounded-xl text-left transition-all group cursor-pointer"
                        >
                          <div className="p-3 bg-emerald-50 text-primary-green rounded-xl group-hover:bg-primary-green group-hover:text-white transition-all">
                            <User className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-500 group-hover:text-primary-green transition-all">Doctor Appointment</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">General consultation, chief complaint, specialization visit.</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormCategory('dental');
                            setTotalAmount('1500');
                          }}
                          className="flex items-center gap-4 p-4 border border-border-gray hover:border-primary-green hover:bg-very-light-green rounded-xl text-left transition-all group cursor-pointer"
                        >
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <Activity className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-500 group-hover:text-blue-600 transition-all">Dental Appointment</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Dental concerns, dentist checkups, and specialized treatments.</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormCategory('services');
                            setTotalAmount('3500');
                          }}
                          className="flex items-center gap-4 p-4 border border-border-gray hover:border-primary-green hover:bg-very-light-green rounded-xl text-left transition-all group cursor-pointer"
                        >
                          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all">
                            <Settings className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-500 group-hover:text-amber-600 transition-all">Services Appointment</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Specialized therapies (HBOT, Ozone, SIPCD, Zero Gravity, etc.) with technicians.</p>
                          </div>
                        </button>
                      </div>
                      <div className="pt-4 border-t border-border-gray flex justify-end">
                        <button
                          type="button"
                          onClick={() => setIsFormOpen(false)}
                          className="px-4 py-2 border border-border-gray hover:bg-slate-50 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Selected Category Pill */}
                      <div className="flex items-center justify-between bg-slate-50 border border-border-gray p-2.5 rounded-xl text-xs mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500">Category:</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            formCategory === 'doctor' ? 'bg-emerald-50 text-primary-green border border-light-green/30' :
                            formCategory === 'dental' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {formCategory} Appointment
                          </span>
                        </div>
                        {!selectedApp && (
                          <button
                            type="button"
                            onClick={() => setFormCategory(null)}
                            className="text-[10px] text-primary-green hover:underline font-bold cursor-pointer"
                          >
                            Change Type
                          </button>
                        )}
                      </div>

                      {/* Demographics Group */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Patient Name *</label>
                          <input
                            id="form-patient-name"
                            type="text"
                            required
                            maxLength={100}
                            value={patientName}
                            onChange={(e) => handlePatientNameChange(e.target.value)}
                            placeholder="John Doe"
                            className={`w-full bg-white border ${patientNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                          />
                          {patientNameError && (
                            <p className="text-[10px] text-rose-700 mt-1 font-semibold">{patientNameError}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Patient ID (Optional)</label>
                          <div className="flex gap-2">
                            <input
                              id="form-patient-id"
                              type="text"
                              maxLength={30}
                              value={patientId}
                              onChange={(e) => setPatientId(e.target.value)}
                              placeholder="PT-12345"
                              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handlePatientIdSearch}
                              className="px-3 py-2 text-xs font-semibold text-primary-green bg-very-light-green border border-emerald-500/30 rounded-xl hover:bg-very-light-green/60 whitespace-nowrap cursor-pointer"
                            >
                              Search ID
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">C/o (S/o, W/o, D/o)</label>
                          <input
                            id="form-co-relation"
                            type="text"
                            value={coRelation}
                            onChange={(e) => setCoRelation(e.target.value)}
                            placeholder="S/o or W/o"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Date Of Birth</label>
                          <input
                            id="form-dob"
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => {
                              const dobVal = e.target.value;
                              setDateOfBirth(dobVal);
                              if (dobVal) {
                                const birthDate = new Date(dobVal);
                                const today = new Date();
                                let calculatedAge = today.getFullYear() - birthDate.getFullYear();
                                const m = today.getMonth() - birthDate.getMonth();
                                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                  calculatedAge--;
                                }
                                if (calculatedAge >= 0) {
                                  setAge(calculatedAge.toString());
                                }
                              }
                            }}
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Patient Age *</label>
                          <input
                            id="form-age"
                            type="number"
                            required
                            min="0"
                            max="130"
                            maxLength={3}
                            value={age}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.length <= 3) setAge(v);
                            }}
                            placeholder="35"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Gender *</label>
                          <SelectField
                            id="form-gender"
                            value={gender}
                            onChange={setGender}
                            triggerClassName="py-2 px-3 text-xs text-slate-550"
                            options={[
                              { value: 'Male', label: 'Male' },
                              { value: 'Female', label: 'Female' },
                              { value: 'Other', label: 'Other' },
                            ]}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Blood Group</label>
                          <input
                            id="form-blood-group"
                            type="text"
                            maxLength={10}
                            value={bloodGroup}
                            onChange={(e) => setBloodGroup(e.target.value)}
                            placeholder="O+ve"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Contact Number *</label>
                          <input
                            id="form-contact-number"
                            type="tel"
                            required
                            maxLength={10}
                            value={contactNumber}
                            onChange={(e) => handleContactNumberChange(e.target.value)}
                            placeholder="9876543210"
                            className={`w-full bg-white border ${contactNumberError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                          />
                          {contactNumberError && (
                            <p className="text-[10px] text-rose-700 mt-1 font-semibold">{contactNumberError}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">City</label>
                          <SelectField
                            id="form-city"
                            value={city}
                            onChange={setCity}
                            triggerClassName="py-2 px-3 text-xs text-slate-550"
                            options={[
                              { value: '', label: 'Select City' },
                              { value: 'Vijayawada', label: 'Vijayawada' },
                              { value: 'Guntur', label: 'Guntur' },
                              { value: 'Visakhapatnam', label: 'Visakhapatnam' },
                              { value: 'Tirupati', label: 'Tirupati' },
                              { value: 'Nellore', label: 'Nellore' },
                              { value: 'Kurnool', label: 'Kurnool' },
                              { value: 'Rajahmundry', label: 'Rajahmundry' },
                              { value: 'Kakinada', label: 'Kakinada' },
                              { value: 'Eluru', label: 'Eluru' },
                              { value: 'Hyderabad', label: 'Hyderabad' },
                              { value: 'Other', label: 'Other' }
                            ]}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Address</label>
                          <input
                            id="form-address"
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Door No, Street Name, Landmark..."
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Appointment Schedule *</label>
                          <input
                            id="form-appointment-date"
                            type="datetime-local"
                            required
                            min={selectedApp ? undefined : getTodayMinStr()}
                            value={appointmentDate}
                            onChange={(e) => handleAppointmentDateChange(e.target.value)}
                            className={`w-full bg-white border ${appointmentDateError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                          />
                          {appointmentDateError && (
                            <p className="text-[10px] text-rose-700 mt-1 font-semibold">{appointmentDateError}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Foundation Hospital *</label>
                          <SelectField
                            id="form-hospital-id"
                            value={hospitalId}
                            onChange={setHospitalId}
                            triggerClassName="py-2 px-3 text-xs text-slate-550"
                            options={hospitals.map((h) => ({
                              value: String(h.id),
                              label: `🏥 ${h.name} (${h.hospital_uid || 'UID Pending'})`,
                            }))}
                          />
                        </div>
                      </div>

                      {/* Doctor Sub-form */}
                      {formCategory === 'doctor' && (
                        <div className="border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50">
                          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Doctor Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Select Doctor *</label>
                              <SelectField
                                id="form-doctor-id"
                                value={doctorId}
                                onChange={setDoctorId}
                                triggerClassName="py-2 px-3 text-xs text-slate-550"
                                options={doctors.length > 0 ? doctors.map((d) => ({
                                  value: String(d.id),
                                  label: `🩺 ${d.name} (${d.role})`,
                                })) : [{ value: '', label: 'No Doctors Available' }]}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Department / Specialization</label>
                              <input
                                id="form-department"
                                type="text"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                placeholder="e.g. Cardiology"
                                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Visit Type</label>
                              <SelectField
                                id="form-visit-type"
                                value={visitType}
                                onChange={setVisitType}
                                triggerClassName="py-2 px-3 text-xs text-slate-550"
                                options={[
                                  { value: 'New', label: 'New Visit' },
                                  { value: 'Follow-up', label: 'Follow-up' },
                                ]}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Chief Complaint / Reason *</label>
                              <input
                                id="form-chief-complaint"
                                type="text"
                                required
                                value={chiefComplaint}
                                onChange={(e) => setChiefComplaint(e.target.value)}
                                placeholder="Brief reason for consultation..."
                                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dental Sub-form */}
                      {formCategory === 'dental' && (
                        <div className="border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50">
                          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Dental Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Select Dentist *</label>
                              <SelectField
                                id="form-dentist-id"
                                value={doctorId}
                                onChange={setDoctorId}
                                triggerClassName="py-2 px-3 text-xs text-slate-555"
                                options={dentists.length > 0 ? dentists.map((d) => ({
                                  value: String(d.id),
                                  label: `🦷 ${d.name} (${d.role})`,
                                })) : [{ value: '', label: 'No Dentist Available' }]}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Treatment Type</label>
                              <input
                                id="form-treatment-type"
                                type="text"
                                value={treatmentType}
                                onChange={(e) => setTreatmentType(e.target.value)}
                                placeholder="e.g. Scaling, Root Canal"
                                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Dental Concern *</label>
                            <input
                              id="form-dental-concern"
                              type="text"
                              required
                              value={dentalConcern}
                              onChange={(e) => setDentalConcern(e.target.value)}
                              placeholder="Specific dental issue or tooth pain description..."
                              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Services Sub-form */}
                      {formCategory === 'services' && (
                        <div className="border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50">
                          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Service Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Service Selection *</label>
                              <SelectField
                                id="form-service-name"
                                value={serviceName}
                                onChange={setServiceName}
                                triggerClassName="py-2 px-3 text-xs text-slate-550"
                                options={[
                                  { value: 'HBOT', label: 'HBOT (Hyperbaric Oxygen)' },
                                  { value: 'Ozone', label: 'Ozone Therapy' },
                                  { value: 'Physiotherapy', label: 'Physiotherapy' },
                                  { value: 'Dental', label: 'Dental Service' },
                                  { value: 'Pelvic Chair', label: 'Pelvic Chair' },
                                  { value: 'SIPCD', label: 'SIPCD' },
                                  { value: 'Zero Gravity', label: 'Zero Gravity' },
                                  { value: 'Hydrogen', label: 'Hydrogen Inhalation' },
                                  { value: 'Lab', label: 'Lab Services' }
                                ]}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Assigned Technician *</label>
                              <SelectField
                                id="form-technician-id"
                                value={technicianId}
                                onChange={setTechnicianId}
                                triggerClassName="py-2 px-3 text-xs text-slate-550"
                                options={serviceTechnicians.length > 0 ? serviceTechnicians.map((t) => ({
                                  value: String(t.id),
                                  label: `🔧 ${t.name} (${t.role})`,
                                })) : [{ value: '', label: 'No Technicians Available' }]}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">No. of Sessions</label>
                              <input
                                id="form-sessions"
                                type="number"
                                min="1"
                                value={numberOfSessions}
                                onChange={(e) => setNumberOfSessions(e.target.value)}
                                placeholder="e.g. 10"
                                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Duration (mins)</label>
                              <input
                                id="form-duration"
                                type="number"
                                min="5"
                                value={sessionDuration}
                                onChange={(e) => setSessionDuration(e.target.value)}
                                placeholder="e.g. 60"
                                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Package Type</label>
                              <input
                                id="form-package"
                                type="text"
                                value={packageType}
                                onChange={(e) => setPackageType(e.target.value)}
                                placeholder="e.g. Silver, Premium"
                                className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Service Remarks</label>
                            <input
                              id="form-service-remarks"
                              type="text"
                              value={serviceRemarks}
                              onChange={(e) => setServiceRemarks(e.target.value)}
                              placeholder="Clinical instructions or specific requests..."
                              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Diagnostic & Reference Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Diagnosis</label>
                          <input
                            id="form-diagnosis"
                            type="text"
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            placeholder="Diagnosis"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Reference</label>
                          <SelectField
                            id="form-reference"
                            value={reference}
                            onChange={setReference}
                            triggerClassName="py-2 px-3 text-xs text-slate-550"
                            options={[
                              { value: '', label: 'Reference' },
                              { value: 'Walk-in', label: 'Walk-in' },
                              { value: 'Doctor Referral', label: 'Doctor Referral' },
                              { value: 'Google Search', label: 'Google Search' },
                              { value: 'Social Media', label: 'Social Media' },
                              { value: 'Friend/Family', label: 'Friend/Family' },
                              { value: 'Camp', label: 'Camp' },
                              { value: 'Telecaller Outreach', label: 'Telecaller Outreach' },
                              { value: 'Other', label: 'Other' }
                            ]}
                          />
                        </div>
                      </div>

                      {/* Billing Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Consultation Charges (₹)</label>
                          <input
                            id="form-consultation-charges"
                            type="number"
                            min="0"
                            value={consultationCharges}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConsultationCharges(val);
                              const c = parseFloat(val || '0');
                              const t = parseFloat(testsCharges || '0');
                              const m = parseFloat(medicineCharges || '0');
                              setTotalAmount((c + t + m).toString());
                            }}
                            placeholder="Consultation Charges"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Tests Charges (₹)</label>
                          <input
                            id="form-tests-charges"
                            type="number"
                            min="0"
                            value={testsCharges}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTestsCharges(val);
                              const c = parseFloat(consultationCharges || '0');
                              const t = parseFloat(val || '0');
                              const m = parseFloat(medicineCharges || '0');
                              setTotalAmount((c + t + m).toString());
                            }}
                            placeholder="Tests Charges"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Medicine Charges (₹)</label>
                          <input
                            id="form-medicine-charges"
                            type="number"
                            min="0"
                            value={medicineCharges}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMedicineCharges(val);
                              const c = parseFloat(consultationCharges || '0');
                              const t = parseFloat(testsCharges || '0');
                              const m = parseFloat(val || '0');
                              setTotalAmount((c + t + m).toString());
                            }}
                            placeholder="Medicine Charges"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      {/* Total Amount & Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Total Amount (₹) *</label>
                          <input
                            id="form-total-amount"
                            type="text"
                            required
                            value={totalAmount}
                            onChange={(e) => handleTotalAmountChange(e.target.value)}
                            placeholder="Total Amount"
                            className={`w-full bg-white border ${totalAmountError ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-border-gray focus:border-primary-green focus:ring-light-green'} focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                          />
                          {totalAmountError && (
                            <p className="text-[10px] text-rose-700 mt-1 font-semibold font-semibold">{totalAmountError}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold font-semibold">Diagnostic / Visit Notes</label>
                          <input
                            id="form-notes"
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Symptoms, clinical references, indications..."
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      {/* Footer actions inside the active form */}
                      <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                        <button
                          id="btn-cancel-form"
                          type="button"
                          onClick={() => {
                            setIsFormOpen(false);
                            const prefix = getRolePrefix(user?.role || '');
                            const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
                            router.push(dashboardHref);
                          }}
                          className="px-4 py-2 border border-border-gray hover:bg-slate-550 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          id="btn-submit-form"
                          type="submit"
                          disabled={submitLoading || !!patientNameError || !!contactNumberError || !!appointmentDateError || !!totalAmountError || (formCategory === 'doctor' && !chiefComplaint) || (formCategory === 'dental' && !dentalConcern)}
                          className={`px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl transition-all flex items-center gap-1.5 ${
                            (submitLoading || !!patientNameError || !!contactNumberError || !!appointmentDateError || !!totalAmountError || (formCategory === 'doctor' && !chiefComplaint) || (formCategory === 'dental' && !dentalConcern))
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer'
                          }`}
                        >
                          {submitLoading ? 'Submitting...' : 'Register Record'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Warning Error Dialog Overlay */}
        <AnimatePresence>
          {error && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setError('')}
                className="fixed inset-0 bg-slate-900"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-sm bg-white border border-border-gray rounded-2xl shadow-2xl p-6 z-10 flex flex-col items-center text-center gap-4"
              >
                <div className="p-3 bg-amber-50 text-amber-500 rounded-full">
                  <AlertTriangle className="h-10 w-10 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-700">Warning</h4>
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">{error}</p>
                </div>
                <button
                  id="btn-error-ok"
                  type="button"
                  onClick={() => setError('')}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  OK
                </button>
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
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <IndianRupee className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                    Log Consultation Transaction
                  </h3>
                  <button id="close-payment-modal" onClick={() => setIsPaymentOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
 
                <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Receipt for Patient:</span>
                    <strong className="text-sm text-slate-500 block">{selectedApp?.patient_name}</strong>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Amount (₹)</label>
                    <input
                      id="payment-amount"
                      type="number"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between bg-slate-55/50 border border-border-gray p-2.5 rounded-xl">
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
                          setSplits([{ method: 'Cash', amount: paymentAmount, transaction_ref: '' }]);
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
                            <div key={index} className="bg-slate-55/50 p-3 rounded-xl border border-border-gray relative space-y-2">
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
                        const targetAmount = parseFloat(paymentAmount) || 0;
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
                            id="payment-method"
                            value={paymentMethod}
                            onChange={(value) => {
                              setPaymentMethod(value);
                              if (!isUPIMethod(value)) {
                                setUpiApp('');
                                setPayerUpiId('');
                              }
                            }}
                            triggerClassName="py-2.5 px-3 text-xs text-slate-555"
                            options={[
                              { value: 'Digital (UPI/Card)', label: 'UPI / GPay / PhonePe' },
                              { value: 'Cash Receipt', label: 'Cash Desk' },
                              { value: 'Bank Transfer', label: 'Bank Wire' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            {isUPIMethod(paymentMethod) ? 'Ref ID (UTR) *' : 'Reference Transaction ID / UTR (Optional)'}
                          </label>
                          <input
                            id="payment-reference"
                            type="text"
                            required={isUPIMethod(paymentMethod)}
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            placeholder={isUPIMethod(paymentMethod) ? 'UTR / Ref ID' : 'TXN987654321'}
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      {isUPIMethod(paymentMethod) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UPI App</label>
                            <select
                              value={upiApp}
                              onChange={(e) => setUpiApp(e.target.value)}
                              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-555 outline-none"
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
                              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Transaction Notes</label>
                    <input
                      id="payment-notes"
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Consultation co-pay, surgery deposit..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-payment"
                      type="button"
                      onClick={() => setIsPaymentOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-payment"
                      type="submit"
                      disabled={submitLoading || (isSplitPayment && Math.abs(splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) - (parseFloat(paymentAmount) || 0)) > 0.01)}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
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
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <Eye className="h-4.5 w-4.5 text-primary-green" />
                    Appointment Details & Audit Trail
                  </h3>
                  <button id="close-details-modal" onClick={() => setIsDetailsOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Grid Layout: Details Left, History Right */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Patient Details */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Patient Information</h4>
                        <div className="bg-secondary-bg border border-border-gray p-4 rounded-xl space-y-3">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Name</span>
                            <span className="text-sm font-bold text-slate-500">{selectedAppForDetails.patient_name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Age & Gender</span>
                              <span className="text-xs font-semibold text-slate-500">{selectedAppForDetails.age} yrs • {selectedAppForDetails.gender}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Contact</span>
                              <span className="text-xs font-semibold text-slate-500">{selectedAppForDetails.contact_number}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Clinical Assignment</h4>
                        <div className="bg-secondary-bg border border-border-gray p-4 rounded-xl space-y-3">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Assigned Doctor</span>
                            <span className="text-xs font-semibold text-slate-500">🩺 {selectedAppForDetails.doctor_name || 'Unassigned'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Foundation Hospital</span>
                            <span className="text-xs font-semibold text-slate-500">🏥 {selectedAppForDetails.hospital_name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Schedule Date</span>
                            <span className="text-xs font-semibold text-slate-500">
                              📅 {new Date(selectedAppForDetails.appointment_date).toLocaleString('en-IN', {
                                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Financial Status</h4>
                        <div className="bg-secondary-bg border border-border-gray p-4 rounded-xl">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Total Fee</span>
                              <span className="text-xs font-bold text-slate-500">₹{selectedAppForDetails.total_amount}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Paid</span>
                              <span className="text-xs font-bold text-primary-green">₹{selectedAppForDetails.paid_amount}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Outstanding</span>
                              <span className="text-xs font-bold text-alert-text">₹{selectedAppForDetails.total_amount - selectedAppForDetails.paid_amount}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-border-gray/50 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500">Payment Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              selectedAppForDetails.payment_status === 'Completed' ? 'bg-very-light-green text-primary-green border border-light-green' :
                              selectedAppForDetails.payment_status === 'Partially Paid' ? 'bg-secondary-bg text-slate-500 border border-border-gray' :
                              'bg-alert-bg text-alert-text border border-alert-border'
                            }`}>
                              {selectedAppForDetails.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {selectedAppForDetails.notes && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Diagnostic Notes</h4>
                          <div className="bg-secondary-bg border border-border-gray p-3 rounded-xl text-xs text-slate-500 italic">
                            "{selectedAppForDetails.notes}"
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Audit Timeline or Therapy/Payment History */}
                    <div className="flex flex-col h-full border-t md:border-t-0 md:border-l border-border-gray pt-4 md:pt-0 md:pl-6">
                      <div className="flex gap-2 border-b border-border-gray pb-2 mb-3 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDetailsTab('audit')}
                          className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all ${
                            detailsTab === 'audit' 
                              ? 'text-primary-green border-b-2 border-primary-green' 
                              : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          Audit Trail
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsTab('payment')}
                          className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all ${
                            detailsTab === 'payment' 
                              ? 'text-primary-green border-b-2 border-primary-green' 
                              : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          Payment History
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsTab('therapy')}
                          className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all ${
                            detailsTab === 'therapy' 
                              ? 'text-primary-green border-b-2 border-primary-green' 
                              : 'text-slate-400 hover:text-slate-500'
                          }`}
                        >
                          Therapy History
                        </button>
                      </div>

                      {detailsTab === 'audit' ? (
                        <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] pr-1 space-y-4">
                          {historyLoading ? (
                            <div className="flex h-32 items-center justify-center">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                            </div>
                          ) : editHistory.length === 0 ? (
                            <div className="text-center py-8 bg-secondary-bg/50 border border-dashed border-border-gray rounded-xl">
                              <p className="text-xs text-slate-500 italic">No edit history recorded.</p>
                              <p className="text-[10px] text-slate-500 mt-1">Updates to this appointment will be tracked here.</p>
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
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-1">
                                        <span className="font-bold text-slate-500">{log.edited_by_name}</span>
                                        <span className="text-[9px] bg-white border border-border-gray/80 px-1.5 py-0.5 rounded text-slate-500 uppercase font-semibold">
                                          {log.edited_by_designation}
                                        </span>
                                      </div>
                                      <p className="text-[9px] text-slate-500">
                                        {new Date(log.edited_at).toLocaleString('en-IN')}
                                      </p>
                                      
                                      <ul className="space-y-1 pt-1 border-t border-border-gray/40">
                                        {summaries.map((s: string, idx: number) => (
                                          <li key={idx} className="text-[10px] text-slate-500 list-disc pl-0.5 ml-3">
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
                      ) : detailsTab === 'payment' ? (
                        <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] pr-1 space-y-4">
                          {historyLoading ? (
                            <div className="flex h-32 items-center justify-center">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                            </div>
                          ) : detailsPayments.length === 0 ? (
                            <div className="text-center py-8 bg-secondary-bg/50 border border-dashed border-border-gray rounded-xl">
                              <p className="text-xs text-slate-500 italic">No payments logged yet.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {detailsPayments.map((log: any) => (
                                <div key={log.id} className="bg-slate-55/30 border border-border-gray rounded-xl p-3 text-xs space-y-1.5 hover:border-light-green transition-all animate-fade-in">
                                  <div className="flex items-center justify-between font-bold text-slate-555 flex-wrap gap-1">
                                    <span className="text-emerald-600 font-bold">₹{log.amount}</span>
                                    <span className="text-[9px] bg-white border border-border-gray/80 px-1.5 py-0.5 rounded text-slate-500 uppercase font-semibold">
                                      {log.payment_method}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 space-y-1 pt-1.5 border-t border-border-gray/40">
                                    <p>Collected by: <span className="font-semibold text-slate-500">{log.collector_name || 'System / N/A'}</span></p>
                                    <p>Date: <span className="font-semibold text-slate-500">{new Date(log.created_at).toLocaleString('en-IN')}</span></p>
                                    
                                    {log.payment_method === 'Split Payment' && log.payment_splits ? (
                                      <div className="mt-1.5 pl-2 border-l border-border-gray space-y-1">
                                        {((typeof log.payment_splits === 'string' ? JSON.parse(log.payment_splits) : log.payment_splits) || []).map((split: any, idx: number) => (
                                          <div key={idx} className="text-[9px] text-slate-500 flex items-center gap-1.5">
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
                                          <p>Ref ID: <span className="font-semibold text-slate-500">{log.transaction_ref}</span></p>
                                        )}
                                        {log.upi_app && (
                                          <p>UPI App: <span className="font-semibold text-slate-500">{log.upi_app}</span></p>
                                        )}
                                        {log.payer_upi_id && (
                                          <p>Payer UPI ID: <span className="font-semibold text-slate-500">{log.payer_upi_id}</span></p>
                                        )}
                                      </>
                                    )}
                                    {log.notes && (
                                      <p className="italic text-slate-450 text-[9px] mt-1.5 border-t border-dashed border-border-gray/30 pt-1">"{log.notes}"</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-[50vh] pr-1 space-y-3">
                          {(() => {
                            const patientTherapies = therapySessions.filter(
                              (ts) => ts.mobile_number === selectedAppForDetails?.contact_number
                            );
                            if (patientTherapies.length === 0) {
                              return (
                                <div className="text-center py-8 bg-secondary-bg/50 border border-dashed border-border-gray rounded-xl">
                                  <p className="text-xs text-slate-500 italic">No therapy history found.</p>
                                  <p className="text-[10px] text-slate-400 mt-1">No past therapies are linked to this patient's contact number.</p>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-3">
                                {patientTherapies.map((ts: any) => {
                                  const statusClass = ts.status === 'Verified' 
                                    ? 'bg-very-light-green text-primary-green border border-light-green/35' 
                                    : ts.status === 'Completed'
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                    : ts.status === 'Rejected'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-250'
                                    : ts.status === 'Cancelled'
                                    ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                    : 'bg-rose-50 text-rose-500 border border-rose-100';

                                  return (
                                    <div key={ts.id} className="bg-slate-55/30 border border-border-gray rounded-xl p-3 text-xs space-y-1.5">
                                      <div className="flex items-center justify-between font-bold text-slate-555">
                                        <span className="text-primary-green">{ts.therapy_type}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] ${statusClass}`}>
                                          {ts.status}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                                        <div>Date: <span className="font-semibold">{formatDateStr(ts.session_date)}</span></div>
                                        <div>Timings: <span className="font-semibold">{ts.timings || '--'}</span></div>
                                        {ts.op_technician_name && (
                                          <div className="col-span-2">OP Tech: <span className="font-semibold">{ts.op_technician_name}</span></div>
                                        )}
                                        {ts.sop_technician_name && (
                                          <div className="col-span-2">SOP Tech: <span className="font-semibold">{ts.sop_technician_name}</span></div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
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

        {/* Modal: Move to Telecalling */}
        <AnimatePresence>
          {isMoveModalOpen && selectedApp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMoveModalOpen(false)}
                className="fixed inset-0 bg-slate-900"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between bg-secondary-bg">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <PhoneCall className="h-4.5 w-4.5 text-primary-green" />
                    Move Lead to Telecalling
                  </h3>
                  <button
                    id="close-move-modal"
                    onClick={() => setIsMoveModalOpen(false)}
                    className="text-slate-500 hover:text-primary-green cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleMoveSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Phone Number field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      id="move-phone-number"
                      type="tel"
                      required
                      value={movePhoneNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMovePhoneNumber(val);
                        validateMovePhone(val);
                      }}
                      placeholder="9876543210"
                      className={`w-full bg-white border ${
                        movePhoneError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                          : 'border-border-gray focus:border-primary-green focus:ring-light-green'
                      } focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                    />
                    {movePhoneError && (
                      <p className="text-[10px] text-rose-700 mt-1 font-semibold">{movePhoneError}</p>
                    )}
                  </div>

                  {/* Outreach Status Field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Outreach Status
                    </label>
                    <SelectField
                      id="move-outreach-status"
                      value={moveOutreachStatus}
                      onChange={(val) => {
                        setMoveOutreachStatus(val);
                        validateMoveCallback(val, moveCallbackDate, moveCallbackTime);
                      }}
                      triggerClassName="py-2 px-3 text-xs text-slate-500"
                      options={[
                        { value: 'Interested', label: 'Interested' },
                        { value: 'Callback Requested', label: 'Callback Requested' },
                        { value: 'Not Interested', label: 'Not Interested' },
                        { value: 'RNR (Ring Not Responding)', label: 'RNR (Ring Not Responding)' },
                      ]}
                    />
                  </div>

                  {/* Callback Schedule Fields - Conditional */}
                  {moveOutreachStatus === 'Callback Requested' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Callback Date *
                        </label>
                        <input
                          id="move-callback-date"
                          type="date"
                          required
                          value={moveCallbackDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMoveCallbackDate(val);
                            validateMoveCallback(moveOutreachStatus, val, moveCallbackTime);
                          }}
                          className={`w-full bg-white border ${
                            moveCallbackError
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                              : 'border-border-gray focus:border-primary-green focus:ring-light-green'
                          } focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Callback Time *
                        </label>
                        <input
                          id="move-callback-time"
                          type="time"
                          required
                          value={moveCallbackTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMoveCallbackTime(val);
                            validateMoveCallback(moveOutreachStatus, moveCallbackDate, val);
                          }}
                          className={`w-full bg-white border ${
                            moveCallbackError
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                              : 'border-border-gray focus:border-primary-green focus:ring-light-green'
                          } focus:ring-1 rounded-xl py-2 px-3 text-xs text-slate-500 outline-none`}
                        />
                      </div>
                      {moveCallbackError && (
                        <div className="col-span-1 sm:col-span-2">
                          <p className="text-[10px] text-rose-700 font-semibold">{moveCallbackError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assigned Telecaller Field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Assigned Telecaller *
                    </label>
                    <SelectField
                      id="move-telecaller-id"
                      value={moveTelecallerId}
                      onChange={(val) => {
                        setMoveTelecallerId(val);
                        validateMoveTelecaller(val);
                      }}
                      triggerClassName="py-2 px-3 text-xs text-slate-500"
                      options={telecallersList.map((t) => ({
                        value: String(t.id),
                        label: `📞 ${t.name} (Employee ID: ${t.id})`,
                      }))}
                    />
                    {moveTelecallerError && (
                      <p className="text-[10px] text-rose-700 mt-1 font-semibold">{moveTelecallerError}</p>
                    )}
                  </div>

                  {/* Outbound Notes Field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Outbound Notes
                    </label>
                    <textarea
                      id="move-outbound-notes"
                      rows={3}
                      maxLength={1500}
                      value={moveOutboundNotes}
                      onChange={(e) => setMoveOutboundNotes(e.target.value)}
                      placeholder="Reason for transfer, clinical context, or patient preference..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl p-3 text-xs text-slate-500 outline-none resize-none"
                    />
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5 bg-white">
                    <button
                      id="btn-cancel-move"
                      type="button"
                      onClick={() => setIsMoveModalOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-move"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      {submitLoading ? 'Moving...' : 'Move to Telecalling'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

        {/* Modal: Therapy Scheduling (Create / Edit) */}
        <AnimatePresence>
          {isTherapyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsTherapyModalOpen(false);
                  const prefix = getRolePrefix(user?.role || '');
                  const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
                  router.push(dashboardHref);
                }}
                className="fixed inset-0 bg-black cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-[95%] md:w-[85%] lg:w-full lg:max-w-4xl min-h-[550px] bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <form onSubmit={handleTherapyScheduleSubmit} className="flex flex-col flex-1 max-h-[90vh] w-full">
                  {/* Fixed Header */}
                  <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between shrink-0 bg-white">
                    <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                      <Settings className="h-4.5 w-4.5 text-primary-green animate-pulse" />
                      {isEditingTherapy ? `Edit ${formTherapyType === 'Hydrogen Inhalation' ? 'Hydrogen' : formTherapyType} Session Details` : `Schedule New Therapy Session`}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTherapyModalOpen(false);
                        const prefix = getRolePrefix(user?.role || '');
                        const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
                        router.push(dashboardHref);
                      }}
                      className="text-slate-500 hover:text-primary-green cursor-pointer"
                    >
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
                          disabled={isEditingTherapy}
                          value={formTherapyType}
                          onChange={setFormTherapyType}
                          triggerClassName="h-[65px] px-4 text-base sm:text-[17px] md:text-lg font-semibold text-slate-700"
                          arrowClassName="h-5 w-5"
                          optionClassName="px-4 py-3 text-base sm:text-[17px] md:text-lg"
                          options={[
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

                      {/* Autocomplete Patient Selector */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Patient (Optional)</label>
                        <SelectField
                          value=""
                          onChange={(val) => {
                            if (val) {
                              const [name, phone] = val.split('|');
                              setPatientNameTherapy(name);
                              setMobileNumberTherapy(phone);
                            }
                          }}
                          triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
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
                          value={patientNameTherapy}
                          onChange={(e) => setPatientNameTherapy(e.target.value)}
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
                          value={mobileNumberTherapy}
                          onChange={(e) => setMobileNumberTherapy(e.target.value)}
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
                          value={sessionDateTherapy}
                          onChange={(e) => setSessionDateTherapy(e.target.value)}
                          className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                        />
                      </div>

                      {/* Hospital */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hospital Location *</label>
                        <SelectField
                          value={hospitalIdTherapy}
                          onChange={setHospitalIdTherapy}
                          triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                          options={hospitals.map(h => ({ value: String(h.id), label: h.name }))}
                        />
                      </div>

                      {/* Timing Slot */}
                      {formTherapyType !== 'Lab' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session Timing Slot *</label>
                          <input
                            type="text"
                            required
                            value={timingsTherapy}
                            onChange={(e) => setTimingsTherapy(e.target.value)}
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
                              value={opTechnicianIdTherapy}
                              onChange={setOpTechnicianIdTherapy}
                              triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                              options={[
                                { value: '', label: 'Select OP Technician' },
                                ...technicians.filter(t => t.role === 'OP Technician').map(t => ({ value: String(t.id), label: t.name }))
                              ]}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">SOP Technician</label>
                            <SelectField
                              value={sopTechnicianIdTherapy}
                              onChange={setSopTechnicianIdTherapy}
                              triggerClassName="py-2.5 px-3 text-xs font-semibold text-slate-700"
                              options={[
                                { value: '', label: 'Select SOP Technician' },
                                ...technicians.filter(t => t.role === 'SOP Technician').map(t => ({ value: String(t.id), label: t.name }))
                              ]}
                            />
                          </div>
                        </>
                      )}

                      {/* Custom layouts */}
                      {formTherapyType === 'HBOT' && (
                        <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs">
                          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">HBOT Dive Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dive Time</label>
                              <input
                                type="text"
                                value={diveTimeTherapy}
                                onChange={(e) => setDiveTimeTherapy(e.target.value)}
                                placeholder="e.g. 09:00 AM"
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Surface Time</label>
                              <input
                                type="text"
                                value={surfaceTimeTherapy}
                                onChange={(e) => setSurfaceTimeTherapy(e.target.value)}
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
                                    name="pressureTypeTherapy"
                                    checked={pressureTypeTherapy === 'Cylinder Pressure'}
                                    onChange={() => setPressureTypeTherapy('Cylinder Pressure')}
                                    className="h-4 w-4 text-primary-green focus:ring-primary-green cursor-pointer"
                                  />
                                  <span>Cylinder Pressure</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="pressureTypeTherapy"
                                    checked={pressureTypeTherapy === 'Tank Pressure'}
                                    onChange={() => setPressureTypeTherapy('Tank Pressure')}
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
                                value={pressureValueTherapy}
                                onChange={(e) => setPressureValueTherapy(e.target.value)}
                                placeholder="e.g. 120"
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {formTherapyType === 'Ozone' && (
                        <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs">
                          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Ozone Modality Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Concentration Type</label>
                              <SelectField
                                value={pressureTypeTherapy}
                                onChange={setPressureTypeTherapy}
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
                                value={pressureValueTherapy}
                                onChange={(e) => setPressureValueTherapy(e.target.value)}
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
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physiotherapist assigned</label>
                              <input
                                type="text"
                                value={physiotherapistNameTherapy}
                                onChange={(e) => setPhysiotherapistNameTherapy(e.target.value)}
                                placeholder="Dr. Roy"
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Routines / Therapies</label>
                              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                                {physioOptionsTherapy.map(opt => {
                                  const selected = selectedPhysioTherapiesTherapy.includes(opt);
                                  return (
                                    <div
                                      key={opt}
                                      onClick={() => {
                                        setSelectedPhysioTherapiesTherapy(prev => 
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
                                            setPhysioOptionsTherapy(prev => prev.filter(o => o !== opt));
                                            setSelectedPhysioTherapiesTherapy(prev => prev.filter(o => o !== opt));
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
                                  value={customPhysioTherapyTherapy}
                                  onChange={(e) => setCustomPhysioTherapyTherapy(e.target.value)}
                                  placeholder="e.g. Laser Therapy"
                                  className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-555 outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (customPhysioTherapyTherapy.trim()) {
                                    const val = customPhysioTherapyTherapy.trim();
                                    if (!physioOptionsTherapy.includes(val)) {
                                      setPhysioOptionsTherapy(prev => [...prev, val]);
                                    }
                                    if (!selectedPhysioTherapiesTherapy.includes(val)) {
                                      setSelectedPhysioTherapiesTherapy(prev => [...prev, val]);
                                    }
                                    setCustomPhysioTherapyTherapy('');
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

                      {formTherapyType === 'Dental' && (
                        <div className="col-span-1 md:col-span-2 border border-border-gray p-4 rounded-xl space-y-4 bg-slate-50/50 text-xs animate-fade-in">
                          <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Dental Procedure Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Treatment routine type</label>
                              <input
                                type="text"
                                value={treatmentTypeTherapy}
                                onChange={(e) => setTreatmentTypeTherapy(e.target.value)}
                                placeholder="e.g. Root Canal Therapy"
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dentist Name</label>
                              <input
                                type="text"
                                value={dentistNameTherapy}
                                onChange={(e) => setDentistNameTherapy(e.target.value)}
                                placeholder="Dr. Verma"
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
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
                                  const selected = selectedTestsTherapy.includes(test);
                                  return (
                                    <button
                                      type="button"
                                      key={test}
                                      onClick={() => handleTherapyTestToggle(test)}
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
                                  value={labReportedTherapy}
                                  onChange={setLabReportedTherapy}
                                  triggerClassName="py-2 px-3 text-xs"
                                  options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Report Printed</label>
                                <SelectField
                                  value={labReportPrintedTherapy}
                                  onChange={setLabReportPrintedTherapy}
                                  triggerClassName="py-2 px-3 text-xs"
                                  options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Delivery</label>
                                <SelectField
                                  value={labWhatsappReportTherapy}
                                  onChange={setLabWhatsappReportTherapy}
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
                                value={rescheduledTherapy}
                                onChange={setRescheduledTherapy}
                                triggerClassName="py-2 px-3 text-xs"
                                options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]}
                              />
                            </div>
                            {rescheduledTherapy === 'Yes' && (
                              <>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Date</label>
                                    <input
                                      type="date"
                                      required
                                      value={rescheduledDateTherapy}
                                      onChange={(e) => setRescheduledDateTherapy(e.target.value)}
                                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Time</label>
                                    <input
                                      type="text"
                                      required
                                      value={rescheduledTimeTherapy}
                                      onChange={(e) => setRescheduledTimeTherapy(e.target.value)}
                                      placeholder="09:00 AM"
                                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
                                    />
                                  </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Next session timings (Except Lab and Hydrogen) */}
                      {formTherapyType !== 'Lab' && formTherapyType !== 'Hydrogen Inhalation' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Next Session Date</label>
                            <input
                              type="date"
                              value={nextSessionDateTherapy}
                              onChange={(e) => setNextSessionDateTherapy(e.target.value)}
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Next Session Time</label>
                            <input
                              type="text"
                              value={nextSessionTimeTherapy}
                              onChange={(e) => setNextSessionTimeTherapy(e.target.value)}
                              placeholder="e.g. 09:00 AM"
                              className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                            />
                          </div>
                        </>
                      )}

                      {/* Notes / Remarks */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Session Remarks / Notes (Optional)</label>
                        <textarea
                          rows={3}
                          value={remarksTherapy}
                          onChange={(e) => setRemarksTherapy(e.target.value)}
                          placeholder="Add administrative notes or logs remarks..."
                          className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fixed Footer */}
                  <div className="px-6 py-4 border-t border-border-gray flex items-center justify-end gap-2.5 shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTherapyModalOpen(false);
                        const prefix = getRolePrefix(user?.role || '');
                        const dashboardHref = user?.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
                        router.push(dashboardHref);
                      }}
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
        {isEditOptionModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-border-gray shadow-xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Edit Therapy Option</h3>
              <p className="text-xs text-slate-400 mb-4">Update the name of this routine/therapy below.</p>
              <input
                type="text"
                value={optionEditValue}
                onChange={(e) => setOptionEditValue(e.target.value)}
                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-550 outline-none mb-4"
                placeholder="Therapy name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (optionEditValue.trim() && optionEditValue.trim() !== optionToEdit) {
                      const trimmed = optionEditValue.trim();
                      setPhysioOptionsTherapy(prev => prev.map(o => o === optionToEdit ? trimmed : o));
                      setSelectedPhysioTherapiesTherapy(prev => prev.map(o => o === optionToEdit ? trimmed : o));
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
                      setPhysioOptionsTherapy(prev => prev.map(o => o === optionToEdit ? trimmed : o));
                      setSelectedPhysioTherapiesTherapy(prev => prev.map(o => o === optionToEdit ? trimmed : o));
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
