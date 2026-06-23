'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Target, Award, Sparkles, TrendingUp, Calendar, Zap, CheckCircle2 } from 'lucide-react';

interface MyPerformanceData {
  dailyCount: number;
  monthlyCount: number;
  monthlyTarget: number;
  achievementPercentage: number;
}

interface MyPerformanceWidgetProps {
  performance: MyPerformanceData | null;
  role: string;
}

function getPerformanceLabels(role: string) {
  switch (role) {
    case 'Reception':
      return {
        unit: 'Appointments',
        dailyLabel: 'Registered Today',
        monthlyLabel: 'Registered This Month',
        activityType: 'Appointments Registered',
      };
    case 'Telecaller':
      return {
        unit: 'Leads',
        dailyLabel: 'Leads Handled Today',
        monthlyLabel: 'Leads Handled This Month',
        activityType: 'Leads Managed',
      };
    case 'Executive':
      return {
        unit: 'Visits',
        dailyLabel: 'Completed Visits Today',
        monthlyLabel: 'Completed Visits This Month',
        activityType: 'Completed Visits',
      };
    case 'Doctor':
      return {
        unit: 'Consultations',
        dailyLabel: 'Consultations Today',
        monthlyLabel: 'Consultations This Month',
        activityType: 'Completed Consultations',
      };
    case 'Dental Doctor':
      return {
        unit: 'Consultations',
        dailyLabel: 'Dental Consultations Today',
        monthlyLabel: 'Dental Consultations This Month',
        activityType: 'Dental Consultations',
      };
    case 'OP Technician':
    case 'SOP Technician':
      return {
        unit: 'Services',
        dailyLabel: 'Services Logged Today',
        monthlyLabel: 'Services Logged This Month',
        activityType: 'Therapy Services Done',
      };
    default:
      return {
        unit: 'Activities',
        dailyLabel: 'Activities Today',
        monthlyLabel: 'Activities This Month',
        activityType: 'Activities Logged',
      };
  }
}

export function MyPerformanceWidget({ performance, role }: MyPerformanceWidgetProps) {
  if (!performance) return null;

  const { dailyCount, monthlyCount, monthlyTarget, achievementPercentage } = performance;
  const labels = getPerformanceLabels(role);
  const remainingTarget = Math.max(monthlyTarget - monthlyCount, 0);
  const isTargetMet = monthlyTarget > 0 && monthlyCount >= monthlyTarget;

  // HSL green color styling matching vvf theme
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border border-border-gray rounded-2xl p-5 shadow-sm relative overflow-hidden max-w-full min-w-0"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary-green/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 border-b border-border-gray pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-very-light-green text-primary-green rounded-xl border border-light-green/30">
            <Target className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">My Performance Dashboard</h3>
            <p className="text-[11px] text-slate-400 font-medium">Tracking {labels.activityType} Targets</p>
          </div>
        </div>

        {isTargetMet && (
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1 bg-very-light-green text-primary-green border border-light-green/45 rounded-full text-xs font-bold shadow-sm"
          >
            <Sparkles className="h-4.5 w-4.5 text-primary-green animate-spin" />
            <span>Target Exceeded! 🎉</span>
          </motion.div>
        )}
      </div>

      {/* Targets and Counts Layout */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-5">
        <div className="bg-slate-50 border border-border-gray/50 rounded-xl p-3.5">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">{labels.dailyLabel}</span>
          <span className="text-2xl font-extrabold text-slate-700 block mt-1.5">{dailyCount}</span>
          <span className="text-[10px] text-slate-400 font-medium">{labels.unit} today</span>
        </div>

        <div className="bg-slate-50 border border-border-gray/50 rounded-xl p-3.5">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">{labels.monthlyLabel}</span>
          <span className="text-2xl font-extrabold text-slate-700 block mt-1.5">{monthlyCount}</span>
          <span className="text-[10px] text-slate-400 font-medium">{labels.unit} total</span>
        </div>

        <div className="bg-slate-50 border border-border-gray/50 rounded-xl p-3.5">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Monthly Target</span>
          <span className="text-2xl font-extrabold text-slate-700 block mt-1.5">{monthlyTarget}</span>
          <span className="text-[10px] text-slate-400 font-medium">Goal set by Admin</span>
        </div>

        <div className="bg-slate-50 border border-border-gray/50 rounded-xl p-3.5">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Remaining Goal</span>
          <span className={`text-2xl font-extrabold block mt-1.5 ${remainingTarget === 0 ? 'text-primary-green' : 'text-slate-700'}`}>
            {remainingTarget}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{remainingTarget === 0 ? 'Goal completed!' : `${labels.unit} remaining`}</span>
        </div>

        <div className="bg-slate-50 border border-border-gray/50 rounded-xl p-3.5 col-span-2 md:col-span-1">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Achievement %</span>
          <span className={`text-2xl font-extrabold block mt-1.5 ${isTargetMet ? 'text-primary-green' : 'text-slate-700'}`}>
            {achievementPercentage}%
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Target completion</span>
        </div>
      </div>

      {/* Progress Bar container */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
          <span>Target Progress</span>
          <span>{achievementPercentage}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-border-gray/30">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(achievementPercentage, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              isTargetMet ? 'bg-gradient-to-r from-primary-green to-emerald-400' : 'bg-primary-green'
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}
