'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { TestSeries } from '@/types/supabase';
import { Loading, Message } from '../page';
import { fetchPublishedTestSeries } from '@/lib/test-series-client';

export default function PaidTestSeriesPage() {
  const [series, setSeries] = useState<TestSeries[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const list = await fetchPublishedTestSeries('paid');
      setSeries(list);
      setError('');
    } catch (reason: any) {
      setError(reason.message || 'Could not load paid test series.');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Re-fetch when Android app or WebView resumes or regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    const handleFocus = () => {
      loadData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="flex-grow">
        <section className="bg-amber-600 dark:bg-amber-700 text-white py-14 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-100 text-xs sm:text-sm mb-2 sm:mb-3">Premium practice</p>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-3 sm:mb-4">Paid Test Series</h1>
            <p className="text-amber-100 max-w-2xl mx-auto text-base sm:text-lg">Access premium preparation tracks, structured by subject, with paid tests clearly marked for purchase.</p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isRefreshing || loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                title="Refresh paid test series"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </section>
        <section className="py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <Loading />
            ) : error ? (
              <Message title="Unable to load paid test series" text={error} />
            ) : series.length === 0 ? (
              <Message title="No paid test series available" text="New paid practice series will appear here when published." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {series.map((item) => (
                  <article key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 soft-shadow flex flex-col hover:border-amber-500/40 transition-all duration-200">
                    <div className="h-48 bg-amber-50 dark:bg-slate-800 relative">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-full flex items-center justify-center text-5xl">📝</div>
                      )}
                      <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                        PREMIUM
                      </span>
                    </div>
                    <div className="p-5 sm:p-6 flex flex-col flex-grow">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{item.title}</h2>
                      <p className="text-slate-600 dark:text-slate-300 mt-3 leading-relaxed flex-grow whitespace-pre-wrap text-sm sm:text-base">
                        {item.description || 'Advance your preparation with premium, timed practice tests.'}
                      </p>
                      <Link href={`/test-series/paid/${item.id}`} className="mt-6 block">
                        <Button variant="outline" fullWidth>View Paid Series</Button>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

