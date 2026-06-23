'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, Calendar, Award, Shield, 
  Briefcase, Hash, CheckCircle2, Settings2, UserCircle, LogOut 
} from 'lucide-react';
import { User as UserType } from '../context/AuthContext';
import { BACKEND_URL } from '../lib/api';

function getDesignation(role: string): string {
  switch (role) {
    case 'Executive':
      return 'Regional Executive';
    case 'Dental Doctor':
      return 'Dental Doctor';
    case 'Doctor':
      return 'Doctor';
    case 'Reception':
      return 'Front Desk Receptionist';
    case 'Telecaller':
      return 'Telecalling Specialist';
    case 'Admin':
      return 'System Administrator';
    case 'Superadmin':
      return 'Super Administrator';
    default:
      return role;
  }
}

function getDepartment(role: string): string {
  switch (role) {
    case 'Executive':
      return 'Operations';
    case 'Dental Doctor':
    case 'Doctor':
      return 'Medical Services';
    case 'Reception':
      return 'Patient Reception';
    case 'Telecaller':
      return 'Telecommunications';
    case 'Admin':
    case 'Superadmin':
      return 'Administration';
    default:
      return 'General';
  }
}

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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100/60 last:border-0 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="text-slate-400 shrink-0">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <span className="text-xs font-semibold text-slate-700 truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

interface HeaderProfilePanelProps {
  user: UserType;
  settingsHref: string;
  onViewProfileClick?: () => void;
}

export function HeaderProfilePanel({ user, settingsHref, onViewProfileClick }: HeaderProfilePanelProps) {
  const designation = getDesignation(user.role);
  const department = getDepartment(user.role);
  const employeeId = `EMP-${String(user.id).padStart(3, '0')}`;
  const status = user.is_active !== false ? 'Active' : 'Inactive';
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
  const age = calculateAge(user.date_of_birth);
  const formattedDob = formatDate(user.date_of_birth);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-x-0 bottom-0 md:absolute md:right-0 md:bottom-auto md:top-full md:inset-x-auto md:mt-2 w-full md:w-[360px] bg-white rounded-t-[2rem] md:rounded-3xl border-t md:border border-border-gray shadow-2xl z-[9999] overflow-hidden max-h-[85vh] md:max-h-none flex flex-col"
    >
      {/* Mobile Top Pull Bar Indicator */}
      <div className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto my-3 shrink-0 md:hidden" />

      {/* Header section with Centered Avatar */}
      <div className="flex flex-col items-center pt-4 pb-5 md:pt-7 md:pb-5 px-6 shrink-0 text-center">
        {/* Avatar */}
        <div className="relative">
          <div className="h-20 w-20 md:h-22 md:w-22 rounded-full bg-primary-green flex items-center justify-center font-bold text-white text-3xl md:text-4xl shadow-md border-4 border-white ring-1 ring-slate-100 overflow-hidden">
            {user.photo_url ? (
              <img src={`${BACKEND_URL}${user.photo_url}`} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          {/* Account status badge overlay */}
          <span className={`absolute bottom-0 right-0 h-4.5 w-4.5 rounded-full border-2 border-white ${
            status === 'Active' ? 'bg-[#10b981]' : 'bg-[#ef4444]'
          }`} />
        </div>

        {/* Full Name & Designation */}
        <h2 className="mt-3.5 text-base md:text-lg font-bold text-slate-800 leading-snug">
          {user.name}
        </h2>
        <p className="text-xs text-primary-green font-semibold mt-0.5">
          {designation}
        </p>
      </div>

      {/* Thin Divider */}
      <div className="border-t border-slate-100 w-full" />

      {/* User profile details layout (stacked list) */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5">
        <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="Employee ID" value={employeeId} />
        <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Gender" value={user.gender || 'Not set'} />
        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="DOB" value={formattedDob} />
        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Age" value={age} />
        <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={user.personal_email || user.email || 'Not set'} />
        <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={user.phone || 'Not set'} />
        <InfoRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Department" value={department} />
        <InfoRow icon={<Shield className="h-3.5 w-3.5" />} label="Role" value={user.role} />
        <InfoRow 
          icon={<CheckCircle2 className="h-3.5 w-3.5" />} 
          label="Status" 
          value={status} 
        />
      </div>

      {/* Actions section */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-2 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          {onViewProfileClick ? (
            <button
              onClick={onViewProfileClick}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green rounded-xl transition-colors shadow-sm text-center cursor-pointer"
            >
              <UserCircle className="h-3.5 w-3.5" />
              View Profile
            </button>
          ) : (
            <Link
              href={settingsHref}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green rounded-xl transition-colors shadow-sm text-center"
            >
              <UserCircle className="h-3.5 w-3.5" />
              View Profile
            </Link>
          )}
          <Link
            href={settingsHref}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-primary-green bg-white hover:bg-very-light-green border border-light-green rounded-xl transition-colors shadow-sm text-center"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
