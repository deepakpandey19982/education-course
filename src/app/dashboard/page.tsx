'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getUserProfile } from '@/lib/supabase';
import { Profile, Order, Course } from '@/types/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/Button';

interface PurchasedCourse extends Course {
  order_id: string;
  payment_id: string;
}

export default function UserDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myCourses, setMyCourses] = useState<PurchasedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const userProfile = await getUserProfile();
        if (!userProfile) {
          router.replace('/login');
          return;
        }
        setProfile(userProfile);

        // Fetch purchased courses
        // JOIN orders -> courses
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            payment_id,
            courses (*)
          `)
          .eq('status', 'paid');

        if (error) throw error;

        const purchased = data?.map(order => {
          const courseData = Array.isArray(order.courses) ? order.courses[0] : order.courses;
          return {
            ...(courseData as Course),
            order_id: order.id,
            payment_id: order.payment_id,
          };
        }) || [];

        setMyCourses(purchased);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, [router]);

  const handleDownload = async (courseId: string) => {
    if (!profile) {
      alert('You must be logged in to download.');
      return;
    }
    window.location.href = `/api/courses/download?courseId=${courseId}`;
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      alert('Logout failed. Please try again.');
    }
  };

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        <div className="bg-slate-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900">My Learning Dashboard</h1>
                <p className="text-slate-500">Welcome back, {profile?.full_name || 'Student'}!</p>
              </div>
              <div className="flex items-center gap-3 bg-white p-2 rounded-lg soft-shadow border border-slate-100">
                <span className="text-sm font-medium text-slate-600 px-2">Account:</span>
                <span className="text-xs font-bold uppercase px-2 py-1 bg-blue-100 text-blue-600 rounded">{profile?.role}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Section */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl soft-shadow border border-slate-100 p-6">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-brand-primary text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                      {profile?.full_name?.[0] || 'U'}
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900">{profile?.full_name || 'Student'}</h3>
                    <p className="text-sm font-medium text-slate-500 mb-1">Student</p>
                    <p className="text-sm text-slate-400">{profile?.email}</p>
                  </div>
                  <div className="space-y-3 pt-6 border-t border-slate-100">
                    <Button variant="outline" fullWidth size="sm" onClick={handleEditProfile}>Edit Profile</Button>
                    <Button variant="ghost" fullWidth size="sm" className="text-red-500" onClick={handleLogout}>Logout</Button>
                  </div>
                </div>
              </div>

              {/* My Courses Section */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span>📚</span> My Purchased Courses
                </h2>

                {myCourses.length === 0 ? (
                  <div className="bg-white rounded-2xl soft-shadow border border-slate-100 p-12 text-center">
                    <div className="text-6xl mb-4">🛒</div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No courses purchased yet</h3>
                    <p className="text-slate-500 mb-8">Start your professional journey by purchasing your first PDF course.</p>
                    <Button variant="primary" onClick={() => window.location.href = '/courses'}>Browse All Courses</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {myCourses.map((course, idx) => (
                      <div key={idx} className="bg-white rounded-xl soft-shadow border border-slate-100 p-5 flex items-center gap-4 group hover:border-brand-primary transition-all">
                        <img
                          src={course.thumbnail_url || '/placeholder-course.svg'}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div className="flex-grow">
                          <h4 className="font-bold text-slate-900 line-clamp-1">{course.title}</h4>
                          <p className="text-xs text-slate-500 mb-3">Purchased on {new Date(course.created_at).toLocaleDateString()}</p>
                          <Button variant="secondary" size="sm" onClick={() => handleDownload(course.id)}>
                            Download PDF
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
