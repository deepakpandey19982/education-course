'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center text-2xl`}>
        {icon}
      </div>
    </div>
    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
    <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeCourses: 0,
    totalStudents: 0,
    totalSales: 0,
    systemStatus: {
      database: 'CONNECTED',
      storage: 'ACTIVE',
      razorpay: 'ACTIVE',
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/admin/stats', { headers });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const formattedRevenue = `₹${Number(stats.totalRevenue).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h2>
        <p className="text-slate-500 dark:text-slate-400">Quick glimpse of your platform's performance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard
          title="Total Revenue"
          value={loading ? '...' : formattedRevenue}
          icon="💰"
          color="bg-green-100 dark:bg-emerald-950/70 text-green-600 dark:text-emerald-400"
        />
        <StatCard
          title="Active Courses"
          value={loading ? '...' : String(stats.activeCourses)}
          icon="📚"
          color="bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Total Students"
          value={loading ? '...' : String(stats.totalStudents)}
          icon="👥"
          color="bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Total Sales"
          value={loading ? '...' : String(stats.totalSales)}
          icon="📈"
          color="bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/admin/courses/new">
              <Button variant="primary" fullWidth className="justify-start gap-2">
                <span>➕</span> Create New Course
              </Button>
            </Link>
            <Link href="/admin/courses">
              <Button variant="outline" fullWidth className="justify-start gap-2">
                <span>📋</span> Manage All Courses
              </Button>
            </Link>
            <Link href="/admin/categories">
              <Button variant="outline" fullWidth className="justify-start gap-2">
                <span>📂</span> Manage Categories
              </Button>
            </Link>
            <Link href="/admin/homepage">
              <Button variant="outline" fullWidth className="justify-start gap-2">
                <span>🖼️</span> Homepage Banners
              </Button>
            </Link>
            <Link href="/admin/feature-grid">
              <Button variant="outline" fullWidth className="justify-start gap-2">
                <span>⚡</span> Feature Grid
              </Button>
            </Link>
            <Link href="/admin/test-series/free">
              <Button variant="outline" fullWidth className="justify-start gap-2">
                <span>🧪</span> Free Test Series
              </Button>
            </Link>
            <Link href="/admin/test-series/paid">
              <Button variant="outline" fullWidth className="justify-start gap-2">
                <span>💳</span> Paid Test Series
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/70 rounded-lg">
              <span className="text-sm text-slate-600 dark:text-slate-300">Database Connection</span>
              <span className="text-xs font-bold text-green-600 dark:text-emerald-300 bg-green-100 dark:bg-emerald-950/80 px-2 py-1 rounded">
                {stats.systemStatus.database}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/70 rounded-lg">
              <span className="text-sm text-slate-600 dark:text-slate-300">Storage Bucket (site-assets)</span>
              <span className="text-xs font-bold text-green-600 dark:text-emerald-300 bg-green-100 dark:bg-emerald-950/80 px-2 py-1 rounded">
                {stats.systemStatus.storage}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/70 rounded-lg">
              <span className="text-sm text-slate-600 dark:text-slate-300">Payment Gateway (Razorpay)</span>
              {stats.systemStatus.razorpay === 'ACTIVE' ? (
                <span className="text-xs font-bold text-green-600 dark:text-emerald-300 bg-green-100 dark:bg-emerald-950/80 px-2 py-1 rounded">
                  ACTIVE
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-1 rounded">
                  PENDING SETUP
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
