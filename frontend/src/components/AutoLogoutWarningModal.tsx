'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock } from 'lucide-react';

interface AutoLogoutWarningModalProps {
  onDismiss: () => void;
}

export const AutoLogoutWarningModal: React.FC<AutoLogoutWarningModalProps> = ({ onDismiss }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(22, 30, 0, 0);

      // If we are past 10:30 PM today, countdown is 0 (or target is tomorrow's 10:30 PM, but we'd be logged out already)
      let diffMs = target.getTime() - now.getTime();
      if (diffMs < 0) {
        setTimeLeft('00:00');
        return;
      }

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const formatNum = (num: number) => String(num).padStart(2, '0');
      setTimeLeft(`${formatNum(minutes)}:${formatNum(seconds)}`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Semi-transparent dark overlay with backdrop blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden"
      >
        {/* Glow effect at the top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent blur-sm" />

        <div className="flex flex-col items-center text-center">
          {/* Warning Icon Container */}
          <div className="h-16 w-16 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/35 rounded-2xl flex items-center justify-center mb-5 relative">
            <AlertTriangle className="h-8 w-8 text-amber-500 animate-pulse" />
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-slate-850 dark:text-white mb-2 leading-tight">
            Security Logout Warning
          </h2>

          {/* Description message required exactly */}
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 px-2">
            For security purposes, the system will automatically log you out at 10:30 PM. Please save any pending work.
          </p>

          {/* Countdown Clock Panel */}
          <div className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl py-4 px-6 flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Time Remaining
              </span>
            </div>
            <span className="font-mono text-2xl font-black text-amber-600 dark:text-amber-500 tracking-wider">
              {timeLeft}
            </span>
          </div>

          {/* Action Buttons */}
          <button
            onClick={onDismiss}
            className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 cursor-pointer text-center"
          >
            Got It, I'll Save My Work
          </button>
        </div>
      </motion.div>
    </div>
  );
};
