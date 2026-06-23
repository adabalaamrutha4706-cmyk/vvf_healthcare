'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api, BACKEND_URL } from '../../lib/api';
import { 
  MapPin, Camera, Play, CheckCircle2, ShieldAlert, Sparkles, X, 
  Clock, Check, Building, FileText, Map as MapIcon, Image as ImageIcon, Eye,
  ChevronRight, WifiOff, AlertTriangle, ShieldCheck, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectField } from '../../components/SelectField';

export function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    const updateTimer = () => {
      const total = Date.parse(expiresAt) - Date.now();
      if (total <= 0) {
        setTimeLeft('Expired');
        setUrgency('critical');
        return;
      }
      const seconds = Math.floor((total / 1000) % 60);
      const minutes = Math.floor((total / 1000 / 60) % 60);
      const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
      
      let displayStr = '';
      if (hours > 0) displayStr += `${hours}h `;
      if (minutes > 0 || hours > 0) displayStr += `${minutes}m `;
      displayStr += `${seconds}s`;

      setTimeLeft(displayStr);

      const totalHours = total / (1000 * 60 * 60);
      if (totalHours <= 2) {
        setUrgency('critical');
      } else if (totalHours <= 6) {
        setUrgency('warning');
      } else {
        setUrgency('normal');
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [expiresAt]);

  const colors = {
    normal: 'text-primary-green bg-very-light-green border-light-green/40',
    warning: 'text-slate-500 bg-secondary-bg/40 border-border-gray animate-pulse',
    critical: 'text-alert-text bg-alert-bg/40 border-alert-border animate-pulse font-bold'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${colors[urgency]}`}>
      ⏳ {timeLeft}
    </span>
  );
}

function VisitsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || 'field';
  const visitType = typeParam === 'dental' ? 'Dental Visit' : 'Field Visit';

  const [executiveSearch, setExecutiveSearch] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // Lists
  const [visits, setVisits] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  
  // States
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Active visit status (for current logged in Executive)
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const executiveActiveVisits = user?.role === 'Executive'
    ? visits.filter((v: any) => v.executive_id === user.id && ['Checked In', 'Partially Completed', 'Pending Evidence', 'In Progress'].includes(v.status))
    : [];

  const filteredVisits = visits.filter((v: any) => {
    // 1. Status Filter
    if (statusFilter !== 'All') {
      if (statusFilter === 'Checked In') {
        if (v.status !== 'Checked In' && v.status !== 'In Progress') return false;
      } else {
        if (v.status !== statusFilter) return false;
      }
    }
    // 2. Executive Name Search (case-insensitive)
    if (executiveSearch.trim() !== '') {
      const execName = (v.executive_name || '').toLowerCase();
      if (!execName.includes(executiveSearch.toLowerCase().trim())) return false;
    }
    // 3. Date Range Filter
    if (v.start_time) {
      const visitDate = new Date(v.start_time);
      if (startDateFilter) {
        const start = new Date(startDateFilter);
        start.setHours(0, 0, 0, 0);
        if (visitDate < start) return false;
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter);
        end.setHours(23, 59, 59, 999);
        if (visitDate > end) return false;
      }
    }
    return true;
  });
  
  // Form Dialogs
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [selectedVisitDetails, setSelectedVisitDetails] = useState<any | null>(null);
  
  // Field values
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('vvf_selected_hospital_id') || '';
    }
    return '';
  });
  const [isHospDropdownOpen, setIsHospDropdownOpen] = useState(false);
  const [hospSearchQuery, setHospSearchQuery] = useState('');
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [gpsUpdateCount, setGpsUpdateCount] = useState(0);
  const [gpsStabilized, setGpsStabilized] = useState(false);
  const [gpsTimestamp, setGpsTimestamp] = useState('');
  const [gpsPermissionStatus, setGpsPermissionStatus] = useState<string>('Prompt');
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Admin Diagnostics Sandbox states
  const [adminSelectedHospitalId, setAdminSelectedHospitalId] = useState('');
  const [adminLat, setAdminLat] = useState<number | null>(null);
  const [adminLng, setAdminLng] = useState<number | null>(null);
  const [adminAccuracy, setAdminAccuracy] = useState<number | null>(null);
  const [adminGpsTimestamp, setAdminGpsTimestamp] = useState('');
  const [adminGpsUpdateCount, setAdminGpsUpdateCount] = useState(0);
  const [adminGpsStabilized, setAdminGpsStabilized] = useState(false);
  const [isAdminTestingLocation, setIsAdminTestingLocation] = useState(false);
  const [isAdminSandboxExpanded, setIsAdminSandboxExpanded] = useState(false);
  const [visitSummary, setVisitSummary] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Offline support states (Enhancement 5)
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const hospMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Admin diagnostics map refs
  const adminMapRef = useRef<any>(null);
  const adminUserMarkerRef = useRef<any>(null);
  const adminHospMarkerRef = useRef<any>(null);
  const adminPolylineRef = useRef<any>(null);

  const [gpsFetching, setGpsFetching] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');

  // Camera & Note Section states
  const [noteText, setNoteText] = useState('');
  const [capturedPhotos, setCapturedPhotos] = useState<{ blob: Blob; preview: string; lat: number; lng: number; capturedAt: string }[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [lightboxPhotoUrl, setLightboxPhotoUrl] = useState<string | null>(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [cameraGps, setCameraGps] = useState<{ lat: number; lng: number } | null>(null);
  const [cameraGpsLoading, setCameraGpsLoading] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    setCameraGpsLoading(true);
    let lat = currentLat || 0;
    let lng = currentLng || 0;
    try {
      const loc = await fetchCurrentLocation(1);
      lat = loc.lat;
      lng = loc.lng;
      setCameraGps({ lat, lng });
    } catch (e) {
      console.warn("Could not fetch GPS for camera watermark, falling back to cached:", e);
      if (currentLat !== null && currentLng !== null) {
        setCameraGps({ lat: currentLat, lng: currentLng });
      } else {
        setCameraGps({ lat: 17.3850, lng: 78.4860 });
      }
    } finally {
      setCameraGpsLoading(false);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('getUserMedia error:', err);
      setError('Failed to access camera: ' + (err.message || 'Unknown error'));
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraGps(null);
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraOpen]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const lat = cameraGps?.lat ?? currentLat ?? 0;
    const lng = cameraGps?.lng ?? currentLng ?? 0;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    ctx.save();
    const fontSize = Math.max(12, Math.round(canvas.height * 0.035));
    ctx.font = `bold ${fontSize}px monospace`;

    const lines = [
      `DATE: ${formattedDate}`,
      `TIME: ${formattedTime}`,
      `LAT: ${lat.toFixed(6)}`,
      `LNG: ${lng.toFixed(6)}`
    ];

    let maxTextWidth = 0;
    lines.forEach(line => {
      const width = ctx.measureText(line).width;
      if (width > maxTextWidth) maxTextWidth = width;
    });

    const padding = Math.round(fontSize * 0.6);
    const boxWidth = maxTextWidth + padding * 2;
    const boxHeight = lines.length * (fontSize + 6) + padding * 1.5;

    const x = 15;
    const y = canvas.height - boxHeight - 15;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x, y, boxWidth, boxHeight);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => {
      ctx.fillText(line, x + padding, y + padding + index * (fontSize + 6));
    });

    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPhotos(prev => [...prev, {
          blob,
          preview: previewUrl,
          lat,
          lng,
          capturedAt: now.toISOString()
        }]);
      }
    }, 'image/jpeg', 0.85);

    stopCamera();
  };

  const handleSaveNotesAndPhotos = async () => {
    const targetVisit = isNotesModalOpen ? activeVisit : selectedVisitDetails;
    if (!targetVisit) return;
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const visitId = targetVisit.id;

      // 1. Upload captured photos sequentially
      for (const photo of capturedPhotos) {
        const formData = new FormData();
        const file = new File([photo.blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        formData.append('photo', file);
        formData.append('gps_lat', photo.lat.toString());
        formData.append('gps_lng', photo.lng.toString());
        formData.append('gps_accuracy', '10');
        formData.append('city', '');
        formData.append('state', '');
        formData.append('captured_at', photo.capturedAt);

        await api.visits.uploadPhoto(visitId, formData);
      }

      // 2. Save note
      await api.visits.updateNotes(visitId, {
        notes: noteText,
        summary: targetVisit.summary || 'Updated via Notes Panel'
      });

      setSuccess('Notes and attached photos saved successfully.');
      setNoteText('');
      setCapturedPhotos([]);
      
      await fetchData();

      const updatedRes = await api.visits.getById(visitId);
      if (updatedRes && updatedRes.visit) {
        if (selectedVisitDetails && selectedVisitDetails.id === visitId) {
          setSelectedVisitDetails(updatedRes.visit);
        }
        if (activeVisit && activeVisit.id === visitId) {
          setActiveVisit(updatedRes.visit);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save notes and photos.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Reset note states when selected visit details changes
  useEffect(() => {
    if (selectedVisitDetails) {
      setNoteText(selectedVisitDetails.notes || '');
      setCapturedPhotos([]);
    }
  }, [selectedVisitDetails]);

  const formatCaptureDateTime = (capturedAtStr: string) => {
    const d = new Date(capturedAtStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    
    return {
      date: `${day}/${month}/${year}`,
      time: formattedTime
    };
  };

  const formatDistance = (meters: number | null | undefined, isFailed: boolean) => {
    if (meters === undefined || meters === null) return '';
    const label = isFailed ? 'Rejected' : 'Verified';
    const distanceStr = meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
    return `${label} - ${distanceStr} away`;
  };

  const getDistanceInMetersClient = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Radius of the earth in m
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in m
  };

  const isHospitalCoordsValid = (h: any): boolean => {
    if (!h) return false;
    const lat = Number(h.latitude);
    const lng = Number(h.longitude);
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
  };

  // Load Geolocation permission and Leaflet CDN scripts on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (navigator.permissions && navigator.permissions.query) {
      const queryPermission = async () => {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          const mapStatus = (state: string) => {
            if (state === 'granted') return 'Granted';
            if (state === 'denied') return 'Denied';
            return 'Prompt';
          };
          setGpsPermissionStatus(mapStatus(status.state));
          status.onchange = () => {
            setGpsPermissionStatus(mapStatus(status.state));
          };
        } catch (e) {
          console.error('Error querying geolocation permissions:', e);
        }
      };
      queryPermission();
    }

    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Load offline queue on mount
  useEffect(() => {
    const stored = localStorage.getItem('vvf_offline_photos');
    if (stored) {
      try {
        setOfflineQueue(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Real-time GPS diagnostics coordinates & Stabilization tracking
  useEffect(() => {
    if (!isStartOpen) {
      setCurrentLat(null);
      setCurrentLng(null);
      setCurrentAccuracy(null);
      setGpsTimestamp('');
      setGpsUpdateCount(0);
      setGpsStabilized(false);
      return;
    }

    setGpsUpdateCount(0);
    setGpsStabilized(false);

    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const handleGpsUpdate = (pos: GeolocationPosition) => {
      setCurrentLat(pos.coords.latitude);
      setCurrentLng(pos.coords.longitude);
      setCurrentAccuracy(pos.coords.accuracy);
      setGpsTimestamp(new Date(pos.timestamp).toLocaleTimeString());
      
      setGpsUpdateCount(prev => {
        const nextCount = prev + 1;
        if (nextCount >= 3 || pos.coords.accuracy < 30) {
          setGpsStabilized(true);
        }
        return nextCount;
      });
    };

    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        handleGpsUpdate(pos);
      },
      (err) => {
        console.error('Real-time diagnostics GPS error:', err);
        setGpsStatus('GPS error: ' + err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );

    // Active polling fallback to force ticks for stationary users
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleGpsUpdate(pos);
        },
        (err) => {
          console.warn('getCurrentPosition tick fallback error:', err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }, 3000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [isStartOpen]);

  // Check-In Geofence Map Renderer (Leaflet)
  useEffect(() => {
    if (!isStartOpen) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      userMarkerRef.current = null;
      hospMarkerRef.current = null;
      polylineRef.current = null;
      return;
    }

    if (!leafletLoaded || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    const timer = setTimeout(() => {
      const mapContainer = document.getElementById('checkin-map');
      if (!mapContainer) return;

      if (!mapRef.current) {
        mapRef.current = L.map('checkin-map', { zoomControl: false }).setView([17.3850, 78.4860], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapRef.current);
        L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      map.invalidateSize();

      if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
      if (hospMarkerRef.current) map.removeLayer(hospMarkerRef.current);
      if (polylineRef.current) map.removeLayer(polylineRef.current);

      const points: any[] = [];

      if (selectedHosp && isHospitalCoordsValid(selectedHosp)) {
        const hospLat = Number(selectedHosp.latitude);
        const hospLng = Number(selectedHosp.longitude);
        hospMarkerRef.current = L.marker([hospLat, hospLng], {
          icon: L.divIcon({
            className: 'custom-hosp-marker',
            html: `<div class="bg-red-500 text-white rounded-full p-1.5 border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs" style="width: 28px; height: 28px;">🏥</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(map).bindPopup(`<b>${selectedHosp.name}</b><br/>Target Hospital`);
        points.push([hospLat, hospLng]);
      }

      if (currentLat !== null && currentLng !== null) {
        userMarkerRef.current = L.marker([currentLat, currentLng], {
          icon: L.divIcon({
            className: 'custom-user-marker',
            html: `<div class="bg-[#059669] text-white rounded-full p-1.5 border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs animate-pulse" style="width: 28px; height: 28px;">📍</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(map).bindPopup(`<b>Your Location</b><br/>Accuracy: ${Math.round(currentAccuracy || 0)}m`);
        points.push([currentLat, currentLng]);
      }

      if (points.length === 2) {
        polylineRef.current = L.polyline(points, {
          color: '#10b981',
          dashArray: '5, 5',
          weight: 3
        }).addTo(map);

        map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
      } else if (points.length === 1) {
        map.setView(points[0], 16);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [leafletLoaded, currentLat, currentLng, selectedHospitalId, isStartOpen]);

  // Admin Diagnostics Map Renderer (Leaflet)
  useEffect(() => {
    if (!isAdminTestingLocation || !isAdminSandboxExpanded) {
      if (adminMapRef.current) {
        adminMapRef.current.remove();
        adminMapRef.current = null;
      }
      adminUserMarkerRef.current = null;
      adminHospMarkerRef.current = null;
      adminPolylineRef.current = null;
      return;
    }

    if (!leafletLoaded || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    const timer = setTimeout(() => {
      const mapContainer = document.getElementById('admin-diagnostics-map');
      if (!mapContainer) return;

      if (!adminMapRef.current) {
        adminMapRef.current = L.map('admin-diagnostics-map', { zoomControl: false }).setView([17.3850, 78.4860], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(adminMapRef.current);
        L.control.zoom({ position: 'bottomright' }).addTo(adminMapRef.current);
      }

      const map = adminMapRef.current;
      map.invalidateSize();

      if (adminUserMarkerRef.current) map.removeLayer(adminUserMarkerRef.current);
      if (adminHospMarkerRef.current) map.removeLayer(adminHospMarkerRef.current);
      if (adminPolylineRef.current) map.removeLayer(adminPolylineRef.current);

      const points: any[] = [];

      const adminSelectedHosp = hospitals.find(h => String(h.id) === String(adminSelectedHospitalId));

      if (adminSelectedHosp && isHospitalCoordsValid(adminSelectedHosp)) {
        const hospLat = Number(adminSelectedHosp.latitude);
        const hospLng = Number(adminSelectedHosp.longitude);
        adminHospMarkerRef.current = L.marker([hospLat, hospLng], {
          icon: L.divIcon({
            className: 'custom-hosp-marker',
            html: `<div class="bg-red-500 text-white rounded-full p-1.5 border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs" style="width: 28px; height: 28px;">🏥</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(map).bindPopup(`<b>${adminSelectedHosp.name}</b><br/>Target Hospital`);
        points.push([hospLat, hospLng]);
      }

      if (adminLat !== null && adminLng !== null) {
        adminUserMarkerRef.current = L.marker([adminLat, adminLng], {
          icon: L.divIcon({
            className: 'custom-user-marker',
            html: `<div class="bg-[#059669] text-white rounded-full p-1.5 border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs animate-pulse" style="width: 28px; height: 28px;">📍</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(map).bindPopup(`<b>Admin/Your Location</b><br/>Accuracy: ${Math.round(adminAccuracy || 0)}m`);
        points.push([adminLat, adminLng]);
      }

      if (points.length === 2) {
        adminPolylineRef.current = L.polyline(points, {
          color: '#10b981',
          dashArray: '5, 5',
          weight: 3
        }).addTo(map);

        map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
      } else if (points.length === 1) {
        map.setView(points[0], 16);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [leafletLoaded, adminLat, adminLng, adminSelectedHospitalId, isAdminTestingLocation, isAdminSandboxExpanded]);

  // Admin Diagnostics Location Watcher
  useEffect(() => {
    if (!isAdminTestingLocation) {
      setAdminLat(null);
      setAdminLng(null);
      setAdminAccuracy(null);
      setAdminGpsTimestamp('');
      setAdminGpsUpdateCount(0);
      setAdminGpsStabilized(false);
      return;
    }

    setAdminGpsUpdateCount(0);
    setAdminGpsStabilized(false);

    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setAdminLat(pos.coords.latitude);
        setAdminLng(pos.coords.longitude);
        setAdminAccuracy(pos.coords.accuracy);
        setAdminGpsTimestamp(new Date(pos.timestamp).toLocaleTimeString());
        
        setAdminGpsUpdateCount(prev => {
          const nextCount = prev + 1;
          if (nextCount >= 3 || pos.coords.accuracy < 30) {
            setAdminGpsStabilized(true);
          }
          return nextCount;
        });
      },
      (err) => {
        console.error('Admin diagnostics GPS error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isAdminTestingLocation]);

  // Sync offline queue helper
  const syncOfflineQueue = async (queueToSync = offlineQueue) => {
    if (!navigator.onLine || queueToSync.length === 0) return;
    
    console.log('Online status detected. Syncing offline photos:', queueToSync.length);
    const remaining = [...queueToSync];
    let successCount = 0;

    for (let i = 0; i < queueToSync.length; i++) {
      const item = queueToSync[i];
      try {
        const res = await fetch(item.fileBase64);
        const blob = await res.blob();
        const file = new File([blob], `offline-${item.timestamp}.jpg`, { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('gps_lat', item.gps_lat.toString());
        formData.append('gps_lng', item.gps_lng.toString());
        formData.append('city', item.city);
        formData.append('state', item.state);
        formData.append('captured_at', item.timestamp);
        
        await api.visits.uploadPhoto(item.visitId, formData);
        
        remaining.shift();
        successCount++;
      } catch (err) {
        console.error('Failed to sync offline photo:', err);
        break; // Stop and retry later if network failed again
      }
    }

    localStorage.setItem('vvf_offline_photos', JSON.stringify(remaining));
    setOfflineQueue(remaining);
    
    if (successCount > 0) {
      setSuccess(`Synced ${successCount} offline photo(s) successfully!`);
      fetchData();
    }
  };

  // Add listener for network status changes
  useEffect(() => {
    const handleOnline = () => {
      const stored = localStorage.getItem('vvf_offline_photos');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.length > 0) {
            syncOfflineQueue(parsed);
          }
        } catch (e) {}
      }
    };
    
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [offlineQueue]);


  async function fetchData(isSilent = false) {
    if (!isSilent) {
      setLoading(true);
      setError('');
    }
    try {
      const typeParam = searchParams.get('type') || 'field';
      const vRes = await api.visits.getAll({ type: typeParam });
      const allVisits = vRes.visits || [];

      // Update visits using smart diffing to preserve card expansions, identities, and prevent re-renders
      setVisits(prevVisits => {
        const prevMap = new Map(prevVisits.map(v => [v.id, v]));
        let hasChanges = false;
        const nextVisits = allVisits.map((v: any) => {
          const prev = prevMap.get(v.id);
          if (!prev) {
            hasChanges = true;
            return v;
          }
          // Compare relevant fields
          const keys = ['status', 'notes', 'checkout_time', 'summary', 'geo_verification_status', 'distance_from_hospital_meters', 'updated_at', 'photos'];
          const isChanged = keys.some(key => {
            if (key === 'photos') {
              return (prev.photos?.length !== v.photos?.length);
            }
            return prev[key] !== v[key];
          });
          if (isChanged) {
            hasChanges = true;
            return v;
          }
          return prev;
        });
        if (prevVisits.length !== allVisits.length) {
          hasChanges = true;
        }
        return hasChanges ? nextVisits : prevVisits;
      });

      // Update selectedVisitDetails in-place if it changed
      if (selectedVisitDetails) {
        const freshSelected = allVisits.find((v: any) => v.id === selectedVisitDetails.id);
        if (freshSelected) {
          const keys = ['status', 'notes', 'checkout_time', 'summary', 'geo_verification_status', 'distance_from_hospital_meters', 'updated_at', 'photos'];
          const isChanged = keys.some(key => {
            if (key === 'photos') {
              return (selectedVisitDetails.photos?.length !== freshSelected.photos?.length);
            }
            return selectedVisitDetails[key] !== freshSelected[key];
          });
          if (isChanged) {
            setSelectedVisitDetails(freshSelected);
          }
        }
      }

      // Update activeVisit in-place if it changed
      if (activeVisit) {
        const freshActive = allVisits.find((v: any) => v.id === activeVisit.id);
        if (freshActive) {
          const keys = ['status', 'notes', 'checkout_time', 'summary', 'geo_verification_status', 'distance_from_hospital_meters', 'updated_at', 'photos'];
          const isChanged = keys.some(key => {
            if (key === 'photos') {
              return (activeVisit.photos?.length !== freshActive.photos?.length);
            }
            return activeVisit[key] !== freshActive[key];
          });
          if (isChanged) {
            setActiveVisit(freshActive);
          }
        }
      }

      const hRes = await api.hospitals.getAll();
      const uniqueHospitals: any[] = [];
      const seenHospIds = new Set();
      (hRes.hospitals || []).forEach((h: any) => {
        if (!seenHospIds.has(h.id)) {
          seenHospIds.add(h.id);
          uniqueHospitals.push(h);
        }
      });
      const activeHospitals = uniqueHospitals.filter((h: any) => h.status === 'Active');
      
      // Sort active hospitals by VVF UID suffix numerically in ascending order
      activeHospitals.sort((a: any, b: any) => {
        const getNum = (uid: string) => {
          if (!uid || !uid.startsWith('VVF-')) return 999999;
          const num = parseInt(uid.replace('VVF-', ''), 10);
          return isNaN(num) ? 999999 : num;
        };
        return getNum(a.hospital_uid) - getNum(b.hospital_uid);
      });

      setHospitals(prevHospitals => {
        const prevMap = new Map(prevHospitals.map(h => [h.id, h]));
        let hasChanges = false;
        const nextHospitals = activeHospitals.map((h: any) => {
          const prev = prevMap.get(h.id);
          if (!prev) {
            hasChanges = true;
            return h;
          }
          const keys = ['name', 'status', 'allowed_radius', 'latitude', 'longitude'];
          const isChanged = keys.some(key => prev[key] !== h[key]);
          if (isChanged) {
            hasChanges = true;
            return h;
          }
          return prev;
        });
        if (prevHospitals.length !== activeHospitals.length) {
          hasChanges = true;
        }
        return hasChanges ? nextHospitals : prevHospitals;
      });
    } catch (e: any) {
      if (!isSilent) {
        setError(e.message || 'Failed to load executive field records.');
      } else {
        console.warn('Silent background refresh failed:', e);
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }

  // Get current device GPS and reverse lookup details with 3x retry & high accuracy
  const fetchCurrentLocation = (
    attempt = 1,
    bestPos: GeolocationPosition | null = null
  ): Promise<{
    lat: number;
    lng: number;
    accuracy: number;
    is_mock_location: boolean;
    city: string;
    state: string;
  }> => {
    return new Promise((resolve, reject) => {
      setGpsFetching(true);
      setGpsStatus('Fetching GPS...');

      if (typeof window === 'undefined' || !navigator.geolocation) {
        setGpsFetching(false);
        setGpsStatus('');
        reject(new Error('Geolocation not supported by this browser.'));
        return;
      }

      let watchId: number;
      let samplesCount = 0;
      let currentBest: GeolocationPosition | null = bestPos;
      
      const clearAndFinish = (posToResolve: GeolocationPosition | null, errorMsg?: string) => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        
        if (posToResolve) {
          const lat = posToResolve.coords.latitude;
          const lng = posToResolve.coords.longitude;
          const accuracy = posToResolve.coords.accuracy;
          const is_mock_location = !!(posToResolve as any).mocked || !!(posToResolve.coords as any).mocked;
          
          if (accuracy <= 3000) {
            setGpsFetching(false);
            setGpsStatus('GPS locked successfully');
            setTimeout(() => setGpsStatus(''), 3000);
            resolve({
              lat,
              lng,
              accuracy,
              is_mock_location,
              city: '',
              state: ''
            });
          } else {
            handleRetry(posToResolve);
          }
        } else {
          setGpsFetching(false);
          setGpsStatus(errorMsg || 'Weak GPS signal detected');
          reject(new Error(errorMsg || 'Unable to fetch precise location.'));
        }
      };

      const handleRetry = (lastKnownPos: GeolocationPosition | null) => {
        if (attempt < 4) {
          setGpsStatus(`Weak GPS signal detected (${Math.round(lastKnownPos?.coords.accuracy || 120)}m). Retrying in 2s (Attempt ${attempt + 1}/4)...`);
          setTimeout(() => {
            resolve(fetchCurrentLocation(attempt + 1, lastKnownPos));
          }, 2000);
        } else {
          setGpsFetching(false);
          setGpsStatus('Weak GPS signal detected');
          reject(new Error('GPS accuracy is too low (>3000m). Please move outdoors or to an open area and try again.'));
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          samplesCount++;
          const accuracy = pos.coords.accuracy;
          
          setGpsStatus(`Improving location accuracy: ${Math.round(accuracy)}m (Reading ${samplesCount}/5)...`);

          if (!currentBest || accuracy < currentBest.coords.accuracy) {
            currentBest = pos;
          }

          if (accuracy <= 20) {
            clearAndFinish(currentBest);
          } else if (samplesCount >= 5) {
            clearAndFinish(currentBest);
          }
        },
        (error) => {
          console.error('watchPosition GPS error:', error);
          if (currentBest) {
            clearAndFinish(currentBest);
          } else if (attempt < 4) {
            handleRetry(null);
          } else {
            clearAndFinish(null, 'Precise GPS signal not locked. Please enable location permissions.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        }
      );

      setTimeout(() => {
        if (samplesCount > 0 && currentBest) {
          clearAndFinish(currentBest);
        }
      }, 8000);
    });
  };

  const handleOpenStart = () => {
    setError('');
    setSuccess('');
    setImageFile(null);
    setImagePreview(null);
    setHospSearchQuery('');
    setIsHospDropdownOpen(false);
    setIsStartOpen(true);
  };

  const handleSelectHospital = (id: string) => {
    setSelectedHospitalId(id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('vvf_selected_hospital_id', id);
    }
    setIsHospDropdownOpen(false);
  };

  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId) {
      setError('Please select a hospital before checking in.');
      return;
    }
    if (currentLat === null || currentLng === null) {
      setError('Waiting for GPS lock. Please wait until coordinates are resolved.');
      return;
    }
    if (!selectedHosp || !isHospitalCoordsValid(selectedHosp)) {
      setError('Selected hospital has invalid coordinates. Please contact an administrator.');
      return;
    }
    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const allowedRadius = selectedHosp.allowed_radius !== null && selectedHosp.allowed_radius !== undefined ? selectedHosp.allowed_radius : 200;

      // Developer Tools Debug Logging
      console.log('[GPS_CHECKIN_FRONTEND_DEBUG] Check-in attempt:', {
        selected_hospital_uid: selectedHosp.hospital_uid,
        hospital_coordinates: { latitude: Number(selectedHosp.latitude), longitude: Number(selectedHosp.longitude) },
        user_coordinates: { latitude: currentLat, longitude: currentLng },
        gps_accuracy: currentAccuracy,
        gps_timestamp: gpsTimestamp,
        calculated_distance: clientDistance,
        geofence_radius: allowedRadius,
        validation_result: (clientDistance !== null && clientDistance <= allowedRadius) ? 'PASSED' : 'FAILED_GEOFENCE'
      });

      // build FormData for multipart upload
      const formData = new FormData();
      formData.append('visit_type', visitType);
      formData.append('hospital_id', selectedHospitalId);
      formData.append('gps_lat', currentLat.toString());
      formData.append('gps_lng', currentLng.toString());
      formData.append('gps_accuracy', (currentAccuracy || 10).toString());
      formData.append('device_info', navigator.userAgent);
      formData.append('is_mock_location', 'false');
      formData.append('city', '');
      formData.append('state', '');
      formData.append('captured_at', new Date().toISOString());

      const res = await api.visits.start(formData);
      setSuccess(`Visit checked in successfully. Distance to hospital: ${Math.round(res.visit.distance_from_hospital_meters || 0)}m.`);
      setIsStartOpen(false);

      // Reset selected hospital on success
      setSelectedHospitalId('');
      setImageFile(null);
      setImagePreview(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('vvf_selected_hospital_id');
      }

      fetchData();
    } catch (err: any) {
      if (err.message === 'LOCATION_PERMISSION_DENIED') {
        setError('Location permission is blocked. Please enable location permissions for this website in your browser settings (click the lock icon in the address bar, then toggle Location to "Allow") and refresh.');
      } else {
        setError(err.message || 'Check-in failed. Please ensure location services are enabled, move outdoors or near a window for a stronger GPS signal, and try again.');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenPhoto = (vis: any) => {
    setError('');
    setSuccess('');
    setImageFile(null);
    setImagePreview(null);
    setActiveVisit(vis);
    setIsPhotoOpen(true);
  };

  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !activeVisit) return;
    
    setSubmitLoading(true);
    setError('');
    
    try {
      const loc = await fetchCurrentLocation();
      
      const formData = new FormData();
      formData.append('photo', imageFile);
      formData.append('gps_lat', loc.lat.toString());
      formData.append('gps_lng', loc.lng.toString());
      formData.append('gps_accuracy', loc.accuracy.toString());
      formData.append('city', loc.city);
      formData.append('state', loc.state);
      formData.append('captured_at', new Date().toISOString());

      const res = await api.visits.uploadPhoto(activeVisit.id, formData);
      
      let msg = 'Audit photo logged successfully.';
      if (res.warning) {
        msg += ` Warning: ${res.warning}`;
      } else if (res.distance_from_hospital_meters !== null && res.distance_from_hospital_meters !== undefined) {
        msg += ` Verified within geofence (distance: ${Math.round(res.distance_from_hospital_meters)}m).`;
      }
      
      setSuccess(msg);
      setIsPhotoOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.message === 'LOCATION_PERMISSION_DENIED') {
        setError('Location permission is blocked. Please enable location permissions for this website in your browser settings (click the lock icon in the address bar, then toggle Location to "Allow") and refresh.');
      } else {
        setError(err.message || 'Photo upload failed. Please ensure location services are enabled, move outdoors or near a window for a stronger GPS signal, and try again.');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEnd = (vis: any) => {
    setError('');
    setSuccess('');
    setVisitSummary(vis.summary || '');
    setVisitNotes(vis.notes || '');
    setImageFile(null);
    setImagePreview(null);
    setActiveVisit(vis);
    setIsEndOpen(true);
  };

  const handleOpenNotesModal = (vis: any) => {
    setError('');
    setSuccess('');
    setNoteText(vis.notes || '');
    setCapturedPhotos([]);
    setActiveVisit(vis);
    setIsNotesModalOpen(true);
  };

  const handleEndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisit) return;

    const existingNotes = activeVisit.notes || '';
    if (!existingNotes.trim() && !visitNotes.trim()) {
      setError('At least one detailed visit note/observation must be submitted before completing this visit.');
      return;
    }

    setSubmitLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (imageFile) {
        formData.append('photo', imageFile);
      }
      formData.append('summary', visitSummary);
      formData.append('notes', visitNotes);
      formData.append('submission_started_at', new Date().toISOString());

      await api.visits.complete(activeVisit.id, formData);
      setSuccess('Visit completion form submitted successfully.');
      setIsEndOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Visit completion process failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelVisit = async (visitId: number) => {
    if (!window.confirm('Are you sure you want to discard/cancel this active check-in? All captured evidence for this visit session will be discarded.')) return;
    
    setSubmitLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.visits.cancel(visitId);
      setSuccess('Active visit has been successfully discarded.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to discard the visit.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCheckOut = async (vis: any) => {
    setSubmitLoading(true);
    setError('');
    setSuccess('');
    try {
      let loc: any = { lat: null, lng: null, accuracy: null, city: '', state: '' };
      try {
        loc = await fetchCurrentLocation();
      } catch (gpsErr: any) {
        console.warn('Checkout GPS capture failed/bypassed:', gpsErr);
      }
      
      const formData = new FormData();
      if (loc.lat !== null) {
        formData.append('checkout_latitude', loc.lat.toString());
        formData.append('checkout_longitude', loc.lng.toString());
        formData.append('checkout_accuracy', loc.accuracy.toString());
      }
      formData.append('summary', 'Checked Out');
      formData.append('notes', 'Checked Out');
      formData.append('submission_started_at', new Date().toISOString());

      await api.visits.complete(vis.id, formData);
      setSuccess('Checked out and visit completed successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Check-out process failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleVerify = async (visitId: number) => {
    if (!window.confirm('Mark this visit activity as Verified? This confirms GPS location and uploads matches.')) return;
    try {
      await api.visits.verify(visitId);
      setSuccess('Visit checklist verified by Admin.');
      fetchData();
      if (selectedVisitDetails?.id === visitId) {
        setSelectedVisitDetails((prev: any) => prev ? { ...prev, status: 'Verified' } : null);
      }
    } catch (e: any) {
      setError(e.message || 'Verification command rejected.');
    }
  };

  const handleReopen = async (visitId: number) => {
    if (!window.confirm('Are you sure you want to reopen this visit? This will reset the 24-hour expiration timer and set status to active.')) return;
    setSubmitLoading(true);
    try {
      const res = await api.visits.reopen(visitId);
      setSuccess('Visit has been reopened successfully.');
      fetchData();
      if (selectedVisitDetails?.id === visitId) {
        setSelectedVisitDetails(res.visit || res);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to reopen visit.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const viewVisitTimelineDetails = (visit: any) => {
    setSelectedVisitDetails(visit);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    // Auto-polling every 10 seconds for real-time monitoring (Section 5)
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [user, searchParams]);



  const selectedHosp = hospitals.find(h => String(h.id) === String(selectedHospitalId));

  const clientDistance = (currentLat !== null && currentLng !== null && selectedHosp && isHospitalCoordsValid(selectedHosp))
    ? getDistanceInMetersClient(currentLat, currentLng, Number(selectedHosp.latitude), Number(selectedHosp.longitude))
    : null;

  const adminSelectedHosp = hospitals.find(h => String(h.id) === String(adminSelectedHospitalId));

  const adminDistance = (adminLat !== null && adminLng !== null && adminSelectedHosp && isHospitalCoordsValid(adminSelectedHosp))
    ? getDistanceInMetersClient(adminLat, adminLng, Number(adminSelectedHosp.latitude), Number(adminSelectedHosp.longitude))
    : null;

  const getCheckInValidationReason = () => {
    if (gpsPermissionStatus === 'Denied') {
      return 'GPS Permission Denied. Please enable location access in browser settings.';
    }
    if (currentLat === null || currentLng === null) {
      return 'Waiting for GPS signal coordinates...';
    }
    if (!selectedHospitalId) {
      return 'Please select a hospital.';
    }
    if (!selectedHosp) {
      return 'Hospital details not found.';
    }
    if (!isHospitalCoordsValid(selectedHosp)) {
      return 'Selected hospital has invalid coordinates. Please contact an administrator.';
    }
    if (!gpsStabilized) {
      return `Stabilizing GPS signal... (Received ${gpsUpdateCount} of 3 location updates. Device accuracy has a ±${currentAccuracy !== null ? Math.round(currentAccuracy) + 'm' : 'fetching...'} margin of error)`;
    }
    if (clientDistance === null) {
      return 'Calculating distance...';
    }
    
    const allowedRadius = selectedHosp.allowed_radius !== null && selectedHosp.allowed_radius !== undefined ? selectedHosp.allowed_radius : 200;
    if (clientDistance > allowedRadius) {
      return `Geofence violation: You are ${Math.round(clientDistance)}m away from ${selectedHosp.name}, but the allowed check-in radius is ${allowedRadius}m.`;
    }
    
    return null;
  };

  const checkInValidationReason = getCheckInValidationReason();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        
        {/* Header and Mobile-First CTA Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-500 flex items-center gap-2">
                {visitType === 'Dental Visit' ? 'Dental Visits' : 'Field Visits'} - Field Tracking
                <MapPin className="h-5 w-5 text-primary-green animate-bounce" />
              </h1>
              <button
                id="btn-manual-refresh-visits"
                onClick={() => fetchData(false)}
                disabled={loading}
                className="p-1.5 rounded-lg bg-secondary-bg hover:bg-border-gray border border-border-gray text-slate-500 hover:text-primary-green transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-[11px] font-bold"
                title="Refresh visit logs manually"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Mobile-first GPS check-ins, clinical audits, and verification timeline logs.
            </p>
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
            <CheckCircle2 className="h-4.5 w-4.5" />
            {success}
          </div>
        )}

        {offlineQueue.length > 0 && (
          <div className="p-4 rounded-xl bg-secondary-bg/40 border border-border-gray text-xs text-slate-500 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4.5 w-4.5 text-alert-text" />
              <span>Offline Mode: {offlineQueue.length} photo(s) stored locally awaiting network reconnect.</span>
            </div>
            <button 
              onClick={() => syncOfflineQueue()}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
            >
              Sync Now
            </button>
          </div>
        )}        {/* Mobile Executive Shift Check-In Portal */}
        {user?.role === 'Executive' && (
          <div className="bg-white border border-light-green/20 p-4 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary-green animate-pulse" />
                Executive Field Visit Portal
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Start a new visit routine or submit completion details for your active visits.
              </p>
            </div>
            <button
              id="btn-start-visit"
              onClick={handleOpenStart}
              className="shrink-0 bg-primary-green hover:bg-primary-green-hover text-white font-semibold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-all shadow-lg shadow-emerald-950/20 flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Check In At Partner Hospital
            </button>
          </div>
        )}

        {/* Pending Completions Grid Widget */}
        {user?.role === 'Executive' && executiveActiveVisits.length > 0 && (
          <div className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-border-gray pb-3">
              <Clock className="h-4.5 w-4.5 text-primary-green" />
              Pending completions ({executiveActiveVisits.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {executiveActiveVisits.map((vis) => (
                <div key={vis.id} className="p-3.5 sm:p-4 bg-white/70 border border-border-gray/80 rounded-xl space-y-3 flex flex-col justify-between animate-fade-in">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-xs font-bold text-slate-500 block">{vis.hospital_name}</strong>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                        vis.status === 'Checked In' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                        vis.status === 'Pending Evidence' ? 'bg-secondary-bg text-slate-500 border border-border-gray' :
                        'bg-secondary-bg text-slate-500 border border-border-gray'
                      }`}>
                        {vis.status === 'In Progress' ? 'Checked In' : vis.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      📍 {vis.city || 'Hyderabad'}, {vis.state || 'Telangana'}
                    </span>
                    {/* Countdown and Progress */}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <CountdownTimer expiresAt={vis.expires_at} />
                      <span className="text-[10px] text-slate-500 font-semibold">{vis.completion_progress || 0}% Done</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-border-gray rounded-full h-1 mt-1">
                      <div 
                        className="bg-primary-green h-1 rounded-full transition-all duration-300"
                        style={{ width: `${vis.completion_progress || 0}%` }}
                      />
                    </div>
                    {/* Check-In Photo Evidence Preview */}
                    {vis.photos && vis.photos.length > 0 && (
                      <div className="mt-3 rounded-xl overflow-hidden border border-border-gray/50 h-28 w-full bg-slate-50 relative">
                        <img 
                          src={`${BACKEND_URL}${vis.photos[0].photo_url}`} 
                          alt="Check-In Proof" 
                          className="h-full w-full object-cover" 
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 text-[8px] text-white flex items-center gap-1">
                          <Camera className="h-3 w-3 text-white" />
                          Check-In Photo Evidence
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action items */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border-gray">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleOpenEnd(vis)}
                        className="col-span-2 px-2 py-1.5 bg-primary-green hover:bg-primary-green-hover text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                        title="Check Out and Complete"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        Check Out
                      </button>
                      <button
                        onClick={() => handleCancelVisit(vis.id)}
                        className="px-2 py-1.5 bg-rose-955/10 hover:bg-rose-955/20 border border-rose-900/10 rounded-lg text-[10px] font-semibold text-alert-text flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        title="Discard shift visit"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                        Discard
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenNotesModal(vis)}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 border border-border-gray rounded-lg text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Add Notes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two Column Layout: Visit Logs List & Detailed Timeline Activity Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
          
          {/* Column 1 & 2: Visits history table list */}
          <div className="lg:col-span-2 bg-white border border-border-gray rounded-xl sm:rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-4 sm:px-6 py-4 border-b border-border-gray bg-white/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
              <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">
                All {visitType === 'Dental Visit' ? 'Dental' : 'Field'} Visits Log
              </h3>
              <SelectField
                id="filter-visit-status"
                value={statusFilter}
                onChange={setStatusFilter}
                className="w-full sm:w-48"
                triggerClassName="py-1.5 text-xs text-slate-500"
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'Checked In', label: 'Checked In' },
                  { value: 'Partially Completed', label: 'Partially Completed' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Verified', label: 'Verified' },
                  { value: 'Expired', label: 'Expired' },
                  { value: 'Revisit Required', label: 'Revisit Required' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ]}
              />
            </div>

            {/* Admin Filtering & Search Panel */}
            {(user?.role === 'Admin' || user?.role === 'Superadmin') && (
              <div className="px-4 sm:px-6 py-3 bg-slate-50/50 border-b border-border-gray grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Executive</label>
                  <input
                    type="text"
                    placeholder="Executive name..."
                    value={executiveSearch}
                    onChange={(e) => setExecutiveSearch(e.target.value)}
                    className="w-full bg-white border border-border-gray hover:border-emerald-500 focus:border-emerald-500 rounded-xl py-1.5 px-3 text-xs text-slate-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full bg-white border border-border-gray hover:border-emerald-500 focus:border-emerald-500 rounded-xl py-1.5 px-3 text-xs text-slate-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full bg-white border border-border-gray hover:border-emerald-500 focus:border-emerald-500 rounded-xl py-1.5 px-3 text-xs text-slate-500 outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500 py-12">
                {visits.length === 0 ? "No field visits logged in the organization yet." : "No visits match the selected status filter."}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/60 text-slate-500 font-semibold border-b border-border-gray uppercase text-[9px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Executive</th>
                        <th className="px-5 py-3.5">Partner Hospital</th>
                        <th className="px-5 py-3.5">Check-In Info</th>
                        <th className="px-5 py-3.5">Check-Out Info</th>
                        <th className="px-5 py-3.5">Duration</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                        <th className="px-5 py-3.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
                      {filteredVisits.map((vis) => {
                        const start = new Date(vis.start_time || vis.checkin_time).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        });
                        const end = vis.checkout_time ? new Date(vis.checkout_time).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        }) : 'N/A';
                        const active = selectedVisitDetails?.id === vis.id;
                        const isRejected = vis.status === 'Expired' || vis.status === 'Revisit Required' || vis.geo_verification_status === 'Failed';

                        const statusColors: Record<string, string> = {
                          'Verified': 'bg-very-light-green text-primary-green border border-light-green/40',
                          'Completed': 'bg-very-light-green text-emerald-500 border border-light-green/40',
                          'Checked In': 'bg-very-light-green text-primary-green border border-light-green/40',
                          'In Progress': 'bg-very-light-green text-primary-green border border-light-green/40',
                          'Pending Evidence': 'bg-secondary-bg text-slate-500 border border-border-gray',
                          'Partially Completed': 'bg-secondary-bg text-slate-500 border border-border-gray',
                          'Expired': 'bg-white text-slate-500 border border-border-gray',
                          'Revisit Required': 'bg-alert-bg text-alert-text border border-alert-border',
                          'Cancelled': 'bg-alert-bg text-alert-text border border-alert-border'
                        };

                        return (
                          <tr 
                            key={vis.id} 
                            id={`visit-row-${vis.id}`}
                            onClick={() => viewVisitTimelineDetails(vis)}
                            className={`cursor-pointer transition-colors ${
                              active 
                                ? 'bg-secondary-bg hover:bg-secondary-bg text-slate-500 border-l-2 border-primary-green' 
                                : isRejected
                                  ? 'bg-alert-bg hover:bg-[#fee2e2] text-alert-text border-l-2 border-alert-border'
                                  : 'hover:bg-secondary-bg/30 text-slate-500'
                            }`}
                          >
                            <td className="px-5 py-4 font-bold">{vis.executive_name}</td>
                            <td className="px-5 py-4">
                              <span className="block font-semibold">{vis.hospital_name}</span>
                              <span className="text-[10px] text-slate-500">{vis.hospital_city}, {vis.hospital_state}</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="block font-medium text-slate-500">{start}</span>
                              <span className="block text-[10px] text-primary-green">
                                📍 {vis.checkin_latitude?.toFixed(5)}, {vis.checkin_longitude?.toFixed(5)}
                              </span>
                              {vis.distance_from_hospital_meters !== undefined && vis.distance_from_hospital_meters !== null && (
                                <span className={`block text-[9px] font-semibold ${isRejected ? 'text-alert-text' : 'text-slate-500'}`}>
                                  {formatDistance(vis.distance_from_hospital_meters, isRejected)}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {vis.checkout_time ? (
                                <>
                                  <span className="block font-medium text-slate-500">{end}</span>
                                  {vis.checkout_latitude && (
                                    <span className="block text-[10px] text-primary-green">
                                      📍 {vis.checkout_latitude.toFixed(5)}, {vis.checkout_longitude.toFixed(5)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-500 italic">Active</span>
                              )}
                            </td>
                            <td className="px-5 py-4 font-medium text-slate-500">
                              {vis.duration_minutes !== null && vis.duration_minutes !== undefined ? (
                                `${vis.duration_minutes} mins`
                              ) : (
                                <span className="text-slate-500 italic">Active</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusColors[vis.status] || 'bg-slate-800 text-slate-500'}`}>
                                {vis.status === 'In Progress' ? 'Checked In' : vis.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <ChevronRight className="h-4 w-4 text-slate-500" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Cards */}
                <div className="block md:hidden divide-y divide-border-gray max-h-[60vh] overflow-y-auto">
                  {filteredVisits.map((vis) => {
                    const start = new Date(vis.start_time).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    });
                    const active = selectedVisitDetails?.id === vis.id;
                    const isRejected = vis.status === 'Expired' || vis.status === 'Revisit Required' || vis.geo_verification_status === 'Failed';
                    const statusColors: Record<string, string> = {
                      'Verified': 'bg-very-light-green text-primary-green border border-light-green/40',
                      'Completed': 'bg-very-light-green text-emerald-500 border border-light-green/40',
                      'Checked In': 'bg-very-light-green text-primary-green border border-light-green/40',
                      'In Progress': 'bg-very-light-green text-primary-green border border-light-green/40',
                      'Pending Evidence': 'bg-secondary-bg text-slate-500 border border-border-gray',
                      'Partially Completed': 'bg-secondary-bg text-slate-500 border border-border-gray',
                      'Expired': 'bg-white text-slate-500 border border-border-gray',
                      'Revisit Required': 'bg-alert-bg text-alert-text border border-alert-border',
                      'Cancelled': 'bg-alert-bg text-alert-text border border-alert-border'
                    };

                    return (
                      <div
                        key={vis.id}
                        onClick={() => viewVisitTimelineDetails(vis)}
                        className={`p-3.5 sm:p-4 space-y-2 cursor-pointer transition-colors ${
                          active 
                            ? 'bg-secondary-bg border-l-2 border-primary-green' 
                            : isRejected
                              ? 'bg-alert-bg border-l-2 border-alert-border'
                              : 'hover:bg-secondary-bg/30'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-500 block">{vis.executive_name}</span>
                            <span className="text-[10px] text-slate-500">{start}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusColors[vis.status] || 'bg-slate-800 text-slate-500'}`}>
                            {vis.status === 'In Progress' ? 'Checked In' : vis.status}
                          </span>
                        </div>
                        <div className="bg-white/60 p-2.5 rounded-lg border border-border-gray text-xs space-y-1">
                          <p className="text-slate-500"><span className="font-semibold text-slate-500">Hospital:</span> {vis.hospital_name} ({vis.hospital_city})</p>
                          <p className="text-slate-500"><span className="font-semibold text-slate-500">Check-In:</span> {new Date(vis.start_time || vis.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          {vis.checkout_time ? (
                            <p className="text-slate-500"><span className="font-semibold text-slate-500">Check-Out:</span> {new Date(vis.checkout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({vis.duration_minutes} mins)</p>
                          ) : (
                            <p className="text-slate-500"><span className="font-semibold text-slate-500">Check-Out:</span> <span className="italic text-slate-500">Active</span></p>
                          )}
                          <p className="text-primary-green flex items-center gap-1">
                            <span>📍 Geotag: {vis.city || 'N/A'}</span>
                            {vis.distance_from_hospital_meters !== undefined && vis.distance_from_hospital_meters !== null && (
                              <span className={`text-[9px] font-bold ${isRejected ? 'text-alert-text' : 'text-slate-500'}`}>
                                ({formatDistance(vis.distance_from_hospital_meters, isRejected)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Audit Activity Timeline Detail */}
          <div className="bg-white border border-border-gray rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col min-h-[400px]">
            {selectedVisitDetails ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Title & Actions */}
                  <div className="border-b border-border-gray pb-4 mb-5 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-primary-green font-bold uppercase tracking-wider">Visit Activity Timeline</span>
                      <h3 className="font-bold text-base text-slate-500 mt-0.5">{selectedVisitDetails.hospital_name}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Exec: {selectedVisitDetails.executive_name}</p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {user?.role === 'Admin' && selectedVisitDetails.status === 'Completed' && (
                        <button
                          id="btn-verify-visit-timeline"
                          onClick={() => handleVerify(selectedVisitDetails.id)}
                          className="px-2.5 py-1.5 bg-very-light-green hover:bg-emerald-900 text-primary-green text-[10px] font-bold rounded-lg border border-light-green/40 cursor-pointer transition-colors"
                        >
                          Verify Visit
                        </button>
                      )}
                      
                      {user?.role === 'Admin' && (selectedVisitDetails.status === 'Completed' || selectedVisitDetails.status === 'Expired' || selectedVisitDetails.status === 'Verified') && (
                        <button
                          id="btn-reopen-visit-timeline"
                          onClick={() => handleReopen(selectedVisitDetails.id)}
                          className="px-2.5 py-1.5 bg-secondary-bg hover:bg-very-light-green text-slate-500 text-[10px] font-bold rounded-lg border border-border-gray cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="mb-4">
                    {selectedVisitDetails.geo_verification_status === 'Verified' ? (
                      <div className="p-3 bg-very-light-green border border-light-green/40 rounded-xl flex items-center gap-2 text-primary-green text-xs font-semibold">
                        <ShieldCheck className="h-4.5 w-4.5 text-primary-green" />
                        <span>Check-In Verified ({formatDistance(selectedVisitDetails.distance_from_hospital_meters, false)})</span>
                      </div>
                    ) : selectedVisitDetails.geo_verification_status === 'Failed' ? (
                      <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl flex flex-col gap-1 text-alert-text text-xs">
                        <div className="flex items-center gap-2 font-bold">
                          <AlertTriangle className="h-4.5 w-4.5 text-alert-text" />
                          <span>Location Mismatch Warning</span>
                        </div>
                        <p className="text-[10px] text-red-300">
                          Check-in status: {formatDistance(selectedVisitDetails.distance_from_hospital_meters, true)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Audit Timeline */}
                  <div className="space-y-5 relative pl-4 border-l-2 border-border-gray">
                    
                    {/* Check In Event */}
                    <div className="relative">
                      <div className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                        selectedVisitDetails.geo_verification_status === 'Failed' ? 'bg-red-500' : 'bg-primary-green'
                      }`} />
                      <div className="text-xs">
                        <span className="font-bold text-slate-500">
                          Checked In (Shift Start)
                        </span>
                        <p className="text-[10px] text-slate-500">
                          {new Date(selectedVisitDetails.start_time).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Device: {selectedVisitDetails.device_info || 'Mobile Web Browser'}
                        </p>
                        <p className="text-[10px] text-primary-green mt-0.5">
                          📍 GPS: {selectedVisitDetails.checkin_latitude?.toFixed(5)}, {selectedVisitDetails.checkin_longitude?.toFixed(5)} (Acc: {Math.round(selectedVisitDetails.checkin_accuracy || 0)}m)
                        </p>
                      </div>
                    </div>

                    {/* Reopened Event */}
                    {selectedVisitDetails.reopened_at && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary-green ring-4 ring-white" />
                        <div className="text-xs">
                          <span className="font-bold text-slate-500 flex items-center gap-1">
                            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                            Visit Reopened by Admin
                          </span>
                          <p className="text-[10px] text-slate-500">
                            {new Date(selectedVisitDetails.reopened_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Visit Evidence Event */}
                    <div className="relative animate-fade-in">
                      <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-white" />
                      <div className="text-xs space-y-2.5">
                        <span className="font-bold text-slate-500 block">Visit Evidence</span>
                        
                        {/* Visit Notes Observations */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-border-gray/60 font-sans">
                          <span className="font-bold text-[9px] uppercase tracking-wider text-slate-550 block mb-1">Visit Notes</span>
                          {selectedVisitDetails.notes ? (
                            <p className="text-[11px] text-slate-700 italic leading-relaxed font-sans">"{selectedVisitDetails.notes}"</p>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">No notes observations captured yet.</p>
                          )}
                        </div>

                        {/* Visit Photos Grid */}
                        <div className="space-y-2">
                          <span className="font-bold text-[9px] uppercase tracking-wider text-slate-550 block">Captured Photos</span>
                          {selectedVisitDetails.photos && selectedVisitDetails.photos.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {selectedVisitDetails.photos
                                .slice()
                                .sort((a: any, b: any) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
                                .map((photo: any, index: number) => {
                                  const formatted = formatCaptureDateTime(photo.captured_at);
                                  return (
                                    <div key={photo.id} className="rounded-xl overflow-hidden border border-border-gray bg-white flex flex-col hover:border-emerald-500 transition-colors">
                                      <div 
                                        className="relative h-28 w-full bg-slate-100 cursor-pointer overflow-hidden group" 
                                        onClick={() => setLightboxPhotoUrl(photo.photo_url)}
                                      >
                                        <img 
                                          src={photo.photo_url.startsWith('http') ? photo.photo_url : `${BACKEND_URL}${photo.photo_url}`} 
                                          alt={`Visit Proof ${index + 1}`} 
                                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" 
                                        />
                                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <span className="px-2 py-1 bg-black/60 rounded text-[9px] text-white font-semibold flex items-center gap-1">
                                            <Eye className="h-3 w-3" /> Click to Expand
                                          </span>
                                        </div>
                                      </div>
                                      <div className="p-2.5 bg-slate-50/50 text-[10px] text-slate-500 space-y-1.5 border-t border-border-gray font-mono">
                                        <p className="font-sans text-[10px] font-bold text-slate-500">Photo {index + 1}</p>
                                        <p className="text-[9px] font-sans text-slate-500">
                                          <span className="font-semibold text-slate-555">Captured:</span> {formatted.date} - {formatted.time}
                                        </p>
                                        {photo.gps_lat !== null && photo.gps_lng !== null && (
                                          <div className="text-[9px] text-primary-green leading-none space-y-0.5">
                                            <p><span className="font-semibold text-slate-555 font-sans">Lat:</span> {Number(photo.gps_lat).toFixed(6)}</p>
                                            <p><span className="font-semibold text-slate-555 font-sans">Lng:</span> {Number(photo.gps_lng).toFixed(6)}</p>
                                          </div>
                                        )}
                                        <p className="text-[9px] font-sans text-slate-500">
                                          <span className="font-semibold text-slate-555">Collector:</span> {photo.captured_by_name || 'System / Unknown'}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">No photos captured yet.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expiration Event */}
                    {selectedVisitDetails.status === 'Expired' && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-50 ring-4 ring-white" />
                        <div className="text-xs text-slate-500 font-bold">
                          ⚠️ Shift Expired (24-hour limit exceeded)
                        </div>
                      </div>
                    )}

                    {/* Complete Event */}
                    {selectedVisitDetails.completed_at && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-rose-400 ring-4 ring-white" />
                        <div className="text-xs">
                          <span className="font-bold text-slate-500">Visit Submission Completed</span>
                          <p className="text-[10px] text-slate-500">
                            {new Date(selectedVisitDetails.completed_at).toLocaleString('en-IN')}
                          </p>
                          {selectedVisitDetails.summary && (
                            <p className="text-[10px] text-slate-355 italic mt-1 bg-white/45 p-2 rounded border border-border-gray">
                              "Checklist: {selectedVisitDetails.summary}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Verification Status */}
                    {selectedVisitDetails.status === 'Verified' && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-white" />
                        <div className="text-xs text-primary-green flex items-center gap-1 font-bold">
                          <Check className="h-3.5 w-3.5" />
                          <span>Audit Verified & Archived by Admin</span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Visit Notes & Photos Capture Management Panel */}
                {user?.role === 'Executive' && selectedVisitDetails.executive_id === user.id && selectedVisitDetails.status !== 'Cancelled' && selectedVisitDetails.status !== 'Expired' && (
                  <div className="border-t border-border-gray pt-4 mt-6">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Add Notes & Capture Photos</h4>
                    <textarea
                      rows={3}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write observations..."
                      className="w-full bg-white border border-border-gray hover:border-emerald-500 focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-500 outline-none resize-none transition-colors"
                    />

                    {capturedPhotos.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {capturedPhotos.map((photo, index) => (
                          <div key={index} className="relative rounded-xl overflow-hidden border border-border-gray bg-slate-50 h-24 flex flex-col">
                            <img src={photo.preview} alt="Capture preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[8px] text-white font-mono truncate">
                              {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="flex-1 py-2 px-3 border border-border-gray hover:border-emerald-500 text-slate-500 hover:text-primary-green rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Camera className="h-4 w-4" />
                        Take Live Photo
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNotesAndPhotos}
                        disabled={submitLoading || (!noteText.trim() && capturedPhotos.length === 0)}
                        className="flex-1 py-2 px-3 bg-primary-green hover:bg-primary-green-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-950/10"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Save Notes
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-4 border-t border-border-gray text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Visit ID: #{selectedVisitDetails.id}</span>
                  <span>Timeline Verified</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <MapIcon className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-sm font-medium">Visit Activity Timeline</p>
                <p className="text-xs text-slate-650 mt-1 max-w-[200px]">Select a visit record to audit coordinates, view captured images, and verify logs.</p>
              </div>
            )}
          </div>
        </div>

        {/* Admin/Superadmin GPS Sandbox Diagnostics Tool */}
        {(user?.role === 'Admin' || user?.role === 'Superadmin') && (
          <div className="bg-white border border-border-gray rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
            {/* Header */}
            <button
              onClick={() => setIsAdminSandboxExpanded(!isAdminSandboxExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between bg-[#f8fafc] border-b border-border-gray hover:bg-slate-50 transition-colors text-left font-bold text-xs uppercase tracking-wider text-slate-500"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🛠️</span>
                <span>Admin Coordinates Diagnostics Sandbox</span>
              </div>
              <span className="text-slate-500 text-sm">
                {isAdminSandboxExpanded ? '▼' : '▶'}
              </span>
            </button>

            <AnimatePresence>
              {isAdminSandboxExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 py-6 space-y-4 border-t border-border-gray"
                >
                  <div className="text-xs text-slate-500 leading-relaxed">
                    Test GPS coordinates and geofence distance calculation parameters for any clinic dynamically. Toggle the live diagnostics watcher to inspect browser-resolved position details.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {/* Hospital selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Clinic to Inspect</label>
                        <SelectField
                          value={adminSelectedHospitalId}
                          onChange={setAdminSelectedHospitalId}
                          triggerClassName="py-2 text-xs"
                          placeholder="-- Choose Hospital --"
                          options={[
                            { value: '', label: '-- Choose Hospital --' },
                            ...hospitals.map((h) => ({
                              value: String(h.id),
                              label: `🏥 ${h.name} (${h.hospital_uid || 'UID Pending'} - ${h.city})`,
                            })),
                          ]}
                        />
                      </div>

                      {/* Control Button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsAdminTestingLocation(!isAdminTestingLocation)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            isAdminTestingLocation
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                              : 'bg-primary-green hover:bg-primary-green-hover text-white shadow-sm'
                          }`}
                        >
                          {isAdminTestingLocation ? 'Stop Geotrack Watcher' : 'Start Live Diagnostics Watcher'}
                        </button>
                      </div>

                      {/* GPS Diagnostics info */}
                      {isAdminTestingLocation && (
                        <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-border-gray text-xs space-y-2 text-slate-500">
                          <div className="font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-border-gray pb-1.5 flex items-center justify-between">
                            <span>📡 Simulator Telemetry</span>
                            <span className="text-[9px] font-semibold text-primary-green">Active (ticks: {adminGpsUpdateCount})</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono">
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">Simulator Lat:</span>
                              <span className="text-slate-500">{adminLat !== null ? adminLat.toFixed(6) : 'Fetching...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">Simulator Lng:</span>
                              <span className="text-slate-500">{adminLng !== null ? adminLng.toFixed(6) : 'Fetching...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">GPS Accuracy:</span>
                              <span className="text-slate-500">{adminAccuracy !== null ? `${Math.round(adminAccuracy)}m` : 'Fetching...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">GPS Status:</span>
                              <span className="text-slate-500">{adminGpsStabilized ? 'Stabilized' : 'Acquiring...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">Target Lat:</span>
                              <span className="text-slate-500">{adminSelectedHosp && adminSelectedHosp.latitude !== null ? Number(adminSelectedHosp.latitude).toFixed(6) : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">Target Lng:</span>
                              <span className="text-slate-500">{adminSelectedHosp && adminSelectedHosp.longitude !== null ? Number(adminSelectedHosp.longitude).toFixed(6) : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">Computed Distance:</span>
                              <span className="text-primary-green font-bold">
                                {adminDistance !== null ? `${Math.round(adminDistance)}m` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block font-sans font-medium">Allowed Geofence:</span>
                              <span className="text-slate-500">
                                {adminSelectedHosp ? `${adminSelectedHosp.allowed_radius || 200}m` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Geofence verification status badge */}
                          {adminDistance !== null && adminSelectedHosp && (
                            <div className="mt-2.5 pt-2 border-t border-border-gray flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">Geofence Status:</span>
                              {adminDistance <= (adminSelectedHosp.allowed_radius || 200) ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-very-light-green text-primary-green border border-light-green/40">
                                  ✓ Inside Geofence
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-alert-bg text-alert-text border border-alert-border">
                                  ✗ Geofence Violation
                                </span>
                              )}
                            </div>
                          )}

                          {adminAccuracy !== null && adminAccuracy > 150 && (
                            <div className="p-2.5 rounded-lg bg-[#fffbeb] border border-amber-200 text-[10px] text-amber-800 flex items-start gap-1.5 leading-normal mt-2">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                              <span>Accuracy &gt; 150m. Geofence checks may fail due to cellular triangulation or browser caching.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Interactive Simulator Map Container */}
                    <div className="flex flex-col animate-fade-in w-full">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Interactive Sandbox Map</label>
                      <div className="w-full h-64 rounded-xl border border-border-gray overflow-hidden relative bg-slate-50">
                        <div
                          id="admin-diagnostics-map"
                          className="h-full w-full relative z-10"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Modal: Start Visit (Check In) */}
        <AnimatePresence>
          {isStartOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsStartOpen(false)}
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
                    <Building className="h-4.5 w-4.5 text-primary-green" />
                    Shift Check In
                  </h3>
                  <button id="close-start-modal" onClick={() => setIsStartOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
                <form onSubmit={handleStartSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  {error && error.includes('permission') && (
                    <div className="p-3.5 rounded-xl bg-secondary-bg/40 border border-border-gray text-xs text-slate-500 leading-normal flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-alert-text" />
                        <span>Location Permission Denied</span>
                      </div>
                      <p className="text-slate-500 text-[10px] mt-1 leading-relaxed">
                        Please grant location permissions for this website in your browser settings (click the lock icon in the address bar, then toggle Location to "Allow") and refresh.
                      </p>
                    </div>
                  )}
                  {gpsStatus && (
                    <div className="p-3.5 rounded-xl bg-very-light-green border border-light-green/40 text-xs text-primary-green flex items-center gap-2 font-medium">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-green/60 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-green"></span>
                      </span>
                      <span>{gpsStatus}</span>
                    </div>
                  )}
                  <div className="relative min-w-0 max-w-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Partner Hospital</label>
                    
                    {/* Dropdown Trigger */}
                    <button
                      id="start-visit-hospital-dropdown-trigger"
                      type="button"
                      onClick={() => setIsHospDropdownOpen(!isHospDropdownOpen)}
                      className="w-full bg-white border border-border-gray hover:border-primary-green focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedHosp ? (
                          `🏥 ${selectedHosp.name} (${selectedHosp.hospital_uid || 'UID Pending'} - ${selectedHosp.city})`
                        ) : (
                          <span className="text-slate-500">Select Partner Hospital</span>
                        )}
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isHospDropdownOpen ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isHospDropdownOpen && (
                      <>
                        {/* Overlay to close when clicking outside */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsHospDropdownOpen(false)}
                        />
                        <div className="absolute z-50 left-0 right-0 mt-1 w-full max-w-full min-w-0 bg-white border border-border-gray rounded-xl shadow-xl overflow-hidden flex flex-col max-h-60">
                          {/* Search Input */}
                          <div className="p-2 border-b border-border-gray bg-white">
                            <input
                              type="text"
                              placeholder="Search by name, UID, or city..."
                              value={hospSearchQuery}
                              onChange={(e) => setHospSearchQuery(e.target.value)}
                              className="w-full bg-[#f8fafc] border border-border-gray focus:border-primary-green rounded-lg py-1.5 px-2.5 text-xs text-slate-500 outline-none"
                              autoFocus
                            />
                          </div>

                          {/* Hospital Options List */}
                          <div className="overflow-y-auto flex-1 divide-y divide-border-gray/50 bg-white">
                            {(() => {
                              const filtered = hospitals.filter(h => {
                                const query = hospSearchQuery.toLowerCase();
                                return (
                                  (h.name || '').toLowerCase().includes(query) ||
                                  (h.hospital_uid || '').toLowerCase().includes(query) ||
                                  (h.city || '').toLowerCase().includes(query)
                                );
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-xs text-slate-500 text-center">
                                    No hospitals found
                                  </div>
                                );
                              }

                              return filtered.map(h => {
                                const isSelected = String(h.id) === String(selectedHospitalId);
                                return (
                                  <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => handleSelectHospital(String(h.id))}
                                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                      isSelected
                                        ? 'bg-very-light-green text-primary-green font-bold'
                                        : 'hover:bg-[#f8fafc] text-slate-500'
                                    }`}
                                  >
                                    <span className="truncate">
                                      🏥 {h.name} ({h.hospital_uid || 'UID Pending'} - {h.city})
                                    </span>
                                    {isSelected && (
                                      <Check className="h-3.5 w-3.5 text-primary-green shrink-0 ml-2" />
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>



                  {/* GPS Diagnostics Panel */}
                  <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-border-gray text-xs space-y-2 text-slate-500 animate-fade-in">
                    <div className="font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-border-gray pb-1.5 flex items-center justify-between">
                      <span>📡 GPS Diagnostics</span>
                      <span className="text-[9px] font-semibold text-primary-green">Real-time</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Current Lat:</span>
                        <span className="text-slate-500">{currentLat !== null ? currentLat.toFixed(6) : 'Fetching...'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Current Lng:</span>
                        <span className="text-slate-500">{currentLng !== null ? currentLng.toFixed(6) : 'Fetching...'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">GPS Accuracy (Error Margin):</span>
                        <span className={`${currentAccuracy !== null && currentAccuracy > 150 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                          {currentAccuracy !== null ? `±${Math.round(currentAccuracy)}m` : 'Fetching...'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Permission:</span>
                        <span className={`font-bold ${gpsPermissionStatus === 'Granted' ? 'text-primary-green' : gpsPermissionStatus === 'Denied' ? 'text-alert-text' : 'text-slate-500'}`}>{gpsPermissionStatus}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Target Lat:</span>
                        <span className="text-slate-500">{selectedHosp && selectedHosp.latitude !== null ? Number(selectedHosp.latitude).toFixed(6) : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Target Lng:</span>
                        <span className="text-slate-500">{selectedHosp && selectedHosp.longitude !== null ? Number(selectedHosp.longitude).toFixed(6) : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Calc Distance:</span>
                        <span className="text-primary-green font-bold">
                          {clientDistance !== null ? `${Math.round(clientDistance)}m` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans font-medium">Stabilized:</span>
                        <span className={`font-bold ${gpsStabilized ? 'text-primary-green' : 'text-amber-600'}`}>{gpsStabilized ? 'Yes' : `No (${gpsUpdateCount}/3)`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Map Preview */}
                  <div className="space-y-1.5 w-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Map Geofence Preview</label>
                    <div className="w-full h-48 rounded-xl border border-border-gray overflow-hidden relative bg-slate-50">
                      <div id="checkin-map" className="h-full w-full relative z-10" />
                    </div>
                  </div>

                  {/* Warning/Validation Messages */}
                  {currentAccuracy !== null && currentAccuracy > 150 && (
                    <div className="p-3 rounded-xl bg-[#fffbeb] border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2 leading-relaxed animate-fade-in">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong className="font-semibold block text-amber-900">Weak GPS Signal Detected</strong>
                        <span>Current GPS accuracy is low ({Math.round(currentAccuracy)}m). Desktop/wifi connections or being indoors can affect precision. Please stand near a window or move outdoors if possible.</span>
                      </div>
                    </div>
                  )}

                  {((selectedHospitalId || gpsPermissionStatus === 'Denied') && checkInValidationReason) && (
                    <div className="p-3 rounded-xl bg-alert-bg border border-alert-border text-[11px] text-alert-text flex items-start gap-2 leading-relaxed animate-pulse">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                      <span>{checkInValidationReason}</span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-start"
                      type="button"
                      onClick={() => setIsStartOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-start"
                      type="submit"
                      disabled={submitLoading || !!checkInValidationReason}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitLoading ? 'Checking In...' : 'Check In'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Visit Notes & Evidence Capture */}
        <AnimatePresence>
          {isNotesModalOpen && activeVisit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNotesModalOpen(false)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5 font-sans">
                    <FileText className="h-4.5 w-4.5 text-primary-green" />
                    Visit Notes & Proof
                  </h3>
                  <button onClick={() => setIsNotesModalOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hospital / Clinic</label>
                    <div className="text-xs font-semibold text-slate-500 bg-secondary-bg/40 border border-border-gray/50 p-2.5 rounded-xl">
                      🏥 {activeVisit.hospital_name || 'Partner Hospital'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Visit Notes</label>
                    <textarea
                      rows={4}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Enter visit summary, lead details, doctor interaction, follow-up requirements, remarks, etc."
                      className="w-full bg-white border border-border-gray hover:border-emerald-500 focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-500 outline-none resize-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Attached Photos</label>
                    {capturedPhotos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        {capturedPhotos.map((photo, index) => (
                          <div key={index} className="relative rounded-xl overflow-hidden border border-border-gray bg-slate-50 h-24 flex flex-col">
                            <img src={photo.preview} alt="Capture preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[8px] text-white font-mono truncate">
                              {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 italic py-2">No photos captured for this note yet.</div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-border-gray flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setIsNotesModalOpen(false)}
                    className="px-4 py-2 border border-border-gray hover:bg-white text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="py-2 px-3 border border-border-gray hover:border-emerald-500 text-slate-500 hover:text-primary-green rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer bg-white transition-all"
                    >
                      <Camera className="h-4 w-4" />
                      Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSaveNotesAndPhotos();
                        setIsNotesModalOpen(false);
                      }}
                      disabled={submitLoading || (!noteText.trim() && capturedPhotos.length === 0)}
                      className="py-2 px-4 bg-primary-green hover:bg-primary-green-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-950/15"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Save Notes
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Built-in HTML5 Camera Viewfinder */}
        <AnimatePresence>
          {isCameraOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCameraOpen(false)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col h-[520px]"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-500 flex items-center gap-1.5">
                    <Camera className="h-4.5 w-4.5 text-primary-green" />
                    Built-in Camera Viewfinder
                  </h3>
                  <button onClick={() => setIsCameraOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* GPS Coordinates Overlay */}
                  <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-[9px] text-white font-mono space-y-0.5">
                    {cameraGpsLoading ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-spin h-2 w-2 rounded-full border border-white border-t-transparent"></span>
                        Acquiring GPS for watermark...
                      </span>
                    ) : cameraGps ? (
                      <span>📍 GPS: {cameraGps.lat.toFixed(6)}, {cameraGps.lng.toFixed(6)}</span>
                    ) : (
                      <span>📍 GPS: Waiting for signal...</span>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-white border-t border-border-gray flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(false)}
                    className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-6 py-2.5 bg-primary-green hover:bg-primary-green-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                  >
                    <Check className="h-4 w-4" />
                    Take Photo
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Complete Visit */}
        <AnimatePresence>
          {isEndOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEndOpen(false)}
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
                    <CheckCircle2 className="h-4.5 w-4.5 text-primary-green" />
                    Visit Completion Form
                  </h3>
                  <button id="close-end-modal" onClick={() => setIsEndOpen(false)} className="text-slate-500 hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
                <form onSubmit={handleEndSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Executive Summary Checklist</label>
                    <input
                      id="end-visit-summary"
                      type="text"
                      required
                      value={visitSummary}
                      onChange={(e) => setVisitSummary(e.target.value)}
                      placeholder="Doctor was not available, shared clinical brochure..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Detailed visit observations</label>
                    <textarea
                      id="end-visit-notes"
                      rows={3}
                      required
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      placeholder="Enter details about discussions with clinic receptionist..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl p-3 text-xs text-slate-500 outline-none resize-none"
                    />
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-end"
                      type="button"
                      onClick={() => setIsEndOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-slate-500 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-end"
                      type="submit"
                      disabled={submitLoading}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitLoading ? 'Completing Visit...' : 'Complete Visit'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {lightboxPhotoUrl && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                exit={{ opacity: 0 }}
                onClick={() => setLightboxPhotoUrl(null)}
                className="fixed inset-0 bg-black cursor-zoom-out"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative max-w-4xl max-h-[85vh] z-10 flex flex-col items-center"
              >
                <button 
                  onClick={() => setLightboxPhotoUrl(null)} 
                  className="absolute -top-10 right-0 text-white hover:text-emerald-450 cursor-pointer flex items-center gap-1 font-semibold text-sm"
                >
                  <X className="h-5 w-5" /> Close
                </button>
                <img 
                  src={lightboxPhotoUrl.startsWith('http') ? lightboxPhotoUrl : `${BACKEND_URL}${lightboxPhotoUrl}`} 
                  alt="Full preview" 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10" 
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        </div>
      </DashboardLayout>
    }>
      <VisitsContent />
    </Suspense>
  );
}
