'use client';

import RoleLogin from '@/components/RoleLogin';
import { Activity } from 'lucide-react';

export default function DentistJuniorLoginPage() {
  return <RoleLogin targetRole="Dentist Junior" icon={<Activity className="h-7 w-7 text-white" />} />;
}
