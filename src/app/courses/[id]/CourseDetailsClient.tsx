'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, getUserProfile } from '@/lib/supabase';
import { Course } from '@/types/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/Button';
import Script from 'next/script';
import { downloadCoursePdf } from '@/lib/course-download';
import { getApiUrl } from '@/lib/api-config';

export default function CourseDetailsClient() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch User Profile
      const profile = await getUserProfile();
      setUserProfile(profile);

      // 2. Fetch Course
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Error fetching course:', error);
      } else {
        setCourse(data);

        // 3. Check if user has purchased this course
        if (profile) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', profile.id)
            .eq('course_id', data.id)
            .eq('status', 'paid')
            .single();

          setHasPurchased(!!order);
        }
      }
      setIsLoading(false);
    }
    fetchData();
  }, [params.id]);

  const isFreeCourse = (course?.price ?? 0) === 0;

  const handlePayment = async () => {
    if (!userProfile) {
      alert('Please login to purchase this course.');
      router.push('/login');
      return;
    }

    if (isFreeCourse) {
      alert('This course is free. No payment is required.');
      return;
    }

    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(getApiUrl('/api/payments/create'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          courseId: course?.id,
          userId: userProfile.id,
        }),
      });

      const orderData = await response.json();

      if (!response.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Education-Course',
        description: course?.title,
        handler: async function (response: any) {
          try {
            setPaymentLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const verifyRes = await fetch(getApiUrl('/api/payments/verify'), {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            alert('Payment Successful! Your course is now available in your dashboard.');
            router.push('/dashboard');
          } catch (verifyErr: any) {
            console.error('Payment verification error:', verifyErr);
            alert('Payment received! Finalizing access: ' + (verifyErr.message || 'Please check your dashboard.'));
            router.push('/dashboard');
          } finally {
            setPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          },
        },
        prefill: {
          name: userProfile.full_name || '',
          email: userProfile.email,
        },
        theme: {
          color: '#1e3a8a',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setPaymentLoading(false);
        alert(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
      });
      rzp.open();

    } catch (error: any) {
      alert(error.message || 'Payment initiation failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!userProfile) {
      alert('Please log in to access this course PDF.');
      router.push('/login');
      return;
    }
    if (!course?.id) return;
    setDownloading(true);
    try {
      const result = await downloadCoursePdf(course.id);
      if (!result.success) {
        alert(result.error || 'Could not download course PDF.');
      }
    } catch (err: any) {
      alert(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <Navbar />
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-slate-900">Course Not Found</h1>
          <p className="text-slate-500 mb-8">The course you are looking for doesn't exist or is not published.</p>
          <Button variant="primary" onClick={() => window.location.href = '/courses'}>Back to Courses</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <Navbar />

      <main className="flex-grow">
        <div className="bg-slate-50 dark:bg-slate-950 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Left: Course Content */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white dark:bg-slate-900 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <img
                    src={course.thumbnail_url || '/placeholder-course.svg'}
                    alt={course.title}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x400?text=Course+Image';
                    }}
                    className="w-full h-64 md:h-96 object-cover"
                  />
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-4">
                      <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">
                        {course.title}
                      </h1>
                    </div>
                    <div className="flex flex-wrap gap-3 mb-6">
                      <span className="bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                        Professional Certification
                      </span>
                      <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                        Digital PDF
                      </span>
                    </div>
                    <div className="prose prose-slate max-w-none">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">About this course</h3>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {course.description || 'No description provided for this course.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-800 p-8">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">What you will learn</h3>
                  {course.learning_points && course.learning_points.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {course.learning_points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                          <span className="text-green-500 font-bold">✓</span>
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 italic">No specific learning outcomes listed for this course.</p>
                  )}
                </div>
              </div>

              {/* Right: Purchase Card */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-900 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-800 p-8 sticky top-24">
                  <div className="text-center mb-8">
                    {isFreeCourse ? (
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-extrabold text-green-600 dark:text-emerald-400">FREE</span>
                        <span className="text-xs font-bold text-green-700 dark:text-emerald-300 bg-green-100 dark:bg-emerald-950/80 px-2 py-1 rounded mt-2 uppercase">No payment required</span>
                      </div>
                    ) : course.discount > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-lg text-slate-400 dark:text-slate-500 line-through">₹{course.price}</span>
                        <span className="text-4xl font-extrabold text-brand-primary dark:text-blue-400">₹{(course.price * (1 - course.discount / 100)).toFixed(2)}</span>
                        <span className="text-xs font-bold text-green-600 dark:text-emerald-300 bg-green-100 dark:bg-emerald-950/80 px-2 py-1 rounded mt-2 uppercase">{course.discount}% OFF</span>
                      </div>
                    ) : (
                      <span className="text-4xl font-extrabold text-brand-primary dark:text-blue-400">₹{course.price}</span>
                    )}
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">{isFreeCourse ? 'Free lifetime access' : 'One-time payment for lifetime access'}</p>
                  </div>

                  <div className="space-y-4">
                    {hasPurchased || isFreeCourse ? (
                      <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        className="text-lg py-4 bg-green-600 hover:bg-green-700"
                        onClick={handleDownload}
                        disabled={downloading}
                      >
                        {downloading ? 'Preparing PDF...' : (isFreeCourse ? 'Open Course PDF' : 'Download PDF Now')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        className="text-lg py-4"
                        onClick={handlePayment}
                        disabled={paymentLoading}
                      >
                        {paymentLoading ? 'Processing...' : 'Buy Now & Download'}
                      </Button>
                    )}
                    <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                      Secure payment powered by Razorpay. <br />
                      Instant PDF delivery to your dashboard.
                    </p>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>📄</span>
                      <span>High-quality Professional PDF</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>♾️</span>
                      <span>Lifetime Access</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>🛡️</span>
                      <span>Verified Certification</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
