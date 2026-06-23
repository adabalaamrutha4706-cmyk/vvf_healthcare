'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { api, BACKEND_URL } from '../lib/api';
import { 
  LayoutDashboard, Calendar, CreditCard, Building2, MapPin, 
  PhoneCall, Users2, Settings, LogOut, Bell, Menu, X, 
  Play, Square, Map, Moon, Sun, Clock, Home, CalendarDays, ClipboardCheck,
  Camera, RefreshCw, Activity, BarChart3, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeaderProfilePanel } from './HeaderProfilePanel';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { name: 'Superadmin Panel', href: '/superadmin/dashboard', icon: LayoutDashboard, roles: ['Superadmin'] },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Dental Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive', 'OP Technician', 'SOP Technician'] },
  { name: 'Appointments', href: '/appointments', icon: Calendar, roles: ['Admin', 'Doctor', 'Dental Doctor', 'Reception', 'Superadmin', 'OP Technician', 'SOP Technician'] },
  { name: 'Field leads', href: '/field-appointments', icon: CalendarDays, roles: ['Executive', 'Admin', 'Superadmin', 'Telecaller'] },
  { name: 'Attendance', href: '/attendance', icon: Clock, roles: ['Admin', 'Dental Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive', 'Superadmin', 'OP Technician', 'SOP Technician'] },
  { name: 'Field Visits', href: '/visits?type=field', icon: MapPin, roles: ['Admin', 'Executive', 'Superadmin'] },
  { name: 'Dental Visits', href: '/visits?type=dental', icon: MapPin, roles: ['Admin', 'Executive', 'Superadmin'] },
  { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['Admin', 'Superadmin', 'Reception'] },
  { name: 'Hospitals', href: '/hospitals', icon: Building2, roles: ['Admin', 'Superadmin'] },
  { name: 'Telecalling', href: '/telecaller', icon: PhoneCall, roles: ['Admin', 'Telecaller', 'Superadmin'] },
  { name: 'Therapies', href: '/therapies', icon: Activity, roles: ['Admin', 'Superadmin'] },
  { name: 'Session History', href: '/therapies/history', icon: ClipboardCheck, roles: ['Admin', 'Superadmin'] },
  { name: 'User Management', href: '/users', icon: Users2, roles: ['Admin', 'Superadmin'] },
  { name: 'Daily Reports', href: '/reports', icon: BarChart3, roles: ['Admin', 'Superadmin'] },
  { name: 'Target Management', href: '/targets', icon: Target, roles: ['Admin', 'Superadmin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['Admin', 'Dental Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive', 'Superadmin', 'OP Technician', 'SOP Technician'] },
];

function calculateAge(dobStr?: string | null): string {
  if (!dobStr) return 'Not set';
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return 'Not set';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return String(age);
}

function formatDate(dobStr?: string | null): string {
  if (!dobStr) return 'Not set';
  const date = new Date(dobStr);
  if (Number.isNaN(date.getTime())) return dobStr;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/ /g, '-');
}

