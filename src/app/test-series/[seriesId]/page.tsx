'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { Loading, Message } from '../page';

type TestCard = { id: string; title: string; date_label: string | null; duration_minutes: number; max_marks: number; language: string; is_paid: boolean; price: number; scheduled_start: string | null; scheduled_end: string | null; question_count: number };
type Subject = { id: string; name: string; icon_url: string | null; tests: TestCard[] };
type SeriesDetail = { id: string; title: string; description: string | null; thumbnail_url: string | null };

function testStatus(test: TestCard) {
  const now = Date.now();
  if (test.scheduled_end && now > new Date(test.scheduled_end).getTime()) return 'Ended';
  if (test.scheduled_start && now < new Date(test.scheduled_start).getTime()) return 'Upcoming';
  return 'Available';
}

export default function TestSeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/test-series/${seriesId}?type=free`)
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setSeries(payload.series); setSubjects(payload.subjects); })
      .catch((reason) => setError(reason.message || 'Could not load this free test series.'))
      .finally(() => setLoading(false));
  }, [seriesId]);

  return <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950"><Navbar /><main className="flex-grow py-10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {loading ? <Loading /> : error || !series ? <Message title="Test series unavailable" text={error || 'This series is not currently available.'} /> : <>
        <section className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden soft-shadow border border-slate-100 dark:border-slate-800 mb-10">
          <div className="grid md:grid-cols-3"><div className="h-56 md:h-full bg-blue-50 dark:bg-slate-800">{series.thumbnail_url ? <img src={series.thumbnail_url} alt={series.title} className="w-full h-full object-cover" /> : <div className="h-full min-h-56 flex items-center justify-center text-6xl">📝</div>}</div><div className="md:col-span-2 p-7 md:p-10"><p className="text-brand-primary dark:text-blue-400 font-bold text-sm uppercase tracking-widest">Test Series</p><h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">{series.title}</h1><p className="text-slate-600 dark:text-slate-300 mt-5 whitespace-pre-wrap leading-relaxed">{series.description || 'Select a subject below to begin practicing.'}</p><p className="mt-6 inline-block bg-green-100 dark:bg-emerald-950/80 text-green-700 dark:text-emerald-300 text-sm font-bold px-3 py-1 rounded-full">Free and paid tests are clearly marked</p></div></div>
        </section>
        <section><h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">Subjects & Tests</h2>{subjects.length === 0 ? <Message title="No subjects available" text="Tests will appear here when the series is published." /> : <div className="space-y-6">{subjects.map((subject) => <article key={subject.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 soft-shadow overflow-hidden"><div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">{subject.icon_url ? <img src={subject.icon_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/70 flex items-center justify-center text-xl">📖</span>}<div><h3 className="text-xl font-bold text-slate-900 dark:text-white">{subject.name}</h3><p className="text-sm text-slate-500 dark:text-slate-400">{subject.tests.length} published {subject.tests.length === 1 ? 'test' : 'tests'}</p></div></div><div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">{subject.tests.length === 0 ? <p className="text-slate-500 dark:text-slate-400">No tests are available for this subject yet.</p> : subject.tests.map((test) => <TestCardView key={test.id} test={test} />)}</div></article>)}</div>}</section>
      </>}
    </div>
  </main><Footer /></div>;
}

function TestCardView({ test }: { test: TestCard }) {
  const status = testStatus(test);
  const canStart = status === 'Available';
  return <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl p-5"><div className="flex justify-between gap-3"><h4 className="font-bold text-slate-900 dark:text-white">{test.title}</h4><span className={`text-xs font-bold px-2 py-1 rounded h-fit ${test.is_paid ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' : 'bg-green-100 dark:bg-emerald-950/80 text-green-700 dark:text-emerald-300'}`}>{test.is_paid ? `PAID · ₹${test.price}` : 'FREE'}</span></div><div className="grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300 mt-4"><span>⏱ {test.duration_minutes} min</span><span>📝 {test.question_count} questions</span><span>🏆 {test.max_marks} marks</span><span>🌐 {test.language}</span></div><div className="flex items-center justify-between mt-5"><span className={`text-sm font-semibold ${status === 'Available' ? 'text-green-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{status}</span>{canStart ? <Link href={`/test-series/tests/${test.id}/instructions`}><Button size="sm">{test.is_paid ? 'Check Access' : 'Start Test'}</Button></Link> : <Button size="sm" disabled>{status}</Button>}</div></div>;
}
