'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getUserProfile } from '@/lib/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/Button';

export default function EditProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getUserProfile();
        if (!profile) {
          router.replace('/login');
          return;
        }
        setFullName(profile.full_name || '');
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile information.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (updateError) throw updateError;

      alert('Profile updated successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="bg-white w-full max-w-md rounded-2xl soft-shadow border border-slate-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Edit Profile</h1>
            <p className="text-slate-500">Update your personal information</p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Full Name</label>
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                placeholder="Enter your full name"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <Button
                variant="outline"
                fullWidth
                type="button"
                onClick={() => router.push('/dashboard')}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
