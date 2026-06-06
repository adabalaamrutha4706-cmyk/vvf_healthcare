'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  Building2, Search, Plus, Edit3, Trash2, ShieldAlert, CheckCircle, 
  MapPin, Phone, User, Sparkles, X, Activity, Globe, Clock, Users,
  CheckSquare, Check, Compass, Shield, Eye, Calendar, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';

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
  const [state, setState] = useState('Telangana');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [allowedRadius, setAllowedRadius] = useState('200');
  const [hospitalType, setHospitalType] = useState('Clinic');
  const [branchCode, setBranchCode] = useState('');
  const [visitingHoursStart, setVisitingHoursStart] = useState('');
  const [visitingHoursEnd, setVisitingHoursEnd] = useState('');
  const [territoryZone, setTerritoryZone] = useState('');
  const [receptionPhone, setReceptionPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [hospitalAdminName, setHospitalAdminName] = useState('');
  const [department, setDepartment] = useState('Cardiology');
  const [visitFrequency, setVisitFrequency] = useState('Weekly');
  const [legacyHospitalId, setLegacyHospitalId] = useState('');
  // Assigned Executives states
  const [executives, setExecutives] = useState<any[]>([]);
  const [selectedExecIds, setSelectedExecIds] = useState<number[]>([]);
  const [execSearchQuery, setExecSearchQuery] = useState('');
  const [isExecDropdownOpen, setIsExecDropdownOpen] = useState(false);

  // Geo-Verification states
  const [requireGpsValidation, setRequireGpsValidation] = useState(true);
  const [requireLivePhoto, setRequireLivePhoto] = useState(false);
  const [requireCheckout, setRequireCheckout] = useState(true);
  const [allowRemoteCompletion, setAllowRemoteCompletion] = useState(true);
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const [temporarilyClosed, setTemporarilyClosed] = useState(false);

  // Verification Preview states
  const [isVerifyingCoords, setIsVerifyingCoords] = useState(false);
  const [previewLat, setPreviewLat] = useState<number | null>(null);
  const [previewLng, setPreviewLng] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [previewWarning, setPreviewWarning] = useState('');
  const [previewError, setPreviewError] = useState('');

  // Frontend real-time validations errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const getInputClass = (fieldName: string, value: string) => {
    const base = "w-full bg-white border rounded-xl py-2 px-3 text-xs text-primary-text outline-none transition-all";
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

  useEffect(() => {
    if (!user) return;
    fetchHospitals();
    if (user?.role === 'Admin' || user?.role === 'Superadmin') {
      fetchExecutives();
    }
  }, [user]);

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

  const fetchExecutives = async () => {
    try {
      const res = await api.users.getExecutives();
      setExecutives(res.executives || []);
    } catch (e) {
      console.error('Failed to load executives:', e);
    }
  };

  // Real-time validations hook
  useEffect(() => {
    const errs: Record<string, string> = {};

    // Clinic Name
    const nameTrim = name.trim();
    if (nameTrim) {
      if (nameTrim.length < 3 || nameTrim.length > 100) {
        errs.name = 'Clinic name must be between 3 and 100 characters.';
      } else if (!/^[a-zA-Z0-9\s\-&\.]+$/.test(nameTrim)) {
        errs.name = 'Only letters, numbers, spaces, hyphens, ampersands, and full stops allowed.';
      } else if (/^\d+$/.test(nameTrim)) {
        errs.name = 'Clinic name cannot contain only numbers.';
      } else if (nameTrim.split('.').length > 2) {
        errs.name = 'At most one full stop is allowed in the clinic name.';
      }
    }

    // Branch Code
    if (branchCode && !/^[A-Z0-9\-]+$/.test(branchCode.trim())) {
      errs.branch_code = 'Branch code must contain only uppercase letters, numbers, and hyphens.';
    }

    // Visiting Hours
    if (visitingHoursStart && visitingHoursEnd) {
      const timeToMins = (t: string) => {
        const parts = t.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      };
      if (timeToMins(visitingHoursEnd) <= timeToMins(visitingHoursStart)) {
        errs.visiting_hours = 'End time must be greater than start time.';
      }
    }

    // Territory / Zone
    if (territoryZone && !/^[a-zA-Z\s]+$/.test(territoryZone.trim())) {
      errs.territory_zone = 'Territory/Zone must contain only letters and spaces.';
    }

    // Address
    const addrTrim = address.trim();
    if (addrTrim) {
      if (addrTrim.length < 10) {
        errs.address = 'Full address must be at least 10 characters.';
      } else if (!/^[a-zA-Z0-9\s,\/\-]+$/.test(addrTrim)) {
        errs.address = 'Only letters, numbers, commas, slashes, hyphens, spaces allowed.';
      }
    }

    // City
    if (city && !/^[a-zA-Z\s]+$/.test(city.trim())) {
      errs.city = 'City must contain only letters and spaces.';
    }

    // Pincode
    if (pincode && !/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'Pincode must be exactly 6 numeric digits.';
    }

    // Landmark
    if (landmark && !/^[a-zA-Z0-9\s,\-]+$/.test(landmark.trim())) {
      errs.landmark = 'Only letters, numbers, commas, spaces, hyphens allowed.';
    }

    // Google Maps Link
    if (googleMapsLink && !/(google\.com\/maps|maps\.app\.goo\.gl)/.test(googleMapsLink.trim())) {
      errs.google_maps_link = 'Must contain google.com/maps or maps.app.goo.gl.';
    }

    // Allowed Radius
    if (allowedRadius) {
      const rad = parseInt(allowedRadius, 10);
      if (isNaN(rad) || rad < 50 || rad > 1000) {
        errs.allowed_radius = 'Allowed check-in radius must be between 50 and 1000 meters.';
      }
    }

    // POC & Admin Names
    if (contactPerson) {
      if (contactPerson.trim().length < 3 || contactPerson.trim().length > 100) {
        errs.contact_person = 'Primary POC Name must be between 3 and 100 characters.';
      } else if (!/^[a-zA-Z\s\.]+$/.test(contactPerson.trim())) {
        errs.contact_person = 'Primary POC Name must contain only letters, spaces, and full stops.';
      } else if (!/[a-zA-Z]/.test(contactPerson)) {
        errs.contact_person = 'Primary POC Name must contain alphabets.';
      } else if (contactPerson.split('.').length > 3) {
        errs.contact_person = 'Primary POC Name can contain at most two full stops.';
      }
    }
    if (hospitalAdminName) {
      if (hospitalAdminName.trim().length < 3 || hospitalAdminName.trim().length > 100) {
        errs.hospital_admin_name = 'Hospital Admin Name must be between 3 and 100 characters.';
      } else if (!/^[a-zA-Z\s\.]+$/.test(hospitalAdminName.trim())) {
        errs.hospital_admin_name = 'Hospital Admin Name must contain only letters, spaces, and full stops.';
      } else if (!/[a-zA-Z]/.test(hospitalAdminName)) {
        errs.hospital_admin_name = 'Hospital Admin Name must contain alphabets.';
      } else if (hospitalAdminName.split('.').length > 3) {
        errs.hospital_admin_name = 'Hospital Admin Name can contain at most two full stops.';
      }
    }

    // Contact Numbers (Primary, Reception, Alternate)
    if (phone) {
      if (!/^\d+$/.test(phone.trim())) {
        errs.phone = 'Primary Contact Number must contain only numeric digits.';
      } else if (phone.trim().length > 10) {
        errs.phone = 'Primary Contact Number must not exceed 10 digits.';
      }
    }
    if (receptionPhone) {
      if (!/^\d+$/.test(receptionPhone.trim())) {
        errs.reception_phone = 'Reception Contact Number must contain only numeric digits.';
      } else if (receptionPhone.trim().length > 10) {
        errs.reception_phone = 'Reception Contact Number must not exceed 10 digits.';
      }
    }
    if (alternatePhone) {
      if (!/^\d+$/.test(alternatePhone.trim())) {
        errs.alternate_phone = 'Alternate Contact Number must contain only numeric digits.';
      } else if (alternatePhone.trim().length > 10) {
        errs.alternate_phone = 'Alternate Contact Number must not exceed 10 digits.';
      }
    }

    // Email
    if (email) {
      if (!/^[^\s@]+@gmail\.com$/.test(email.trim().toLowerCase())) {
        errs.email = 'Email Address must contain @gmail.com.';
      }
    }

    setFormErrors(errs);
  }, [name, address, city, state, pincode, phone, receptionPhone, alternatePhone, email, googleMapsLink, allowedRadius, contactPerson, hospitalAdminName, visitingHoursStart, visitingHoursEnd, branchCode, territoryZone, landmark]);

  const handleOpenCreate = () => {
    setSelectedHospital(null);
    setTouchedFields({});
    setName('');
    setCity('');
    setState('Telangana');
    setContactPerson('');
    setPhone('');
    setStatus('ACTIVE');
    setAddress('');
    setLandmark('');
    setPincode('');
    setGoogleMapsLink('');
    setAllowedRadius('200');
    setHospitalType('Clinic');
    setBranchCode('');
    setVisitingHoursStart('');
    setVisitingHoursEnd('');
    setTerritoryZone('');
    setReceptionPhone('');
    setAlternatePhone('');
    setEmail('');
    setHospitalAdminName('');
    setDepartment('Cardiology');
    setVisitFrequency('Weekly');
    setLegacyHospitalId('');
    setSelectedExecIds([]);
    setExecSearchQuery('');
    setIsExecDropdownOpen(false);
    setRequireGpsValidation(true);
    setRequireLivePhoto(false);
    setRequireCheckout(true);
    setAllowRemoteCompletion(true);
    setGeofencingEnabled(true);
    setTemporarilyClosed(false);
    setPreviewLat(null);
    setPreviewLng(null);
    setPreviewStatus('');
    setPreviewWarning('');
    setPreviewError('');
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (hosp: any) => {
    setSelectedHospital(hosp);
    setTouchedFields({
      name: true,
      city: true,
      state: true,
      contactPerson: true,
      phone: true,
      address: true,
      landmark: true,
      pincode: true,
      googleMapsLink: true,
      allowedRadius: true,
      branchCode: true,
      visitingHoursStart: true,
      visitingHoursEnd: true,
      territoryZone: true,
      receptionPhone: true,
      alternatePhone: true,
      email: true,
      hospitalAdminName: true,
      department: true
    });
    setName(hosp.name || '');
    setCity(hosp.city || '');
    setState(hosp.state || 'Telangana');
    setContactPerson(hosp.contact_person || '');
    setPhone(hosp.phone || '');
    setStatus(hosp.status || 'ACTIVE');
    setAddress(hosp.address || '');
    setLandmark(hosp.landmark || '');
    setPincode(hosp.pincode || '');
    setGoogleMapsLink(hosp.google_maps_link || '');
    setAllowedRadius(hosp.allowed_radius !== null && hosp.allowed_radius !== undefined ? hosp.allowed_radius.toString() : '200');
    setHospitalType(hosp.hospital_type || 'Clinic');
    setBranchCode(hosp.branch_code || '');
    
    // Parse visiting hours
    let start = '';
    let end = '';
    if (hosp.visiting_hours && hosp.visiting_hours.includes('-')) {
      const parts = hosp.visiting_hours.split('-');
      start = parts[0].trim();
      end = parts[1].trim();
    }
    setVisitingHoursStart(start);
    setVisitingHoursEnd(end);
    
    setTerritoryZone(hosp.territory_zone || '');
    setReceptionPhone(hosp.reception_phone || '');
    setAlternatePhone(hosp.alternate_phone || '');
    setEmail(hosp.email || '');
    setHospitalAdminName(hosp.hospital_admin_name || '');
    setDepartment(hosp.department || 'Cardiology');
    setVisitFrequency(hosp.visit_frequency || 'Weekly');
    setLegacyHospitalId(hosp.legacyHospitalId || hosp.legacy_hospital_id || '');
    
    // Parse assigned executives IDs
    if (hosp.assigned_executives) {
      const ids = hosp.assigned_executives.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
      setSelectedExecIds(ids);
    } else {
      setSelectedExecIds([]);
    }
    setExecSearchQuery('');
    setIsExecDropdownOpen(false);

    setRequireGpsValidation(hosp.require_gps_validation !== undefined ? (hosp.require_gps_validation === true || hosp.require_gps_validation === 'true') : true);
    setRequireLivePhoto(hosp.require_live_photo !== undefined ? (hosp.require_live_photo === true || hosp.require_live_photo === 'true') : false);
    setRequireCheckout(hosp.require_checkout !== undefined ? (hosp.require_checkout === true || hosp.require_checkout === 'true') : true);
    setAllowRemoteCompletion(hosp.allow_remote_completion !== undefined ? (hosp.allow_remote_completion === true || hosp.allow_remote_completion === 'true') : true);
    setGeofencingEnabled(hosp.geofencing_enabled !== undefined ? (hosp.geofencing_enabled === true || hosp.geofencing_enabled === 'true') : true);
    setTemporarilyClosed(hosp.temporarily_closed !== undefined ? (hosp.temporarily_closed === true || hosp.temporarily_closed === 'true') : false);
    
    setPreviewLat(hosp.latitude);
    setPreviewLng(hosp.longitude);
    setPreviewStatus(hosp.geo_verification_status || 'VERIFIED');
    setPreviewWarning(hosp.allowed_radius > 300 ? 'Geofence radius exceeds recommended 300 meters limit.' : '');
    setPreviewError('');
    setError('');
    setSuccess('');
    setIsFormOpen(true);
  };

  const handleVerifyLocation = async () => {
    if (!address && !googleMapsLink) {
      setPreviewError('Please enter an Address or a Google Maps Link to verify.');
      return;
    }
    setIsVerifyingCoords(true);
    setPreviewError('');
    setPreviewWarning('');
    try {
      const res = await api.hospitals.geocodeAddress(address, googleMapsLink);
      const data = res?.data || res;
      if (data && data.latitude !== undefined && data.longitude !== undefined) {
        setPreviewLat(data.latitude);
        setPreviewLng(data.longitude);
        setPreviewStatus(data.status);
        
        const radius = allowedRadius ? parseInt(allowedRadius, 10) : 200;
        if (radius > 300) {
          setPreviewWarning('Geofence radius exceeds recommended 300 meters limit. Verify geofencing zone accuracy.');
        }
        
        if (data.status === 'MANUAL_REVIEW_REQUIRED') {
          setPreviewWarning(prev => (prev ? prev + ' • ' : '') + 'Google Maps link coordinates are inconsistent with address geocoder. Verify location manually.');
        }
      } else {
        setPreviewError('Unable to resolve coordinates. Check address spelling or maps link.');
      }
    } catch (e: any) {
      setPreviewError(e.message || 'Geocoding failed.');
    } finally {
      setIsVerifyingCoords(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all validation fields as touched
    const allTouched: Record<string, boolean> = {
      name: true,
      branch_code: true,
      visitingHoursStart: true,
      visitingHoursEnd: true,
      territory_zone: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      landmark: true,
      google_maps_link: true,
      allowed_radius: true,
      contact_person: true,
      hospital_admin_name: true,
      phone: true,
      reception_phone: true,
      alternate_phone: true,
      email: true,
      department: true
    };
    setTouchedFields(allTouched);

    if (Object.keys(formErrors).length > 0) {
      setError('Registration validation failed. Please correct the highlighted errors.');
      return;
    }
    
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    const visitingHours = (visitingHoursStart && visitingHoursEnd) ? `${visitingHoursStart} - ${visitingHoursEnd}` : '';

    const payload = {
      name,
      city,
      state,
      contact_person: contactPerson,
      phone,
      status,
      address,
      landmark,
      pincode,
      google_maps_link: googleMapsLink,
      allowed_radius: allowedRadius !== '' ? parseInt(allowedRadius, 10) : 200,
      hospital_type: hospitalType,
      branch_code: branchCode,
      visiting_hours: visitingHours,
      visiting_hours_start: visitingHoursStart,
      visiting_hours_end: visitingHoursEnd,
      territory_zone: territoryZone,
      reception_phone: receptionPhone,
      alternate_phone: alternatePhone,
      email,
      hospital_admin_name: hospitalAdminName,
      department,
      assigned_executives: selectedExecIds.join(','),
      visit_frequency: visitFrequency,
      legacyHospitalId,
      legacy_hospital_id: legacyHospitalId,
      require_gps_validation: requireGpsValidation,
      require_live_photo: requireLivePhoto,
      require_checkout: requireCheckout,
      allow_remote_completion: allowRemoteCompletion,
      geofencing_enabled: geofencingEnabled,
      temporarily_closed: temporarilyClosed
    };

    try {
      let res;
      if (selectedHospital) {
        res = await api.hospitals.update(selectedHospital.id, payload);
        setSuccess('Hospital credentials modified successfully.');
      } else {
        res = await api.hospitals.create(payload);
        setSuccess('New hospital registered into organization network.');
      }
      
      if (res && res.warnings && Object.keys(res.warnings).length > 0) {
        setSuccess(prev => prev + ' (Note: ' + Object.values(res.warnings).join(', ') + ')');
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
    h.state.toLowerCase().includes(search.toLowerCase()) ||
    (h.hospital_uid && h.hospital_uid.toLowerCase().includes(search.toLowerCase())) ||
    (h.legacy_hospital_id && h.legacy_hospital_id.toLowerCase().includes(search.toLowerCase())) ||
    (h.legacyHospitalId && h.legacyHospitalId.toLowerCase().includes(search.toLowerCase()))
  );

  const isFormInvalid = 
    !name.trim() || 
    !city.trim() || 
    !state.trim() || 
    !address.trim() || 
    Object.keys(formErrors).length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-primary-text flex items-center gap-2">
              Partner Hospitals Registry
              <Building2 className="h-5 w-5 text-primary-green" />
            </h1>
            <p className="text-sm text-secondary-text mt-0.5">
              Manage clinical locations, reference branches, and field geofence tracking zones.
            </p>
          </div>

          {user?.role === 'Admin' && (
            <button
              id="btn-new-hospital"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-950/20"
            >
              <Plus className="h-4.5 w-4.5" />
              Register Branch
            </button>
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
          <div className="p-4 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {/* Search Panel */}
        <div className="bg-white border border-border-gray p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-secondary-text" />
            <input
              id="hospital-search"
              type="text"
              placeholder="Search hospitals by name, UID, city, or state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2.5 pl-10 pr-4 text-xs text-primary-text placeholder-slate-400 outline-none transition-all"
            />
          </div>
        </div>

        {/* Grid List */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="bg-white/60 border border-border-gray p-12 text-center rounded-2xl flex flex-col items-center justify-center">
            <Building2 className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-secondary-text text-sm font-medium">No medical centers matched your query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredHospitals.map((hosp) => (
              <motion.div
                key={hosp.id}
                id={`hospital-card-${hosp.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-light-green transition-all duration-200 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-green/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-green/10 transition-all duration-300" />
                
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] bg-very-light-green text-primary-green border border-light-green/40 px-1.5 py-0.5 rounded font-bold">
                          {hosp.hospital_uid || 'UID Pending'}
                        </span>
                        {hosp.branch_code && (
                          <span className="text-[9px] bg-white text-secondary-text border border-border-gray px-1.5 py-0.5 rounded font-semibold">
                            {hosp.branch_code}
                          </span>
                        )}
                        {(hosp.legacyHospitalId || hosp.legacy_hospital_id) && (
                          <span className="text-[9px] bg-white text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded font-semibold" title="Legacy Reference ID">
                            Legacy ID: {hosp.legacyHospitalId || hosp.legacy_hospital_id}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-primary-text text-sm leading-snug group-hover:text-primary-green transition-colors mt-1">
                        {hosp.name}
                      </h3>
                      <p className="text-[10px] text-secondary-text mt-0.5">
                        {hosp.hospital_type || 'Clinic'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        hosp.status?.toUpperCase() === 'ACTIVE' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                        hosp.status?.toUpperCase() === 'UNDER_REVIEW' ? 'bg-secondary-bg text-secondary-text border border-border-gray' :
                        hosp.status?.toUpperCase() === 'TEMPORARILY_CLOSED' ? 'bg-orange-950 text-orange-400 border border-orange-500/20' :
                        'bg-alert-bg text-alert-text border border-alert-border'
                      }`}>
                        {hosp.status}
                      </span>
                      {hosp.temporarily_closed && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-secondary-bg text-secondary-text border border-border-gray flex items-center gap-0.5 animate-pulse">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 bg-white/60 border border-border-gray p-3 rounded-xl mb-4 text-xs">
                    {/* Location info */}
                    <div className="space-y-1">
                      <div className="flex items-start gap-2 text-secondary-text">
                        <MapPin className="h-3.5 w-3.5 text-secondary-text mt-0.5 shrink-0" />
                        <div>
                          <p className="text-secondary-text font-medium leading-normal">
                            {hosp.address || `${hosp.city}, ${hosp.state}`}
                          </p>
                          {hosp.landmark && (
                            <p className="text-[10px] text-secondary-text">
                              Landmark: {hosp.landmark}
                            </p>
                          )}
                          {hosp.pincode && (
                            <p className="text-[10px] text-secondary-text">
                              Pincode: {hosp.pincode}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {hosp.latitude && hosp.longitude && (
                        <div className="flex items-center gap-2 pl-5.5 text-[10px] text-secondary-text">
                          <Globe className="h-3 w-3 text-slate-600" />
                          <span>GPS: {parseFloat(hosp.latitude).toFixed(4)}, {parseFloat(hosp.longitude).toFixed(4)}</span>
                          {hosp.google_maps_link && (
                            <a 
                              href={hosp.google_maps_link}
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-primary-green hover:underline flex items-center gap-0.5 font-semibold"
                            >
                              (Maps)
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contact Person info */}
                    <div className="border-t border-border-gray/60 pt-2 space-y-1">
                      {hosp.contact_person && (
                        <div className="flex items-center gap-2 text-secondary-text">
                          <User className="h-3.5 w-3.5 text-secondary-text shrink-0" />
                          <span>
                            POC: <strong className="text-primary-text font-semibold">{hosp.contact_person}</strong>
                          </span>
                        </div>
                      )}
                      
                      {(hosp.phone || hosp.reception_phone) && (
                        <div className="flex items-start gap-2 text-slate-455 pl-5.5 flex-wrap gap-x-3 text-[11px]">
                          {hosp.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-600" />
                              <span>{hosp.phone}</span>
                            </div>
                          )}
                          {hosp.reception_phone && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] px-1 bg-white border border-border-gray rounded text-secondary-text">Rec</span>
                              <span>{hosp.reception_phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Executive Assignment & Timing */}
                    {(hosp.assigned_executives_names || hosp.visit_frequency) && (
                      <div className="border-t border-border-gray/60 pt-2 text-[10px] text-secondary-text space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-secondary-text font-medium">Frequency:</span>
                          <span className="font-semibold text-secondary-text bg-white px-1.5 py-0.5 rounded border border-border-gray">
                            {hosp.visit_frequency || 'Weekly'}
                          </span>
                        </div>
                        {hosp.assigned_executives_names && (
                          <div className="flex items-start gap-1 justify-between">
                            <span className="text-secondary-text shrink-0 font-medium">Assigned:</span>
                            <span className="font-semibold text-secondary-text truncate max-w-[70%]" title={hosp.assigned_executives_names}>
                              {hosp.assigned_executives_names}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Geofencing Status Indicators */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                      hosp.geofencing_enabled 
                        ? 'bg-very-light-green text-primary-green border-light-green/40' 
                        : 'bg-white text-secondary-text border-border-gray'
                    }`}>
                      Geofence: {hosp.geofencing_enabled ? `${hosp.allowed_radius || 200}m` : 'Off'}
                    </span>
                    
                    {hosp.geo_verification_status && (
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                        hosp.geo_verification_status === 'VERIFIED' ? 'bg-very-light-green text-primary-green border-light-green/40' :
                        hosp.geo_verification_status === 'APPROXIMATE' ? 'bg-secondary-bg/40 text-secondary-text border-border-gray' :
                        'bg-alert-bg/40 text-alert-text border-alert-border'
                      }`}>
                        {hosp.geo_verification_status}
                      </span>
                    )}

                    {hosp.allow_remote_completion ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-very-light-green text-primary-green border border-light-green/40">
                        Remote OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-alert-bg/40 text-alert-text border border-alert-border">
                        Strict Location
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                {user?.role === 'Admin' && (
                  <div className="flex justify-end items-center border-t border-border-gray pt-3 gap-2.5">
                    <button
                      id={`btn-edit-hospital-${hosp.id}`}
                      onClick={() => handleOpenEdit(hosp)}
                      className="p-1.5 text-secondary-text hover:text-primary-green hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
                      title="Edit Branch"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      id={`btn-delete-hospital-${hosp.id}`}
                      onClick={() => handleDelete(hosp.id)}
                      className="p-1.5 text-secondary-text hover:text-alert-text hover:bg-very-light-green rounded-lg cursor-pointer transition-colors"
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
                className="w-full max-w-4xl bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[95vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-primary-green" />
                    {selectedHospital ? `Edit Branch (${selectedHospital.hospital_uid})` : 'Register Partner Clinic'}
                  </h3>
                  <button id="close-hospital-modal" onClick={() => setIsFormOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="overflow-y-auto p-6 space-y-6 max-h-[75vh]">
                    
                    {/* Section 1: General Info & Metadata */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-primary-green flex items-center gap-1.5 uppercase tracking-wider pb-1 border-b border-border-gray">
                        <Building2 className="h-4 w-4" />
                        1. General Info & Metadata
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Clinic Name *</label>
                          <input
                            id="form-hosp-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => { setName(e.target.value); markTouched('name'); }}
                            onBlur={() => markTouched('name')}
                            placeholder="Apex Heart Clinic"
                            className={getInputClass('name', name)}
                          />
                          {touchedFields.name && formErrors.name && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.name}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Branch Code (Uppercase & Hyphen)</label>
                          <input
                            id="form-hosp-branch-code"
                            type="text"
                            value={branchCode}
                            onChange={(e) => { setBranchCode(e.target.value); markTouched('branch_code'); }}
                            onBlur={() => markTouched('branch_code')}
                            placeholder="Auto-Generated if blank"
                            className={getInputClass('branch_code', branchCode)}
                          />
                          {touchedFields.branch_code && formErrors.branch_code && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.branch_code}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Legacy Hospital ID (Reference)</label>
                          <input
                            id="form-hosp-legacy-id"
                            type="text"
                            value={legacyHospitalId}
                            onChange={(e) => setLegacyHospitalId(e.target.value)}
                            placeholder="e.g. HSP-2026-000012"
                            className="w-full bg-white border border-border-gray focus:border-primary-green focus:ring-1 focus:ring-light-green rounded-xl py-2 px-3 text-xs text-primary-text outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Hospital Type</label>
                          <SelectField
                            id="form-hosp-type"
                            value={hospitalType}
                            onChange={setHospitalType}
                            triggerClassName="py-2 px-3 text-xs"
                            options={[
                              { value: 'Clinic', label: 'Clinic' },
                              { value: 'Hospital', label: 'Hospital' },
                              { value: 'Diagnostic Center', label: 'Diagnostic Center' },
                              { value: 'Medical Center', label: 'Medical Center' },
                              { value: 'Nursing Home', label: 'Nursing Home' },
                              { value: 'Other', label: 'Other' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Network Status</label>
                          <SelectField
                            id="form-hosp-status"
                            value={status}
                            onChange={setStatus}
                            triggerClassName="py-2 px-3 text-xs"
                            options={[
                              { value: 'Active', label: 'Active Branch' },
                              { value: 'Pending', label: 'Pending Audit' },
                              { value: 'Suspended', label: 'Suspended' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Visit Frequency</label>
                          <SelectField
                            id="form-hosp-frequency"
                            value={visitFrequency}
                            onChange={setVisitFrequency}
                            triggerClassName="py-2 px-3 text-xs"
                            options={[
                              { value: 'Daily', label: 'Daily' },
                              { value: 'Weekly', label: 'Weekly' },
                              { value: 'Bi-weekly', label: 'Bi-weekly' },
                              { value: 'Monthly', label: 'Monthly' },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Visiting Hours Start Time</label>
                          <input
                            id="form-hosp-hours-start"
                            type="time"
                            value={visitingHoursStart}
                            onChange={(e) => { setVisitingHoursStart(e.target.value); markTouched('visitingHoursStart'); }}
                            onBlur={() => markTouched('visitingHoursStart')}
                            className={getInputClass('visitingHoursStart', visitingHoursStart)}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Visiting Hours End Time</label>
                          <input
                            id="form-hosp-hours-end"
                            type="time"
                            value={visitingHoursEnd}
                            onChange={(e) => { setVisitingHoursEnd(e.target.value); markTouched('visitingHoursEnd'); }}
                            onBlur={() => markTouched('visitingHoursEnd')}
                            className={getInputClass('visitingHoursEnd', visitingHoursEnd)}
                          />
                          {(touchedFields.visitingHoursStart || touchedFields.visitingHoursEnd) && formErrors.visiting_hours && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.visiting_hours}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Territory / Zone</label>
                          <input
                            id="form-hosp-zone"
                            type="text"
                            value={territoryZone}
                            onChange={(e) => { setTerritoryZone(e.target.value); markTouched('territory_zone'); }}
                            onBlur={() => markTouched('territory_zone')}
                            placeholder="North Zone / Gachibowli"
                            className={getInputClass('territory_zone', territoryZone)}
                          />
                          {touchedFields.territory_zone && formErrors.territory_zone && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.territory_zone}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Location & Geo-Verification settings */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-primary-green flex items-center gap-1.5 uppercase tracking-wider pb-1 border-b border-border-gray">
                        <MapPin className="h-4 w-4" />
                        2. Location & Geo-Verification
                      </h4>

                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Full Address</label>
                        <textarea
                          id="form-hosp-address"
                          value={address}
                          onChange={(e) => { setAddress(e.target.value); markTouched('address'); }}
                          onBlur={() => markTouched('address')}
                          placeholder="Plot 42, Jubilee Hills Road No 36"
                          rows={2}
                          className={getInputClass('address', address) + " resize-none"}
                        />
                        {touchedFields.address && formErrors.address && (
                          <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.address}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">City *</label>
                          <input
                            id="form-hosp-city"
                            type="text"
                            required
                            value={city}
                            onChange={(e) => { setCity(e.target.value); markTouched('city'); }}
                            onBlur={() => markTouched('city')}
                            placeholder="Secunderabad"
                            className={getInputClass('city', city)}
                          />
                          {touchedFields.city && formErrors.city && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.city}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">State *</label>
                          <input
                            id="form-hosp-state"
                            type="text"
                            required
                            value={state}
                            onChange={(e) => { setState(e.target.value); markTouched('state'); }}
                            onBlur={() => markTouched('state')}
                            placeholder="Telangana"
                            className={getInputClass('state', state)}
                          />
                          {touchedFields.state && formErrors.state && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.state}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Pincode</label>
                          <input
                            id="form-hosp-pincode"
                            type="text"
                            value={pincode}
                            onChange={(e) => { setPincode(e.target.value); markTouched('pincode'); }}
                            onBlur={() => markTouched('pincode')}
                            placeholder="500003"
                            className={getInputClass('pincode', pincode)}
                          />
                          {touchedFields.pincode && formErrors.pincode && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.pincode}</p>
                          )}
                        </div>
                      </div>                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Landmark</label>
                          <input
                            id="form-hosp-landmark"
                            type="text"
                            value={landmark}
                            onChange={(e) => { setLandmark(e.target.value); markTouched('landmark'); }}
                            onBlur={() => markTouched('landmark')}
                            placeholder="Opposite Metro Pillar 1600"
                            className={getInputClass('landmark', landmark)}
                          />
                          {touchedFields.landmark && formErrors.landmark && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.landmark}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Google Maps Link</label>
                          <input
                            id="form-hosp-maps-link"
                            type="url"
                            value={googleMapsLink}
                            onChange={(e) => { setGoogleMapsLink(e.target.value); markTouched('google_maps_link'); }}
                            onBlur={() => markTouched('google_maps_link')}
                            placeholder="https://maps.google.com/..."
                            className={getInputClass('google_maps_link', googleMapsLink)}
                          />
                          {touchedFields.google_maps_link && formErrors.google_maps_link && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.google_maps_link}</p>
                          )}
                        </div>
                      </div>

                      {/* Verify Button and Radius */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Allowed Radius (meters)</label>
                          <input
                            id="form-hosp-radius"
                            type="number"
                            value={allowedRadius}
                            onChange={(e) => { setAllowedRadius(e.target.value); markTouched('allowed_radius'); }}
                            onBlur={() => markTouched('allowed_radius')}
                            placeholder="200"
                            className={getInputClass('allowed_radius', allowedRadius)}
                          />
                          {touchedFields.allowed_radius && formErrors.allowed_radius && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.allowed_radius}</p>
                          )}
                        </div>
                        <div>
                          <button
                            id="btn-verify-location"
                            type="button"
                            onClick={handleVerifyLocation}
                            disabled={isVerifyingCoords}
                            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-green bg-very-light-green hover:bg-very-light-green/60 border border-emerald-500/30 rounded-xl cursor-pointer transition-all disabled:opacity-50"
                          >
                            <Compass className={`h-4 w-4 ${isVerifyingCoords ? 'animate-spin' : ''}`} />
                            {isVerifyingCoords ? 'Resolving Coordinates...' : 'Verify Coordinates'}
                          </button>
                        </div>
                      </div>

                      {/* Location Preview Panel */}
                      {(previewLat !== null || previewError || previewWarning) && (
                        <div className="bg-white/80 border border-border-gray rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-secondary-text uppercase tracking-wider">Location Verification Status</h5>
                            {previewStatus && (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                previewStatus === 'VERIFIED' ? 'bg-very-light-green text-primary-green border-light-green/40' :
                                previewStatus === 'APPROXIMATE' ? 'bg-secondary-bg text-secondary-text border-border-gray' :
                                'bg-alert-bg text-alert-text border-alert-border'
                              }`}>
                                {previewStatus}
                              </span>
                            )}
                          </div>

                          {previewError && (
                            <p className="text-xs text-alert-text font-medium flex items-center gap-1.5">
                              <ShieldAlert className="h-4 w-4 shrink-0" />
                              {previewError}
                            </p>
                          )}

                          {previewWarning && (
                            <div className="p-2.5 rounded-lg bg-secondary-bg/20 border border-amber-500/10 text-[10px] text-secondary-text flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span className="font-medium leading-normal">{previewWarning}</span>
                            </div>
                          )}

                          {previewLat !== null && previewLng !== null && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Resolved coordinates info */}
                              <div className="space-y-2 text-xs">
                                <div className="bg-white border border-border-gray p-2.5 rounded-lg space-y-1">
                                  <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider block">Resolved Coordinates</span>
                                  <div className="font-mono text-secondary-text flex flex-col">
                                    <span>Latitude: {previewLat.toFixed(6)}</span>
                                    <span>Longitude: {previewLng.toFixed(6)}</span>
                                  </div>
                                </div>
                                <div className="bg-white border border-border-gray p-2.5 rounded-lg space-y-1">
                                  <span className="text-[9px] font-bold text-secondary-text uppercase tracking-wider block">Target Address Reference</span>
                                  <p className="text-secondary-text leading-snug line-clamp-2">{address || 'No address specified'}</p>
                                </div>
                              </div>

                              {/* Mini map preview */}
                              <div className="relative h-28 bg-white rounded-lg overflow-hidden border border-border-gray flex items-center justify-center">
                                {/* Grid lines for cartography effect */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_14px] opacity-25" />
                                
                                {/* Circular geofence outline */}
                                <div 
                                  className="absolute rounded-full border border-light-green/40 bg-primary-green/5 animate-pulse"
                                  style={{ width: '80px', height: '80px' }}
                                />
                                <div 
                                  className="absolute rounded-full border border-emerald-500/40"
                                  style={{ width: '40px', height: '40px' }}
                                />

                                {/* Center marker */}
                                <div className="relative z-10 flex flex-col items-center">
                                  <MapPin className="h-5 w-5 text-primary-green filter drop-shadow-[0_2px_4px_rgba(4,120,87,0.5)] animate-bounce" />
                                  <div className="h-1.5 w-1.5 bg-primary-green rounded-full scale-y-50 opacity-80" />
                                </div>

                                <div className="absolute bottom-1 right-2 text-[8px] font-mono text-secondary-text bg-white/80 px-1 rounded">
                                  Scale: ~{allowedRadius || 200}m
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Geo-Verification Toggle Checkboxes */}
                      <div className="bg-white/60 border border-border-gray p-4 rounded-xl space-y-3">
                        <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-2">Geo-Verification Settings</label>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          <label className="flex items-center gap-2 text-xs text-secondary-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={geofencingEnabled}
                              onChange={(e) => setGeofencingEnabled(e.target.checked)}
                              className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4"
                            />
                            <span>Enable Geo-Fencing</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-secondary-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={requireGpsValidation}
                              onChange={(e) => setRequireGpsValidation(e.target.checked)}
                              className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4"
                            />
                            <span>Require GPS Validation</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-secondary-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={requireLivePhoto}
                              onChange={(e) => setRequireLivePhoto(e.target.checked)}
                              className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4"
                            />
                            <span>Require Live Photo</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-secondary-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={requireCheckout}
                              onChange={(e) => setRequireCheckout(e.target.checked)}
                              className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4"
                            />
                            <span>Require Check-Out</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-secondary-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allowRemoteCompletion}
                              onChange={(e) => setAllowRemoteCompletion(e.target.checked)}
                              className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4"
                            />
                            <span>Allow Remote Completion</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-slate-355 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={temporarilyClosed}
                              onChange={(e) => setTemporarilyClosed(e.target.checked)}
                              className="rounded border-border-gray text-primary-green focus:ring-light-green bg-white h-4 w-4"
                            />
                            <span className="text-secondary-text font-medium">Temporarily Closed</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Contacts & Assignment */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-primary-green flex items-center gap-1.5 uppercase tracking-wider pb-1 border-b border-border-gray">
                        <Users className="h-4 w-4" />
                        3. Contacts & Executive Assignment
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Primary POC Name</label>
                          <input
                            id="form-hosp-poc"
                            type="text"
                            value={contactPerson}
                            onChange={(e) => { setContactPerson(e.target.value); markTouched('contact_person'); }}
                            onBlur={() => markTouched('contact_person')}
                            placeholder="Dr. K. Srinivas"
                            className={getInputClass('contact_person', contactPerson)}
                          />
                          {touchedFields.contact_person && formErrors.contact_person && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.contact_person}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Primary Contact Number</label>
                          <input
                            id="form-hosp-phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); markTouched('phone'); }}
                            onBlur={() => markTouched('phone')}
                            placeholder="9876543210"
                            className={getInputClass('phone', phone)}
                          />
                          {touchedFields.phone && formErrors.phone && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.phone}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Reception Contact Number</label>
                          <input
                            id="form-hosp-reception"
                            type="tel"
                            value={receptionPhone}
                            onChange={(e) => { setReceptionPhone(e.target.value); markTouched('reception_phone'); }}
                            onBlur={() => markTouched('reception_phone')}
                            placeholder="040-27894561"
                            className={getInputClass('reception_phone', receptionPhone)}
                          />
                          {touchedFields.reception_phone && formErrors.reception_phone && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.reception_phone}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Alternate Contact Number</label>
                          <input
                            id="form-hosp-alternate"
                            type="tel"
                            value={alternatePhone}
                            onChange={(e) => { setAlternatePhone(e.target.value); markTouched('alternate_phone'); }}
                            onBlur={() => markTouched('alternate_phone')}
                            placeholder="9876543211"
                            className={getInputClass('alternate_phone', alternatePhone)}
                          />
                          {touchedFields.alternate_phone && formErrors.alternate_phone && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.alternate_phone}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Email Address</label>
                          <input
                            id="form-hosp-email"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); markTouched('email'); }}
                            onBlur={() => markTouched('email')}
                            placeholder="contact@apexheartclinic.com"
                            className={getInputClass('email', email)}
                          />
                          {touchedFields.email && formErrors.email && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.email}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Department</label>
                          <input
                            id="form-hosp-department"
                            type="text"
                            value={department}
                            onChange={(e) => { setDepartment(e.target.value); markTouched('department'); }}
                            onBlur={() => markTouched('department')}
                            placeholder="Cardiology"
                            className={getInputClass('department', department)}
                          />
                          {touchedFields.department && formErrors.department && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.department}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Hospital Admin Name</label>
                          <input
                            id="form-hosp-admin"
                            type="text"
                            value={hospitalAdminName}
                            onChange={(e) => { setHospitalAdminName(e.target.value); markTouched('hospital_admin_name'); }}
                            onBlur={() => markTouched('hospital_admin_name')}
                            placeholder="M. R. Prasad"
                            className={getInputClass('hospital_admin_name', hospitalAdminName)}
                          />
                          {touchedFields.hospital_admin_name && formErrors.hospital_admin_name && (
                            <p className="text-[10px] text-alert-text mt-1 font-semibold">{formErrors.hospital_admin_name}</p>
                          )}
                        </div>

                        <div className="relative min-w-0 max-w-full">
                          <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Assigned Executives *</label>
                          
                          {/* Dropdown Button */}
                          <div
                            id="form-hosp-executives-select"
                            onClick={() => setIsExecDropdownOpen(!isExecDropdownOpen)}
                            className="w-full bg-white border border-border-gray focus-within:border-emerald-500 rounded-xl py-2 px-3 text-xs text-primary-text outline-none flex items-center justify-between cursor-pointer min-h-[38px]"
                          >
                            <div className="flex flex-wrap gap-1">
                              {selectedExecIds.length === 0 ? (
                                <span className="text-secondary-text">Select Executives...</span>
                              ) : (
                                selectedExecIds.map(id => {
                                  const exec = executives.find(e => e.id === id);
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1 bg-very-light-green text-primary-green border border-light-green/40 px-2 py-0.5 rounded text-[10px] font-semibold">
                                      {exec ? exec.name : `User #${id}`}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedExecIds(prev => prev.filter(x => x !== id));
                                        }}
                                        className="hover:text-alert-text cursor-pointer"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  );
                                })
                              )}
                            </div>
                            <span className="text-secondary-text">▼</span>
                          </div>

                          {/* Dropdown Options */}
                          {isExecDropdownOpen && (
                            <div className="absolute z-20 left-0 right-0 w-full max-w-full min-w-0 mt-1 bg-white border border-border-gray rounded-xl shadow-xl p-2.5 space-y-2">
                              <input
                                type="text"
                                placeholder="Search executives..."
                                value={execSearchQuery}
                                onChange={(e) => setExecSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-white border border-border-gray focus:border-primary-green rounded-lg py-1.5 px-2.5 text-xs text-primary-text outline-none"
                              />
                              <div className="max-h-36 overflow-y-auto space-y-1">
                                {executives
                                  .filter(exec => exec.name.toLowerCase().includes(execSearchQuery.toLowerCase()))
                                  .map(exec => {
                                    const isSelected = selectedExecIds.includes(exec.id);
                                    return (
                                      <div
                                        key={exec.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isSelected) {
                                            setSelectedExecIds(prev => prev.filter(id => id !== exec.id));
                                          } else {
                                            setSelectedExecIds(prev => [...prev, exec.id]);
                                          }
                                        }}
                                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer ${
                                          isSelected ? 'bg-very-light-green text-primary-green font-semibold' : 'text-secondary-text hover:bg-white'
                                        }`}
                                      >
                                        <span>{exec.name} ({exec.email})</span>
                                        {isSelected && <Check className="h-4 w-4 text-primary-green" />}
                                      </div>
                                    );
                                  })}
                                {executives.length === 0 && (
                                  <p className="text-[10px] text-secondary-text p-2">No active executives found.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="p-6 border-t border-border-gray bg-white/50 flex items-center justify-end gap-2.5 shrink-0">
                    <button
                      id="btn-cancel-hosp"
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-hosp"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                    >
                      {submitLoading ? 'Saving...' : 'Save Branch'}
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
