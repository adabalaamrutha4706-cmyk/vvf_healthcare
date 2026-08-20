'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Users, Search, Plus, Edit3, Trash2, ShieldAlert, CheckCircle, 
  Mail, Phone, Shield, UserX, UserCheck, X, Sparkles, Key,
  Building2, MapPin, Eye, EyeOff, AlertTriangle, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';
import { useRouter } from 'next/navigation';
import { ReportFilterPanel } from '../../components/ReportFilterPanel';
import { exportToPDF, exportToExcel } from '../../lib/exportUtils';

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Lists
  const [usersList, setUsersList] = useState<any[]>([]);
  const [hospitalsList, setHospitalsList] = useState<any[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'in-staff' | 'field-staff'>('in-staff');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [hospitalFilter, setHospitalFilter] = useState('All');
  
  // States
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Doctor');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [staffType, setStaffType] = useState<'in-staff' | 'field-staff'>('in-staff');
  const [assignedHospitalId, setAssignedHospitalId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [qualification, setQualification] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [assignedTherapy, setAssignedTherapy] = useState('');

  // Role Options list (Superadmin only if logged in user is Superadmin)
  const isSuperadmin = user?.role === 'Superadmin';
  const roleOptions = [
    { value: 'Doctor', label: '🩺 Doctor (Clinician)' },
    { value: 'Dental Doctor', label: '🦷 Dental Doctor' },
    { value: 'Dentist Junior', label: '🦷 Dentist Junior' },
    { value: 'Dental Assistant', label: '🦷 Dental Assistant' },
    { value: 'Reception', label: '📝 Reception Desk' },
    { value: 'Telecaller', label: '📞 Telecaller Outreach' },
    { value: 'Executive', label: '🏃‍♂️ Field Executive' },
    { value: 'OP Technician', label: '⚙️ OP Technician' },
    { value: 'SOP Technician', label: '🔍 SOP Technician' },
    { value: 'Admin', label: '💼 Administrator' },
    { value: 'Co-admin', label: '💼 Co-Administrator' },
  ];
  if (isSuperadmin) {
    roleOptions.push({ value: 'Superadmin', label: '👑 Super Administrator' });
  }

  // Frontend real-time validations errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const getInputClass = (fieldName: string, value: string) => {
    const base = "w-full bg-white border rounded-xl py-2 px-3 text-xs text-slate-500 outline-none transition-all";
    if (touchedFields[fieldName]) {
      if (formErrors[fieldName]) {
        return `${base} border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500`;
      }
      if (value && value.trim() !== '') {
        return `${base} border-emerald-500/50 focus:border-primary-green focus:ring-1 focus:ring-light-green`;
      }
    }
    return `${base} border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green`;
  };

  // Real-time validations hook
  useEffect(() => {
    const errs: Record<string, string> = {};

    // Full Name
    const nameVal = name;
    if (!nameVal || nameVal.trim() === '') {
      errs.name = 'Full Name is required.';
    } else if (nameVal.length < 3 || nameVal.length > 100) {
      errs.name = 'Full Name must be between 3 and 100 characters.';
    } else if (!/^[a-zA-Z\s\.]+$/.test(nameVal)) {
      errs.name = 'Only alphabets and full stops are allowed in Full Name.';
    } else if (/^\d+$/.test(nameVal.trim())) {
      errs.name = 'Numbers-only values are not allowed in Full Name.';
    } else if ((nameVal.match(/\./g) || []).length > 2) {
      errs.name = 'Maximum 2 full stops are only allowed in Full Name.';
    } else if (/\.\./.test(nameVal)) {
      errs.name = 'Full stops cannot appear continuously in Full Name.';
    } else if (nameVal.startsWith('.') || nameVal.endsWith('.')) {
      errs.name = 'Full Name should not start or end with a full stop.';
    } else if (nameVal.startsWith(' ') || nameVal.endsWith(' ')) {
      errs.name = 'Full Name should not start or end with spaces.';
    }

    // Corporate Email
    const emailVal = email;
    if (!emailVal || emailVal.trim() === '') {
      errs.email = 'Corporate Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      errs.email = 'Please enter a valid corporate email (e.g. user@vvf.org).';
    }

    // Password
    const passwordVal = password;
    if (!selectedStaff && (!passwordVal || passwordVal.trim() === '')) {
      errs.password = 'Access Password is required for new accounts.';
    } else if (passwordVal && passwordVal.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    // Role Permission
    const roleVal = role;
    if (!roleVal || roleVal.trim() === '') {
      errs.role = 'Role Permission is required.';
    }

    // Phone Number
    const phoneVal = phone;
    if (!phoneVal || phoneVal.trim() === '') {
      errs.phone = 'Phone Number is required.';
    } else if (!/^\d+$/.test(phoneVal)) {
      errs.phone = 'Phone Number must contain only numeric digits.';
    } else if (phoneVal.length !== 10) {
      errs.phone = 'Phone Number must be exactly 10 digits.';
    }

    // Date of Birth
    const dobVal = dob;
    if (!dobVal || dobVal.trim() === '') {
      errs.dob = 'Date of Birth is required.';
    } else {
      const selectedDate = new Date(dobVal);
      const today = new Date();
      if (selectedDate > today) {
        errs.dob = 'Date of Birth cannot be in the future.';
      }
    }

    // Aadhar Number
    const aadharVal = aadharNumber;
    if (aadharVal) {
      if (!/^\d+$/.test(aadharVal)) {
        errs.aadharNumber = 'Aadhar Number must contain only numeric digits.';
      } else if (aadharVal.length !== 12) {
        errs.aadharNumber = 'Aadhar Number must be exactly 12 digits.';
      }
    }

    // Assigned Hospital
    if (staffType === 'in-staff' && (!assignedHospitalId || String(assignedHospitalId).trim() === '')) {
      errs.assignedHospitalId = 'Assigned Hospital is required for In-Staff employees.';
    }

    setFormErrors(errs);
  }, [name, phone, aadharNumber, dob, email, password, role, selectedStaff, staffType, assignedHospitalId]);

  const calculateAge = (dobString: string) => {
    if (!dobString) return '';
    const birthDate = new Date(dobString);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge >= 0 ? String(calculatedAge) : '';
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDob(value);
    const calculated = calculateAge(value);
    setAge(calculated);
  };

  const formatDateForDisplay = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (_) {
      return '';
    }
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    if (user?.role === 'Admin' || user?.role === 'Superadmin') {
      fetchUsers(false);
      fetchHospitals();
      const interval = setInterval(() => fetchUsers(true), 10000); // silent polling every 10s
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.users.getAll();
      setUsersList(res.users || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch directory accounts.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await api.hospitals.getAll();
      setHospitalsList(res.hospitals || []);
    } catch (e: any) {
      console.error('Failed to fetch hospitals:', e);
    }
  };

  const handleScheduleAppointment = (staff: any) => {
    let url = '/appointments?new=true';
    const rolesList = (staff.role || '').split(',').map((r: string) => r.trim());
    const isDoc = rolesList.some((r: string) => ['Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant'].includes(r));
    const isTech = rolesList.some((r: string) => ['OP Technician', 'SOP Technician'].includes(r));
    
    if (isDoc) {
      const docRole = rolesList.find((r: string) => ['Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant'].includes(r));
      url += `&doctorId=${staff.id}&role=${encodeURIComponent(docRole || '')}`;
    } else if (isTech) {
      const techRole = rolesList.find((r: string) => ['OP Technician', 'SOP Technician'].includes(r));
      url += `&technicianId=${staff.id}&role=${encodeURIComponent(techRole || '')}`;
    }
    router.push(url);
  };

  const handleOpenCreate = () => {
    setSelectedStaff(null);
    setTouchedFields({});
    setName('');
    setEmail('');
    setPassword('');
    setRole('Doctor');
    setPhone('');
    setIsActive(true);
    setStaffType('in-staff');
    setAssignedHospitalId('');
    setQualification('');
    setAadharNumber('');
    setDob('');
    setAge('');
    setDateOfJoining('');
    setAssignedTherapy('');
    setError('');
    setSuccess('');
    setShowPassword(false);
    setIsRoleDropdownOpen(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (staff: any) => {
    setSelectedStaff(staff);
    // On edit, mark fields as initially touched so their initial correct state shows success border
    setTouchedFields({
      name: true,
      phone: true,
      aadharNumber: staff.aadhar_number ? true : false
    });
    setName(staff.name);
    setEmail(staff.email);
    setPassword(''); // leave blank if no password update
    setRole(staff.role);
    setPhone(staff.phone || '');
    setIsActive(staff.is_active);
    setStaffType(staff.staff_type || 'in-staff');
    setAssignedHospitalId(staff.assigned_hospital_id ? String(staff.assigned_hospital_id) : '');
    setQualification(staff.qualification || '');
    setAadharNumber(staff.aadhar_number || '');
    setAssignedTherapy(staff.assigned_therapy || '');

    const formatDateForInput = (dateStr: string | null) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
      } catch (_) {
        return '';
      }
    };

    setDob(formatDateForInput(staff.date_of_birth));
    setAge(staff.age != null ? String(staff.age) : '');
    setDateOfJoining(formatDateForInput(staff.date_of_joining));
    setError('');
    setSuccess('');
    setShowPassword(false);
    setIsRoleDropdownOpen(false);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all validation fields as touched
    const allTouched: Record<string, boolean> = {
      name: true,
      phone: true,
      aadharNumber: true,
      dob: true,
      email: true,
      password: true,
      role: true,
      assignedHospitalId: true
    };
    setTouchedFields(allTouched);

    if (Object.keys(formErrors).length > 0) {
      setError('Staff registration validation failed. Please fix the highlighted fields.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    setSuccess('');

    const isTechRole = role === 'OP Technician' || role === 'SOP Technician';
    const payload: any = {
      name,
      email,
      role,
      phone,
      is_active: isActive,
      staff_type: staffType,
      assigned_hospital_id: staffType === 'in-staff' && assignedHospitalId ? parseInt(assignedHospitalId, 10) : null,
      qualification: qualification || null,
      aadhar_number: aadharNumber || null,
      date_of_birth: dob || null,
      age: age ? parseInt(age, 10) : null,
      date_of_joining: dateOfJoining || null,
      assigned_therapy: isTechRole ? (assignedTherapy || null) : null
    };

    if (password) {
      payload.password = password;
    }

    try {
      if (selectedStaff) {
        await api.users.update(selectedStaff.id, payload);
        setSuccess('Staff account modifications saved.');
      } else {
        if (!password) {
          setError('Password is required for new accounts.');
          setSubmitLoading(false);
          return;
        }
        await api.users.create(payload);
        setSuccess('New staff profile generated successfully.');
      }
      setIsFormOpen(false);
      fetchUsers();
      router.push('/admin/users');
    } catch (err: any) {
      setError(err.message || 'Account registration failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === user?.id) {
      alert('Self-deletion is blocked for security.');
      return;
    }
    if (!window.confirm('Are you sure you want to deactivate/delete this staff account? This soft-deletes the record.')) return;
    try {
      await api.users.delete(id);
      setSuccess('Staff profile removed from active records.');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to remove user profile.');
    }
  };

  // Comprehensive Filter (Classification Tab, Search, Role, Hospital, Date Range)
  const filteredUsers = usersList.filter(u => {
    const matchesTab = (u.staff_type || 'in-staff') === activeTab;

    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.phone && String(u.phone).includes(q)) ||
      (u.assigned_hospital_name && u.assigned_hospital_name.toLowerCase().includes(q))
    );

    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesHospital = hospitalFilter === 'All' || String(u.assigned_hospital_id) === String(hospitalFilter);

    let matchesDate = true;
    if (reportStartDate && reportEndDate) {
      const dateVal = u.created_at || u.date_of_joining;
      if (dateVal) {
        const uDate = new Date(dateVal).setHours(0, 0, 0, 0);
        const start = new Date(reportStartDate).setHours(0, 0, 0, 0);
        const end = new Date(reportEndDate).setHours(23, 59, 59, 999);
        if (uDate < start || uDate > end) {
          matchesDate = false;
        }
      }
    }

    return matchesTab && matchesSearch && matchesRole && matchesHospital && matchesDate;
  });

  const handleDownloadPDF = () => {
    const headers = ['#', 'Full Name', 'Corporate Email', 'Role', 'Type', 'Assigned Hospital', 'Phone', 'Joining Date', 'Status'];
    const body = filteredUsers.map((u, idx) => [
      String(idx + 1),
      u.name || 'N/A',
      u.email || 'N/A',
      u.role || 'N/A',
      (u.staff_type || 'in-staff') === 'in-staff' ? 'In-Staff' : 'Field-Staff',
      u.assigned_hospital_name || ((u.staff_type || 'in-staff') === 'field-staff' ? 'N/A (Field)' : 'Unassigned'),
      u.phone || 'N/A',
      formatDateForDisplay(u.date_of_joining) || formatDateForDisplay(u.created_at) || 'N/A',
      u.is_active ? 'Active' : 'Suspended'
    ]);

    const activeHospName = hospitalFilter === 'All' 
      ? 'All Hospitals' 
      : (hospitalsList.find(h => String(h.id) === String(hospitalFilter))?.name || hospitalFilter);
    const subtitle = `Date Range: ${reportStartDate ? formatDateForDisplay(reportStartDate) : 'All Time'} to ${reportEndDate ? formatDateForDisplay(reportEndDate) : 'Present'} | Role: ${roleFilter} | Hospital: ${activeHospName}`;
    exportToPDF(headers, body, 'VVF Healthcare - User Management & Staff Directory Report', subtitle, `user_management_report_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDownloadExcel = () => {
    const activeHospName = hospitalFilter === 'All' 
      ? 'All Hospitals' 
      : (hospitalsList.find(h => String(h.id) === String(hospitalFilter))?.name || hospitalFilter);

    const excelData = filteredUsers.map((u, idx) => ({
      'S.No': idx + 1,
      'Full Name': u.name || '',
      'Corporate Email': u.email || '',
      'Role Permission': u.role || '',
      'Staff Classification': (u.staff_type || 'in-staff') === 'in-staff' ? 'In-Staff' : 'Field-Staff',
      'Assigned Hospital': u.assigned_hospital_name || ((u.staff_type || 'in-staff') === 'field-staff' ? 'Field Staff' : 'Unassigned'),
      'Phone Number': u.phone || '',
      'Qualification': u.qualification || '',
      'Aadhar Number': u.aadhar_number || '',
      'Date of Birth': formatDateForDisplay(u.date_of_birth),
      'Age': u.age || '',
      'Date of Joining': formatDateForDisplay(u.date_of_joining),
      'Assigned Therapy': u.assigned_therapy || '',
      'Account Status': u.is_active ? 'Active' : 'Suspended',
      'Created Date': formatDateForDisplay(u.created_at)
    }));

    exportToExcel(excelData, `user_management_report_${new Date().toISOString().split('T')[0]}`, {
      title: 'VVF Healthcare - User Directory & Staff Report',
      filters: {
        'Classification Tab': activeTab === 'in-staff' ? 'In-Staff' : 'Field-Staff',
        'Role Filter': roleFilter,
        'Hospital Filter': activeHospName,
        'Start Date': reportStartDate || 'All Time',
        'End Date': reportEndDate || 'Present',
        'Total Exported Records': String(filteredUsers.length)
      }
    });
  };

  // Count for tab badges
  const inStaffCount = usersList.filter(u => (u.staff_type || 'in-staff') === 'in-staff').length;
  const fieldStaffCount = usersList.filter(u => (u.staff_type || 'in-staff') === 'field-staff').length;

  // Guard view
  if (user?.role !== 'Admin' && user?.role !== 'Superadmin') {
    return (
      <DashboardLayout>
        <div className="p-6 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          Access Denied. You do not have corporate administrator rights to manage users.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
              Team & Staff Management
              <Users className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Generate corporate accounts, update roles (RBAC overrides), and suspend profiles.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-schedule-appointment"
              onClick={() => router.push('/appointments?new=true')}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
            >
              <Plus className="h-4.5 w-4.5" />
              Schedule Appointment
            </button>
            <button
              id="btn-new-staff"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
            >
              <Plus className="h-4.5 w-4.5" />
              Add Staff Member
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

        {/* Staff Type Tabs */}
        <div className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-1.5 flex gap-1.5">
          <button
            id="tab-in-staff"
            onClick={() => setActiveTab('in-staff')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'in-staff'
                ? 'bg-primary-green text-white shadow-md shadow-emerald-950/15'
                : 'text-slate-500 hover:bg-secondary-bg hover:text-primary-green'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            In-Staff
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
              activeTab === 'in-staff'
                ? 'bg-white/20 text-white'
                : 'bg-secondary-bg text-slate-500'
            }`}>
              {inStaffCount}
            </span>
          </button>
          <button
            id="tab-field-staff"
            onClick={() => setActiveTab('field-staff')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === 'field-staff'
                ? 'bg-primary-green text-white shadow-md shadow-emerald-950/15'
                : 'text-slate-500 hover:bg-secondary-bg hover:text-primary-green'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            Field-Staff
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
              activeTab === 'field-staff'
                ? 'bg-white/20 text-white'
                : 'bg-secondary-bg text-slate-500'
            }`}>
              {fieldStaffCount}
            </span>
          </button>
        </div>

        {/* Role & Hospital Filtering Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-border-gray p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Filter by Role Permission</label>
            <SelectField
              id="filter-user-role"
              value={roleFilter}
              onChange={setRoleFilter}
              triggerClassName="py-2 px-3 text-xs"
              options={[
                { value: 'All', label: 'All Roles' },
                ...roleOptions
              ]}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Filter by Assigned Hospital</label>
            <SelectField
              id="filter-user-hospital"
              value={hospitalFilter}
              onChange={setHospitalFilter}
              triggerClassName="py-2 px-3 text-xs"
              options={[
                { value: 'All', label: 'All Hospitals' },
                ...hospitalsList.map((h: any) => ({
                  value: String(h.id),
                  label: `🏥 ${h.name} (${h.city || 'Location'})`
                }))
              ]}
            />
          </div>
        </div>

        {/* Report Filter & Export Panel */}
        <ReportFilterPanel
          onGenerate={(start, end) => {
            setReportStartDate(start);
            setReportEndDate(end);
          }}
          onReset={() => {
            setReportStartDate('');
            setReportEndDate('');
            setRoleFilter('All');
            setHospitalFilter('All');
            setSearch('');
          }}
          isLoading={loading}
          totalRecords={filteredUsers.length}
          activeStartDate={reportStartDate}
          activeEndDate={reportEndDate}
          onDownloadPDF={handleDownloadPDF}
          onDownloadExcel={handleDownloadExcel}
          showSearch={true}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search staff by name, email, role, phone, or hospital..."
        />

        {/* User Card list */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white/60 border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <Users className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              No {activeTab === 'in-staff' ? 'in-staff' : 'field-staff'} accounts found.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredUsers.map((staff) => (
              <motion.div
                key={staff.id}
                id={`user-card-${staff.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-light-green transition-all duration-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-green/10 transition-all duration-300" />
                
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-500 text-sm truncate leading-tight flex items-center gap-1.5">
                        {staff.name}
                        {!staff.is_active && (
                          <span className="px-1.5 py-0.5 bg-alert-bg/60 text-rose-450 border border-rose-900/30 rounded text-[8px] font-bold uppercase tracking-wider shrink-0">
                            Suspended
                          </span>
                        )}
                      </h3>
                      <span className="text-[10px] text-primary-green font-bold uppercase tracking-wider mt-0.5 block">{staff.role}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1.5 ${
                      staff.current_session_status === 'Active'
                        ? 'bg-very-light-green/60 text-primary-green border border-light-green/40' 
                        : 'bg-white text-slate-500 border border-border-gray'
                    }`}>
                      {staff.current_session_status === 'Active' ? (
                        <>
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          Online
                        </>
                      ) : (
                        'Offline'
                      )}
                    </span>
                  </div>

                  <div className="space-y-2 bg-white/60 border border-border-gray p-3 rounded-xl mb-4 text-xs">
                    <div className="flex items-center gap-2 text-slate-500 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-500" />
                      <span>{staff.email}</span>
                    </div>
                    {staff.phone && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>{staff.phone}</span>
                      </div>
                    )}

                    {/* Staff Type Badge & Hospital */}
                    <div className="flex items-center gap-2 pt-1">
                      {(staff.staff_type || 'in-staff') === 'in-staff' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                          <Building2 className="h-2.5 w-2.5" />
                          In-Staff
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                          <MapPin className="h-2.5 w-2.5" />
                          Field-Staff
                        </span>
                      )}
                      {(staff.staff_type || 'in-staff') === 'in-staff' && staff.assigned_hospital_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 truncate max-w-[160px]" title={staff.assigned_hospital_name}>
                          <Building2 className="h-2.5 w-2.5 shrink-0" />
                          {staff.assigned_hospital_name}
                        </span>
                      )}
                    </div>

                    {/* Qualification, Aadhar, DOJ, Therapy */}
                    {(staff.qualification || staff.aadhar_number || staff.date_of_joining || staff.assigned_therapy) && (
                      <div className="pt-2 mt-2 border-t border-border-gray/50 space-y-1.5 text-[10px] text-slate-500">
                        {staff.assigned_therapy && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Assigned Therapy:</span>
                            <span className="font-semibold text-emerald-600">{staff.assigned_therapy}</span>
                          </div>
                        )}
                        {staff.qualification && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Qualification:</span>
                            <span className="font-semibold text-slate-500 truncate max-w-[180px]">{staff.qualification}</span>
                          </div>
                        )}
                        {staff.aadhar_number && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Aadhar Number:</span>
                            <span className="font-mono font-semibold text-slate-500">{staff.aadhar_number}</span>
                          </div>
                        )}
                        {staff.date_of_joining && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Date of Joining:</span>
                            <span className="font-semibold text-slate-500">{formatDateForDisplay(staff.date_of_joining)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Live Session Tracker details */}
                    <div className="pt-2 mt-2 border-t border-border-gray/50 space-y-1 text-[10px] text-slate-500">
                      {staff.current_session_status === 'Active' ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Login Time:</span>
                            <span className="font-bold text-primary-green">{formatTime(staff.last_login_time)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Session Duration:</span>
                            <span className="font-mono text-primary-green font-bold">{staff.current_session_duration}m active</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Last Seen:</span>
                          <span className="font-semibold text-slate-500">{formatDateTime(staff.last_logout_time || staff.last_login_time)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end items-center border-t border-border-gray pt-3 gap-2.5">
                  <button
                    id={`btn-schedule-appointment-user-${staff.id}`}
                    onClick={() => handleScheduleAppointment(staff)}
                    className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                    title="Schedule Appointment"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  <button
                    id={`btn-edit-user-${staff.id}`}
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 text-slate-500 hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                    title="Edit profile"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    id={`btn-delete-user-${staff.id}`}
                    onClick={() => handleDelete(staff.id)}
                    className="p-1.5 text-slate-500 hover:text-alert-text hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                    title="Delete Account"
                    disabled={staff.id === user?.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
                className="w-[95%] md:w-[90%] lg:w-full lg:max-w-4xl bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <form onSubmit={handleFormSubmit} className="flex flex-col max-h-[90vh] w-full">
                  {/* Fixed Header */}
                  <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between shrink-0 bg-white">
                    <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="h-4.5 w-4.5 text-primary-green" />
                      {selectedStaff ? 'Edit Staff Account' : 'Register New Employee'}
                    </h3>
                    <button type="button" id="close-user-modal" onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  {/* Scrollable Form Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar pb-16">
                    {/* Staff Type Toggle */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Staff Classification</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setStaffType('in-staff'); setAssignedHospitalId(''); }}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                            staffType === 'in-staff'
                              ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                              : 'bg-white text-slate-500 border-border-gray hover:bg-secondary-bg'
                          }`}
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          In-Staff
                        </button>
                        <button
                          type="button"
                          onClick={() => { setStaffType('field-staff'); setAssignedHospitalId(''); }}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                            staffType === 'field-staff'
                              ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                              : 'bg-white text-slate-500 border-border-gray hover:bg-secondary-bg'
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Field-Staff
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {staffType === 'in-staff'
                          ? 'In-Staff attendance is restricted to the assigned hospital location.'
                          : 'Field-Staff can mark attendance from any location. GPS coordinates will be tracked.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Full Name *</label>
                        <input
                          id="form-user-name"
                          type="text"
                          required
                          maxLength={100}
                          value={name}
                          onChange={(e) => { setName(e.target.value); markTouched('name'); }}
                          onBlur={() => markTouched('name')}
                          placeholder="Anil Kumar"
                          className={getInputClass('name', name)}
                        />
                        {touchedFields.name && formErrors.name && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.name}</p>
                        )}
                      </div>

                      {/* Corporate Email */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Corporate Email *</label>
                        <input
                          id="form-user-email"
                          type="email"
                          required
                          maxLength={100}
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); markTouched('email'); }}
                          onBlur={() => markTouched('email')}
                          placeholder="anil@vvf.org"
                          className={getInputClass('email', email)}
                        />
                        {touchedFields.email && formErrors.email && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.email}</p>
                        )}
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">
                          {selectedStaff ? 'Update Password (Optional)' : 'Access Password *'}
                        </label>
                        <div className="relative">
                          <input
                            id="form-user-password"
                            type={showPassword ? 'text' : 'password'}
                            required={!selectedStaff}
                            maxLength={50}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); markTouched('password'); }}
                            onBlur={() => markTouched('password')}
                            placeholder="••••••••"
                            className={getInputClass('password', password) + " pr-10"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-650 cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {touchedFields.password && formErrors.password && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.password}</p>
                        )}
                      </div>

                      {/* Role Permission (Multi-Select Dropdown) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Role Permission *</label>
                        <div className="relative">
                          <div
                            id="form-user-role"
                            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-slate-550 flex justify-between items-center cursor-pointer transition-all min-h-[38px]"
                          >
                            <span className="truncate">
                              {role
                                ? role.split(', ').map(r => {
                                    const opt = roleOptions.find(o => o.value === r);
                                    return opt ? opt.label : r;
                                  }).join(', ')
                                : 'Select Roles'}
                            </span>
                            <span className="text-slate-400 text-[10px]">▼</span>
                          </div>
                          
                          {isRoleDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setIsRoleDropdownOpen(false)} />
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-border-gray rounded-xl shadow-lg z-45 max-h-56 overflow-y-auto p-2 space-y-1">
                                {roleOptions.map((opt) => {
                                  const selectedList = role ? role.split(', ') : [];
                                  const isSelected = selectedList.includes(opt.value);
                                  return (
                                    <label
                                      key={opt.value}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-very-light-green rounded-lg cursor-pointer text-xs font-semibold text-slate-500 transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          let newList: string[];
                                          if (isSelected) {
                                            newList = selectedList.filter(v => v !== opt.value);
                                          } else {
                                            newList = [...selectedList, opt.value];
                                          }
                                          setRole(newList.join(', '));
                                          markTouched('role');
                                        }}
                                        className="h-3.5 w-3.5 rounded border-border-gray text-primary-green focus:ring-primary-green cursor-pointer"
                                      />
                                      <span>{opt.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                        {touchedFields.role && formErrors.role && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.role}</p>
                        )}
                      </div>

                      {/* Assigned Therapy (OP or SOP Technician only) */}
                      {(role.includes('OP Technician') || role.includes('SOP Technician')) && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Therapy</label>
                          <SelectField
                            id="form-user-therapy"
                            value={assignedTherapy}
                            onChange={setAssignedTherapy}
                            triggerClassName="py-2 px-3 text-xs"
                            options={[
                              { value: '', label: '— Select Therapy —' },
                              { value: 'HBOT', label: '🏥 HBOT' },
                              { value: 'Ozone', label: '🧪 Ozone' },
                              { value: 'Physiotherapy', label: '🧘 Physiotherapy' },
                              { value: 'Dental', label: '🦷 Dental' },
                              { value: 'Pelvic Chair Therapy', label: '🪑 Pelvic Chair' },
                              { value: 'SIPCD', label: '🧦 SIPCD' },
                              { value: 'Zero Gravity', label: '🌌 Zero Gravity' },
                              { value: 'Hydrogen Inhalation', label: '🌬️ Hydrogen Inhalation' },
                              { value: 'Lab', label: '🔬 Lab' }
                            ]}
                          />
                        </div>
                      )}

                      {/* Phone Number */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Phone Number *</label>
                        <input
                          id="form-user-phone"
                          type="tel"
                          required
                          value={phone}
                          maxLength={10}
                          onChange={(e) => { setPhone(e.target.value); markTouched('phone'); }}
                          onBlur={() => markTouched('phone')}
                          placeholder="9876543210"
                          className={getInputClass('phone', phone)}
                        />
                        {touchedFields.phone && formErrors.phone && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.phone}</p>
                        )}
                      </div>

                      {/* Qualification */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Qualification</label>
                        <input
                          id="form-user-qualification"
                          type="text"
                          maxLength={150}
                          value={qualification}
                          onChange={(e) => setQualification(e.target.value)}
                          placeholder="e.g. MBBS, MD, B.Sc Nursing"
                          className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                        />
                      </div>

                      {/* Aadhar Number */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Aadhar Number</label>
                        <input
                          id="form-user-aadhar"
                          type="text"
                          maxLength={12}
                          value={aadharNumber}
                          onChange={(e) => { setAadharNumber(e.target.value); markTouched('aadharNumber'); }}
                          onBlur={() => markTouched('aadharNumber')}
                          placeholder="12-digit Aadhar Number"
                          className={getInputClass('aadharNumber', aadharNumber)}
                        />
                        {touchedFields.aadharNumber && formErrors.aadharNumber && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.aadharNumber}</p>
                        )}
                      </div>

                      {/* Date of Birth */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Date of Birth *</label>
                        <input
                          id="form-user-dob"
                          type="date"
                          required
                          value={dob}
                          onChange={(e) => {
                            handleDobChange(e);
                            markTouched('dob');
                          }}
                          onBlur={() => markTouched('dob')}
                          className={getInputClass('dob', dob)}
                        />
                        {touchedFields.dob && formErrors.dob && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.dob}</p>
                        )}
                      </div>

                      {/* Age */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Age</label>
                        <input
                          id="form-user-age"
                          type="number"
                          min={0}
                          max={120}
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="Employee Age"
                          className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                        />
                      </div>

                      {/* Date of Joining */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date of Joining</label>
                        <input
                          id="form-user-doj"
                          type="date"
                          value={dateOfJoining}
                          onChange={(e) => setDateOfJoining(e.target.value)}
                          className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 px-3 text-xs text-slate-500 outline-none"
                        />
                      </div>

                      {/* Assigned Hospital (In-Staff only) */}
                      {staffType === 'in-staff' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">
                            Assigned Hospital *
                          </label>
                          <SelectField
                            id="form-user-hospital"
                            value={assignedHospitalId}
                            onChange={(val) => { setAssignedHospitalId(val); markTouched('assignedHospitalId'); }}
                            triggerClassName="py-2 px-3 text-xs"
                            options={[
                              { value: '', label: '— Select Hospital —' },
                              ...hospitalsList.map((h: any) => ({
                                value: String(h.id),
                                label: `🏥 ${h.name} — ${h.city}`
                              }))
                            ]}
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Attendance will be geo-fenced to this hospital's location.
                          </p>
                          {touchedFields.assignedHospitalId && formErrors.assignedHospitalId && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.assignedHospitalId}</p>
                          )}
                        </div>
                      )}

                      {/* Employee ID */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                        <input
                          id="form-user-emp-id"
                          type="text"
                          disabled
                          value={selectedStaff ? `EMP-${String(selectedStaff.id).padStart(3, '0')}` : 'EMP-*** (Auto-generated)'}
                          className="w-full bg-slate-50 border border-border-gray rounded-xl py-2 px-3 text-xs text-slate-500 outline-none cursor-not-allowed"
                        />
                      </div>

                      {/* System Access State */}
                      <div className={selectedStaff ? "col-span-1" : "col-span-1 md:col-span-2"}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">System Access State</label>
                        <SelectField
                          id="form-user-active"
                          value={isActive ? 'true' : 'false'}
                          onChange={(value) => setIsActive(value === 'true')}
                          triggerClassName="py-2 px-3 text-xs"
                          options={[
                            { value: 'true', label: 'Active (Granted Access)' },
                            { value: 'false', label: 'Suspended (Blocked Access)' },
                          ]}
                        />
                      </div>

                      {/* Password Change Tracking (Read-Only) */}
                      {selectedStaff && (
                        <div className="col-span-1 bg-slate-50 border border-border-gray rounded-xl p-3.5 space-y-2.5 text-xs text-slate-500">
                          <h4 className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                            Password Change Tracking
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Attempts Used</span>
                              <span className="font-semibold text-slate-500">
                                {selectedStaff.password_change_count != null ? selectedStaff.password_change_count : 0} / {selectedStaff.password_change_limit != null ? selectedStaff.password_change_limit : 3}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Lock Status</span>
                              <span className={`font-semibold ${selectedStaff.password_change_locked ? 'text-rose-600' : 'text-primary-green'}`}>
                                {selectedStaff.password_change_locked ? 'Locked' : 'Active'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fixed Footer */}
                  <div className="px-6 py-4 border-t border-border-gray flex items-center justify-end gap-2.5 shrink-0 bg-white">
                    <button
                      id="btn-cancel-user"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-user"
                      type="submit"
                      disabled={submitLoading || Object.keys(formErrors).length > 0}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-50"
                    >
                      {submitLoading ? 'Registering...' : 'Save Employee'}
                    </button>
                  </div>
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

      </div>
    </DashboardLayout>
  );
}
