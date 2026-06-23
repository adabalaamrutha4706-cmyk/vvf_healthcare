'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('vvf_token');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-secondary-bg text-slate-500">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-green border-t-transparent"></div>
        <p className="text-sm font-medium text-slate-500">Loading Venkateswara Vascular Foundation Systems...</p>
      </div>
    </div>
  );
}
