'use client';

import RoleLogin from '../../../components/RoleLogin';
import { ClipboardList } from 'lucide-react';

export default function ReceptionLoginPage() {
  return <RoleLogin targetRole="Reception" icon={<ClipboardList className="h-7 w-7 text-white" />} />;
}
