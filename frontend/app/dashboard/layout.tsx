'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { isAuthenticated } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/');
  }, [router]);

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
