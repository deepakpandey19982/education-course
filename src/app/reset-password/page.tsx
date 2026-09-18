'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);

  useEffect(() => {
    let ignore = false;

    async function validateRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hash = window.location.hash;

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session || (hash && hash.includes('type=recovery'))) {
          if (!ignore) setIsValidLink(true);
          return;
        }

        if (!ignore) setIsValidLink(false);
      } catch (err: any) {
        if (!ignore) {
          setIsValidLink(false);
          setError(err?.message || 'This reset link is invalid or has expired. Please request a new one.');
        }
      }
    }

    void validateRecoverySession();
    return () => {
      ignore = true;
    };
  }, []);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (!isValidLink) {
        throw new Error('This password reset link is invalid or has expired. Please request a new reset link.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setSuccess('Password updated successfully. You can now sign in with your new password.');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Could not update the password. The reset link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="bg-white w-full max-w-md rounded-2xl soft-shadow border border-slate-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Reset Password</h1>
            <p className="text-slate-500">Create a new password for your account.</p>
          </div>

          {isValidLink === false && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              This password reset link is invalid or has expired. Please request a new reset link.
            </div>
          )}

          {isValidLink !== false && (
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">New Password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Confirm Password</label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                  placeholder="Confirm new password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200">
                  {success}
                </div>
              )}

              <Button variant="primary" fullWidth size="lg" disabled={loading || isValidLink !== true} type="submit">
                {loading ? 'Updating password...' : 'Update password'}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center text-sm text-slate-500">
            <Link href="/login" className="text-brand-primary font-bold hover:underline">Back to login</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
