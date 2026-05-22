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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive'] },
  { name: 'Appointments', href: '/appointments', icon: Calendar, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception'] },
  { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['Admin', 'Reception'] },
  { name: 'Go Visits', href: '/visits', icon: MapPin, roles: ['Admin', 'Executive'] },
  { name: 'Hospitals', href: '/hospitals', icon: Building2, roles: ['Admin', 'Executive'] },
  { name: 'Telecalling', href: '/telecaller', icon: PhoneCall, roles: ['Admin', 'Telecaller'] },
  { name: 'Attendance', href: '/attendance', icon: Clock, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive'] },
  { name: 'User Management', href: '/users', icon: Users2, roles: ['Admin'] },
  { name: 'Settings', href: '/settings', icon: Settings2, roles: ['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Telecaller', 'Executive'] },
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
          const res = await api.dashboard.getNotifications();
          setNotifications(res.notifications || []);
        } catch (e) {
          console.error(e);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 20000); // refresh every 20s
      return () => clearInterval(interval);
    }
  }, [user]);

  // If loading or no user, wait (routes will be guarded)
  useEffect(() => {
    const token = localStorage.getItem('vvf_token');
    if (!token) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-400">Loading your profile session...</p>
        </div>
      </div>
    );
  }

  const allowedItems = SIDEBAR_ITEMS.filter(item => item.roles.includes(user.role));

  const handlePunchToggle = async () => {
    setPunchLoading(true);
    try {
      if (isPunchedIn) {
        await triggerPunch('out');
      } else {
        // Query basic GPS for security punching if available
        if (typeof window !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              await triggerPunch('in', undefined, pos.coords.latitude, pos.coords.longitude);
            },
            async () => {
              // Denied GPS, continue with mock punch
              await triggerPunch('in');
            }
          );
        } else {
          await triggerPunch('in');
        }
      }
    } catch (e) {
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
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 bg-slate-900 border-r border-slate-800">
        {/* Brand */}
        <div className="flex h-16 items-center px-6 border-b border-slate-800 gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center font-bold text-white text-lg">
            V
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight text-white">VENKATESWARA</span>
            <span className="text-[10px] text-cyan-400 font-semibold tracking-wider">VASCULAR FOUNDATION</span>
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
                    ? 'bg-gradient-to-r from-cyan-900/60 to-blue-900/40 text-cyan-300 border-l-4 border-cyan-500 shadow-lg shadow-cyan-950/20' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-slate-700">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <button 
            id="logout-btn"
            onClick={logout} 
            className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-900/60 rounded-lg transition-colors cursor-pointer"
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
              className="fixed inset-0 z-40 bg-black md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col md:hidden"
            >
              <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center font-bold text-white text-lg">
                    V
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-tight text-white">VENKATESWARA</span>
                    <span className="text-[10px] text-cyan-400 font-semibold tracking-wider">VASCULAR FOUNDATION</span>
                  </div>
                </div>
                <button id="close-mobile-menu" onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
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
                        active ? 'bg-gradient-to-r from-cyan-900/60 to-blue-900/40 text-cyan-300 border-l-4 border-cyan-500' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-400 group-hover:text-white" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 border border-slate-700">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                    <p className="text-[10px] text-cyan-400 font-bold uppercase">{user.role}</p>
                  </div>
                </div>
                <button 
                  id="mobile-logout-btn"
                  onClick={logout} 
                  className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-4">
            <button 
              id="open-mobile-menu"
              onClick={() => setSidebarOpen(true)} 
              className="text-slate-400 hover:text-white md:hidden cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Clock & Punch status */}
            <div className="hidden sm:flex items-center gap-3 bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                <span>{currentTime}</span>
              </div>
              <div className="h-3 w-px bg-slate-800" />
              {isPunchedIn && activePunchRecord ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-ping" />
                    Session Active
                  </span>
                  <span className="text-[10px] text-slate-400">
                    In: {new Date(activePunchRecord.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-950/50 text-rose-450 border border-rose-500/30">
                  Offline/No Session
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4 relative">
            {/* User details (Tablet & Desktop) */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs text-slate-400">Current Session</span>
              <span className="text-xs font-semibold text-cyan-300">{user.role} Dashboard</span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                id="notification-bell-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-cyan-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
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
                      className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                        <span className="font-semibold text-xs text-white">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] text-cyan-400 font-bold">{unreadCount} Unread</span>
                        )}
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-slate-500">
                            No alerts or updates.
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <div 
                              key={item.id} 
                              className={`p-3 text-xs leading-normal transition-colors ${item.is_read ? 'text-slate-400 bg-slate-900/40' : 'text-slate-200 bg-slate-800/30'}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-slate-200">{item.title}</span>
                                {!item.is_read && (
                                  <button 
                                    onClick={() => handleMarkRead(item.id)}
                                    className="text-[9px] text-cyan-400 hover:underline"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                              <p className="text-slate-400 mb-1">{item.message}</p>
                              <span className="text-[9px] text-slate-500">
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
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Sticky Mobile Clock Widget */}
        <div className="sm:hidden flex items-center justify-between bg-slate-900 border-b border-slate-850 px-6 py-2">
          <span className="text-[11px] font-semibold text-slate-400">Shift status:</span>
          {isPunchedIn && activePunchRecord ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-450 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-emerald-900/20">
                <span className="h-1 w-1 rounded-full bg-emerald-450 animate-ping" />
                Active
              </span>
              <span className="text-[9px] text-slate-400">
                ({new Date(activePunchRecord.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-bold text-rose-450 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/20">
              No Session
            </span>
          )}
        </div>

        {/* Main page scroll contents */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
