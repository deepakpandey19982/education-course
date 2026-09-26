'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { testSeriesFetch } from '@/lib/test-series-client';
import { Loading, Message } from '../../../page';

type Result = {
  attempt: { score: number; correct_count: number; incorrect_count: number; unattempted_count: number; accuracy: number };
  analysis: Array<{
    id: string;
    question_text: string;
    question_image_url?: string | null;
    option_a: string;
    option_a_image_url?: string | null;
    option_b: string;
    option_b_image_url?: string | null;
    option_c: string;
    option_c_image_url?: string | null;
    option_d: string;
    option_d_image_url?: string | null;
    correct_option: string;
    explanation: string | null;
    answer: { selected_option: string | null; is_correct: boolean | null } | null;
  }>;
};

function TestResultsContent() {
  const attemptId = useSearchParams().get('attempt');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;
    testSeriesFetch(`/api/test-attempts/${attemptId}/result`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        setResult(payload);
      })
      .catch((reason) => setError(reason.message || 'Could not load result.'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="flex-grow py-10">
        <div className="max-w-4xl mx-auto px-4">
          {!attemptId ? (
            <Message title="Result unavailable" text="No attempt was selected." />
          ) : loading ? (
            <Loading />
          ) : error || !result ? (
            <Message title="Result unavailable" text={error || 'This result is not available.'} />
          ) : (
            <>
              <section className="bg-white dark:bg-slate-900 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-800 p-7 text-center">
                <p className="font-bold text-brand-primary dark:text-blue-400 uppercase text-sm tracking-widest">Test completed</p>
                <h1 className="text-5xl font-extrabold text-slate-900 dark:text-white mt-3">{result.attempt.score}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Your score</p>
                <div className="grid grid-cols-3 gap-3 mt-7 text-sm">
                  <Stat label="Correct" value={result.attempt.correct_count} />
                  <Stat label="Incorrect" value={result.attempt.incorrect_count} />
                  <Stat label="Unattempted" value={result.attempt.unattempted_count} />
                </div>
                <p className="mt-5 text-slate-700 dark:text-slate-300 font-semibold">Accuracy: {result.attempt.accuracy}%</p>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                  <Link href="/test-series">
                    <Button variant="outline">Free Test Series</Button>
                  </Link>
                  <Link href="/test-series/paid">
                    <Button variant="primary" className="bg-amber-600 hover:bg-amber-700 text-white">Paid Test Series</Button>
                  </Link>
                </div>
              </section>

              <section className="mt-8 space-y-4">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Solution analysis</h2>
                {result.analysis.map((item, index) => (
                  <article key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 soft-shadow p-6">
                    {item.question_text && (
                      <p className="font-bold text-slate-900 dark:text-white leading-relaxed">
                        {index + 1}. {item.question_text}
                      </p>
                    )}
                    {item.question_image_url && (
                      <div className="my-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.question_image_url}
                          alt="Question diagram"
                          className="max-h-60 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-2 object-contain"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs my-3">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const optText = item[`option_${opt.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                        const optImg = item[`option_${opt.toLowerCase()}_image_url` as 'option_a_image_url' | 'option_b_image_url' | 'option_c_image_url' | 'option_d_image_url'];
                        const isCorrect = item.correct_option === opt;
                        const isSelected = item.answer?.selected_option === opt;

                        return (
                          <div
                            key={opt}
                            className={`p-2.5 rounded-lg border ${
                              isCorrect
                                ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                                : isSelected
                                ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-bold mr-1.5">{opt}.</span>
                            {optText}
                            {optImg && (
                              <div className="mt-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={optImg}
                                  alt={`Option ${opt} diagram`}
                                  className="max-h-24 rounded border border-slate-200 dark:border-slate-700 bg-white p-1 object-contain"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-sm mt-3 text-slate-600 dark:text-slate-300">
                      Your answer: <strong className="text-slate-900 dark:text-white">{item.answer?.selected_option ?? 'Not answered'}</strong>
                    </p>
                    <p className="text-sm mt-1 text-green-700 dark:text-emerald-400">
                      Correct answer: <strong>{item.correct_option}</strong>
                    </p>
                    {item.explanation && (
                      <p className="mt-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 text-slate-700 dark:text-slate-200 text-sm p-3 rounded-lg">
                        {item.explanation}
                      </p>
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function TestResultsPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" /></div>}><TestResultsContent /></Suspense>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-3"><p className="font-bold text-slate-900 dark:text-white">{value}</p><p className="text-slate-500 dark:text-slate-400">{label}</p></div>; }
