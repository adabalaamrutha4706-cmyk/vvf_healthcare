'use client';

import RoleLogin from '../../../components/RoleLogin';
import { Briefcase } from 'lucide-react';

export default function AdminLoginPage() {
  return <RoleLogin targetRole="Admin" icon={<Briefcase className="h-7 w-7 text-white" />} />;
}
