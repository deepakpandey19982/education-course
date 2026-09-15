'use client';

import React from 'react';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/Button';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {/* Header */}
        <section className="bg-brand-primary text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6">About Education-Course</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              We are dedicated to bridging the gap between traditional education and industry requirements
              through professional, high-quality digital resources.
            </p>
          </div>
        </section>

        {/* Our Mission */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Mission</h2>
                <p className="text-slate-600 leading-relaxed text-lg mb-6">
                  Education-Course was founded on the belief that professional, high-tier education should be
                  accessible to everyone, regardless of their location. We specialize in creating comprehensive,
                  industry-aligned PDF courses that provide a clear roadmap to career success.
                </p>
                <p className="text-slate-600 leading-relaxed text-lg">
                  Our content is curated by industry veterans who bring years of practical experience from
                  top-tier companies, ensuring that what you learn is not just theoretical, but immediately
                  applicable in the real world.
                </p>
              </div>
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800"
                  alt="Team collaborating"
                  className="rounded-2xl shadow-2xl"
                />
                <div className="absolute -bottom-6 -left-6 bg-brand-secondary p-6 rounded-xl shadow-xl hidden md:block">
                  <p className="text-brand-secondary-foreground font-bold text-2xl">100%</p>
                  <p className="text-brand-secondary-foreground text-sm">Industry-Aligned</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Core Values</h2>
              <p className="text-slate-500 max-w-2xl mx-auto">The principles that guide everything we create.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Quality First',
                  desc: 'We don\'t publish courses until they meet our rigorous industry standards.',
                  icon: '🎯',
                },
                {
                  title: 'Accessibility',
                  desc: 'Digital PDF formats ensure you can learn anywhere, anytime, on any device.',
                  icon: '🌍',
                },
                {
                  title: 'Career Focused',
                  desc: 'Every lesson is designed with a single goal: making you more employable.',
                  icon: '💼',
                },
              ].map((value, idx) => (
                <div key={idx} className="bg-white p-8 rounded-2xl soft-shadow border border-slate-100 text-center hover:border-brand-primary transition-all">
                  <div className="text-4xl mb-4">{value.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{value.title}</h3>
                  <p className="text-slate-600">{value.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Ready to upgrade your career?</h2>
            <Button size="lg" variant="primary" onClick={() => window.location.href = '/courses'}>
              Explore All Courses
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
