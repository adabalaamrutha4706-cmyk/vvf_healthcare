'use client';

import RoleLogin from '../../../components/RoleLogin';
import { Activity } from 'lucide-react';

export default function SOPTechnicianLoginPage() {
  return <RoleLogin targetRole="SOP Technician" icon={<Activity className="h-7 w-7 text-white" />} />;
}
