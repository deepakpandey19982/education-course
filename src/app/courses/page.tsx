'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Course } from '@/types/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { CourseCard } from '@/components/shared/CourseCard';
import { Button } from '@/components/ui/Button';

function CoursesList() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchData() {
      // Fetch Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');
      if (catData) setCategories(catData);

      // Fetch Published Courses
      const { data: courseData, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (!error) setCourses(courseData || []);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const filteredCourses = selectedCategory === ''
    ? courses
    : courses.filter(c => {
      const cat = categories.find(cat => cat.id === c.category_id);
      return cat?.name === selectedCategory;
    });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === ''
              ? 'bg-brand-primary text-white shadow-md'
              : 'bg-white text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Courses
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat.name
                ? 'bg-brand-primary text-white shadow-md'
                : 'bg-white text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {filteredCourses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-slate-900">No courses found</h3>
            <p className="text-slate-500">Try selecting a different category or check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id}
                courseId={course.id}
                title={course.title}
                instructor="Professional Instructor"
                price={course.price}
                discount={course.discount || 0}
                rating={4.8}
                category="Course"
                image={course.thumbnail_url || 'https://via.placeholder.com/300x200?text=Course'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function CoursesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <section className="bg-brand-primary text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4">Explore Our Professional Courses</h1>
            <p className="text-blue-100 max-w-2xl mx-auto text-lg">
              Master high-demand skills with our industry-certified PDF guides and comprehensive learning paths.
            </p>
          </div>
        </section>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
          </div>
        }>
          <CoursesList />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
