'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { Loading, Message } from '../../page';
import { fetchSeriesDetail, SeriesDetailData, SubjectWithTests, TestCard } from '@/lib/test-series-client';

function testStatus(test: TestCard) {
  const now = Date.now();
  if (test.scheduled_end && now > new Date(test.scheduled_end).getTime()) return 'Ended';
  if (test.scheduled_start && now < new Date(test.scheduled_start).getTime()) return 'Upcoming';
  return 'Available';
}

export default function PaidTestSeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [series, setSeries] = useState<SeriesDetailData['series'] | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithTests[]>([]);
  const [tests, setTests] = useState<TestCard[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!seriesId) return;
    try {
      const data = await fetchSeriesDetail(seriesId, 'paid');
      setSeries(data.series);
      setSubjects(data.subjects);
      const allTests: TestCard[] = data.tests || (data.subjects || []).flatMap((s) => s.tests);
      const uniqueTests = Array.from(new Map(allTests.map((t) => [t.id, t])).values());
      setTests(uniqueTests);
      setError('');
    } catch (reason: any) {
      setError(reason.message || 'Could not load this paid test series.');
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    loadDetail();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDetail();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDetail]);

  const filteredTests = useMemo(() => {
    if (selectedSubjectId === 'all') return tests;
    return tests.filter(
      (t) =>
        t.subjects?.some((s) => s.id === selectedSubjectId) ||
        (t as any).subject_id === selectedSubjectId
    );
  }, [selectedSubjectId, tests]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <Loading />
          ) : error || !series ? (
            <Message title="Paid test series unavailable" text={error || 'This paid series is not currently available.'} />
          ) : (
            <>
              <section className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden soft-shadow border border-slate-100 dark:border-slate-800 mb-10">
                <div className="grid md:grid-cols-3">
                  <div className="h-56 md:h-full bg-amber-50 dark:bg-slate-800">
                    {series.thumbnail_url ? (
                      <img src={series.thumbnail_url} alt={series.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="h-full min-h-56 flex items-center justify-center text-6xl">📝</div>
                    )}
                  </div>
                  <div className="md:col-span-2 p-7 md:p-10">
                    <p className="text-amber-600 dark:text-amber-400 font-bold text-sm uppercase tracking-widest">
                      Paid Test Series
                    </p>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
                      {series.title}
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-5 whitespace-pre-wrap leading-relaxed">
                      {series.description || 'Select a test below to begin practicing.'}
                    </p>
                    <p className="mt-6 inline-block bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-sm font-bold px-3 py-1 rounded-full border border-amber-300 dark:border-amber-700">
                      Premium exams with demo practice flow
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Tests in this Series</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Choose a test to start your timed exam attempt.
                    </p>
                  </div>
                  {subjects.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedSubjectId('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          selectedSubjectId === 'all'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        All Tests ({tests.length})
                      </button>
                      {subjects.map((sub) => {
                        const subCount = tests.filter(
                          (t) =>
                            t.subjects?.some((s) => s.id === sub.id) ||
                            (t as any).subject_id === sub.id
                        ).length;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setSelectedSubjectId(sub.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                              selectedSubjectId === sub.id
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {sub.name} ({subCount})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {filteredTests.length === 0 ? (
                  <Message title="No tests available" text="Paid tests will appear here when published by the administrator." />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredTests.map((test) => (
                      <TestCardView key={test.id} test={test} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function TestCardView({ test }: { test: TestCard }) {
  const status = testStatus(test);
  const canStart = status === 'Available';
  const isDemo = test.is_paid && test.title.toLowerCase().includes('demo');
  return (
    <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-xl p-5 soft-shadow hover:border-amber-500/40 transition-colors flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start gap-3">
          <div>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white">{test.title}</h4>
            {test.date_label && (
              <span className="inline-block mt-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                📅 {test.date_label}
              </span>
            )}
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full h-fit ${
              isDemo
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                : test.is_paid
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-emerald-950/80 text-green-700 dark:text-emerald-300'
            }`}
          >
            {isDemo ? `PAID DEMO · ₹${test.price}` : test.is_paid ? `PAID · ₹${test.price}` : 'FREE'}
          </span>
        </div>

        {/* Subjects in this Test */}
        {test.subjects && test.subjects.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Subjects:
            </span>
            {test.subjects.map((sub) => (
              <span
                key={sub.id}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
              >
                {sub.name}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300 mt-4">
          <span>⏱ {test.duration_minutes} min</span>
          <span>📝 {test.question_count} questions</span>
          <span>🏆 {test.max_marks} marks</span>
          <span>🌐 {test.language}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60">
        <span
          className={`text-sm font-semibold ${
            status === 'Available' ? 'text-green-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {status}
        </span>
        {canStart ? (
          <Link href={`/test-series/tests/${test.id}/instructions`}>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
              {isDemo ? 'Start Demo Test' : 'Check Access'}
            </Button>
          </Link>
        ) : (
          <Button size="sm" disabled>
            {status}
          </Button>
        )}
      </div>
    </div>
  );
}

