'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Activity, ShieldAlert, KeyRound, Mail, Sparkles } from 'lucide-react';

interface RoleLoginProps {
  targetRole: 'Admin' | 'Dental Doctor' | 'Dentist Junior' | 'Dental Assistant' | 'Doctor' | 'Executive' | 'Reception' | 'Telecaller' | 'OP Technician' | 'SOP Technician';
  icon: React.ReactNode;
}

export default function RoleLogin({ targetRole, icon }: RoleLoginProps) {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getDashboardPath = (role: string) => {
    const r = role.toLowerCase().trim();
    if (r === 'admin' || r === 'superadmin' || r === 'co-admin') return '/admin/dashboard';
    return `/${r.replace(/\s+/g, '-')}/dashboard`;
  };

  useEffect(() => {
    if (authLoading) return;
    const token = localStorage.getItem('vvf_token');
    if (token && user) {
      const userRoles = (user.role || '').split(',').map((r: string) => r.trim().toLowerCase());
      const lowerTargetRole = targetRole.toLowerCase();

      let isAuthorized = userRoles.includes(lowerTargetRole);
      if (!isAuthorized && lowerTargetRole === 'admin') {
        isAuthorized = userRoles.includes('superadmin') || userRoles.includes('co-admin');
      }

      if (isAuthorized) {
        router.replace(getDashboardPath(targetRole));
      }
    }
  }, [user, router, targetRole, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const dashboardPath = getDashboardPath(targetRole);
      await login({ email, password }, dashboardPath, targetRole);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
      setLoading(false);
    }
  };

  // Demo credential mapping
  const getDemoCredentials = () => {
    switch (targetRole) {
      case 'Admin':
        return { email: 'admin@vvf.org', pass: 'admin123', label: '💼 Admin Sandbox Log' };
      case 'Dental Doctor':
        return { email: 'dental@vvf.org', pass: 'dental123', label: '🦷 Dental Doctor Sandbox Log' };
      case 'Dentist Junior':
        return { email: 'dentistjr@vvf.org', pass: 'dentistjr123', label: '🦷 Dentist Junior Sandbox Log' };
      case 'Dental Assistant':
        return { email: 'dentalasst@vvf.org', pass: 'dentalasst123', label: '🦷 Dental Assistant Sandbox Log' };
      case 'Doctor':
        return { email: 'doctor@vvf.org', pass: 'doctor123', label: '🩺 Doctor Sandbox Log' };
      case 'Executive':
        return { email: 'executive@vvf.org', pass: 'executive123', label: '🏃‍♂️ Executive Sandbox Log' };
      case 'Reception':
        return { email: 'reception@vvf.org', pass: 'reception123', label: '📝 Reception Sandbox Log' };
      case 'Telecaller':
        return { email: 'telecaller@vvf.org', pass: 'telecaller123', label: '📞 Telecaller Sandbox Log' };
      case 'OP Technician':
        return { email: 'optech@vvf.org', pass: 'optech123', label: '🔧 OP Tech Sandbox Log' };
      case 'SOP Technician':
        return { email: 'soptech@vvf.org', pass: 'soptech123', label: '🔬 SOP Tech Sandbox Log' };
      default:
        return null;
    }
  };

  const demo = getDemoCredentials();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 relative overflow-hidden px-4 font-sans">
      {/* Visual background details */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[500px] md:w-[500px] bg-white rounded-2xl shadow-xl p-8 z-10 flex flex-col items-center border border-slate-100">
        
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Pranavayu Logo" className="h-16 object-contain mb-2" />
          <p className="text-xs text-primary-green font-bold uppercase tracking-wider">
            {targetRole} Clinical Portal
          </p>
        </div>

        {/* Error panel */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-xl bg-alert-bg border border-alert-border flex items-center gap-3 text-xs text-alert-text leading-normal">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-alert-text" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Corporate Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@vvf.org"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Access Password
              </label>
              <span className="text-[10px] text-slate-400 font-bold tracking-wider">Secure Connection</span>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-10 pr-10 text-sm placeholder-slate-400 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer outline-none p-0 flex items-center justify-center"
              >
                {showPassword ? (
                  <div className="text-[10px] font-extrabold text-primary-green">HIDE</div>
                ) : (
                  <div className="text-[10px] font-extrabold text-slate-400 hover:text-primary-green">SHOW</div>
                )}
              </button>
            </div>
          </div>

          <button
            id="submit-login"
            type="submit"
            disabled={loading}
            className="w-full bg-primary-green hover:bg-primary-green-hover text-white font-semibold text-sm py-3.5 rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Verify & Access Portal'
            )}
          </button>
        </form>


      </div>
    </div>
  );
}
