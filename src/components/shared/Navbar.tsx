'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '../ui/Button';
import { getUserProfile, supabase } from '@/lib/supabase';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const storedTheme = localStorage.getItem('education-course-theme');
    const preferredDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(preferredDark);
    document.documentElement.dataset.theme = preferredDark ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    document.documentElement.style.transition = 'background-color 250ms ease, color 250ms ease';
    localStorage.setItem('education-course-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    async function updateProfile() {
      const profile = await getUserProfile();
      setUserProfile(profile);
      setIsLoading(false);
    }

    updateProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        updateProfile();
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Courses', href: '/courses' },
    { name: 'Free Test Series', href: '/test-series' },
    { name: 'Paid Test Series', href: '/test-series/paid' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    if (path === '/test-series') return pathname === '/test-series';
    if (path === '/test-series/paid') return pathname.startsWith('/test-series/paid');
    return pathname.startsWith(path);
  };

  const isAdminActive = pathname.startsWith('/admin');

  if (isLoading) return <nav className="h-16 bg-white border-b border-slate-200" />;

  return (
    <nav className="sticky top-0 z-50 w-full glass-panel border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-2xl font-bold text-brand-primary flex items-center gap-2">
              <span className="bg-brand-primary text-white p-1 rounded">Ed</span>
              <span className="hidden sm:inline">Education-Course</span>
              <span className="sm:hidden">EdCourse</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className="relative inline-flex h-10 w-16 items-center rounded-full border border-slate-200 bg-slate-200 shadow-inner transition-all duration-300 ease-in-out focus:outline-none"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span
                className={`absolute flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow-md transition-transform duration-300 ease-in-out ${darkMode ? 'translate-x-8' : 'translate-x-1'}`}
              >
                {darkMode ? '☀️' : '🌙'}
              </span>
              <span className="sr-only">Toggle dark mode</span>
            </button>
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-brand-primary'
                    : 'text-brand-muted hover:text-brand-primary'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {userProfile ? (
              <div className="flex items-center space-x-3 ml-4">
                <Link href="/dashboard">
                  <Button
                    variant={pathname === '/dashboard' ? 'primary' : 'outline'}
                    size="sm"
                  >
                    My Dashboard
                  </Button>
                </Link>
                {userProfile.role === 'admin' && (
                  <Link href="/admin">
                    <Button
                      variant={isAdminActive ? 'primary' : 'primary'}
                      size="sm"
                      className={isAdminActive ? 'ring-2 ring-offset-2 ring-brand-primary' : ''}
                    >
                      Admin Panel
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }}>Logout</Button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 ml-4">
                <Link href="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link href="/signup">
                  <Button variant="primary" size="sm">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className="relative mr-2 inline-flex h-8 w-14 items-center rounded-full border border-slate-200 bg-slate-200 shadow-inner transition-all duration-300 ease-in-out focus:outline-none"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span
                className={`absolute flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow-md transition-transform duration-300 ease-in-out ${darkMode ? 'translate-x-7' : 'translate-x-1'}`}
              >
                {darkMode ? '☀️' : '🌙'}
              </span>
              <span className="sr-only">Toggle dark mode</span>
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-brand-muted hover:text-brand-primary hover:bg-slate-100 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden glass-panel border-b border-slate-200 animate-in slide-in-from-top duration-300">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(link.href)
                    ? 'text-brand-primary bg-slate-50'
                    : 'text-brand-muted hover:text-brand-primary hover:bg-slate-50'
                }`}
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            {userProfile && (
              <Link
                href="/dashboard"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === '/dashboard'
                    ? 'text-brand-primary bg-slate-50'
                    : 'text-brand-muted hover:text-brand-primary hover:bg-slate-50'
                }`}
                onClick={() => setIsOpen(false)}
              >
                My Dashboard
              </Link>
            )}
            <div className="pt-4 pb-3 border-t border-slate-200 flex flex-col gap-3 px-3">
              {userProfile ? (
                <>
                  {userProfile.role === 'admin' && (
                    <Link href="/admin" className="w-full">
                      <Button
                        variant="primary"
                        fullWidth
                        className={isAdminActive ? 'ring-2 ring-offset-2 ring-brand-primary' : ''}
                      >
                        Admin Panel
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" fullWidth onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}>Logout</Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="w-full">
                    <Button variant="ghost" fullWidth>Login</Button>
                  </Link>
                  <Link href="/signup" className="w-full">
                    <Button variant="primary" fullWidth>Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
