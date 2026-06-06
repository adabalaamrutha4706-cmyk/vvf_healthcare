'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { 
  MapPin, Camera, Play, CheckCircle2, ShieldAlert, Sparkles, X, 
  Clock, Check, Building, FileText, Map, Image as ImageIcon, Eye,
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
    warning: 'text-secondary-text bg-secondary-bg/40 border-border-gray animate-pulse',
    critical: 'text-alert-text bg-alert-bg/40 border-alert-border animate-pulse font-bold'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${colors[urgency]}`}>
      ⏳ {timeLeft}
    </span>
  );
}

export default function VisitsPage() {
  const { user } = useAuth();
  
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
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Checked In') {
      return v.status === 'Checked In' || v.status === 'In Progress';
    }
    return v.status === statusFilter;
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


  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const vRes = await api.visits.getAll();
      const allVisits = vRes.visits || [];
      setVisits(allVisits);

      const hRes = await api.hospitals.getAll();
      const activeHospitals = (hRes.hospitals || []).filter((h: any) => h.status === 'Active');
      
      // Sort active hospitals by VVF UID suffix numerically in ascending order
      activeHospitals.sort((a: any, b: any) => {
        const getNum = (uid: string) => {
          if (!uid || !uid.startsWith('VVF-')) return 999999;
          const num = parseInt(uid.replace('VVF-', ''), 10);
          return isNaN(num) ? 999999 : num;
        };
        return getNum(a.hospital_uid) - getNum(b.hospital_uid);
      });

      setHospitals(activeHospitals);
    } catch (e: any) {
      setError(e.message || 'Failed to load executive field records.');
    } finally {
      setLoading(false);
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

  const handleEndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisit) return;
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
      fetchData();
    }, 10000);
    return () => clearInterval(interval);
  }, [user]);



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
            <h1 className="text-lg sm:text-2xl font-bold text-primary-text flex items-center gap-2">
              Go Visits - Field Tracking
              <MapPin className="h-5 w-5 text-primary-green animate-bounce" />
            </h1>
            <p className="text-sm text-secondary-text mt-0.5">
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
          <div className="p-4 rounded-xl bg-secondary-bg/40 border border-border-gray text-xs text-secondary-text flex items-center justify-between gap-2">
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
              <h2 className="text-sm font-bold text-primary-text flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary-green animate-pulse" />
                Executive Field Visit Portal
              </h2>
              <p className="text-xs text-secondary-text mt-1">
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
            <h3 className="text-xs font-bold text-primary-text uppercase tracking-wider flex items-center gap-1.5 border-b border-border-gray pb-3">
              <Clock className="h-4.5 w-4.5 text-primary-green" />
              Pending completions ({executiveActiveVisits.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {executiveActiveVisits.map((vis) => (
                <div key={vis.id} className="p-3.5 sm:p-4 bg-white/70 border border-border-gray/80 rounded-xl space-y-3 flex flex-col justify-between animate-fade-in">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-xs font-bold text-primary-text block">{vis.hospital_name}</strong>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                        vis.status === 'Checked In' ? 'bg-very-light-green text-primary-green border border-light-green/40' :
                        vis.status === 'Pending Evidence' ? 'bg-secondary-bg text-secondary-text border border-border-gray' :
                        'bg-secondary-bg text-secondary-text border border-border-gray'
                      }`}>
                        {vis.status === 'In Progress' ? 'Checked In' : vis.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-secondary-text block">
                      📍 {vis.city || 'Hyderabad'}, {vis.state || 'Telangana'}
                    </span>
                    {/* Countdown and Progress */}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <CountdownTimer expiresAt={vis.expires_at} />
                      <span className="text-[10px] text-secondary-text font-semibold">{vis.completion_progress || 0}% Done</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-border-gray rounded-full h-1 mt-1">
                      <div 
                        className="bg-primary-green h-1 rounded-full transition-all duration-300"
                        style={{ width: `${vis.completion_progress || 0}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Action items */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-gray">
                    <button
                      onClick={() => handleOpenPhoto(vis)}
                      className="px-2 py-1.5 bg-white hover:bg-secondary-bg border border-border-gray rounded-lg text-[10px] font-semibold text-secondary-text flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Upload photo evidence"
                    >
                      <Camera className="h-3.5 w-3.5 text-primary-green" />
                      Photo
                    </button>
                    <button
                      onClick={() => handleOpenEnd(vis)}
                      className="px-2 py-1.5 bg-very-light-green hover:bg-very-light-green border border-light-green/40 rounded-lg text-[10px] font-bold text-primary-green flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Complete visit details"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary-green" />
                      Complete
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
              <h3 className="font-bold text-xs text-primary-text uppercase tracking-wider">All Field Visits Log</h3>
              <SelectField
                id="filter-visit-status"
                value={statusFilter}
                onChange={setStatusFilter}
                className="w-full sm:w-48"
                triggerClassName="py-1.5 text-xs text-secondary-text"
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

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-secondary-text py-12">
                {visits.length === 0 ? "No field visits logged in the organization yet." : "No visits match the selected status filter."}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/60 text-secondary-text font-semibold border-b border-border-gray uppercase text-[9px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Executive</th>
                        <th className="px-5 py-3.5">Partner Hospital</th>
                        <th className="px-5 py-3.5">GPS Geotag</th>
                        <th className="px-5 py-3.5">Start Time</th>
                        <th className="px-5 py-3.5 text-center">Status</th>
                        <th className="px-5 py-3.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-gray">
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
                          'Pending Evidence': 'bg-secondary-bg text-secondary-text border border-border-gray',
                          'Partially Completed': 'bg-secondary-bg text-secondary-text border border-border-gray',
                          'Expired': 'bg-white text-secondary-text border border-border-gray',
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
                                ? 'bg-secondary-bg hover:bg-secondary-bg text-primary-text border-l-2 border-primary-green' 
                                : isRejected
                                  ? 'bg-alert-bg hover:bg-[#fee2e2] text-alert-text border-l-2 border-alert-border'
                                  : 'hover:bg-secondary-bg/30 text-secondary-text'
                            }`}
                          >
                            <td className="px-5 py-4 font-bold">{vis.executive_name}</td>
                            <td className="px-5 py-4">
                              <span className="block font-semibold">{vis.hospital_name}</span>
                              <span className="text-[10px] text-secondary-text">{vis.hospital_city}, {vis.hospital_state}</span>
                            </td>
                            <td className="px-5 py-4 text-primary-green">
                              📍 {vis.city || 'N/A'}
                              {vis.distance_from_hospital_meters !== undefined && vis.distance_from_hospital_meters !== null && (
                                <span className={`block text-[10px] font-semibold ${isRejected ? 'text-alert-text' : 'text-secondary-text'}`}>
                                  {formatDistance(vis.distance_from_hospital_meters, isRejected)}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-secondary-text font-medium">{start}</td>
                            <td className="px-5 py-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusColors[vis.status] || 'bg-slate-800 text-secondary-text'}`}>
                                {vis.status === 'In Progress' ? 'Checked In' : vis.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <ChevronRight className="h-4 w-4 text-secondary-text" />
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
                      'Pending Evidence': 'bg-secondary-bg text-secondary-text border border-border-gray',
                      'Partially Completed': 'bg-secondary-bg text-secondary-text border border-border-gray',
                      'Expired': 'bg-white text-secondary-text border border-border-gray',
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
                            <span className="font-bold text-primary-text block">{vis.executive_name}</span>
                            <span className="text-[10px] text-secondary-text">{start}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusColors[vis.status] || 'bg-slate-800 text-secondary-text'}`}>
                            {vis.status === 'In Progress' ? 'Checked In' : vis.status}
                          </span>
                        </div>
                        <div className="bg-white/60 p-2.5 rounded-lg border border-border-gray text-xs space-y-1">
                          <p className="text-secondary-text"><span className="font-semibold text-primary-text">Hospital:</span> {vis.hospital_name} ({vis.hospital_city})</p>
                          <p className="text-primary-green flex items-center gap-1">
                            <span>📍 Geotag: {vis.city || 'N/A'}</span>
                            {vis.distance_from_hospital_meters !== undefined && vis.distance_from_hospital_meters !== null && (
                              <span className={`text-[9px] font-bold ${isRejected ? 'text-alert-text' : 'text-secondary-text'}`}>
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
                      <h3 className="font-bold text-base text-primary-text mt-0.5">{selectedVisitDetails.hospital_name}</h3>
                      <p className="text-[10px] text-secondary-text mt-0.5">Exec: {selectedVisitDetails.executive_name}</p>
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
                          className="px-2.5 py-1.5 bg-secondary-bg hover:bg-very-light-green text-secondary-text text-[10px] font-bold rounded-lg border border-border-gray cursor-pointer transition-colors flex items-center gap-1"
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
                        <span className="font-bold text-primary-text">
                          Checked In (Shift Start)
                        </span>
                        <p className="text-[10px] text-secondary-text">
                          {new Date(selectedVisitDetails.start_time).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-secondary-text mt-0.5">
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
                          <span className="font-bold text-primary-text flex items-center gap-1">
                            <RotateCcw className="h-3.5 w-3.5 text-secondary-text" />
                            Visit Reopened by Admin
                          </span>
                          <p className="text-[10px] text-secondary-text">
                            {new Date(selectedVisitDetails.reopened_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Photos Upload Event */}
                    {selectedVisitDetails.photos && selectedVisitDetails.photos.length > 0 && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary-green ring-4 ring-white" />
                        <div className="text-xs space-y-2">
                          <span className="font-bold text-primary-text">Evidence Photo Uploaded</span>
                          <div className="space-y-2">
                            {selectedVisitDetails.photos.map((photo: any) => (
                              <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-border-gray/80 bg-white flex flex-col">
                                <img 
                                  src={`http://localhost:5000${photo.photo_url}`} 
                                  alt="Visit proof" 
                                  className="h-32 w-full object-cover" 
                                />
                                <div className="p-2 bg-white text-[10px] text-secondary-text space-y-0.5 border-t border-border-gray">
                                  <p className="text-[9px]">Uploaded: {new Date(photo.captured_at).toLocaleString('en-IN')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expiration Event */}
                    {selectedVisitDetails.status === 'Expired' && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-500 ring-4 ring-white" />
                        <div className="text-xs text-secondary-text font-bold">
                          ⚠️ Shift Expired (24-hour limit exceeded)
                        </div>
                      </div>
                    )}

                    {/* Complete Event */}
                    {selectedVisitDetails.completed_at && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-rose-400 ring-4 ring-white" />
                        <div className="text-xs">
                          <span className="font-bold text-primary-text">Visit Submission Completed</span>
                          <p className="text-[10px] text-secondary-text">
                            {new Date(selectedVisitDetails.completed_at).toLocaleString('en-IN')}
                          </p>
                          {selectedVisitDetails.summary && (
                            <p className="text-[10px] text-slate-355 italic mt-1 bg-white/45 p-2 rounded border border-border-gray">
                              "Checklist: {selectedVisitDetails.summary}"
                            </p>
                          )}
                          {selectedVisitDetails.notes && (
                            <p className="text-[9px] text-slate-455 mt-1 pl-2 border-l border-border-gray">
                              Observations: {selectedVisitDetails.notes}
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

                <div className="mt-8 pt-4 border-t border-border-gray text-[10px] text-secondary-text flex items-center justify-between">
                  <span>Visit ID: #{selectedVisitDetails.id}</span>
                  <span>Timeline Verified</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-secondary-text py-12">
                <Map className="h-10 w-10 text-slate-700 mb-3" />
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
              className="w-full px-6 py-4 flex items-center justify-between bg-[#f8fafc] border-b border-border-gray hover:bg-slate-50 transition-colors text-left font-bold text-xs uppercase tracking-wider text-primary-text"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🛠️</span>
                <span>Admin Coordinates Diagnostics Sandbox</span>
              </div>
              <span className="text-secondary-text text-sm">
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
                  <div className="text-xs text-secondary-text leading-relaxed">
                    Test GPS coordinates and geofence distance calculation parameters for any clinic dynamically. Toggle the live diagnostics watcher to inspect browser-resolved position details.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {/* Hospital selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Select Clinic to Inspect</label>
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
                        <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-border-gray text-xs space-y-2 text-secondary-text">
                          <div className="font-bold text-[10px] text-primary-text uppercase tracking-wider border-b border-border-gray pb-1.5 flex items-center justify-between">
                            <span>📡 Simulator Telemetry</span>
                            <span className="text-[9px] font-semibold text-primary-green">Active (ticks: {adminGpsUpdateCount})</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono">
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">Simulator Lat:</span>
                              <span className="text-primary-text">{adminLat !== null ? adminLat.toFixed(6) : 'Fetching...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">Simulator Lng:</span>
                              <span className="text-primary-text">{adminLng !== null ? adminLng.toFixed(6) : 'Fetching...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">GPS Accuracy:</span>
                              <span className="text-primary-text">{adminAccuracy !== null ? `${Math.round(adminAccuracy)}m` : 'Fetching...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">GPS Status:</span>
                              <span className="text-primary-text">{adminGpsStabilized ? 'Stabilized' : 'Acquiring...'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">Target Lat:</span>
                              <span className="text-primary-text">{adminSelectedHosp && adminSelectedHosp.latitude !== null ? Number(adminSelectedHosp.latitude).toFixed(6) : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">Target Lng:</span>
                              <span className="text-primary-text">{adminSelectedHosp && adminSelectedHosp.longitude !== null ? Number(adminSelectedHosp.longitude).toFixed(6) : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">Computed Distance:</span>
                              <span className="text-primary-green font-bold">
                                {adminDistance !== null ? `${Math.round(adminDistance)}m` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-secondary-text block font-sans font-medium">Allowed Geofence:</span>
                              <span className="text-primary-text">
                                {adminSelectedHosp ? `${adminSelectedHosp.allowed_radius || 200}m` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Geofence verification status badge */}
                          {adminDistance !== null && adminSelectedHosp && (
                            <div className="mt-2.5 pt-2 border-t border-border-gray flex items-center justify-between">
                              <span className="text-[10px] text-secondary-text">Geofence Status:</span>
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
                    <div className="flex flex-col animate-fade-in">
                      <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Interactive Sandbox Map</label>
                      <div
                        id="admin-diagnostics-map"
                        className="h-64 w-full rounded-xl border border-border-gray relative z-10 bg-slate-50"
                      />
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
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <Building className="h-4.5 w-4.5 text-primary-green" />
                    Shift Check In
                  </h3>
                  <button id="close-start-modal" onClick={() => setIsStartOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
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
                    <div className="p-3.5 rounded-xl bg-secondary-bg/40 border border-border-gray text-xs text-secondary-text leading-normal flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-alert-text" />
                        <span>Location Permission Denied</span>
                      </div>
                      <p className="text-secondary-text text-[10px] mt-1 leading-relaxed">
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
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Select Partner Hospital</label>
                    
                    {/* Dropdown Trigger */}
                    <button
                      id="start-visit-hospital-dropdown-trigger"
                      type="button"
                      onClick={() => setIsHospDropdownOpen(!isHospDropdownOpen)}
                      className="w-full bg-white border border-border-gray hover:border-primary-green focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-primary-text outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="truncate">
                        {selectedHosp ? (
                          `🏥 ${selectedHosp.name} (${selectedHosp.hospital_uid || 'UID Pending'} - ${selectedHosp.city})`
                        ) : (
                          <span className="text-secondary-text">Select Partner Hospital</span>
                        )}
                      </span>
                      <svg
                        className={`w-4 h-4 text-secondary-text transition-transform duration-200 ${isHospDropdownOpen ? 'transform rotate-180' : ''}`}
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
                              className="w-full bg-[#f8fafc] border border-border-gray focus:border-primary-green rounded-lg py-1.5 px-2.5 text-xs text-primary-text outline-none"
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
                                  <div className="p-3 text-xs text-secondary-text text-center">
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
                                        : 'hover:bg-[#f8fafc] text-secondary-text'
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
                  <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-border-gray text-xs space-y-2 text-secondary-text animate-fade-in">
                    <div className="font-bold text-[10px] text-primary-text uppercase tracking-wider border-b border-border-gray pb-1.5 flex items-center justify-between">
                      <span>📡 GPS Diagnostics</span>
                      <span className="text-[9px] font-semibold text-primary-green">Real-time</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono">
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Current Lat:</span>
                        <span className="text-primary-text">{currentLat !== null ? currentLat.toFixed(6) : 'Fetching...'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Current Lng:</span>
                        <span className="text-primary-text">{currentLng !== null ? currentLng.toFixed(6) : 'Fetching...'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">GPS Accuracy (Error Margin):</span>
                        <span className={`${currentAccuracy !== null && currentAccuracy > 150 ? 'text-amber-600 font-bold' : 'text-primary-text'}`}>
                          {currentAccuracy !== null ? `±${Math.round(currentAccuracy)}m` : 'Fetching...'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Permission:</span>
                        <span className={`font-bold ${gpsPermissionStatus === 'Granted' ? 'text-primary-green' : gpsPermissionStatus === 'Denied' ? 'text-alert-text' : 'text-secondary-text'}`}>{gpsPermissionStatus}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Target Lat:</span>
                        <span className="text-primary-text">{selectedHosp && selectedHosp.latitude !== null ? Number(selectedHosp.latitude).toFixed(6) : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Target Lng:</span>
                        <span className="text-primary-text">{selectedHosp && selectedHosp.longitude !== null ? Number(selectedHosp.longitude).toFixed(6) : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Calc Distance:</span>
                        <span className="text-primary-green font-bold">
                          {clientDistance !== null ? `${Math.round(clientDistance)}m` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-secondary-text block font-sans font-medium">Stabilized:</span>
                        <span className={`font-bold ${gpsStabilized ? 'text-primary-green' : 'text-amber-600'}`}>{gpsStabilized ? 'Yes' : `No (${gpsUpdateCount}/3)`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Map Preview */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider">Map Geofence Preview</label>
                    <div id="checkin-map" className="h-48 w-full rounded-xl border border-border-gray relative z-10 bg-slate-50" />
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
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
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

        {/* Modal: Upload Photo */}
        <AnimatePresence>
          {isPhotoOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPhotoOpen(false)}
                className="fixed inset-0 bg-black"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <Camera className="h-4.5 w-4.5 text-primary-green" />
                    Visit Field Audit Capture
                  </h3>
                  <button id="close-photo-modal" onClick={() => setIsPhotoOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <form onSubmit={handlePhotoSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                      <span>{error}</span>
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
                  {/* Photo Input Frame */}
                  <div className="flex flex-col items-center justify-center w-full">
                    {imagePreview ? (
                      <div className="relative h-48 w-full rounded-xl overflow-hidden border border-border-gray bg-white">
                        <img src={imagePreview} alt="Captured preview" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute top-2.5 right-2.5 px-3 py-1.5 bg-black/85 hover:bg-black text-[10px] font-bold rounded-lg text-secondary-text hover:text-primary-green cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-48 rounded-xl border border-dashed border-border-gray hover:border-emerald-500 bg-white/50 hover:bg-white transition-all cursor-pointer group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-2">
                          <ImageIcon className="h-8 w-8 text-secondary-text group-hover:text-primary-green transition-colors" />
                          <p className="text-xs text-secondary-text group-hover:text-secondary-text">
                            <span className="font-semibold text-primary-green">Click to select photo</span> or drag and drop
                          </p>
                          <p className="text-[10px] text-secondary-text">
                            JPEG, PNG or WEBP (Max 5MB)
                          </p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-photo"
                      type="button"
                      onClick={() => setIsPhotoOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-secondary-bg text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-photo"
                      type="submit"
                      disabled={submitLoading || !imageFile}
                      className="px-5 py-2 text-xs font-semibold text-white bg-primary-green hover:bg-primary-green-hover rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitLoading ? 'Uploading...' : 'Verify & Send File'}
                    </button>
                  </div>
                </form>
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
                  <h3 className="font-bold text-sm text-primary-text flex items-center gap-1.5">
                    <CheckCircle2 className="h-4.5 w-4.5 text-primary-green" />
                    Visit Completion Form
                  </h3>
                  <button id="close-end-modal" onClick={() => setIsEndOpen(false)} className="text-secondary-text hover:text-primary-green cursor-pointer">
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
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Executive Summary Checklist</label>
                    <input
                      id="end-visit-summary"
                      type="text"
                      required
                      value={visitSummary}
                      onChange={(e) => setVisitSummary(e.target.value)}
                      placeholder="Doctor was not available, shared clinical brochure..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl py-2.5 px-3 text-xs text-primary-text outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-secondary-text uppercase tracking-wider mb-1.5">Detailed visit observations</label>
                    <textarea
                      id="end-visit-notes"
                      rows={3}
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      placeholder="Enter details about discussions with clinic receptionist..."
                      className="w-full bg-white border border-border-gray focus:border-primary-green rounded-xl p-3 text-xs text-primary-text outline-none resize-none"
                    />
                  </div>

                  {!activeVisit?.evidence_uploaded && (
                    <div className="p-3.5 rounded-xl bg-secondary-bg/40 border border-border-gray text-xs text-secondary-text leading-normal flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-alert-text" />
                        <span>Photo Evidence Missing</span>
                      </div>
                      <p className="text-slate-355 text-[10px] mt-1 leading-relaxed">
                        Please upload photo evidence first using the 'Photo' button before completing this visit.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border-gray flex items-center justify-end gap-2.5">
                    <button
                      id="btn-cancel-end"
                      type="button"
                      onClick={() => setIsEndOpen(false)}
                      className="px-4 py-2 border border-border-gray hover:bg-slate-855 text-xs text-secondary-text rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-end"
                      type="submit"
                      disabled={submitLoading || !activeVisit?.evidence_uploaded}
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

      </div>
    </DashboardLayout>
  );
}
