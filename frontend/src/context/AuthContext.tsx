'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, removeToken } from '../lib/api';
import { AutoLogoutWarningModal } from '../components/AutoLogoutWarningModal';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  personal_email?: string | null;
  age?: number | null;
  date_of_birth?: string | null;
  gender?: string | null;
  about?: string | null;
  is_active?: boolean;
  photo_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  activeRole: string;
  setActiveRole: (role: string) => void;
  loading: boolean;
  isPunchedIn: boolean;
  activePunchRecord: any | null;
  login: (credentials: { email: string; password: string }, redirectPath?: string, targetRole?: string) => Promise<void>;
  logout: (redirectPath?: string) => Promise<void>;
  checkPunchStatus: () => Promise<void>;
  triggerPunch: (action: 'in' | 'out', device_info?: string, gps_latitude?: number, gps_longitude?: number) => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => void;
}

const getCookie = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
  return null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRoleState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [activePunchRecord, setActivePunchRecord] = useState<any | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const router = useRouter();

  const setActiveRole = (role: string) => {
    setActiveRoleState(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vvf_active_role', role);
    }
  };

  const getLoginPathForRole = (role: string) => {
    const r = role.toLowerCase().trim();
    if (r === 'dental doctor') return '/dental-doctor/login';
    if (r === 'dentist junior') return '/dentist-junior/login';
    if (r === 'dental assistant') return '/dental-assistant/login';
    if (r === 'op technician') return '/op-technician/login';
    if (r === 'sop technician') return '/sop-technician/login';
    if (r === 'superadmin' || r === 'admin' || r === 'co-admin') return '/admin/login';
    if (r === 'doctor') return '/doctor/login';
    if (r === 'executive') return '/executive/login';
    if (r === 'reception' || r === 'receptionist') return '/reception/login';
    if (r === 'telecaller') return '/telecaller/login';
    return '/login';
  };

  const isSessionExpiredBy1030PM = (loginTime: Date): boolean => {
    const now = new Date();
    const last1030PM = new Date(now);
    last1030PM.setHours(22, 30, 0, 0);
    if (now.getTime() < last1030PM.getTime()) {
      last1030PM.setDate(last1030PM.getDate() - 1);
    }
    return loginTime.getTime() < last1030PM.getTime();
  };

  // Load user details on boot
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('vvf_token');

        if (token) {
          const loginTimeStr = localStorage.getItem('vvf_login_time');
          if (loginTimeStr) {
            const loginTime = new Date(loginTimeStr);
            if (isSessionExpiredBy1030PM(loginTime)) {
              console.warn('Session expired due to 10:30 PM auto-logout requirement.');
              removeToken();
              localStorage.removeItem('vvf_login_time');
              setUser(null);
              setLoading(false);
              router.push('/login');
              return;
            }
          } else {
            localStorage.setItem('vvf_login_time', new Date().toISOString());
          }

          const res = await api.auth.getMe();
          const mappedUser = {
            ...res.user,
            role: res.user.role === 'Co-admin' ? 'Admin' : res.user.role
          };
          setUser(mappedUser);
          
          let initActiveRole = '';
          const storedActiveRole = localStorage.getItem('vvf_active_role');
          const rolesList = (mappedUser.role || '').split(',').map((r: string) => r.trim());
          if (storedActiveRole && rolesList.some((r: string) => r.toLowerCase() === storedActiveRole.toLowerCase())) {
            initActiveRole = rolesList.find((r: string) => r.toLowerCase() === storedActiveRole.toLowerCase()) || rolesList[0];
          } else {
            initActiveRole = rolesList[0] || '';
          }
          setActiveRoleState(initActiveRole);

          if (typeof window !== 'undefined') {
            localStorage.setItem('vvf_role', mappedUser.role);
          }
          await checkPunchStatus(res.user);
        }
      } catch (err) {
        console.error('Failed to restore authentication session:', err);
        removeToken();
        localStorage.removeItem('vvf_login_time');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const checkPunchStatus = async (currentUser?: User | null) => {
    try {
      const activeUser = currentUser || user;
      const params = activeUser ? { targetUserId: activeUser.id } : undefined;
      const res = await api.auth.getAttendance(params);
      const records = res.records || [];
      const active = records.find((r: any) => r.status === 'active' || r.punch_out === null || r.punch_out === undefined);
      if (active) {
        setIsPunchedIn(true);
        setActivePunchRecord(active);
      } else {
        setIsPunchedIn(false);
        setActivePunchRecord(null);
      }
    } catch (err) {
      console.error('Failed to query attendance punch state:', err);
    }
  };

  const login = async (credentials: { email: string; password: string }, redirectPath?: string, targetRole?: string) => {
    setLoading(true);
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      if (typeof window !== 'undefined' && navigator.geolocation) {
        try {
          coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 5500, maximumAge: 0 }
            );
          });
        } catch (geoErr) {
          console.warn('GPS coordinates fetch timed out or was denied:', geoErr);
        }
      }

      const loginPayload = coords
        ? { ...credentials, latitude: coords.latitude, longitude: coords.longitude }
        : credentials;

      const res = await api.auth.login(loginPayload);

      if (targetRole) {
        const userRole = res.user.role || '';
        const userRolesList = userRole.split(',').map((r: string) => r.trim().toLowerCase());
        const lowerTargetRole = targetRole.toLowerCase();

        let isAuthorized = userRolesList.includes(lowerTargetRole);
        if (!isAuthorized && lowerTargetRole === 'admin') {
          isAuthorized = userRolesList.includes('superadmin') || userRolesList.includes('co-admin');
        }

        if (!isAuthorized) {
          throw new Error(`Access Denied: This login portal is restricted to ${targetRole} users. Your account has the role "${userRole}".`);
        }
      }

      setToken(res.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vvf_role', res.user.role);
        localStorage.setItem('vvf_login_time', new Date().toISOString());
      }
      const mappedUser = {
        ...res.user,
        role: res.user.role === 'Co-admin' ? 'Admin' : res.user.role
      };
      setUser(mappedUser);

      const rolesList = (mappedUser.role || '').split(',').map((r: string) => r.trim());
      const initActiveRole = rolesList[0] || '';
      setActiveRoleState(initActiveRole);

      if (typeof window !== 'undefined') {
        localStorage.setItem('vvf_active_role', initActiveRole);
        localStorage.setItem('vvf_role', mappedUser.role);
        localStorage.setItem('vvf_login_time', new Date().toISOString());
      }
      await checkPunchStatus(res.user);

      // Fire-and-forget: capture GPS and tag the attendance record
      // Uses browser GPS first, falls back to IP-based geolocation if GPS is denied/unavailable
      if (typeof window !== 'undefined') {
        const sendLocation = (lat: number, lng: number) => {
          api.auth.updateAttendanceLocation({
            gps_latitude: lat,
            gps_longitude: lng,
          }).catch((err) => console.warn('Failed to update attendance location:', err));
        };

        const fallbackToIpLocation = () => {
          fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
              if (data.latitude && data.longitude) {
                sendLocation(data.latitude, data.longitude);
              }
            })
            .catch((err) => console.warn('IP geolocation fallback failed:', err));
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              sendLocation(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
              // GPS denied or failed — use IP-based fallback
              fallbackToIpLocation();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          // No geolocation API — use IP-based fallback
          fallbackToIpLocation();
        }
      }
      
      if (redirectPath) {
        router.push(redirectPath);
      } else if (res.user.role === 'Superadmin') {
        router.push('/superadmin/dashboard');
      } else {
        const role = res.user.role.toLowerCase();
        if (role === 'admin') router.push('/admin/dashboard');
        else if (role === 'dental doctor') router.push('/dental-doctor/dashboard');
        else if (role === 'dentist junior') router.push('/dentist-junior/dashboard');
        else if (role === 'dental assistant') router.push('/dental-assistant/dashboard');
        else if (role === 'doctor') router.push('/doctor/dashboard');
        else if (role === 'executive') router.push('/executive/dashboard');
        else if (role === 'reception') router.push('/reception/dashboard');
        else if (role === 'telecaller') router.push('/telecaller/dashboard');
        else if (role === 'op technician') router.push('/op-technician/dashboard');
        else if (role === 'sop technician') router.push('/sop-technician/dashboard');
        else router.push('/dashboard');
      }
    } catch (err) {
      removeToken();
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (redirectPath?: string) => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vvf_token') : null;
      if (token) {
        await api.auth.logout();
      }
    } catch (err) {
      console.warn('Logout request failed, cleaning local storage directly.');
    } finally {
      removeToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('vvf_login_time');
      }
      setUser(null);
      setIsPunchedIn(false);
      setActivePunchRecord(null);
      setLoading(false);
      setShowWarningModal(false);
      setWarningDismissed(false);
      router.push(redirectPath || '/login');
    }
  };

  const triggerPunch = async (action: 'in' | 'out', device_info?: string, gps_latitude?: number, gps_longitude?: number) => {
    try {
      const deviceStr = device_info || (typeof window !== 'undefined' ? window.navigator.userAgent : 'Browser Client');
      const res = await api.auth.punch({
        action,
        device_info: deviceStr,
        gps_latitude,
        gps_longitude
      });
      await checkPunchStatus();
    } catch (err) {
      console.error(`Failed to register punch-${action}:`, err);
      throw err;
    }
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updatedFields } as User : null);
  };

  const triggerAutoLogout = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vvf_token') : null;
      if (token) {
        await api.auth.autoLogout();
      }
    } catch (err) {
      console.warn('Auto logout request failed, cleaning local storage directly.');
    } finally {
      const currentRole = typeof window !== 'undefined' ? localStorage.getItem('vvf_role') : null;
      const roleStr = currentRole || (user ? user.role : '');

      removeToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('vvf_login_time');
      }
      setUser(null);
      setIsPunchedIn(false);
      setActivePunchRecord(null);
      setLoading(false);
      setShowWarningModal(false);
      setWarningDismissed(false);

      let redirectPath = '/login';
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        if (pathname.startsWith('/admin') || pathname.startsWith('/superadmin')) redirectPath = '/admin/login';
        else if (pathname.startsWith('/dental-doctor')) redirectPath = '/dental-doctor/login';
        else if (pathname.startsWith('/dentist-junior')) redirectPath = '/dentist-junior/login';
        else if (pathname.startsWith('/dental-assistant')) redirectPath = '/dental-assistant/login';
        else if (pathname.startsWith('/doctor')) redirectPath = '/doctor/login';
        else if (pathname.startsWith('/executive')) redirectPath = '/executive/login';
        else if (pathname.startsWith('/reception')) redirectPath = '/reception/login';
        else if (pathname.startsWith('/telecaller')) redirectPath = '/telecaller/login';
        else if (pathname.startsWith('/op-technician')) redirectPath = '/op-technician/login';
        else if (pathname.startsWith('/sop-technician')) redirectPath = '/sop-technician/login';
        else {
          redirectPath = getLoginPathForRole(roleStr);
        }
      } else {
        redirectPath = getLoginPathForRole(roleStr);
      }
      router.push(redirectPath);
    }
  };

  // Check auto-logout & warning state every 5 seconds
  useEffect(() => {
    if (!user) {
      setShowWarningModal(false);
      setWarningDismissed(false);
      return;
    }

    const checkAutoLogout = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // Warning window: 10:25 PM to 10:29:59 PM (22:25 to 22:29)
      const isInWarningWindow = currentHours === 22 && currentMinutes >= 25 && currentMinutes < 30;

      if (isInWarningWindow) {
        if (!warningDismissed) {
          setShowWarningModal(true);
        } else {
          setShowWarningModal(false);
        }
      } else {
        setShowWarningModal(false);
        setWarningDismissed(false);
      }

      // Invalidate if login time was before the last 10:30 PM threshold
      const loginTimeStr = localStorage.getItem('vvf_login_time');
      if (loginTimeStr) {
        const loginTime = new Date(loginTimeStr);
        if (isSessionExpiredBy1030PM(loginTime)) {
          triggerAutoLogout();
        }
      }
    };

    checkAutoLogout();
    const interval = setInterval(checkAutoLogout, 5000);
    return () => clearInterval(interval);
  }, [user, warningDismissed]);

  // Sync token removal across multiple tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vvf_token' && !e.newValue) {
        setUser(null);
        setIsPunchedIn(false);
        setActivePunchRecord(null);
        setShowWarningModal(false);
        setWarningDismissed(false);

        let redirectPath = '/login';
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          if (pathname.startsWith('/admin') || pathname.startsWith('/superadmin')) redirectPath = '/admin/login';
          else if (pathname.startsWith('/dental-doctor')) redirectPath = '/dental-doctor/login';
          else if (pathname.startsWith('/dentist-junior')) redirectPath = '/dentist-junior/login';
          else if (pathname.startsWith('/dental-assistant')) redirectPath = '/dental-assistant/login';
          else if (pathname.startsWith('/doctor')) redirectPath = '/doctor/login';
          else if (pathname.startsWith('/executive')) redirectPath = '/executive/login';
          else if (pathname.startsWith('/reception')) redirectPath = '/reception/login';
          else if (pathname.startsWith('/telecaller')) redirectPath = '/telecaller/login';
          else if (pathname.startsWith('/op-technician')) redirectPath = '/op-technician/login';
          else if (pathname.startsWith('/sop-technician')) redirectPath = '/sop-technician/login';
        }
        router.push(redirectPath);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);


  return (
    <AuthContext.Provider value={{
      user,
      activeRole,
      setActiveRole,
      loading,
      isPunchedIn,
      activePunchRecord,
      login,
      logout,
      checkPunchStatus,
      triggerPunch,
      updateUser
    }}>
      {children}
      {showWarningModal && (
        <AutoLogoutWarningModal onDismiss={() => setWarningDismissed(true)} />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
