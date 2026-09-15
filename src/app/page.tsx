'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { CourseCard } from '@/components/shared/CourseCard';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Course, Category } from '@/types/supabase';

const WHY_CHOOSE_US = [
  {
    title: 'Expert Instructors',
    description: 'Learn from industry veterans with years of real-world experience in top MNCs.',
    icon: '🎓',
  },
  {
    title: 'Flexible Learning',
    description: 'Study at your own pace with lifetime access to all course materials and videos.',
    icon: '⏰',
  },
  {
    title: 'Recognized Certs',
    description: 'Get professional certifications that are valued by employers across India.',
    icon: '📜',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch Categories Dynamically
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (catData) setCategories(catData);

      // Fetch Published Courses
      const { data: courseData, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .limit(4)
        .order('created_at', { ascending: false });

      if (!error) setFeaturedCourses(courseData || []);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 text-center lg:text-left">
                <h1 className="text-4xl md:text-6xl font-extrabold text-brand-text leading-tight mb-6">
                  Unlock Your Potential with <span className="text-brand-primary">Professional Courses</span>
                </h1>
                <p className="text-lg text-brand-muted mb-8 max-w-2xl mx-auto lg:mx-0">
                  Join thousands of students across India. Master the most in-demand skills and land your dream job with our industry-certified programs.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Button size="lg" variant="primary" onClick={() => window.location.href = '/courses'}>Explore Courses</Button>
                  <Button size="lg" variant="outline">Learn More</Button>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-brand-secondary/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl"></div>
                <img
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800"
                  alt="Students learning"
                  className="relative rounded-2xl shadow-2xl border-8 border-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Featured Courses Section */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text mb-4">Featured Courses</h2>
              <p className="text-brand-muted max-w-2xl mx-auto">
                Hand-picked courses designed to help you transition into a high-paying professional career.
              </p>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-80 bg-slate-200 animate-pulse rounded-xl"></div>
                ))}
              </div>
            ) : featuredCourses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No featured courses available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {featuredCourses.map((course, idx) => (
                  <CourseCard key={idx}
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

        {/* Categories Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text mb-4">Explore by Category</h2>
              <p className="text-brand-muted">Find the perfect path for your career goals.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  onClick={() => router.push(`/courses?category=${encodeURIComponent(cat.name)}`)}
                  className="p-6 rounded-xl border border-slate-100 text-center soft-shadow hover:border-brand-primary transition-all cursor-pointer group min-w-[140px] max-w-[200px]"
                >
                  <div className={`w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    📚
                  </div>
                  <span className="font-bold text-brand-text block text-center">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-20 bg-brand-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Education-Course?</h2>
              <p className="text-blue-100 max-w-2xl mx-auto">
                We provide more than just videos. We provide a complete learning ecosystem.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {WHY_CHOOSE_US.map((item, idx) => (
                <div key={idx} className="text-center p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <div className="text-5xl mb-6">{item.icon}</div>
                  <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                  <p className="text-blue-100 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-brand-secondary rounded-3xl p-8 md:p-16 text-center text-brand-secondary-foreground relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-extrabold mb-6">Ready to Start Your Journey?</h2>
                <p className="text-lg mb-10 opacity-90 max-w-2xl mx-auto">
                  Join 50,000+ learners and start building your future today. Get access to premium content and expert mentorship.
                </p>
                <Button size="lg" variant="primary" className="bg-brand-primary hover:bg-blue-900" onClick={() => window.location.href = '/courses'}>
                  Get Started Now
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
