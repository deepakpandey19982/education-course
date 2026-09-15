'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Course } from '@/types/supabase';
import { CourseForm } from '@/components/shared/CourseForm';

export default function EditCourseClient() {
  const router = useRouter();
  const params = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCourse() {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Error fetching course:', error);
      } else {
        setCourse(data);
      }
      setIsLoading(false);
    }
    fetchCourse();
  }, [params.id]);

  if (isLoading) {
    return <div className="text-center py-12 text-slate-500">Loading course...</div>;
  }

  if (!course) {
    return <div className="text-center py-12 text-red-500">Course not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Edit Course</h2>
        <p className="text-slate-500">Updating: {course.title}</p>
      </div>
      <CourseForm initialCourse={course} onSuccess={() => router.push('/admin/courses')} />
    </div>
  );
}
