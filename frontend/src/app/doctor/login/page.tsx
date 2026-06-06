'use client';

import RoleLogin from '../../../components/RoleLogin';
import { Stethoscope } from 'lucide-react';

export default function DoctorLoginPage() {
  return <RoleLogin targetRole="Doctor" icon={<Stethoscope className="h-7 w-7 text-white" />} />;
}
