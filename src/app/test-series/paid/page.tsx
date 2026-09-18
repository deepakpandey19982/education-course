'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { TestSeries } from '@/types/supabase';
import { Loading, Message } from '../page';

export default function PaidTestSeriesPage() {
  const [series, setSeries] = useState<TestSeries[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/test-series?type=paid')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        setSeries(payload.series);
      })
      .catch((reason) => setError(reason.message || 'Could not load paid test series.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-grow">
        <section className="bg-amber-600 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-100 text-sm mb-3">Premium practice</p>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4">Paid Test Series</h1>
            <p className="text-amber-100 max-w-2xl mx-auto text-lg">Access premium preparation tracks, structured by subject, with paid tests clearly marked for purchase.</p>
          </div>
        </section>
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? <Loading /> : error ? <Message title="Unable to load paid test series" text={error} /> : series.length === 0 ? (
              <Message title="No paid test series available" text="New paid practice series will appear here when published." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {series.map((item) => (
                  <article key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 soft-shadow flex flex-col">
                    <div className="h-48 bg-amber-50">
                      {item.thumbnail_url ? <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-5xl">📝</div>}
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                      <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
                      <p className="text-slate-600 mt-3 leading-relaxed flex-grow whitespace-pre-wrap">{item.description || 'Advance your preparation with premium, timed practice tests.'}</p>
                      <Link href={`/test-series/paid/${item.id}`} className="mt-6"><Button variant="outline" fullWidth>View Paid Series</Button></Link>
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
