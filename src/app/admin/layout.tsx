'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUserProfile } from '@/lib/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  const adminNav = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Test Series', href: '/admin/test-series' },
    { name: 'Courses', href: '/admin/courses' },
    { name: 'Categories', href: '/admin/categories' },
    { name: 'Banners', href: '/admin/homepage' },
    { name: 'Feature Grid', href: '/admin/feature-grid' },
    { name: 'Users', href: '/admin/users' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <div className="flex-grow">
        {/* Admin Navigation Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="bg-brand-primary text-white text-xs font-bold px-2 py-0.5 rounded">ADMIN</span>
                Control Panel
              </Link>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2 flex-wrap text-xs sm:text-sm font-medium">
              {adminNav.map((link) => {
                const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-primary text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-brand-primary dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
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
