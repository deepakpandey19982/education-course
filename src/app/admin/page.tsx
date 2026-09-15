'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) => (
  <div className="bg-white p-6 rounded-xl soft-shadow border border-slate-100">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center text-2xl`}>
        {icon}
      </div>
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-3xl font-bold text-slate-900">{value}</p>
  </div>
);

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500">Quick glimpse of your platform's performance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard title="Total Revenue" value="₹0.00" icon="💰" color="bg-green-100 text-green-600" />
        <StatCard title="Active Courses" value="0" icon="📚" color="bg-blue-100 text-blue-600" />
        <StatCard title="Total Students" value="0" icon="👥" color="bg-purple-100 text-purple-600" />
        <StatCard title="Total Sales" value="0" icon="📈" color="bg-orange-100 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl soft-shadow border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
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
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl soft-shadow border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Database Connection</span>
              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">CONNECTED</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Storage Bucket (course-pdfs)</span>
              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">ACTIVE</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Payment Gateway (Razorpay)</span>
              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">PENDING SETUP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
