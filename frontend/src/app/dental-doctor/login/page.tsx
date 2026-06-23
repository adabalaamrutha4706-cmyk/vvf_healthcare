'use client';

import RoleLogin from '../../../components/RoleLogin';
import { Activity } from 'lucide-react';

export default function DentalDoctorLoginPage() {
  return <RoleLogin targetRole="Dental Doctor" icon={<Activity className="h-7 w-7 text-white" />} />;
}
