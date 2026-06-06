'use client';

import RoleLogin from '../../../components/RoleLogin';
import { MapPin } from 'lucide-react';

export default function ExecutiveLoginPage() {
  return <RoleLogin targetRole="Executive" icon={<MapPin className="h-7 w-7 text-white" />} />;
}
