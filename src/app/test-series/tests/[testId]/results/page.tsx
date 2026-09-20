'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { testSeriesFetch } from '@/lib/test-series-client';
import { Loading, Message } from '../../../page';

type Result = { attempt: { score: number; correct_count: number; incorrect_count: number; unattempted_count: number; accuracy: number }; analysis: Array<{ id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; explanation: string | null; answer: { selected_option: string | null; is_correct: boolean | null } | null }> };

function TestResultsContent() {
  const attemptId = useSearchParams().get('attempt');
  const [result, setResult] = useState<Result | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!attemptId) return; testSeriesFetch(`/api/test-attempts/${attemptId}/result`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setResult(payload); }).catch((reason) => setError(reason.message || 'Could not load result.')).finally(() => setLoading(false)); }, [attemptId]);
  return <div className="min-h-screen flex flex-col bg-slate-50"><Navbar /><main className="flex-grow py-10"><div className="max-w-4xl mx-auto px-4">{!attemptId ? <Message title="Result unavailable" text="No attempt was selected." /> : loading ? <Loading /> : error || !result ? <Message title="Result unavailable" text={error || 'This result is not available.'} /> : <><section className="bg-white rounded-2xl soft-shadow border border-slate-100 p-7 text-center"><p className="font-bold text-brand-primary uppercase text-sm tracking-widest">Test completed</p><h1 className="text-5xl font-extrabold text-slate-900 mt-3">{result.attempt.score}</h1><p className="text-slate-500 mt-1">Your score</p><div className="grid grid-cols-3 gap-3 mt-7 text-sm"><Stat label="Correct" value={result.attempt.correct_count} /><Stat label="Incorrect" value={result.attempt.incorrect_count} /><Stat label="Unattempted" value={result.attempt.unattempted_count} /></div><p className="mt-5 text-slate-700 font-semibold">Accuracy: {result.attempt.accuracy}%</p><div className="flex flex-wrap items-center justify-center gap-3 mt-6"><Link href="/test-series"><Button variant="outline">Free Test Series</Button></Link><Link href="/test-series/paid"><Button variant="primary" className="bg-amber-600 hover:bg-amber-700 text-white">Paid Test Series</Button></Link></div></section><section className="mt-8 space-y-4"><h2 className="text-2xl font-extrabold text-slate-900">Solution analysis</h2>{result.analysis.map((item, index) => <article key={item.id} className="bg-white rounded-xl border border-slate-100 soft-shadow p-6"><p className="font-bold text-slate-900">{index + 1}. {item.question_text}</p><p className="text-sm mt-3 text-slate-600">Your answer: <strong>{item.answer?.selected_option ?? 'Not answered'}</strong></p><p className="text-sm mt-1 text-green-700">Correct answer: <strong>{item.correct_option}</strong></p>{item.explanation && <p className="mt-4 bg-blue-50 text-slate-700 text-sm p-3 rounded-lg">{item.explanation}</p>}</article>)}</section></>}</div></main><Footer /></div>;
}

export default function TestResultsPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" /></div>}><TestResultsContent /></Suspense>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-slate-50 rounded-lg p-3"><p className="font-bold text-slate-900">{value}</p><p className="text-slate-500">{label}</p></div>; }
