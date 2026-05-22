'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, removeToken } from '../lib/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Chief Doctor' | 'Doctor' | 'Reception' | 'Telecaller' | 'Executive';
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPunchedIn: boolean;
  activePunchRecord: any | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
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
          await checkPunchStatus();
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

  const checkPunchStatus = async () => {
    try {
      const res = await api.auth.getAttendance();
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

  const login = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.auth.login(credentials);
      setToken(res.token);
      setUser(res.user);
      await checkPunchStatus();
      router.push('/dashboard');
    } catch (err) {
      removeToken();
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout request failed, cleaning local storage directly.');
    } finally {
      removeToken();
      setUser(null);
      setIsPunchedIn(false);
      setActivePunchRecord(null);
      setLoading(false);
      router.push('/login');
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
