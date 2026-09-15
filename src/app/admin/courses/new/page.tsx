'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CourseForm } from '@/components/shared/CourseForm';

export default function NewCoursePage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Create New Course</h2>
        <p className="text-slate-500">Add a new professional PDF course to your platform.</p>
      </div>
      <CourseForm onSuccess={() => router.push('/admin/courses')} />
    </div>
  );
}
