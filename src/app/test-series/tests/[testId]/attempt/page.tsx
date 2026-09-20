'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { testSeriesFetch } from '@/lib/test-series-client';
import { lockTestLandscape, restorePortrait } from '@/lib/orientation';

type Question = {
  id: string;
  subject_id?: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  negative_marks: number;
};

type AnswerStatus = 'not_visited' | 'visited' | 'answered' | 'marked_for_review' | 'answered_marked';

type Answer = {
  question_id: string;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  status: AnswerStatus | string;
};

type Attempt = { id: string; started_at: string; duration_minutes_snapshot: number; status: string };

type PaletteState = 'not_visited' | 'unattempted' | 'attempted' | 'marked_for_review' | 'answered_marked';

export default function TestAttemptPage() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [testSubjects, setTestSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);
  const [testTitle, setTestTitle] = useState('Test');
  const [subjectName, setSubjectName] = useState('Subject');
  const [marksPerCorrect, setMarksPerCorrect] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [timerReady, setTimerReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [subjectOpen, setSubjectOpen] = useState(true);
  const submittedRef = useRef(false);

  const questionCount = questions.length;

  const subjectGroups = useMemo<Array<{ id: string; name: string; questions: number[] }>>(() => {
    const list = testSubjects.length > 0 ? testSubjects : [{ id: 'single-subject', name: subjectName }];
    if (!questions.length) {
      return list.map((subject) => ({ id: subject.id, name: subject.name, questions: [] }));
    }

    const hasExplicitSubjectIds = questions.some((question) => Boolean(question.subject_id));
    if (hasExplicitSubjectIds) {
      const grouped = new Map<string, number[]>();
      questions.forEach((question, questionIndex) => {
        const mappedSubjectId = question.subject_id || (testSubjects.find((subject) => subject.id === question.subject_id)?.id) || list[0]?.id || 'single-subject';
        const current = grouped.get(mappedSubjectId) ?? [];
        current.push(questionIndex);
        grouped.set(mappedSubjectId, current);
      });

      return list.map((subject) => ({
        id: subject.id,
        name: subject.name,
        questions: grouped.get(subject.id) ?? [],
      }));
    }

    const ranges = list.map((subject, subjectIndex) => {
      const start = Math.floor((questions.length * subjectIndex) / list.length);
      const end = Math.floor((questions.length * (subjectIndex + 1)) / list.length);
      return {
        id: subject.id,
        name: subject.name,
        start,
        end: Math.max(start, end),
      };
    });

    return ranges.map((group) => ({
      ...group,
      questions: questions.slice(group.start, group.end).map((_, localIndex) => group.start + localIndex),
    }));
  }, [questions, subjectName, testSubjects]);

  useEffect(() => {
    if (!subjectGroups.length) return;

    const activeGroupIndex = subjectGroups.findIndex((group) => group.questions.includes(index));
    if (activeGroupIndex >= 0 && activeGroupIndex !== selectedSubjectIndex) {
      setSelectedSubjectIndex(activeGroupIndex);
    }
    if (selectedSubjectIndex >= subjectGroups.length) {
      setSelectedSubjectIndex(0);
    }
  }, [index, selectedSubjectIndex, subjectGroups]);

  const submit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setSaving(true);
    try {
      const response = await testSeriesFetch(`/api/test-attempts/${attempt.id}/submit`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      await restorePortrait();
      router.replace(`/test-series/tests/${testId}/results?attempt=${payload.attempt.id}`);
    } catch (reason) {
      submittedRef.current = false;
      setError(reason instanceof Error ? reason.message : 'Could not submit the test.');
    } finally {
      setSaving(false);
    }
  }, [attempt, router, testId]);

  // Dynamic screen orientation: automatically switch to landscape when test attempt screen is active,
  // and safely restore to portrait when exiting, unmounting, submitting, or navigating away.
  useEffect(() => {
    if (attempt && attempt.status === 'in_progress') {
      void lockTestLandscape();
    }
    return () => {
      void restorePortrait();
    };
  }, [attempt]);

  useEffect(() => {
    testSeriesFetch(`/api/tests/${testId}/attempt`, { method: 'POST' })
      .then(async (response) => {
        let payload: any = {};
        try {
          payload = await response.json();
        } catch {
          // Response body is not valid JSON
        }
        if (!response.ok) {
          throw new Error(payload.error || `Unable to start test (Server returned ${response.status})`);
        }
        if (payload.attempt.status !== 'in_progress') {
          router.replace(`/test-series/tests/${testId}/results?attempt=${payload.attempt.id}`);
          return;
        }
        setAttempt(payload.attempt);
        setTestTitle(payload.test?.title || 'Test');
        const loadedSubjects = Array.isArray(payload.test?.subjects) && payload.test.subjects.length
          ? payload.test.subjects
          : [{ id: 'single-subject', name: payload.test?.subject_name || 'Subject' }];
        setTestSubjects(loadedSubjects);
        setSubjectName(loadedSubjects[0]?.name || 'Subject');
        setMarksPerCorrect(Number(payload.test?.marks_per_correct ?? 1));
        setNegativeMarks(Number(payload.test?.negative_marks ?? 0));
        setQuestions(payload.questions ?? []);
        setAnswers(Object.fromEntries((payload.answers as Answer[] | undefined ?? []).map((answer) => [answer.question_id, answer])));
      })
      .catch((reason) => {
        const msg = reason?.message || 'Could not start this test.';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setError('Network request failed. Please check internet connection and CORS / server configuration.');
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [router, testId]);

  useEffect(() => {
    if (!attempt) {
      setTimerReady(false);
      setRemaining(null);
      return;
    }

    const updateTimer = () => {
      const expiryAt = new Date(attempt.started_at).getTime() + attempt.duration_minutes_snapshot * 60000;
      const nextRemaining = Math.max(0, Math.ceil((expiryAt - Date.now()) / 1000));
      setRemaining(nextRemaining);
      setTimerReady(true);
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (!attempt || !timerReady || remaining === null || submittedRef.current || remaining > 0) return;

    const timeout = window.setTimeout(() => {
      if (!submittedRef.current) {
        void submit();
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [attempt, remaining, submit, timerReady]);

  const save = async (status: AnswerStatus | string, next = false, clear = false) => {
    const question = questions[index];
    if (!attempt || !question) return;

    setSaving(true);
    setError('');

    const currentAnswer = answers[question.id];
    const selectedOption = clear ? null : currentAnswer?.selected_option ?? null;

    try {
      const response = await testSeriesFetch(`/api/test-attempts/${attempt.id}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, selectedOption, status }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);

      setAnswers((current) => ({ ...current, [question.id]: payload.answer }));
      if (next && index < questions.length - 1) {
        setIndex(index + 1);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your answer.');
    } finally {
      setSaving(false);
    }
  };

  const getPaletteState = (questionId: string): PaletteState => {
    const answer = answers[questionId];
    if (!answer) return 'not_visited';
    if (answer.status === 'answered') return 'attempted';
    if (answer.status === 'marked_for_review') return 'marked_for_review';
    if (answer.status === 'answered_marked') return 'answered_marked';
    if (answer.status === 'visited' || answer.selected_option === null) return 'unattempted';
    return 'not_visited';
  };

  const currentQuestion = questions[index];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const minutes = remaining === null ? 0 : Math.floor(remaining / 60);
  const seconds = remaining === null ? 0 : remaining % 60;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (error && !attempt) {
    const isAuthError =
      error.toLowerCase().includes('authentication') ||
      error.toLowerCase().includes('sign in') ||
      error.toLowerCase().includes('log in');

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md text-center rounded-2xl soft-shadow p-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 text-xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-slate-900">Unable to start test</h1>
          <p className="text-slate-600 mt-3 text-sm leading-relaxed">{error}</p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            {isAuthError && (
              <Button onClick={() => router.push(`/login?redirect=/test-series/tests/${testId}/attempt`)}>
                Sign In to Continue
              </Button>
            )}
            <Button
              variant={isAuthError ? 'outline' : 'primary'}
              onClick={async () => {
                await restorePortrait();
                router.push(`/test-series/tests/${testId}/instructions`);
              }}
            >
              Back to Instructions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!attempt || !currentQuestion) return null;

  const statusLegend = [
    { label: 'Not Visited', className: 'bg-slate-200 text-slate-700 border-slate-300' },
    { label: 'Unattempted', className: 'bg-red-100 text-red-700 border-red-300' },
    { label: 'Attempted', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { label: 'Marked for Review', className: 'bg-amber-100 text-amber-700 border-amber-300' },
    { label: 'Attempted & Marked', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900">{testTitle}</p>
              {testTitle.toLowerCase().includes('demo') && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  {testTitle.toLowerCase().includes('paid') ? 'Paid Demo' : 'Demo'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {subjectGroups.map((group, groupIndex) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectIndex(groupIndex);
                    if (group.questions.length > 0) setIndex(group.questions[0]);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    groupIndex === selectedSubjectIndex
                      ? 'border-brand-primary bg-blue-50 dark:bg-blue-950/70 text-brand-primary dark:text-blue-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>

          <div className={`font-mono text-lg font-bold px-4 py-2 rounded-lg ${remaining !== null && remaining < 300 ? 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300' : 'bg-blue-100 text-brand-primary dark:bg-blue-950/70 dark:text-blue-300'}`}>
            ⏱ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 pb-20 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px] gap-4 md:gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-800 p-4 sm:p-6 md:p-8 flex flex-col min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-brand-primary dark:text-blue-400">Question {index + 1}</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/70 px-2.5 py-1 font-medium text-brand-primary dark:text-blue-300">+{marksPerCorrect} marks</span>
              <span className="rounded-full bg-rose-50 dark:bg-rose-950/70 px-2.5 py-1 font-medium text-rose-700 dark:text-rose-300">-{negativeMarks} negative</span>
            </div>
          </div>

          <h1 className="mt-4 text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
            {currentQuestion.question_text}
          </h1>

          <div className="mt-7 space-y-3 flex-1">
            {(['A', 'B', 'C', 'D'] as const).map((option) => {
              const isSelected = currentAnswer?.selected_option === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setAnswers((current) => ({
                      ...current,
                      [currentQuestion.id]: {
                        question_id: currentQuestion.id,
                        selected_option: option,
                        status: 'answered',
                      },
                    }))
                  }
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    isSelected
                      ? 'border-brand-primary bg-blue-50 dark:bg-blue-950/70 dark:border-blue-500 shadow-sm text-slate-900 dark:text-slate-100 font-medium'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <span className="font-bold mr-3">{option}.</span>
                  {currentQuestion[`option_${option.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d']}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-5 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" disabled={index === 0 || saving} onClick={() => setIndex(index - 1)}>
                Previous
              </Button>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={saving} onClick={() => void save('visited', false, true)}>
                  Clear Response
                </Button>
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void save(currentAnswer?.selected_option ? 'answered_marked' : 'marked_for_review', true)}
                >
                  Review & Next
                </Button>
                <Button disabled={saving} onClick={() => void save(currentAnswer?.selected_option ? 'answered' : 'visited', true)}>
                  Save & Next
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="bg-white dark:bg-slate-900 rounded-2xl soft-shadow border border-slate-100 dark:border-slate-800 p-4 sm:p-5 h-fit md:sticky md:top-20 flex flex-col min-h-0">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <button type="button" onClick={() => setPaletteOpen((value) => !value)} className="flex w-full items-center justify-between gap-2 font-bold text-slate-900 dark:text-slate-100">
              <span>Question palette</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{paletteOpen ? 'Hide' : 'Show'}</span>
            </button>
          </div>

          {paletteOpen && (
            <>
              <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                {subjectGroups.map((group, groupIndex) => (
                  <div key={group.id} className="mb-3 last:mb-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubjectIndex(groupIndex);
                        setSubjectOpen((value) => (value && groupIndex === selectedSubjectIndex ? false : true));
                        if (group.questions.length > 0) {
                          setIndex(group.questions[0]);
                        }
                      }}
                      className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span>{group.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{group.questions.length} Q</span>
                    </button>

                    {subjectOpen && groupIndex === selectedSubjectIndex && (
                      <div className="grid grid-cols-5 gap-2 mt-3">
                        {group.questions.map((questionIndex) => {
                          const item = questions[questionIndex];
                          if (!item) return null;
                          const status = getPaletteState(item.id);
                          const paletteStyles =
                            status === 'attempted'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                              : status === 'marked_for_review'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                : status === 'answered_marked'
                                  ? 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-300 border-violet-300 dark:border-violet-700 ring-2 ring-amber-300 dark:ring-amber-500'
                                  : status === 'unattempted'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-700'
                                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setIndex(questionIndex)}
                              className={`relative h-10 rounded-lg border text-sm font-bold ${index === questionIndex ? 'ring-2 ring-brand-primary dark:ring-blue-400 ring-offset-1' : ''} ${paletteStyles}`}
                              aria-label={`Question ${questionIndex + 1} ${status}`}
                            >
                              {questionIndex + 1}
                              {(status === 'marked_for_review' || status === 'answered_marked') && (
                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border border-white dark:border-slate-900" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 text-xs text-slate-500 space-y-2">
                {statusLegend.map((entry) => (
                  <p key={entry.label} className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full border ${entry.className}`} />
                    {entry.label}
                  </p>
                ))}
              </div>
            </>
          )}

          <div className="mt-auto pt-4 border-t border-slate-100">
            <Button className="w-full" disabled={saving} onClick={() => void submit()}>
              Submit Test
            </Button>
          </div>
        </aside>
      </main>
    </div>
  );
}
