'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Course } from '@/types/supabase';
import { Button } from '@/components/ui/Button';

export default function CourseListPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching courses:', error);
      } else {
        setCourses(data || []);
      }
      setIsLoading(false);
    }
    fetchCourses();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) return;

    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
      alert('Error deleting course: ' + error.message);
    } else {
      setCourses(courses.filter(c => c.id !== id));
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-slate-500">Loading courses...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Manage Courses</h2>
          <p className="text-slate-500 dark:text-slate-400">Create and organize your professional PDF courses.</p>
        </div>
        <Link href="/admin/courses/new">
          <Button variant="primary">Create New Course</Button>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">Course</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">Price</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No courses found. Start by creating your first course!
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={course.thumbnail_url || 'https://via.placeholder.com/40'}
                          alt=""
                          className="w-10 h-10 rounded-md object-cover"
                        />
                        <span className="font-medium text-slate-900 dark:text-white">{course.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">₹{course.price}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${course.is_published ? 'bg-green-100 text-green-700 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'}`}>
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link href={`/admin/courses/${course.id}`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => handleDelete(course.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
