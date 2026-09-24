'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from '../_components/ImageUploadField';
import {
  decodeSubjectTag,
  decodeTestSubjectsTag,
  encodeSubjectTag,
  encodeTestSubjectsTag,
  resolveQuestionSubjectId,
  resolveTestSubjectIds,
} from '../_components/testSeriesHelpers';
import type { TestSeries, TestSeriesSubject, Test, Question } from '@/types/supabase';
import { ImportQuestionsModal } from '../_components/ImportQuestionsModal';

type Tab = 'overview' | 'subjects' | 'tests' | 'questions';

type SeriesEditForm = {
  title: string;
  description: string;
  thumbnail_url: string;
  is_paid: boolean;
  is_published: boolean;
  order: number;
};

type SubjectForm = {
  id?: string;
  name: string;
  icon_url: string;
  is_enabled: boolean;
  order: number;
};

type TestForm = {
  id?: string;
  title: string;
  date_label: string;
  duration_minutes: number;
  max_marks: number;
  marks_per_correct: number;
  negative_marks: number;
  language: string;
  instructions: string;
  is_paid: boolean;
  price: number;
  is_published: boolean;
  scheduled_start: string;
  scheduled_end: string;
  order: number;
  selected_subject_ids: string[];
};

type QuestionForm = {
  id?: string;
  subject_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  marks: number;
  negative_marks: number;
  language: string;
  order: number;
};

const emptySubjectForm = (): SubjectForm => ({
  name: '',
  icon_url: '',
  is_enabled: true,
  order: 0,
});

const emptyTestForm = (isSeriesPaid = false): TestForm => ({
  title: '',
  date_label: '',
  duration_minutes: 60,
  max_marks: 100,
  marks_per_correct: 1,
  negative_marks: 0,
  language: 'English',
  instructions: '',
  is_paid: isSeriesPaid,
  price: isSeriesPaid ? 299 : 0,
  is_published: true,
  scheduled_start: '',
  scheduled_end: '',
  order: 0,
  selected_subject_ids: [],
});

const emptyQuestionForm = (defaultSubjectId = '', marks = 1, neg = 0, lang = 'English'): QuestionForm => ({
  subject_id: defaultSubjectId,
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  explanation: '',
  marks,
  negative_marks: neg,
  language: lang,
  order: 0,
});

export default function DedicatedSeriesManagementPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(
    ['overview', 'subjects', 'tests', 'questions'].includes(initialTab) ? initialTab : 'overview'
  );

  // Core Data
  const [series, setSeries] = useState<TestSeries | null>(null);
  const [subjects, setSubjects] = useState<TestSeriesSubject[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Test for Questions Tab
  const initialTestId = searchParams.get('testId') || '';
  const [selectedTestId, setSelectedTestId] = useState<string>(initialTestId);

  // Question Filters
  const initialSubjectFilter = searchParams.get('subjectId') || 'all';
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(initialSubjectFilter);
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');

  // Modals / Forms
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false);
  const [seriesForm, setSeriesForm] = useState<SeriesEditForm>({
    title: '',
    description: '',
    thumbnail_url: '',
    is_paid: false,
    is_published: true,
    order: 0,
  });

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [subjectForm, setSubjectForm] = useState<SubjectForm>(emptySubjectForm());

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testForm, setTestForm] = useState<TestForm>(emptyTestForm());

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  // Load all data for this series
  const loadSeriesData = useCallback(async () => {
    if (!seriesId) return;

    try {
      setLoading(true);

      // 1. Fetch Series
      let seriesRow: any = null;
      try {
        const { data, error } = await supabase
          .from('test_series')
          .select('*')
          .eq('id', seriesId)
          .single();
        if (error) throw error;
        seriesRow = data;
      } catch (err) {
        console.error('Failed to load series:', err);
        alert('Unable to load test series.');
        return;
      }

      setSeries(seriesRow);
      setSeriesForm({
        title: seriesRow.title,
        description: seriesRow.description || '',
        thumbnail_url: seriesRow.thumbnail_url || '',
        is_paid: Boolean(seriesRow.is_paid || seriesRow.title?.toLowerCase().includes('paid')),
        is_published: seriesRow.is_published,
        order: seriesRow.order || 0,
      });

      // 2. Fetch Subjects belonging to THIS series
      const { data: subjectRows, error: subErr } = await supabase
        .from('test_series_subjects')
        .select('*')
        .eq('series_id', seriesId)
        .order('order', { ascending: true });

      if (subErr) throw subErr;
      const loadedSubjects = subjectRows ?? [];
      setSubjects(loadedSubjects);

      const subjectIds = loadedSubjects.map((s) => s.id);

      // 3. Fetch Tests belonging to THIS series (via subject_id in series or direct series_id)
      let testRows: any[] = [];
      if (subjectIds.length > 0) {
        const { data: tData } = await supabase
          .from('tests')
          .select('*')
          .in('subject_id', subjectIds)
          .order('order', { ascending: true });
        testRows = tData ?? [];
      }
      try {
        const { data: directTests } = await supabase
          .from('tests')
          .select('*')
          .eq('series_id', seriesId)
          .order('order', { ascending: true });
        if (directTests && directTests.length > 0) {
          const existingIds = new Set(testRows.map((t) => t.id));
          directTests.forEach((t) => {
            if (!existingIds.has(t.id)) testRows.push(t);
          });
        }
      } catch {
        // Safe fallback if series_id column not present in DB cache
      }
      setTests(testRows);

      // Auto-select first test if none selected or invalid
      if (testRows.length > 0) {
        if (!selectedTestId || !testRows.some((t) => t.id === selectedTestId)) {
          setSelectedTestId(testRows[0].id);
        }
      } else {
        setSelectedTestId('');
      }

      // 4. Fetch Questions for all tests in this series
      const testIds = testRows.map((t) => t.id);
      if (testIds.length > 0) {
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .in('test_id', testIds)
          .order('order', { ascending: true });
        setQuestions(qData ?? []);
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error('Error loading series hierarchy:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTestId, seriesId]);

  useEffect(() => {
    loadSeriesData();
  }, [loadSeriesData]);

  // Active Test Object
  const currentTest = useMemo(() => {
    return tests.find((t) => t.id === selectedTestId) || tests[0] || null;
  }, [selectedTestId, tests]);

  // Subjects assigned to current test
  const assignedSubjectsForCurrentTest = useMemo(() => {
    if (!currentTest) return subjects;
    const testSubIds = new Set<string>(resolveTestSubjectIds(currentTest));
    // Also include subjects of existing questions in this test
    questions
      .filter((q) => q.test_id === currentTest.id)
      .forEach((q) => {
        const sId = resolveQuestionSubjectId(q, currentTest);
        if (sId) testSubIds.add(sId);
      });

    const filtered = subjects.filter((s) => testSubIds.has(s.id));
    return filtered.length > 0 ? filtered : subjects;
  }, [currentTest, questions, subjects]);

  // Questions belonging to active test
  const testQuestions = useMemo(() => {
    if (!currentTest) return [];
    return questions.filter((q) => q.test_id === currentTest.id);
  }, [currentTest, questions]);

  // Filtered Questions in Tab 4
  const visibleQuestions = useMemo(() => {
    return testQuestions.filter((q) => {
      const qSubId = resolveQuestionSubjectId(q, currentTest);

      if (selectedSubjectFilter !== 'all' && qSubId !== selectedSubjectFilter) {
        return false;
      }

      if (questionSearchQuery.trim()) {
        const query = questionSearchQuery.toLowerCase();
        const matchesText = q.question_text?.toLowerCase().includes(query);
        const matchesExp = q.explanation?.toLowerCase().includes(query);
        if (!matchesText && !matchesExp) return false;
      }

      return true;
    });
  }, [currentTest, questionSearchQuery, selectedSubjectFilter, testQuestions]);

  // Subject Question Counts within current test
  const subjectQuestionCountsInCurrentTest = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sub of subjects) {
      counts.set(sub.id, 0);
    }
    for (const q of testQuestions) {
      const sId = resolveQuestionSubjectId(q, currentTest);
      if (sId) {
        counts.set(sId, (counts.get(sId) ?? 0) + 1);
      }
    }
    return counts;
  }, [currentTest, subjects, testQuestions]);

  // Total Question count per subject across ALL tests in this series
  const subjectTotalQuestionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sub of subjects) {
      counts.set(sub.id, 0);
    }
    for (const q of questions) {
      const parentTest = tests.find((t) => t.id === q.test_id);
      const sId = resolveQuestionSubjectId(q, parentTest);
      if (sId) {
        counts.set(sId, (counts.get(sId) ?? 0) + 1);
      }
    }
    return counts;
  }, [questions, subjects, tests]);

  // ---------------------------------------------------------------------------
  // HANDLERS: Series
  // ---------------------------------------------------------------------------
  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesId) return;

    setSaving(true);
    try {
      const payload: any = {
        title: seriesForm.title.trim(),
        description: seriesForm.description.trim() || null,
        thumbnail_url: seriesForm.thumbnail_url || null,
        is_published: seriesForm.is_published,
        order: Number(seriesForm.order) || 0,
        updated_at: new Date().toISOString(),
      };
      payload.is_paid = seriesForm.is_paid;

      let { error } = await supabase
        .from('test_series')
        .update(payload)
        .eq('id', seriesId);

      if (error && error.message?.includes('is_paid')) {
        delete payload.is_paid;
        const retry = await supabase.from('test_series').update(payload).eq('id', seriesId);
        error = retry.error;
      }

      if (error) throw error;

      setIsEditSeriesModalOpen(false);
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to update series:', err);
      alert(err.message || 'Could not update series.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: Subjects
  // ---------------------------------------------------------------------------
  const openAddSubjectModal = () => {
    setSubjectForm(emptySubjectForm());
    setIsSubjectModalOpen(true);
  };

  const openEditSubjectModal = (sub: TestSeriesSubject) => {
    setSubjectForm({
      id: sub.id,
      name: sub.name,
      icon_url: sub.icon_url || '',
      is_enabled: sub.is_enabled,
      order: sub.order,
    });
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesId || !subjectForm.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        series_id: seriesId,
        name: subjectForm.name.trim(),
        icon_url: subjectForm.icon_url || null,
        is_enabled: subjectForm.is_enabled,
        order: Number(subjectForm.order) || 0,
        updated_at: new Date().toISOString(),
      };

      if (subjectForm.id) {
        const { error } = await supabase
          .from('test_series_subjects')
          .update(payload)
          .eq('id', subjectForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('test_series_subjects').insert(payload);
        if (error) throw error;
      }

      setIsSubjectModalOpen(false);
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to save subject:', err);
      alert(err.message || 'Could not save subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (subId: string, subName: string) => {
    const qCount = subjectTotalQuestionCounts.get(subId) || 0;
    const confirmMsg = `Delete subject "${subName}"?\n\nThis subject currently has ${qCount} questions. Deleting it may impact tests relying on it.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const { error } = await supabase.from('test_series_subjects').delete().eq('id', subId);
      if (error) throw error;
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to delete subject:', err);
      alert(err.message || 'Could not delete subject.');
    }
  };

  const handleManageSubjectQuestions = (subId: string) => {
    setSelectedSubjectFilter(subId);
    setActiveTab('questions');
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: Tests
  // ---------------------------------------------------------------------------
  const openCreateTestModal = () => {
    if (subjects.length === 0) {
      alert('Please add at least one Subject to this Test Series first.');
      setActiveTab('subjects');
      return;
    }
    const form = emptyTestForm(series?.is_paid || false);
    // Pre-select all existing subjects by default
    form.selected_subject_ids = subjects.map((s) => s.id);
    setTestForm(form);
    setIsTestModalOpen(true);
  };

  const openEditTestModal = (test: Test) => {
    const assignedIds = new Set<string>(resolveTestSubjectIds(test));
    questions
      .filter((q) => q.test_id === test.id)
      .forEach((q) => {
        const sId = resolveQuestionSubjectId(q, test);
        if (sId) assignedIds.add(sId);
      });

    const decoded = decodeTestSubjectsTag(test.instructions);

    setTestForm({
      id: test.id,
      title: test.title,
      date_label: test.date_label || '',
      duration_minutes: test.duration_minutes,
      max_marks: test.max_marks,
      marks_per_correct: Number(test.marks_per_correct ?? 1),
      negative_marks: Number(test.negative_marks ?? 0),
      language: test.language || 'English',
      instructions: decoded.cleanInstructions,
      is_paid: test.is_paid,
      price: test.price || 0,
      is_published: test.is_published,
      scheduled_start: test.scheduled_start ? test.scheduled_start.slice(0, 16) : '',
      scheduled_end: test.scheduled_end ? test.scheduled_end.slice(0, 16) : '',
      order: test.order || 0,
      selected_subject_ids: Array.from(assignedIds),
    });
    setIsTestModalOpen(true);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testForm.title.trim()) {
      alert('Please enter a Test Title.');
      return;
    }

    if (testForm.selected_subject_ids.length === 0) {
      alert('Please select at least one Subject included in this Test (Section 4).');
      return;
    }

    setSaving(true);
    try {
      // Primary subject_id is the first selected subject
      const primarySubjectId = testForm.selected_subject_ids[0];

      // Encode multi-subject mapping in instructions as guaranteed fallback
      const taggedInstructions = encodeTestSubjectsTag(
        testForm.instructions.trim() || null,
        testForm.selected_subject_ids
      );

      const payload: any = {
        subject_id: primarySubjectId,
        title: testForm.title.trim(),
        date_label: testForm.date_label.trim() || null,
        duration_minutes: Number(testForm.duration_minutes) || 60,
        max_marks: Number(testForm.max_marks) || 100,
        marks_per_correct: Number(testForm.marks_per_correct) || 1,
        negative_marks: Number(testForm.negative_marks) || 0,
        language: testForm.language || 'English',
        instructions: taggedInstructions || null,
        is_paid: testForm.is_paid,
        price: testForm.is_paid ? Number(testForm.price) || 0 : 0,
        is_published: testForm.is_published,
        scheduled_start: testForm.scheduled_start ? new Date(testForm.scheduled_start).toISOString() : null,
        scheduled_end: testForm.scheduled_end ? new Date(testForm.scheduled_end).toISOString() : null,
        order: Number(testForm.order) || 0,
        updated_at: new Date().toISOString(),
      };

      // Add multi-subject fields
      payload.series_id = seriesId;
      payload.subject_ids = testForm.selected_subject_ids;

      if (testForm.id) {
        let { error } = await supabase.from('tests').update(payload).eq('id', testForm.id);

        if (error && (error.message?.includes('series_id') || error.message?.includes('subject_ids'))) {
          delete payload.series_id;
          delete payload.subject_ids;
          const retry = await supabase.from('tests').update(payload).eq('id', testForm.id);
          error = retry.error;
        }

        if (error) throw error;
      } else {
        let { data, error } = await supabase.from('tests').insert(payload).select().single();

        if (error && (error.message?.includes('series_id') || error.message?.includes('subject_ids'))) {
          delete payload.series_id;
          delete payload.subject_ids;
          const retry = await supabase.from('tests').insert(payload).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error) throw error;
        if (data?.id) setSelectedTestId(data.id);
      }

      setIsTestModalOpen(false);
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to save test:', err);
      alert(err.message || 'Could not save test.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTest = async (tId: string, tTitle: string) => {
    const qCount = questions.filter((q) => q.test_id === tId).length;
    const confirmMsg = `Delete test "${tTitle}"?\n\nThis will permanently delete this test and its ${qCount} questions.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const { error } = await supabase.from('tests').delete().eq('id', tId);
      if (error) throw error;
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to delete test:', err);
      alert(err.message || 'Could not delete test.');
    }
  };

  const handleManageTestQuestions = (tId: string) => {
    setSelectedTestId(tId);
    setSelectedSubjectFilter('all');
    setActiveTab('questions');
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: Questions
  // ---------------------------------------------------------------------------
  const openAddQuestionModal = () => {
    if (!currentTest) {
      alert('Please select or create a Test first.');
      return;
    }
    const preferredSubId = selectedSubjectFilter !== 'all' ? selectedSubjectFilter : '';
    const defaultSubId = preferredSubId || assignedSubjectsForCurrentTest[0]?.id || subjects[0]?.id || '';
    setQuestionForm(
      emptyQuestionForm(
        defaultSubId,
        Number(currentTest.marks_per_correct ?? 1),
        Number(currentTest.negative_marks ?? 0),
        currentTest.language || 'English'
      )
    );
    setIsQuestionModalOpen(true);
  };

  const openEditQuestionModal = (q: Question) => {
    const decoded = decodeSubjectTag(q.explanation);
    const subId = q.subject_id || decoded.subjectId || currentTest?.subject_id || '';

    setQuestionForm({
      id: q.id,
      subject_id: subId,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: decoded.cleanExplanation,
      marks: Number(q.marks ?? 1),
      negative_marks: Number(q.negative_marks ?? 0),
      language: q.language || 'English',
      order: q.order || 0,
    });
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTest) {
      alert('No test selected.');
      return;
    }
    if (!questionForm.subject_id) {
      alert('Please select a Subject for this question.');
      return;
    }
    if (!questionForm.question_text.trim()) {
      alert('Please enter question text.');
      return;
    }

    setSaving(true);
    try {
      // Encode subject tag in explanation so it persists even if subject_id column is not in postgres
      const taggedExplanation = encodeSubjectTag(questionForm.explanation, questionForm.subject_id);

      const payload: any = {
        test_id: currentTest.id,
        subject_id: questionForm.subject_id,
        question_text: questionForm.question_text.trim(),
        option_a: questionForm.option_a.trim(),
        option_b: questionForm.option_b.trim(),
        option_c: questionForm.option_c.trim(),
        option_d: questionForm.option_d.trim(),
        correct_option: questionForm.correct_option,
        explanation: taggedExplanation || null,
        marks: Number(questionForm.marks) || 1,
        negative_marks: Number(questionForm.negative_marks) || 0,
        language: questionForm.language || 'English',
        order: Number(questionForm.order) || 0,
        updated_at: new Date().toISOString(),
      };

      if (questionForm.id) {
        let { error } = await supabase.from('questions').update(payload).eq('id', questionForm.id);

        if (error && error.message?.includes('subject_id')) {
          delete payload.subject_id;
          const retry = await supabase.from('questions').update(payload).eq('id', questionForm.id);
          error = retry.error;
        }

        if (error) throw error;
      } else {
        let { error } = await supabase.from('questions').insert(payload);

        if (error && error.message?.includes('subject_id')) {
          delete payload.subject_id;
          const retry = await supabase.from('questions').insert(payload);
          error = retry.error;
        }

        if (error) throw error;
      }

      setIsQuestionModalOpen(false);
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to save question:', err);
      alert(err.message || 'Could not save question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!window.confirm('Delete this question?')) return;

    try {
      const { error } = await supabase.from('questions').delete().eq('id', qId);
      if (error) throw error;
      await loadSeriesData();
    } catch (err: any) {
      console.error('Failed to delete question:', err);
      alert(err.message || 'Could not delete question.');
    }
  };

  if (loading && !series) {
    return (
      <div className="py-24 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Test Series Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">The requested series does not exist or has been removed.</p>
        <Link href="/admin/test-series" className="mt-6 inline-block">
          <Button variant="primary">Back to Test Series List</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        <Link href="/admin/test-series" className="hover:text-brand-primary font-medium">
          Test Series
        </Link>
        <span>›</span>
        <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{series.title}</span>
      </nav>

      {/* Series Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
              {series.thumbnail_url && !series.thumbnail_url.includes('Empty') && !series.thumbnail_url.includes('Temp') ? (
                <img src={series.thumbnail_url} alt={series.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">📚</div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    series.is_paid ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {series.is_paid ? 'PAID' : 'FREE'}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    series.is_published
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {series.is_published ? 'Published' : 'Draft'}
                </span>
              </div>

              <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {series.title}
              </h1>

              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 max-w-2xl">
                {series.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditSeriesModalOpen(true)}
              className="font-semibold"
            >
              ✏️ Edit Series Details
            </Button>
          </div>
        </div>

        {/* 4 Dedicated Tabs */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center gap-2 sm:gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            1. Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'subjects'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>2. Subjects</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{subjects.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'tests'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>3. Tests</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{tests.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'questions'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>4. Questions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{questions.length}</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 soft-shadow flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-3xl shrink-0">
                📖
              </div>
              <div>
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{subjects.length}</span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  Subjects Configured
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 soft-shadow flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-3xl shrink-0">
                📝
              </div>
              <div>
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{tests.length}</span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  Published Tests
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 soft-shadow flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-3xl shrink-0">
                🎯
              </div>
              <div>
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{questions.length}</span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  Total Questions
                </p>
              </div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 soft-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📖</span>
                  <h3 className="font-bold text-slate-900 dark:text-white">Subjects Management</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Add exam subjects (e.g. Computer, General Knowledge, Reasoning, Hindi).
                </p>
              </div>
              <Button onClick={() => setActiveTab('subjects')} variant="secondary" className="mt-4" fullWidth>
                Manage Subjects ({subjects.length}) →
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 soft-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📝</span>
                  <h3 className="font-bold text-slate-900 dark:text-white">Tests Management</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Create tests and select which subjects are included in each test.
                </p>
              </div>
              <Button onClick={() => setActiveTab('tests')} variant="secondary" className="mt-4" fullWidth>
                Manage Tests ({tests.length}) →
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 soft-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎯</span>
                  <h3 className="font-bold text-slate-900 dark:text-white">Question Bank</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  View, filter, and add questions linked directly to their test and subject.
                </p>
              </div>
              <Button onClick={() => setActiveTab('questions')} variant="secondary" className="mt-4" fullWidth>
                Manage Questions ({questions.length}) →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: SUBJECTS */}
      {/* =================================================================== */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Subjects in {series.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                All subjects configured for this Test Series. When creating tests, you can include questions from these subjects.
              </p>
            </div>
            <Button onClick={openAddSubjectModal} variant="primary" size="sm">
              + Add Subject
            </Button>
          </div>

          {subjects.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-4xl">📖</span>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">No Subjects Added Yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Add your exam subjects here (for example: Computer, General Knowledge, Reasoning, Hindi).
              </p>
              <Button onClick={openAddSubjectModal} variant="primary" className="mt-5">
                + Add First Subject
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((sub) => {
                const qCount = subjectTotalQuestionCounts.get(sub.id) || 0;
                return (
                  <div
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl overflow-hidden shrink-0">
                        {sub.icon_url && !sub.icon_url.includes('Empty') ? (
                          <img src={sub.icon_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          '📖'
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">{sub.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sub.is_enabled
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {sub.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {qCount} {qCount === 1 ? 'Question' : 'Questions'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleManageSubjectQuestions(sub.id)}
                        className="text-xs font-semibold"
                        title="Filter questions by this subject"
                      >
                        Manage Questions
                      </Button>
                      <button
                        type="button"
                        onClick={() => openEditSubjectModal(sub)}
                        className="p-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        title="Edit subject"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub.id, sub.name)}
                        className="p-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                        title="Delete subject"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: TESTS */}
      {/* =================================================================== */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tests in {series.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create full mock tests or practice tests and configure which subjects are included.
              </p>
            </div>
            <Button onClick={openCreateTestModal} variant="primary" size="sm">
              + Create Test
            </Button>
          </div>

          {tests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-4xl">📝</span>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">No Tests Created Yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Click "+ Create Test" to create your first test for this series.
              </p>
              <Button onClick={openCreateTestModal} variant="primary" className="mt-5">
                + Create First Test
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => {
                const qCount = questions.filter((q) => q.test_id === test.id).length;
                // Included subjects
                const testSubIds = new Set<string>(resolveTestSubjectIds(test));
                const includedSubjects = subjects.filter((s) => testSubIds.has(s.id));

                return (
                  <div
                    key={test.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-5 hover:border-brand-primary/40 transition-colors"
                  >
                    <div className="space-y-2 flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            test.is_paid ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {test.is_paid ? `PAID · ₹${test.price}` : 'FREE'}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            test.is_published
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {test.is_published ? 'Published' : 'Draft'}
                        </span>
                        {test.date_label && (
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            📅 {test.date_label}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{test.title}</h3>

                      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                        <span>📝 {qCount} Questions</span>
                        <span>⏱ {test.duration_minutes} Minutes</span>
                        <span>🏆 {test.max_marks} Marks</span>
                        <span>🌐 {test.language}</span>
                      </div>

                      {/* Subjects Included Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Subjects:</span>
                        {includedSubjects.map((sub) => {
                          const subQCount = questions.filter(
                            (q) => q.test_id === test.id && resolveQuestionSubjectId(q, test) === sub.id
                          ).length;
                          return (
                            <span
                              key={sub.id}
                              className="text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900"
                            >
                              {sub.name} ({subQCount})
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleManageTestQuestions(test.id)}
                        className="text-xs font-semibold shadow-xs"
                      >
                        Manage Questions →
                      </Button>
                      <button
                        type="button"
                        onClick={() => openEditTestModal(test)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        title="Edit test"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTest(test.id, test.title)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                        title="Delete test"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: QUESTIONS */}
      {/* =================================================================== */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Active Context Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Test Selector Dropdown */}
              <div className="space-y-1 w-full lg:w-auto">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Test to Manage
                </label>
                {tests.length === 0 ? (
                  <p className="text-sm font-medium text-amber-600">
                    No tests created yet. Please create a Test first.
                  </p>
                ) : (
                  <select
                    value={selectedTestId}
                    onChange={(e) => {
                      setSelectedTestId(e.target.value);
                      setSelectedSubjectFilter('all');
                    }}
                    className="w-full sm:w-80 px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary"
                  >
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({questions.filter((q) => q.test_id === t.id).length} questions)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Add & Import Question Buttons */}
              {currentTest && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={openAddQuestionModal} variant="primary" size="sm" className="shadow-xs">
                    + Add Question
                  </Button>
                  <Button
                    onClick={() => setIsImportModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="shadow-xs bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  >
                    📥 Import Questions
                  </Button>
                </div>
              )}
            </div>

            {currentTest && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">Active Test:</span>
                  <span className="font-semibold text-brand-primary dark:text-blue-400">{currentTest.title}</span>
                  <span>•</span>
                  <span>{testQuestions.length} Questions</span>
                  <span>•</span>
                  <span>{currentTest.marks_per_correct} Marks/Q</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {assignedSubjectsForCurrentTest.map((sub) => {
                    const count = subjectQuestionCountsInCurrentTest.get(sub.id) || 0;
                    return (
                      <span
                        key={sub.id}
                        className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium text-[11px]"
                      >
                        {sub.name}: <b>{count}</b>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filters Bar: Subject & Search */}
          {currentTest && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Subject Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  Filter by Subject:
                </span>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="all">All Subjects ({testQuestions.length})</option>
                  {assignedSubjectsForCurrentTest.map((sub) => {
                    const count = subjectQuestionCountsInCurrentTest.get(sub.id) || 0;
                    return (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search question text..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary"
                />
                <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                {questionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setQuestionSearchQuery('')}
                    className="absolute right-2 top-1.5 text-xs text-slate-400"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Question List */}
          {!currentTest ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-4xl">🎯</span>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Select a Test Above</h3>
              <p className="mt-1 text-xs text-slate-500">
                Choose a test from the dropdown or switch to the "Tests" tab to create one.
              </p>
            </div>
          ) : visibleQuestions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-4xl">📝</span>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">No Questions Found</h3>
              <p className="mt-1 text-xs text-slate-500">
                {questionSearchQuery || selectedSubjectFilter !== 'all'
                  ? 'No questions match the selected filters.'
                  : 'Start by adding questions to this test.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
                <Button onClick={openAddQuestionModal} variant="primary">
                  + Add First Question
                </Button>
                <Button
                  onClick={() => setIsImportModalOpen(true)}
                  variant="outline"
                  className="bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                >
                  📥 Import Questions
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleQuestions.map((q, idx) => {
                const subId = resolveQuestionSubjectId(q, currentTest);
                const subName = subjects.find((s) => s.id === subId)?.name || 'Subject';
                const decoded = decodeSubjectTag(q.explanation);

                return (
                  <div
                    key={q.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col md:flex-row items-start justify-between gap-4"
                  >
                    <div className="space-y-3 flex-grow">
                      {/* Top Badges */}
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                          {subName}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          +{q.marks} / -{q.negative_marks} marks
                        </span>
                      </div>

                      {/* Question Text */}
                      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                        {q.question_text}
                      </p>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            q.correct_option === 'A'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-bold mr-1.5">A.</span> {q.option_a}
                        </div>
                        <div
                          className={`p-2.5 rounded-lg border ${
                            q.correct_option === 'B'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-bold mr-1.5">B.</span> {q.option_b}
                        </div>
                        <div
                          className={`p-2.5 rounded-lg border ${
                            q.correct_option === 'C'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-bold mr-1.5">C.</span> {q.option_c}
                        </div>
                        <div
                          className={`p-2.5 rounded-lg border ${
                            q.correct_option === 'D'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-bold mr-1.5">D.</span> {q.option_d}
                        </div>
                      </div>

                      {decoded.cleanExplanation && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg">
                          💡 <b>Explanation:</b> {decoded.cleanExplanation}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                      <Button size="sm" variant="outline" onClick={() => openEditQuestionModal(q)}>
                        ✏️ Edit
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                        title="Delete question"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT SERIES */}
      {/* =================================================================== */}
      {isEditSeriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Test Series Details</h2>
              <button
                type="button"
                onClick={() => setIsEditSeriesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSeries} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Series Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={seriesForm.title}
                    onChange={(e) => setSeriesForm({ ...seriesForm, title: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={seriesForm.description}
                    onChange={(e) => setSeriesForm({ ...seriesForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Series Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                        !seriesForm.is_paid
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="seriesTypeEdit"
                        checked={!seriesForm.is_paid}
                        onChange={() => setSeriesForm({ ...seriesForm, is_paid: false })}
                        className="accent-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Free Series</p>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                        seriesForm.is_paid
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="seriesTypeEdit"
                        checked={seriesForm.is_paid}
                        onChange={() => setSeriesForm({ ...seriesForm, is_paid: true })}
                        className="accent-amber-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Paid Series</p>
                      </div>
                    </label>
                  </div>
                </div>

                <ImageUploadField
                  label="Thumbnail Image"
                  existingUrl={seriesForm.thumbnail_url}
                  onUrlChange={(url) => setSeriesForm({ ...seriesForm, thumbnail_url: url })}
                />

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={seriesForm.order}
                      onChange={(e) => setSeriesForm({ ...seriesForm, order: Number(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Published
                    </label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={seriesForm.is_published}
                        onChange={(e) => setSeriesForm({ ...seriesForm, is_published: e.target.checked })}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200">Visible to students</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
                <Button type="button" variant="ghost" onClick={() => setIsEditSeriesModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT SUBJECT */}
      {/* =================================================================== */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {subjectForm.id ? 'Edit Subject' : `Add Subject to ${series.title}`}
              </h2>
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer, General Knowledge, Reasoning, Hindi"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <ImageUploadField
                  label="Subject Icon / Image (Optional)"
                  folder="subjects"
                  existingUrl={subjectForm.icon_url}
                  onUrlChange={(url) => setSubjectForm({ ...subjectForm, icon_url: url })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={subjectForm.order}
                      onChange={(e) => setSubjectForm({ ...subjectForm, order: Number(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subjectForm.is_enabled}
                        onChange={(e) => setSubjectForm({ ...subjectForm, is_enabled: e.target.checked })}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200">Enabled</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
                <Button type="button" variant="ghost" onClick={() => setIsSubjectModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : subjectForm.id ? 'Save Changes' : 'Add Subject'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE / EDIT TEST (4 CLEAN SECTIONS) */}
      {/* =================================================================== */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div>
                <span className="text-xs font-bold uppercase text-brand-primary dark:text-blue-400">
                  {series.title}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {testForm.id ? 'Edit Test' : 'Create New Test'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Form: Scrollable Content + Fixed Footer */}
            <form onSubmit={handleSaveTest} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
                {/* SECTION 1 — BASIC INFORMATION */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Section 1 — Basic Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Test Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. UPP Computer Operator 20 SEP 2026, Full Mock Test 1"
                        value={testForm.title}
                        onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Date Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 20 SEP 2026"
                        value={testForm.date_label}
                        onChange={(e) => setTestForm({ ...testForm, date_label: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Duration (Minutes) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={testForm.duration_minutes}
                        onChange={(e) => setTestForm({ ...testForm, duration_minutes: Number(e.target.value) || 60 })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Total Maximum Marks *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={testForm.max_marks}
                        onChange={(e) => setTestForm({ ...testForm, max_marks: Number(e.target.value) || 100 })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Marks Per Correct Question
                      </label>
                      <input
                        type="number"
                        step="any"
                        min={0.1}
                        value={testForm.marks_per_correct}
                        onChange={(e) => setTestForm({ ...testForm, marks_per_correct: Number(e.target.value) || 1 })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Negative Marking
                      </label>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={testForm.negative_marks}
                        onChange={(e) => setTestForm({ ...testForm, negative_marks: Number(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Language
                      </label>
                      <select
                        value={testForm.language}
                        onChange={(e) => setTestForm({ ...testForm, language: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Bilingual (Hindi & English)">Bilingual (Hindi & English)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2 — AVAILABILITY */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Section 2 — Availability & Access
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Start Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={testForm.scheduled_start}
                        onChange={(e) => setTestForm({ ...testForm, scheduled_start: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        End Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={testForm.scheduled_end}
                        onChange={(e) => setTestForm({ ...testForm, scheduled_end: e.target.value })}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Test Pricing
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer ${
                            !testForm.is_paid ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="testPriceRadio"
                            checked={!testForm.is_paid}
                            onChange={() => setTestForm({ ...testForm, is_paid: false, price: 0 })}
                            className="accent-emerald-600"
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">FREE Test</span>
                        </label>

                        <label
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer ${
                            testForm.is_paid ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="testPriceRadio"
                            checked={testForm.is_paid}
                            onChange={() => setTestForm({ ...testForm, is_paid: true })}
                            className="accent-amber-600"
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">PAID Test</span>
                        </label>
                      </div>
                    </div>

                    {testForm.is_paid && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={testForm.price}
                          onChange={(e) => setTestForm({ ...testForm, price: Number(e.target.value) || 0 })}
                          className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={testForm.is_published}
                          onChange={(e) => setTestForm({ ...testForm, is_published: e.target.checked })}
                          className="h-4 w-4 accent-emerald-600 rounded"
                        />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Published (visible to students under configured subjects)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* SECTION 3 — INSTRUCTIONS */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Section 3 — Test Instructions
                  </h3>
                  <textarea
                    rows={3}
                    placeholder="Instructions shown to students before starting the test..."
                    value={testForm.instructions}
                    onChange={(e) => setTestForm({ ...testForm, instructions: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                {/* SECTION 4 — SUBJECTS IN THIS TEST */}
                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      Section 4 — Subjects Included in This Test
                    </h3>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                      Select which subjects belong to this test. A test can combine questions from multiple subjects.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {subjects.map((sub) => {
                      const isChecked = testForm.selected_subject_ids.includes(sub.id);
                      const qCount = testForm.id
                        ? questions.filter((q) => q.test_id === testForm.id && resolveQuestionSubjectId(q, null) === sub.id).length
                        : 0;

                      return (
                        <label
                          key={sub.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xs'
                              : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTestForm({
                                    ...testForm,
                                    selected_subject_ids: [...testForm.selected_subject_ids, sub.id],
                                  });
                                } else {
                                  setTestForm({
                                    ...testForm,
                                    selected_subject_ids: testForm.selected_subject_ids.filter((id) => id !== sub.id),
                                  });
                                }
                              }}
                              className="h-4 w-4 accent-brand-primary rounded"
                            />
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{sub.name}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">Questions: {qCount}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Fixed Modal Footer with Action Buttons */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
                <Button type="button" variant="ghost" onClick={() => setIsTestModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : testForm.id ? 'Save Changes' : 'Create Test'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT QUESTION */}
      {/* =================================================================== */}
      {isQuestionModalOpen && currentTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-primary dark:text-blue-400">
                  <span>{series.title}</span>
                  <span>›</span>
                  <span>Test: {currentTest.title}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {questionForm.id ? 'Edit Question' : 'Add Question'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {/* Scope Indicator: Test & Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">Test</span>
                    <span className="font-bold text-slate-900 dark:text-white">{currentTest.title}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">Subject</span>
                    <span className="font-bold text-brand-primary dark:text-blue-400">
                      {assignedSubjectsForCurrentTest.find((s) => s.id === questionForm.subject_id)?.name || 'Select subject below'}
                    </span>
                  </div>
                </div>

                {/* Subject Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Subject *
                  </label>
                  <select
                    required
                    value={questionForm.subject_id}
                    onChange={(e) => setQuestionForm({ ...questionForm, subject_id: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {assignedSubjectsForCurrentTest.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Question Text *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter the complete question text..."
                    value={questionForm.question_text}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Options A, B, C, D */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Options *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-xs">Option A</span>
                        {questionForm.correct_option === 'A' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Correct</span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={questionForm.option_a}
                        onChange={(e) => setQuestionForm({ ...questionForm, option_a: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-xs">Option B</span>
                        {questionForm.correct_option === 'B' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Correct</span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={questionForm.option_b}
                        onChange={(e) => setQuestionForm({ ...questionForm, option_b: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-xs">Option C</span>
                        {questionForm.correct_option === 'C' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Correct</span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={questionForm.option_c}
                        onChange={(e) => setQuestionForm({ ...questionForm, option_c: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-xs">Option D</span>
                        {questionForm.correct_option === 'D' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Correct</span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={questionForm.option_d}
                        onChange={(e) => setQuestionForm({ ...questionForm, option_d: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Correct Option Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Correct Option *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setQuestionForm({ ...questionForm, correct_option: opt })}
                        className={`py-2 rounded-lg text-sm font-bold border transition-colors ${
                          questionForm.correct_option === opt
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        Option {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Explanation (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Solution / explanation shown to students after submitting the test..."
                    value={questionForm.explanation}
                    onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Marks, Negative Marks, Language */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Marks
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={questionForm.marks}
                      onChange={(e) => setQuestionForm({ ...questionForm, marks: Number(e.target.value) || 1 })}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Negative Marks
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={questionForm.negative_marks}
                      onChange={(e) => setQuestionForm({ ...questionForm, negative_marks: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Language
                    </label>
                    <input
                      type="text"
                      value={questionForm.language}
                      onChange={(e) => setQuestionForm({ ...questionForm, language: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Modal Footer with Action Buttons */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
                <Button type="button" variant="ghost" onClick={() => setIsQuestionModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : questionForm.id ? 'Save Changes' : 'Add Question'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SMART IMPORT QUESTIONS */}
      {/* =================================================================== */}
      <ImportQuestionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={async (importedCount) => {
          await loadSeriesData();
          alert(`Successfully imported ${importedCount} questions!`);
        }}
        seriesId={seriesId}
        currentTest={currentTest}
        subjects={subjects}
        activeSubjectFilter={selectedSubjectFilter}
      />
    </div>
  );
}
