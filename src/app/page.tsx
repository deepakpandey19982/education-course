'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { CourseCard } from '@/components/shared/CourseCard';
import { Button } from '@/components/ui/Button';
import { HomeBannerSlider } from '@/components/shared/HomeBannerSlider';
import { HomeFeatureGrid } from '@/components/shared/HomeFeatureGrid';
import { supabase } from '@/lib/supabase';
import { Course, Category } from '@/types/supabase';

const CONTACT_INFO = [
  { icon: '📧', label: 'Email Us', value: 'support@education-course.com' },
  { icon: '📞', label: 'Call Us', value: '+91 98765 43210' },
  { icon: '📍', label: 'Our Office', value: 'New Delhi, India' },
];

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
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to send message');

      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        {/* Dynamic Banner Slider */}
        <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <HomeBannerSlider />
        </section>

        {/* Dynamic Feature Grid */}
        <HomeFeatureGrid />

        {/* Featured Courses Section */}
        <section className="py-10 sm:py-12 lg:py-14 bg-slate-50 dark:bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text mb-3">Featured Courses</h2>
              <p className="text-brand-muted max-w-2xl mx-auto text-sm sm:text-base">
                Hand-picked courses designed to help you transition into a high-paying professional career.
              </p>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-80 bg-slate-200 animate-pulse rounded-xl"></div>
                ))}
              </div>
            ) : featuredCourses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No featured courses available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                {featuredCourses.map((course, idx) => (
                  <CourseCard key={idx}
                    title={course.title}
                    instructor="Professional Instructor"
                    price={course.price}
                    discount={course.discount || 0}
                    rating={4.8}
                    category="Course"
                    image={course.thumbnail_url || '/placeholder-course.svg'}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-10 sm:py-12 lg:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-text mb-3">Explore by Category</h2>
              <p className="text-brand-muted text-sm sm:text-base">Find the perfect path for your career goals.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  onClick={() => router.push(`/courses?category=${encodeURIComponent(cat.name)}`)}
                  className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center soft-shadow hover:border-brand-primary transition-all cursor-pointer group min-w-[140px] max-w-[200px]"
                >
                  <div className={`w-12 h-12 bg-blue-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                    📚
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block text-center text-sm sm:text-base">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-10 sm:py-12 lg:py-14 bg-brand-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Why Choose Education-Course?</h2>
              <p className="text-blue-100 max-w-2xl mx-auto text-sm sm:text-base">
                We provide more than just videos. We provide a complete learning ecosystem.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {WHY_CHOOSE_US.map((item, idx) => (
                <div key={idx} className="text-center p-6 sm:p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <div className="text-4xl sm:text-5xl mb-4">{item.icon}</div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{item.title}</h3>
                  <p className="text-blue-100 leading-relaxed text-sm sm:text-base">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About Us Section */}
        <section id="about" className="py-10 sm:py-12 lg:py-14 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">About Us</h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base sm:text-lg mb-4">
                  Education-Course was founded on the belief that professional, high-tier education should be
                  accessible to everyone, regardless of their location. We specialize in creating comprehensive,
                  industry-aligned PDF courses that provide a clear roadmap to career success.
                </p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base sm:text-lg">
                  Our content is curated by industry veterans who bring years of practical experience from
                  top-tier companies, ensuring that what you learn is not just theoretical, but immediately
                  applicable in the real world.
                </p>
              </div>
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800"
                  alt="Team collaborating"
                  className="rounded-2xl shadow-2xl w-full"
                />
                <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 bg-brand-secondary p-4 sm:p-6 rounded-xl shadow-xl hidden md:block">
                  <p className="text-brand-secondary-foreground font-bold text-xl sm:text-2xl">100%</p>
                  <p className="text-brand-secondary-foreground text-xs sm:text-sm">Industry-Aligned</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Us Section */}
        <section id="contact" className="py-10 sm:py-12 lg:py-14 bg-slate-50 dark:bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3 sm:mb-4">Contact Us</h2>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base mb-6">
                    We’d love to hear from you. Whether you’re a student with a question or a company looking
                    for partnership, feel free to reach out.
                  </p>
                </div>

                <div className="space-y-4">
                  {CONTACT_INFO.map((item) => (
                    <div key={item.label} className="flex items-start gap-4">
                      <div className="bg-blue-100 dark:bg-slate-800 text-brand-primary dark:text-blue-400 p-3 rounded-lg">{item.icon}</div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-700 p-6 sm:p-8">
                {status === 'success' ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Message Sent!</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Thank you for reaching out. We’ll get back to you soon.</p>
                    <Button variant="primary" onClick={() => setStatus('idle')}>Send another message</Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Your Name</label>
                        <input
                          required
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 dark:text-white dark:bg-slate-900 placeholder-slate-400"
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                        <input
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 dark:text-white dark:bg-slate-900 placeholder-slate-400"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Subject</label>
                      <input
                        required
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 dark:text-white dark:bg-slate-900 placeholder-slate-400"
                        placeholder="How can we help?"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Message</label>
                      <textarea
                        required
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 dark:text-white dark:bg-slate-900 placeholder-slate-400"
                        placeholder="Write your message here..."
                      />
                    </div>

                    {status === 'error' && (
                      <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                        {errorMsg}
                      </div>
                    )}

                    <Button variant="primary" fullWidth size="lg" disabled={status === 'loading'}>
                      {status === 'loading' ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-10 sm:py-12 lg:py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-brand-secondary rounded-3xl p-6 sm:p-10 md:p-12 text-center text-brand-secondary-foreground relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-4">Ready to Start Your Journey?</h2>
                <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 opacity-90 max-w-2xl mx-auto">
                  Join 50,000+ learners and start building your future today. Get access to premium content and expert mentorship.
                </p>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                  <Button size="lg" variant="primary" className="bg-brand-primary hover:bg-blue-900" onClick={() => window.location.href = '/courses'}>
                    Get Started Now
                  </Button>
                  <Button size="lg" variant="outline" className="bg-white/10 border-white/40 text-brand-secondary-foreground hover:bg-white/20" onClick={() => window.location.href = '#about'}>
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
