'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Activity, ShieldAlert, KeyRound, Mail, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    const token = localStorage.getItem('vvf_token');
    if (token && user) {
      if (user.role === 'Superadmin') {
        router.replace('/superadmin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
      setLoading(false);
    }
  };

  const fillCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-bg text-slate-900 relative overflow-hidden px-4">
      {/* Visual background details */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[min(32rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-8 z-10 flex flex-col items-center mobile-contained">
        
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary-green flex items-center justify-center shadow-lg mb-3">
            <Activity className="h-7 w-7 text-white animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight text-center leading-tight">
            VENKATESWARA VASCULAR FOUNDATION
          </h1>
          <p className="text-xs text-primary-green font-bold uppercase tracking-wider mt-1">
            Clinical Operations Portal
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
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-450 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Access Password
              </label>
              <Link 
                href="/forgot-password" 
                className="text-xs text-primary-green hover:text-emerald-800 font-medium hover:underline transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-450 transition-all outline-none"
              />
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

        {/* Demo Fast Logins */}
        <div className="w-full mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4 justify-center">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
            <span>Developer Sandbox Quick-Fill Logs</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <button
              id="fill-admin"
              onClick={() => fillCredentials('admin@vvf.org', 'admin123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              💼 Admin (Full Access)
            </button>
            <button
              id="fill-chief"
              onClick={() => fillCredentials('chief@vvf.org', 'chief123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🏥 Chief Doctor
            </button>
            <button
              id="fill-doctor"
              onClick={() => fillCredentials('doctor@vvf.org', 'doctor123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🩺 Doctor (Clinician)
            </button>
            <button
              id="fill-reception"
              onClick={() => fillCredentials('reception@vvf.org', 'reception123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              📝 Reception (Desk)
            </button>
            <button
              id="fill-telecaller"
              onClick={() => fillCredentials('telecaller@vvf.org', 'telecaller123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              📞 Telecaller (Leads)
            </button>
            <button
              id="fill-executive"
              onClick={() => fillCredentials('executive@vvf.org', 'executive123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🏃‍♂️ Executive (Field)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