function DetailCard({ label, value, isStatus, status }: { label: string; value: string; isStatus?: boolean; status?: boolean }) {
  return (
    <div className="bg-slate-50/60 rounded-2xl p-3.5 border border-slate-100 flex flex-col justify-center min-w-0">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      {isStatus ? (
        <span className={`inline-flex items-center gap-1.5 mt-1 self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          status ? 'bg-very-light-green text-primary-green border border-light-green/35' : 'bg-alert-bg text-alert-text border border-alert-border'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status ? 'bg-primary-green animate-pulse' : 'bg-alert-text'}`} />
          {value}
        </span>
      ) : (
        <span className="text-xs font-semibold text-slate-700 mt-1 truncate" title={value}>{value}</span>
      )}
    </div>
  );
}

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isPunchedIn, triggerPunch, activePunchRecord, updateUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [punchLoading, setPunchLoading] = useState(false);
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Supported image types are JPG, PNG, and WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('File size is too large (max 5MB).');
      return;
    }

    setUploadingPhoto(true);
    setPhotoError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await api.auth.uploadProfilePhoto(formData);
      if (res.user) {
        updateUser(res.user);
      }
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns/modals on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowProfile(false);
        setShowAllNotificationsModal(false);
        setShowProfileModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.dashboard.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e);
    }
  };

  const getRelatedModule = (title: string, message: string) => {
    const text = (title + ' ' + message).toLowerCase();
    if (text.includes('appointment')) return 'Appointments';
    if (text.includes('payment') || text.includes('transaction')) return 'Payments';
    if (text.includes('visit') || text.includes('gps')) return 'Visits';
    if (text.includes('hospital')) return 'Hospitals';
    if (text.includes('telecall') || text.includes('lead')) return 'Telecalling';
    if (text.includes('attendance') || text.includes('punch')) return 'Attendance';
    return null;
  };

  const formatNotificationTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      const fetchNotifications = async () => {
        try {
          if (typeof window !== 'undefined' && !localStorage.getItem('vvf_token')) {
            return;
          }
          const res = await api.dashboard.getNotifications();
          setNotifications(res.notifications || []);
        } catch (e: any) {
          // Suppress authentication or cancellation logs during logout transitions
          if (e?.message && (e.message.includes('Authentication') || e.message.includes('token'))) {
            return;
          }
          console.error(e);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 20000); // refresh every 20s
      return () => clearInterval(interval);
    }
  }, [user]);

  // If loading or no user, wait (routes will be guarded)
  const getLoginPath = (role: string) => {
    const r = role.toLowerCase().trim();
    if (r === 'dental doctor') return '/dental-doctor/login';
    if (r === 'op technician') return '/op-technician/login';
    if (r === 'sop technician') return '/sop-technician/login';
    return `/${r}/login`;
  };

  const getRolePrefix = (role: string): string => {
    const r = role.toLowerCase().trim();
    if (r === 'admin' || r === 'superadmin') return '/admin';
    if (r === 'dental doctor') return '/dental-doctor';
    if (r === 'doctor') return '/doctor';
    if (r === 'executive') return '/executive';
    if (r === 'reception') return '/reception';
    if (r === 'telecaller') return '/telecaller';
    if (r === 'op technician') return '/op-technician';
    if (r === 'sop technician') return '/sop-technician';
    return '';
  };

  // Guard routing & handle redirects
  useEffect(() => {
    const token = localStorage.getItem('vvf_token');
    if (!token) {
      if (pathname.startsWith('/admin')) {
        router.push('/admin/login');
      } else if (pathname.startsWith('/dental-doctor')) {
        router.push('/dental-doctor/login');
      } else if (pathname.startsWith('/doctor')) {
        router.push('/doctor/login');
      } else if (pathname.startsWith('/executive')) {
        router.push('/executive/login');
      } else if (pathname.startsWith('/reception')) {
        router.push('/reception/login');
      } else if (pathname.startsWith('/telecaller')) {
        router.push('/telecaller/login');
      } else if (pathname.startsWith('/op-technician')) {
        router.push('/op-technician/login');
      } else if (pathname.startsWith('/sop-technician')) {
        router.push('/sop-technician/login');
      } else {
        router.push('/login');
      }
    } else if (user) {
      const isSuper = user.role === 'Superadmin';
      if (pathname.startsWith('/admin') && user.role !== 'Admin' && !isSuper) {
        logout('/admin/login');
      } else if (pathname.startsWith('/dental-doctor') && user.role !== 'Dental Doctor' && !isSuper) {
        logout('/dental-doctor/login');
      } else if (pathname.startsWith('/doctor') && user.role !== 'Doctor' && !isSuper) {
        logout('/doctor/login');
      } else if (pathname.startsWith('/executive') && user.role !== 'Executive' && !isSuper) {
        logout('/executive/login');
      } else if (pathname.startsWith('/reception') && user.role !== 'Reception' && !isSuper) {
        logout('/reception/login');
      } else if (pathname.startsWith('/telecaller') && user.role !== 'Telecaller' && !isSuper) {
        logout('/telecaller/login');
      } else if (pathname.startsWith('/op-technician') && user.role !== 'OP Technician' && !isSuper) {
        logout('/op-technician/login');
      } else if (pathname.startsWith('/sop-technician') && user.role !== 'SOP Technician' && !isSuper) {
        logout('/sop-technician/login');
      }
    }
  }, [user, router, pathname]);

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-secondary-bg text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-green border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading your profile session...</p>
        </div>
      </div>
    );
  }

  const prefix = getRolePrefix(user.role);
  const dashboardHref = user.role === 'Superadmin' ? '/superadmin/dashboard' : `${prefix}/dashboard`;
  const isTabActive = (href: string) => {
    if (href.endsWith('/settings')) {
      return pathname.endsWith('/settings');
    }
    if (href.endsWith('/dashboard')) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };
  const allowedItems = SIDEBAR_ITEMS.filter(item => item.roles.includes(user.role)).map(item => {
    let targetHref = item.href;
    if (item.href !== '/superadmin/dashboard' && item.href !== '/dashboard' && !item.href.startsWith(prefix)) {
      if (item.href === '/telecaller') {
        targetHref = `${prefix}/telecalling`;
      } else {
        targetHref = `${prefix}${item.href}`;
      }
    } else if (item.href === '/dashboard') {
      targetHref = `${prefix}/dashboard`;
    }
    return { ...item, href: targetHref };
  });

  const handlePunchToggle = async () => {
  setPunchLoading(true);

  try {

    if (isPunchedIn) {

      await triggerPunch('out');

    } else {

      // Query GPS for secure punching
      if (
        typeof window !== 'undefined' &&
        navigator.geolocation
      ) {

        navigator.geolocation.getCurrentPosition(

          async (pos) => {

            console.log('LIVE GPS:', {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });

            await triggerPunch(
              'in',
              undefined,
              pos.coords.latitude,
              pos.coords.longitude
            );
          },

          async (error) => {

            console.error('GPS ERROR:', error);

            // Continue without GPS if denied
            await triggerPunch('in');
          },

          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );

      } else {

        await triggerPunch('in');

      }
    }

  } catch (e) {

    console.error(e);

    alert('Punch command failed to submit.');

  } finally {

    setPunchLoading(false);

  }
};

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const settingsHref = `${getRolePrefix(user.role)}/settings`;

  const handleToggleNotifications = () => {
    setShowProfile(false);
    setShowNotifications((prev) => !prev);
  };

  const handleToggleProfile = async () => {
    setShowNotifications(false);
    const next = !showProfile;
    setShowProfile(next);
    if (next) {
      try {
        const res = await api.auth.getMe();
        if (res.user) {
          updateUser(res.user);
        }
      } catch {
        // Keep cached user if refresh fails
      }
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.dashboard.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-secondary-bg text-slate-500 w-full max-w-full">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 bg-white border-r border-border-gray">
        {/* Brand */}
        <div className="flex h-16 items-center px-6 border-b border-border-gray gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary-green flex items-center justify-center font-bold text-white text-lg">
            V
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight text-primary-green">VENKATESWARA</span>
            <span className="text-[10px] text-primary-green font-semibold tracking-wider">VASCULAR FOUNDATION</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {allowedItems.map((item) => {
            const active = (() => {
              if (item.href.includes('?')) {
                const [path, queryStr] = item.href.split('?');
                if (pathname !== path) return false;
                if (typeof window !== 'undefined') {
                  const currentParams = new URLSearchParams(window.location.search);
                  const itemParams = new URLSearchParams(queryStr);
                  for (const [key, val] of itemParams.entries()) {
                    if (currentParams.get(key) !== val) return false;
                  }
                  return true;
                }
                return false;
              }
              return pathname === item.href;
            })();
            const Icon = item.icon;
            return (
              <Link 
                key={item.href}
                id={`sidebar-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                href={item.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  active 
                    ? 'bg-light-green text-primary-green font-semibold shadow-sm' 
                    : 'text-slate-500 hover:bg-very-light-green hover:text-primary-green'
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-primary-green' : 'text-slate-500 group-hover:text-primary-green'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-border-gray bg-secondary-bg">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-very-light-green flex items-center justify-center font-bold text-primary-green border border-light-green overflow-hidden">
              {user.photo_url ? (
                <img src={`${BACKEND_URL}${user.photo_url}`} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-500 truncate">{user.name}</p>
              <p className="text-[10px] text-primary-green font-bold uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <button 
            id="logout-btn"
            onClick={() => logout(getLoginPath(user.role))} 
            className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-alert-text bg-alert-bg hover:bg-[#fee2e2] border border-alert-border rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-[min(288px,85vw)] bg-white border-r border-border-gray flex flex-col md:hidden"
            >
              <div className="flex h-16 items-center justify-between px-6 border-b border-border-gray">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary-green flex items-center justify-center font-bold text-white text-lg">
                    V
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-tight text-primary-green">VENKATESWARA</span>
                    <span className="text-[10px] text-primary-green font-semibold tracking-wider">VASCULAR FOUNDATION</span>
                  </div>
                </div>
                <button id="close-mobile-menu" onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-primary-green">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                {allowedItems.map((item) => {
                  const active = (() => {
                    if (item.href.includes('?')) {
                      const [path, queryStr] = item.href.split('?');
                      if (pathname !== path) return false;
                      if (typeof window !== 'undefined') {
                        const currentParams = new URLSearchParams(window.location.search);
                        const itemParams = new URLSearchParams(queryStr);
                        for (const [key, val] of itemParams.entries()) {
                          if (currentParams.get(key) !== val) return false;
                        }
                        return true;
                      }
                      return false;
                    }
                    return pathname === item.href;
                  })();
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.href}
                      id={`mobile-sidebar-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      href={item.href} 
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        active ? 'bg-light-green text-primary-green font-semibold' : 'text-slate-500 hover:bg-very-light-green hover:text-primary-green'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-primary-green' : 'text-slate-500'}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-border-gray bg-secondary-bg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-very-light-green flex items-center justify-center font-bold text-primary-green border border-light-green overflow-hidden">
                    {user.photo_url ? (
                      <img src={`${BACKEND_URL}${user.photo_url}`} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 truncate">{user.name}</p>
                    <p className="text-[10px] text-primary-green font-bold uppercase">{user.role}</p>
                  </div>
                </div>
                <button 
                  id="mobile-logout-btn"
                  onClick={() => logout(getLoginPath(user.role))} 
                  className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-alert-text bg-alert-bg hover:bg-[#fee2e2] border border-alert-border rounded-lg"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border-gray bg-white/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 z-50 min-w-0 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button 
              id="open-mobile-menu"
              onClick={() => setSidebarOpen(true)} 
              className="text-slate-600 hover:text-primary-green md:hidden cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Clock & Punch status */}
            <div className="hidden sm:flex items-center gap-3 bg-secondary-bg px-4 py-1.5 rounded-full border border-border-gray text-secondary-text">
              <div className="flex items-center gap-1.5 text-xs text-secondary-text font-medium">
                <Clock className="h-3.5 w-3.5 text-primary-green animate-pulse" />
                <span>{currentTime}</span>
              </div>
              <div className="h-3.5 w-px bg-border-gray" />
              {isPunchedIn && activePunchRecord ? (
                <div className="flex items-center text-xs">
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-very-light-green text-primary-green border border-light-green/35">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-ping" />
                    Session Active
                  </span>
                </div>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-alert-bg text-alert-text border border-alert-border">
                  Offline
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0 min-w-0">
            {/* User details (Tablet & Desktop) */}
            <button 
              onClick={handleToggleProfile}
              className="hidden lg:flex flex-col text-right min-w-0 max-w-[150px] justify-center transition-all duration-200 hover:opacity-80 cursor-pointer border-0 bg-transparent p-0"
            >
              <span className="text-xs font-semibold text-[#059669] truncate">{user.name}</span>
              <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wide truncate">{user.role}</span>
            </button>


            {/* Notifications Bell */}
            <div 
              ref={notificationRef}
              className="relative shrink-0"
              onMouseEnter={() => {
                if (window.matchMedia('(hover: hover)').matches) {
                  setShowProfile(false);
                  setShowNotifications(true);
                }
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(hover: hover)').matches) {
                  setShowNotifications(false);
                }
              }}
            >
              <button 
                id="notification-bell-btn"
                onClick={handleToggleNotifications}
                aria-label="Notifications"
                aria-expanded={showNotifications}
                className="p-1.5 sm:p-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white border-0 transition-all duration-200 ease-in-out cursor-pointer relative shadow-sm hover:scale-105 active:scale-95"
              >
                <Bell className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-white text-[#059669] text-[8px] sm:text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-x-4 top-16 md:absolute md:right-0 md:left-auto md:top-full md:inset-x-auto md:mt-2 w-[calc(100vw-2rem)] md:w-[380px] bg-white border border-border-gray rounded-2xl shadow-2xl overflow-hidden z-[9999] flex flex-col max-h-[70vh] md:max-h-[480px]"
                  >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border-gray flex items-center justify-between bg-slate-50 gap-2 shrink-0">
                      <span className="font-bold text-xs text-primary-green">Notifications</span>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-primary-green hover:underline font-bold shrink-0"
                          >
                            Mark all as read
                          </button>
                        )}
                        {unreadCount > 0 && (
                          <span className="text-[9px] sm:text-[10px] text-primary-green bg-very-light-green border border-light-green/40 px-2 py-0.5 rounded-full font-bold shrink-0">{unreadCount} Unread</span>
                        )}
                      </div>
                    </div>
                    
                    {/* List */}
                    <div className="overflow-y-auto divide-y divide-border-gray flex-1">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-slate-500">
                          No notifications available
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const module = getRelatedModule(item.title, item.message);
                          return (
                            <div 
                              key={item.id} 
                              className={`p-3.5 text-xs leading-normal transition-colors min-w-0 ${item.is_read ? 'text-slate-400 bg-white' : 'text-slate-800 bg-secondary-bg/30'}`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1.5 min-w-0">
                                <span className="font-bold text-slate-850 truncate">{item.title}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {module && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold bg-very-light-green text-primary-green border border-light-green/30">
                                      {module}
                                    </span>
                                  )}
                                  {!item.is_read && (
                                    <button 
                                      onClick={() => handleMarkRead(item.id)}
                                      className="text-[9px] text-primary-green hover:underline font-bold"
                                    >
                                      Mark read
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-500 mb-1.5 break-words">{item.message}</p>
                              <span className="text-[9px] text-slate-400 font-medium">
                                {formatNotificationTime(item.created_at)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2.5 border-t border-border-gray bg-slate-50/50 shrink-0 text-center">
                      <button 
                        onClick={() => {
                          setShowNotifications(false);
                          setShowAllNotificationsModal(true);
                        }}
                        className="text-[10px] sm:text-xs text-primary-green hover:underline font-bold py-1 w-full block text-center cursor-pointer"
                      >
                        View All Notifications
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Profile Button */}
            <div className="relative shrink-0" ref={profileRef}>
              <button
                id="header-profile-btn"
                type="button"
                onClick={handleToggleProfile}
                aria-label="View profile"
                aria-expanded={showProfile}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary-green hover:bg-primary-green-hover flex items-center justify-center font-bold text-white text-xs sm:text-sm shadow-sm border-2 border-white ring-1 ring-border-gray transition-colors cursor-pointer overflow-hidden"
              >
                {user.photo_url ? (
                  <img src={`${BACKEND_URL}${user.photo_url}`} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </button>

              <AnimatePresence>
                {showProfile && (
                  <HeaderProfilePanel 
                    user={user} 
                    settingsHref={settingsHref} 
                    onViewProfileClick={() => {
                      setShowProfile(false);
                      setShowProfileModal(true);
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Sticky Mobile Clock Widget */}
        <div className="sm:hidden flex items-center justify-between bg-white border-b border-border-gray px-4 py-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Shift status:</span>
          {isPunchedIn && activePunchRecord ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-very-light-green text-primary-green px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-light-green">
                <span className="h-1 w-1 rounded-full bg-primary-green animate-ping" />
                Active
              </span>
              <span className="text-[9px] text-slate-500">
                ({new Date(activePunchRecord.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-bold text-alert-text bg-alert-bg px-2 py-0.5 rounded border border-alert-border">
              No Session
            </span>
          )}
        </div>

        {/* Main page scroll contents */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-secondary-bg p-3 sm:p-5 md:p-8 pb-20 md:pb-8 min-w-0">
          {children}
        </main>

        {/* Full View All Notifications Modal */}
        <AnimatePresence>
          {showAllNotificationsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-border-gray shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] mx-auto"
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-border-gray flex items-center justify-between bg-slate-50 shrink-0">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary-green animate-bounce" />
                    <h2 className="font-bold text-slate-800 text-sm md:text-base">All Alerts & Notifications</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-primary-green hover:underline font-bold"
                      >
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => setShowAllNotificationsModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="flex-1 overflow-y-auto divide-y divide-border-gray p-4">
                  {notifications.length === 0 ? (
                    <div className="px-6 py-12 text-center text-xs text-slate-500">
                      No notifications available
                    </div>
                  ) : (
                    notifications.map((item) => {
                      const module = getRelatedModule(item.title, item.message);
                      return (
                        <div
                          key={item.id}
                          className={`p-4 transition-colors rounded-2xl mb-2 flex items-start gap-4 ${
                            item.is_read ? 'text-slate-500 bg-white border border-slate-100' : 'text-slate-800 bg-secondary-bg border border-light-green/30'
                          }`}
                        >
                          {/* Dot indicator */}
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1.5 ${
                            item.is_read ? 'bg-transparent' : 'bg-primary-green animate-pulse'
                          }`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                              <span className="font-bold text-slate-800 text-xs sm:text-sm">{item.title}</span>
                              <div className="flex items-center gap-2">
                                {module && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-very-light-green text-primary-green border border-light-green/40">
                                    {module}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {formatNotificationTime(item.created_at)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed mb-2 break-words">{item.message}</p>
                            {!item.is_read && (
                              <button
                                onClick={() => handleMarkRead(item.id)}
                                className="text-[10px] text-primary-green hover:underline font-bold flex items-center gap-1"
                              >
                                Mark as Read
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border-gray shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-2xl z-40 pb-[env(safe-area-inset-bottom)] shrink-0">
        <div className="flex justify-around items-center h-16 px-2">
          {/* Home Tab */}
          <Link
            id="mobile-nav-home"
            href={dashboardHref}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors cursor-pointer select-none active:scale-95 ${
              isTabActive(dashboardHref) ? 'text-primary-green font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="h-5.5 w-5.5 mb-1 transition-transform" />
            <span className="text-[10px] tracking-wide">Home</span>
          </Link>

          {/* Appointments Tab */}
          <Link
            id="mobile-nav-appointments"
            href={`${prefix}/appointments`}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors cursor-pointer select-none active:scale-95 ${
              isTabActive(`${prefix}/appointments`) ? 'text-primary-green font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CalendarDays className="h-5.5 w-5.5 mb-1 transition-transform" />
            <span className="text-[10px] tracking-wide">Appointments</span>
          </Link>

          {/* Attendance Tab */}
          <Link
            id="mobile-nav-attendance"
            href={`${prefix}/attendance`}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors cursor-pointer select-none active:scale-95 ${
              isTabActive(`${prefix}/attendance`) ? 'text-primary-green font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ClipboardCheck className="h-5.5 w-5.5 mb-1 transition-transform" />
            <span className="text-[10px] tracking-wide">Attendance</span>
          </Link>

          {/* Settings Tab */}
          <Link
            id="mobile-nav-settings"
            href={settingsHref}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors cursor-pointer select-none active:scale-95 ${
              isTabActive(settingsHref) ? 'text-primary-green font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="h-5.5 w-5.5 mb-1 transition-transform" />
            <span className="text-[10px] tracking-wide">Settings</span>
          </Link>
        </div>
      </div>

      {/* Full Screen View Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-fade-in"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close profile"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Profile Header Block */}
              <div className="relative bg-gradient-to-br from-primary-green to-emerald-800 text-white px-6 pt-12 pb-8 flex flex-col items-center shrink-0">
                {/* Decorative background blur shape */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                
                {/* Avatar Upload Container */}
                <div className="relative group">
                  <div className="h-28 w-28 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-4xl shadow-xl border-4 border-white overflow-hidden relative">
                    {user.photo_url ? (
                      <img src={`${BACKEND_URL}${user.photo_url}`} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Camera Upload Button Overlay */}
                  <label className="absolute bottom-0 right-0 p-2 rounded-full bg-white hover:bg-slate-50 text-primary-green shadow-lg border border-slate-100 cursor-pointer transition-transform active:scale-90 flex items-center justify-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                    <Camera className="h-4.5 w-4.5" />
                  </label>
                </div>

                <h2 className="mt-4 text-xl font-bold tracking-tight">{user.name}</h2>
                <div className="mt-1.5 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 border border-white/20">
                  {user.role}
                </div>
                
                {photoError && (
                  <div className="mt-3 text-xs font-semibold text-red-100 bg-red-950/40 border border-red-500/20 px-3.5 py-1.5 rounded-xl text-center shadow-inner max-w-[90%]">
                    {photoError}
                  </div>
                )}
              </div>

              {/* Profile Details List */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailCard label="Employee ID" value={`EMP-${String(user.id).padStart(3, '0')}`} />
                  <DetailCard label="Gender" value={user.gender || 'Not set'} />
                  <DetailCard label="Date of Birth" value={formatDate(user.date_of_birth)} />
                  <DetailCard label="Age" value={calculateAge(user.date_of_birth)} />
                  <DetailCard label="Personal Email" value={user.personal_email || 'Not set'} />
                  <DetailCard label="Work Email" value={user.email} />
                  <DetailCard label="Phone" value={user.phone || 'Not set'} />
                  <DetailCard label="Status" value={user.is_active !== false ? 'Active' : 'Inactive'} isStatus status={user.is_active !== false} />
                </div>

                {user.about && (
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/60">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">About Me</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{user.about}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};
