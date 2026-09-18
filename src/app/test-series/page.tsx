'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { TestSeries } from '@/types/supabase';

export default function TestSeriesPage() {
  const [series, setSeries] = useState<TestSeries[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/test-series?type=free')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        setSeries(payload.series);
      })
      .catch((reason) => setError(reason.message || 'Could not load free test series.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-grow">
        <section className="bg-brand-primary text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="font-bold uppercase tracking-[0.2em] text-blue-200 text-sm mb-3">Practice with purpose</p>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4">Free Test Series</h1>
            <p className="text-blue-100 max-w-2xl mx-auto text-lg">Choose a free series, practice by subject, and measure your progress with timed tests.</p>
          </div>
        </section>
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? <Loading /> : error ? <Message title="Unable to load free test series" text={error} /> : series.length === 0 ? (
              <Message title="No free test series available" text="New free practice series will appear here when published." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {series.map((item) => (
                  <article key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 soft-shadow flex flex-col">
                    <div className="h-48 bg-blue-50">
                      {item.thumbnail_url ? <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-5xl">📝</div>}
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                      <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
                      <p className="text-slate-600 mt-3 leading-relaxed flex-grow whitespace-pre-wrap">{item.description || 'Build confidence with timed, subject-wise practice tests.'}</p>
                      <Link href={`/test-series/${item.id}`} className="mt-6"><Button variant="outline" fullWidth>View Test Series</Button></Link>
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

export function Loading() {
  return <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" /></div>;
}

export function Message({ title, text }: { title: string; text: string }) {
  return <div className="bg-white rounded-2xl border border-slate-100 soft-shadow text-center py-16 px-6"><div className="text-4xl mb-4">📚</div><h2 className="text-xl font-bold text-slate-900">{title}</h2><p className="text-slate-500 mt-2">{text}</p></div>;
}
