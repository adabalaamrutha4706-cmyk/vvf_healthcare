'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Activity, ShieldAlert, KeyRound, Mail, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password Visibility Toggle
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal Flow
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    const token = localStorage.getItem('vvf_token');
    if (token && user) {
      if (user.role === 'Superadmin') {
        router.replace('/superadmin/dashboard');
      } else if (user.role === 'OP Technician') {
        router.replace('/op-technician/dashboard');
      } else if (user.role === 'SOP Technician') {
        router.replace('/sop-technician/dashboard');
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

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    try {
      await api.auth.requestPasswordReset(forgotEmail);
      setForgotSuccess('Request registered. Please contact the HPS Team or System Administrator.');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to submit reset request.');
    } finally {
      setForgotLoading(false);
    }
  };

  const fillCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 relative overflow-hidden px-4 font-sans">
      {/* Visual background details */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[500px] md:w-[500px] bg-white rounded-2xl shadow-xl p-8 z-10 flex flex-col items-center border border-slate-100">
        
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary-green flex items-center justify-center shadow-lg mb-3">
            <Activity className="h-7 w-7 text-white animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-slate-500 tracking-tight text-center leading-tight">
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
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm placeholder-slate-400 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Access Password
              </label>
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setForgotSuccess(''); setForgotError(''); setShowForgotModal(true); }}
                className="text-xs text-primary-green hover:text-emerald-800 font-medium hover:underline transition-colors bg-transparent border-none cursor-pointer outline-none text-left p-0"
              >
                Forgot?
              </button>
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
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              💼 Admin (Full Access)
            </button>
            <button
              id="fill-dental"
              onClick={() => fillCredentials('dental@vvf.org', 'dental123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🦷 Dental Doctor
            </button>
            <button
              id="fill-doctor"
              onClick={() => fillCredentials('doctor@vvf.org', 'doctor123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🩺 Doctor (Clinician)
            </button>
            <button
              id="fill-reception"
              onClick={() => fillCredentials('reception@vvf.org', 'reception123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              📝 Reception (Desk)
            </button>
            <button
              id="fill-telecaller"
              onClick={() => fillCredentials('telecaller@vvf.org', 'telecaller123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              📞 Telecaller (Leads)
            </button>
            <button
              id="fill-executive"
              onClick={() => fillCredentials('executive@vvf.org', 'executive123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🏃‍♂️ Executive (Field)
            </button>
            <button
              id="fill-optech"
              onClick={() => fillCredentials('optech@vvf.org', 'optech123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🔧 OP Tech (Therapies)
            </button>
            <button
              id="fill-soptech"
              onClick={() => fillCredentials('soptech@vvf.org', 'soptech123')}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg font-semibold transition-colors text-left truncate cursor-pointer shadow-sm"
            >
              🔬 SOP Tech (Audit)
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div 
            onClick={() => setShowForgotModal(false)}
            className="fixed inset-0 cursor-pointer"
          />
          <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100 z-10 space-y-6 flex flex-col relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650 bg-transparent border-none cursor-pointer outline-none text-lg font-bold p-0"
            >
              ×
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-500">
                Password Reset Restricted
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                For security reasons, passwords cannot be reset directly from this portal. 
                Please contact the HPS Team or System Administrator for password assistance.
              </p>
              <p className="text-xs sm:text-sm text-primary-green font-bold">
                support@vvf.org
              </p>
            </div>

            {forgotError && (
              <div className="p-3.5 rounded-xl bg-alert-bg border border-alert-border text-xs text-alert-text flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-alert-text" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <div className="h-4.5 w-4.5 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold">✓</div>
                <span>{forgotSuccess}</span>
              </div>
            )}

            {!forgotSuccess && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Enter Corporate Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@vvf.org"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm placeholder-slate-400 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-primary-green hover:bg-primary-green-hover text-white font-semibold text-sm py-3.5 rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {forgotLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Contact HPS Team'
                  )}
                </button>
              </form>
            )}

            {forgotSuccess && (
              <a
                href="mailto:support@vvf.org?subject=VVF Portal Password Reset Request"
                className="w-full bg-primary-green hover:bg-primary-green-hover text-white font-semibold text-sm py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-center decoration-none"
              >
                Send Email to support@vvf.org
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full border text-slate-500 hover:bg-slate-50 text-slate-655 font-semibold text-sm py-3 rounded-xl cursor-pointer transition-all text-center bg-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
