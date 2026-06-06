'use client';

import RoleLogin from '../../../components/RoleLogin';
import { PhoneCall } from 'lucide-react';

export default function TelecallerLoginPage() {
  return <RoleLogin targetRole="Telecaller" icon={<PhoneCall className="h-7 w-7 text-white" />} />;
}
