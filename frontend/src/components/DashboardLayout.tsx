'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { 
  LayoutDashboard, Calendar, CreditCard, Building2, MapPin, 
  PhoneCall, Users2, Settings2, LogOut, Bell, Menu, X, 
  Play, Square, Map, Moon, Sun, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { name: 'Superadmin Panel', href: '/superadmin/dashboard', icon: LayoutDashboard, roles: ['Superadmin'] },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive'] },
  { name: 'Appointments', href: '/appointments', icon: Calendar, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Superadmin'] },
  { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['Admin', 'Superadmin', 'Reception'] },
  { name: 'Go Visits', href: '/visits', icon: MapPin, roles: ['Admin', 'Executive', 'Superadmin'] },
  { name: 'Hospitals', href: '/hospitals', icon: Building2, roles: ['Admin', 'Executive', 'Superadmin'] },
  { name: 'Telecalling', href: '/telecaller', icon: PhoneCall, roles: ['Admin', 'Telecaller', 'Superadmin'] },
  { name: 'Attendance', href: '/attendance', icon: Clock, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive', 'Superadmin'] },
  { name: 'User Management', href: '/users', icon: Users2, roles: ['Admin', 'Superadmin'] },
  { name: 'Settings', href: '/settings', icon: Settings2, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive', 'Superadmin'] },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isPunchedIn, triggerPunch, activePunchRecord } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [punchLoading, setPunchLoading] = useState(false);

  // Clock timer
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
    if (r === 'chief doctor') return '/chief-doctor/login';
    return `/${r}/login`;
  };

  const getRolePrefix = (role: string): string => {
    const r = role.toLowerCase().trim();
    if (r === 'admin' || r === 'superadmin') return '/admin';
    if (r === 'chief doctor') return '/chief-doctor';
    if (r === 'doctor') return '/doctor';
    if (r === 'executive') return '/executive';
    if (r === 'reception') return '/reception';
    if (r === 'telecaller') return '/telecaller';
    return '';
  };

  // Guard routing & handle redirects
  useEffect(() => {
    const token = localStorage.getItem('vvf_token');
    if (!token) {
      if (pathname.startsWith('/admin')) {
        router.push('/admin/login');
      } else if (pathname.startsWith('/chief-doctor')) {
        router.push('/chief-doctor/login');
      } else if (pathname.startsWith('/doctor')) {
        router.push('/doctor/login');
      } else if (pathname.startsWith('/executive')) {
        router.push('/executive/login');
      } else if (pathname.startsWith('/reception')) {
        router.push('/reception/login');
      } else if (pathname.startsWith('/telecaller')) {
        router.push('/telecaller/login');
      } else {
        router.push('/login');
      }
    } else if (user) {
      const isSuper = user.role === 'Superadmin';
      if (pathname.startsWith('/admin') && user.role !== 'Admin' && !isSuper) {
        logout('/admin/login');
      } else if (pathname.startsWith('/chief-doctor') && user.role !== 'Chief Doctor' && !isSuper) {
        logout('/chief-doctor/login');
      } else if (pathname.startsWith('/doctor') && user.role !== 'Doctor' && !isSuper) {
        logout('/doctor/login');
      } else if (pathname.startsWith('/executive') && user.role !== 'Executive' && !isSuper) {
        logout('/executive/login');
      } else if (pathname.startsWith('/reception') && user.role !== 'Reception' && !isSuper) {
        logout('/reception/login');
      } else if (pathname.startsWith('/telecaller') && user.role !== 'Telecaller' && !isSuper) {
        logout('/telecaller/login');
      }
    }
  }, [user, router, pathname]);

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-secondary-bg text-secondary-text">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-green border-t-transparent"></div>
          <p className="text-sm font-medium text-secondary-text">Loading your profile session...</p>
        </div>
      </div>
    );
  }

  const prefix = getRolePrefix(user.role);
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

  const handleMarkRead = async (id: number) => {
    try {
      await api.dashboard.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-secondary-bg text-secondary-text w-full max-w-full">
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
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href}
                id={`sidebar-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                href={item.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  active 
                    ? 'bg-light-green text-primary-green font-semibold shadow-sm' 
                    : 'text-secondary-text hover:bg-very-light-green hover:text-primary-green'
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-primary-green' : 'text-secondary-text group-hover:text-primary-green'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-border-gray bg-secondary-bg">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-very-light-green flex items-center justify-center font-bold text-primary-green border border-light-green">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-secondary-text truncate">{user.name}</p>
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
                <button id="close-mobile-menu" onClick={() => setSidebarOpen(false)} className="text-secondary-text hover:text-primary-green">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                {allowedItems.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.href}
                      id={`mobile-sidebar-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      href={item.href} 
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        active ? 'bg-light-green text-primary-green font-semibold' : 'text-secondary-text hover:bg-very-light-green hover:text-primary-green'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-primary-green' : 'text-secondary-text'}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-border-gray bg-secondary-bg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-very-light-green flex items-center justify-center font-bold text-primary-green border border-light-green">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-secondary-text truncate">{user.name}</p>
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
        <header className="h-16 border-b border-border-gray bg-white/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 z-30 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button 
              id="open-mobile-menu"
              onClick={() => setSidebarOpen(true)} 
              className="text-secondary-text hover:text-primary-green md:hidden cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Clock & Punch status */}
            <div className="hidden sm:flex items-center gap-3 bg-secondary-bg px-4 py-1.5 rounded-full border border-border-gray text-secondary-text">
              <div className="flex items-center gap-1.5 text-xs text-secondary-text">
                <Clock className="h-3.5 w-3.5 text-primary-green animate-pulse" />
                <span>{currentTime}</span>
              </div>
              <div className="h-3 w-px bg-border-gray" />
              {isPunchedIn && activePunchRecord ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-very-light-green text-primary-green border border-light-green">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-green animate-ping" />
                    Session Active
                  </span>
                  <span className="text-[10px] text-secondary-text">
                    In: {new Date(activePunchRecord.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-alert-bg text-alert-text border border-alert-border">
                  Offline/No Session
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-4 relative shrink-0">
            {/* User details (Tablet & Desktop) */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs text-slate-400">Current Session</span>
              <span className="text-xs font-semibold text-primary-green">{user.role} Dashboard</span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                id="notification-bell-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-secondary-bg hover:bg-slate-100 text-secondary-text hover:text-primary-green transition-all cursor-pointer border border-border-gray"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary-green text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-[min(288px,calc(100vw-1rem))] bg-white border border-border-gray rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-border-gray flex items-center justify-between bg-secondary-bg">
                        <span className="font-semibold text-xs text-primary-green">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] text-primary-green font-bold">{unreadCount} Unread</span>
                        )}
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto divide-y divide-border-gray">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-secondary-text">
                            No alerts or updates.
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <div 
                              key={item.id} 
                              className={`p-3 text-xs leading-normal transition-colors ${item.is_read ? 'text-slate-400 bg-white' : 'text-slate-800 bg-secondary-bg/30'}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-primary-green">{item.title}</span>
                                {!item.is_read && (
                                  <button 
                                    onClick={() => handleMarkRead(item.id)}
                                    className="text-[9px] text-primary-green hover:underline font-bold"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                              <p className="text-secondary-text mb-1">{item.message}</p>
                              <span className="text-[9px] text-slate-400">
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {/* User Avatar Circle */}
            <div className="h-9 w-9 rounded-full bg-primary-green flex items-center justify-center font-bold text-white text-sm shadow-sm">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Sticky Mobile Clock Widget */}
        <div className="sm:hidden flex items-center justify-between bg-white border-b border-border-gray px-4 py-1.5">
          <span className="text-[11px] font-semibold text-secondary-text">Shift status:</span>
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-secondary-bg p-3 sm:p-5 md:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
