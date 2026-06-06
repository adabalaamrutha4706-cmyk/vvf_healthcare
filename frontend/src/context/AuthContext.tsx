'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, removeToken } from '../lib/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Chief Doctor' | 'Doctor' | 'Reception' | 'Telecaller' | 'Executive' | 'Superadmin';
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPunchedIn: boolean;
  activePunchRecord: any | null;
  login: (credentials: { email: string; password: string }, redirectPath?: string) => Promise<void>;
  logout: (redirectPath?: string) => Promise<void>;
  checkPunchStatus: () => Promise<void>;
  triggerPunch: (action: 'in' | 'out', device_info?: string, gps_latitude?: number, gps_longitude?: number) => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [activePunchRecord, setActivePunchRecord] = useState<any | null>(null);
  const router = useRouter();

  // Load user details on boot
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('vvf_token');
        if (token) {
          const res = await api.auth.getMe();
          setUser(res.user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('vvf_role', res.user.role);
          }
          await checkPunchStatus(res.user);
        }
      } catch (err) {
        console.error('Failed to restore authentication session:', err);
        removeToken();
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

  const login = async (credentials: { email: string; password: string }, redirectPath?: string) => {
    setLoading(true);
    try {
      const res = await api.auth.login(credentials);
      setToken(res.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vvf_role', res.user.role);
      }
      setUser(res.user);
      await checkPunchStatus(res.user);
      
      if (redirectPath) {
        router.push(redirectPath);
      } else if (res.user.role === 'Superadmin') {
        router.push('/superadmin/dashboard');
      } else {
        const role = res.user.role.toLowerCase();
        if (role === 'admin') router.push('/admin/dashboard');
        else if (role === 'chief doctor') router.push('/chief-doctor/dashboard');
        else if (role === 'doctor') router.push('/doctor/dashboard');
        else if (role === 'executive') router.push('/executive/dashboard');
        else if (role === 'reception') router.push('/reception/dashboard');
        else if (role === 'telecaller') router.push('/telecaller/dashboard');
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
      setUser(null);
      setIsPunchedIn(false);
      setActivePunchRecord(null);
      setLoading(false);
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

  return (
    <AuthContext.Provider value={{
      user,
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
