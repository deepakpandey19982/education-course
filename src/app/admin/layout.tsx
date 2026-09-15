'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile } from '@/lib/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const profile = await getUserProfile();
        if (!profile || profile.role !== 'admin') {
          router.replace('/');
        } else {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Auth error:', error);
        router.replace('/');
      } finally {
        setIsLoading(false);
      }
    }
    checkAdmin();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex-grow">
        {/* Admin Sidebar Header */}
        <header className="bg-white border-b border-slate-200 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-brand-primary text-white text-xs px-2 py-1 rounded">ADMIN</span>
              Control Panel
            </h1>
            <div className="text-sm text-slate-500">
              Welcome, Administrator
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
