'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Footer from '@/components/shared/Footer';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/Button';
import { Loading, Message } from '../../../page';

type TestInfo = { id: string; title: string; duration_minutes: number; max_marks: number; language: string; instructions: string | null; is_paid: boolean; price: number; question_count: number };

export default function TestInstructionsPage() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const [test, setTest] = useState<TestInfo | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/test-series/tests/${testId}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setTest(payload.test); }).catch((reason) => setError(reason.message || 'Could not load test instructions.')).finally(() => setLoading(false));
  }, [testId]);

  return <div className="min-h-screen flex flex-col bg-slate-50"><Navbar /><main className="flex-grow py-10"><div className="max-w-3xl mx-auto px-4 sm:px-6">
    {loading ? <Loading /> : error || !test ? <Message title="Test unavailable" text={error || 'This test is not currently available.'} /> : <section className="bg-white rounded-2xl border border-slate-100 soft-shadow overflow-hidden"><div className="bg-brand-primary text-white p-7 md:p-10"><p className="text-blue-200 font-bold text-sm uppercase tracking-widest">{test.is_paid ? 'Premium test preparation' : 'Before you begin'}</p><h1 className="text-3xl font-extrabold mt-2">{test.title}</h1><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 text-sm"><Metric label="Duration" value={`${test.duration_minutes} min`} /><Metric label="Questions" value={String(test.question_count)} /><Metric label="Maximum marks" value={String(test.max_marks)} /><Metric label="Language" value={test.language} /></div></div><div className="p-7 md:p-10"><div className="mb-8"><h2 className="text-xl font-bold text-slate-900">Instructions</h2><div className="mt-3 text-slate-600 leading-relaxed whitespace-pre-wrap">{test.instructions || 'Read each question carefully. Your timer starts when you continue. Your answers are saved as you move through the test.'}</div></div>{test.is_paid && <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3"><span className="text-xl">⭐</span><div><p className="font-bold text-amber-900">{test.title.toLowerCase().includes('demo') ? `Paid Test Series Demo (₹${test.price})` : `Paid Test (₹${test.price})`}</p><p className="mt-0.5">{test.title.toLowerCase().includes('demo') ? 'This is a premium demo test with full exam simulation. You can proceed to experience the real-time timer, question palette, and detailed solution analysis.' : 'You can start only if your account has valid access.'}</p></div></div>}<label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 h-4 w-4 accent-blue-900" /><span className="text-sm text-slate-700">I have read the instructions and understand that the timer cannot be paused after I start the test.</span></label><div className="mt-7 flex flex-col-reverse sm:flex-row justify-between gap-3"><Button variant="ghost" onClick={() => router.back()}>Back</Button><Button size="lg" disabled={!agreed} onClick={() => router.push(`/test-series/tests/${test.id}/attempt`)}>{test.is_paid && test.title.toLowerCase().includes('demo') ? 'Agree & Start Demo Test' : 'Agree & Continue'}</Button></div></div></section>}
  </div></main><Footer /></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white/10 rounded-lg p-3"><p className="text-blue-100 text-xs">{label}</p><p className="font-bold mt-1">{value}</p></div>; }
