'use client';

import React, { useState } from 'react';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/Button';

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

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
        <section className="bg-brand-primary text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6">Get in Touch</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
              Have a question or need help with a course? Our team is here to support you.
            </p>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Contact Info */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">Contact Information</h2>
                  <p className="text-slate-600 leading-relaxed mb-8">
                    We'd love to hear from you. Whether you're a student with a question or a company
                    looking for partnership, feel free to reach out.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 text-brand-primary p-3 rounded-lg">📧</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Email Us</p>
                      <p className="text-slate-600">support@education-course.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 text-brand-primary p-3 rounded-lg">📞</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Call Us</p>
                      <p className="text-slate-600">+91 98765 43210</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 text-brand-primary p-3 rounded-lg">📍</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Our Office</p>
                      <p className="text-slate-600">New Delhi, India</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-white rounded-2xl soft-shadow border border-slate-100 p-8">
                {status === 'success' ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h3>
                    <p className="text-slate-500 mb-8">Thank you for reaching out. We'll get back to you soon.</p>
                    <Button variant="primary" onClick={() => setStatus('idle')}>Send another message</Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Your Name</label>
                        <input
                          required
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Email Address</label>
                        <input
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Subject</label>
                      <input
                      required
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                      placeholder="How can we help?"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Message</label>
                      <textarea
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
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
      </main>
      <Footer />
    </div>
  );
}
