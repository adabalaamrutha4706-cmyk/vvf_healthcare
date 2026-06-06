'use client';

import RoleLogin from '../../../components/RoleLogin';
import { Activity } from 'lucide-react';

export default function ChiefDoctorLoginPage() {
  return <RoleLogin targetRole="Chief Doctor" icon={<Activity className="h-7 w-7 text-white" />} />;
}
