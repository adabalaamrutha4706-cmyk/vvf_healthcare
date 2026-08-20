'use client';

import RoleLogin from '@/components/RoleLogin';
import { Activity } from 'lucide-react';

export default function DentalAssistantLoginPage() {
  return <RoleLogin targetRole="Dental Assistant" icon={<Activity className="h-7 w-7 text-white" />} />;
}
