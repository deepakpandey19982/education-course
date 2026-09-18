'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import type { TestSeries, TestSeriesSubject, Test, Question } from '@/types/supabase';

type Mode = 'free' | 'paid';

type QuestionForm = {
  id?: string;
  test_id: string;
  question_subject_id: string;
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

type TestForm = {
  id?: string;
  subject_id: string;
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
};

type SubjectForm = {
  id?: string;
  series_id: string;
  name: string;
  icon_url: string;
  order: number;
  is_enabled: boolean;
};

type SeriesForm = {
  id?: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_published: boolean;
  order: number;
};

const emptySeriesForm = (): SeriesForm => ({
  title: '',
  description: '',
  thumbnail_url: '',
  is_published: false,
  order: 0,
});

const emptySubjectForm = (seriesId: string): SubjectForm => ({
  series_id: seriesId,
  name: '',
  icon_url: '',
  order: 0,
  is_enabled: true,
});

const emptyTestForm = (subjectId: string, mode: Mode): TestForm => ({
  subject_id: subjectId,
  title: '',
  date_label: '',
  duration_minutes: 60,
  max_marks: 100,
  marks_per_correct: 1,
  negative_marks: 0,
  language: 'English',
  instructions: '',
  is_paid: mode === 'paid',
  price: mode === 'paid' ? 299 : 0,
  is_published: false,
  scheduled_start: '',
  scheduled_end: '',
  order: 0,
});

const emptyQuestionForm = (): QuestionForm => ({
  test_id: '',
  question_subject_id: '',
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  explanation: '',
  marks: 1,
  negative_marks: 0,
  language: 'English',
  order: 0,
});

async function uploadTestSeriesAsset(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('site-assets').upload(fileName, file);
  if (error) throw new Error('Image upload failed: ' + error.message);
  const { data } = supabase.storage.from('site-assets').getPublicUrl(fileName);
  return data.publicUrl;
}

function ImageUploadField({
  label,
  buttonLabel,
  folder,
  existingUrl,
  onUrlChange,
}: {
  label: string;
  buttonLabel: string;
  folder: string;
  existingUrl?: string | null;
  onUrlChange: (url: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPreviewUrl(existingUrl || null);
  }, [existingUrl]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    try {
      const uploadedUrl = await uploadTestSeriesAsset(file, folder);
      onUrlChange(uploadedUrl);
      setPreviewUrl(uploadedUrl);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-brand-primary-foreground hover:bg-blue-900">
          {buttonLabel}
          <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
        </label>

        {(fileName || previewUrl) && (
          <div className="space-y-2">
            {previewUrl && (
              <img src={previewUrl} alt={label} className="h-24 w-full rounded-lg border border-slate-200 object-cover" />
            )}
            <p className="text-xs text-slate-500">{uploading ? 'Uploading image...' : fileName || 'Selected image'}</p>
          </div>
        )}

        {existingUrl && !fileName && !uploading && (
          <p className="text-xs text-slate-500">Current image selected</p>
        )}
      </div>
    </div>
  );
}

export function TestSeriesAdminManager({ mode }: { mode: Mode }) {
  const [seriesList, setSeriesList] = useState<TestSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [subjects, setSubjects] = useState<TestSeriesSubject[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [seriesForm, setSeriesForm] = useState<SeriesForm>(emptySeriesForm());
  const [subjectForm, setSubjectForm] = useState<SubjectForm>(emptySubjectForm(''));
  const [testForm, setTestForm] = useState<TestForm>(emptyTestForm('', mode));
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm());
  const [selectedQuestionSubjectId, setSelectedQuestionSubjectId] = useState<string>('all');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [testSubjectAssignments, setTestSubjectAssignments] = useState<Record<string, string[]>>({});

  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const isPaidMode = mode === 'paid';
  const headingLabel = isPaidMode ? 'Paid' : 'Free';

  const selectedSeries = useMemo(
    () => seriesList.find((item) => item.id === selectedSeriesId) ?? null,
    [seriesList, selectedSeriesId]
  );

  const currentTest = useMemo(() => tests.find((item) => item.id === selectedTestId) ?? tests[0] ?? null, [selectedTestId, tests]);

  const getTestSubjectIds = useCallback((testId: string | null | undefined): string[] => {
    if (!testId) return [];
    const parentTest = tests.find((item) => item.id === testId);
    if (!parentTest) return [];
    const subjectIds = [parentTest.subject_id, ...(testSubjectAssignments[testId] ?? [])].filter(Boolean);
    return [...new Set(subjectIds)];
  }, [testSubjectAssignments, tests]);

  const selectedQuestionTest = useMemo(
    () => tests.find((item) => item.id === questionForm.test_id) ?? currentTest,
    [currentTest, questionForm.test_id, tests]
  );

  const assignedSubjectsForCurrentTest = useMemo(() => {
    if (!currentTest) return [];
    const uniqueSubjects = getTestSubjectIds(currentTest.id);
    return subjects.filter((subject) => uniqueSubjects.includes(subject.id));
  }, [currentTest, getTestSubjectIds, subjects]);

  const assignedSubjectsForQuestionTest = useMemo(() => {
    if (!selectedQuestionTest) return [];
    const uniqueSubjects = getTestSubjectIds(selectedQuestionTest.id);
    return subjects.filter((subject) => uniqueSubjects.includes(subject.id));
  }, [getTestSubjectIds, selectedQuestionTest, subjects]);

  const currentTestQuestionCount = useMemo(() => {
    if (!currentTest) return 0;
    return questions.filter((question) => question.test_id === currentTest.id).length;
  }, [currentTest, questions]);

  const visibleTestQuestions = useMemo(() => {
    const activeTestId = currentTest?.id ?? (selectedTestId || null);
    if (!activeTestId) return [];

    return questions.filter((question) => question.test_id === activeTestId);
  }, [currentTest?.id, questions, selectedTestId]);

  const subjectQuestionCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const subject of subjects) {
      counts.set(subject.id, 0);
    }

    for (const question of visibleTestQuestions) {
      const parentTest = tests.find((item) => item.id === question.test_id);
      if (!parentTest) continue;
      const subjectId = question.subject_id ?? parentTest.subject_id;
      if (!subjectId) continue;
      counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
    }

    return counts;
  }, [subjects, tests, visibleTestQuestions]);

  const visibleQuestions = useMemo(() => {
    if (!currentTest) {
      return [];
    }

    const testQuestions = visibleTestQuestions.filter((question) => question.test_id === currentTest.id);

    if (selectedQuestionSubjectId === 'all') {
      return [...testQuestions].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    }

    return testQuestions.filter((question) => {
      const parentTest = tests.find((test) => test.id === question.test_id);
      const questionSubjectId = question.subject_id ?? parentTest?.subject_id ?? null;
      return questionSubjectId === selectedQuestionSubjectId;
    }).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  }, [currentTest, tests, visibleTestQuestions, selectedQuestionSubjectId]);

  const loadSeriesHierarchy = useCallback(async (seriesId: string) => {
    const { data: subjectRows, error: subjectsError } = await supabase
      .from('test_series_subjects')
      .select('*')
      .eq('series_id', seriesId)
      .order('order', { ascending: true });

    if (subjectsError) throw subjectsError;

    const subjectIds = (subjectRows ?? []).map((item) => item.id);

    const { data: testRows, error: testsError } = subjectIds.length
      ? await supabase
          .from('tests')
          .select('*')
          .in('subject_id', subjectIds)
          .eq('is_paid', isPaidMode)
          .order('order', { ascending: true })
      : { data: [], error: null };

    if (testsError) throw testsError;

    setSubjects(subjectRows ?? []);
    setTests(testRows ?? []);

    if (!testRows?.length) {
      setQuestions([]);
      setTestForm(emptyTestForm(subjectRows?.[0]?.id ?? '', mode));
      return;
    }

    const testIds = (testRows ?? []).map((item) => item.id);
    const { data: questionRows, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .in('test_id', testIds)
      .order('order', { ascending: true });

    if (questionError) throw questionError;

    setQuestions(questionRows ?? []);
    setTestForm(emptyTestForm((testRows ?? [])[0]?.subject_id ?? (subjectRows ?? [])[0]?.id ?? '', mode));
  }, [isPaidMode, mode]);

  const loadAll = useCallback(async () => {
    const { data: seriesData, error: seriesError } = await supabase
      .from('test_series')
      .select('*')
      .order('order', { ascending: true });

    if (seriesError) throw seriesError;

    const filteredSeries: TestSeries[] = [];

    for (const series of seriesData ?? []) {
      const { data: subjectRows, error: subjectError } = await supabase
        .from('test_series_subjects')
        .select('id')
        .eq('series_id', series.id);

      if (subjectError) throw subjectError;

      const subjectIds = (subjectRows ?? []).map((item) => item.id);

      if (!subjectIds.length) continue;

      const { data: matchingTests, error: matchError } = await supabase
        .from('tests')
        .select('id')
        .in('subject_id', subjectIds)
        .eq('is_paid', isPaidMode)
        .limit(1);

      if (matchError) throw matchError;

      if ((matchingTests ?? []).length) {
        filteredSeries.push(series);
      }
    }

    setSeriesList(filteredSeries);

    if (!filteredSeries.length) {
      setSelectedSeriesId('');
      setSubjects([]);
      setTests([]);
      setQuestions([]);
      setSubjectForm(emptySubjectForm(''));
      setTestForm(emptyTestForm('', mode));
      setLoading(false);
      return;
    }

    const nextId = selectedSeriesId && filteredSeries.some((item) => item.id === selectedSeriesId)
      ? selectedSeriesId
      : filteredSeries[0].id;

    setSelectedSeriesId(nextId);
    await loadSeriesHierarchy(nextId);
  }, [isPaidMode, loadSeriesHierarchy, mode, selectedSeriesId]);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        await loadAll();
      } catch (error) {
        console.error('Admin test series load failed:', error);
        alert('Unable to load Test Series data.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [loadAll]);

  useEffect(() => {
    if (tests.length && !selectedTestId) {
      setSelectedTestId(tests[0].id);
    }
    if (!tests.some((test) => test.id === selectedTestId) && tests[0]) {
      setSelectedTestId(tests[0].id);
    }
  }, [selectedTestId, tests]);

  useEffect(() => {
    if (currentTest && !testSubjectAssignments[currentTest.id]) {
      const defaultSubjects = currentTest.subject_id ? [currentTest.subject_id] : [];
      setTestSubjectAssignments((current) => ({
        ...current,
        [currentTest.id]: defaultSubjects,
      }));
    }
  }, [currentTest, testSubjectAssignments]);

  useEffect(() => {
    if (tests.length && !questionForm.test_id) {
      const nextTestId = selectedTestId || tests[0]?.id || '';
      if (nextTestId) {
        setSelectedTestId(nextTestId);
        setQuestionForm((current) => ({ ...current, test_id: nextTestId }));
      }
    }
  }, [questionForm.test_id, selectedTestId, tests]);

  useEffect(() => {
    if (!currentTest) return;
    setSelectedQuestionSubjectId('all');
  }, [currentTest?.id]);

  useEffect(() => {
    if (!selectedQuestionTest || !assignedSubjectsForQuestionTest.length) {
      return;
    }

    const allowedSubjectIds = assignedSubjectsForQuestionTest.map((subject) => subject.id);
    if (!allowedSubjectIds.includes(questionForm.question_subject_id)) {
      setQuestionForm((current) => ({
        ...current,
        question_subject_id: allowedSubjectIds[0],
      }));
    }
  }, [assignedSubjectsForQuestionTest, questionForm.question_subject_id, selectedQuestionTest]);

  const handleSeriesSave = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (editingSeriesId) {
        const { error } = await supabase
          .from('test_series')
          .update({
            title: seriesForm.title,
            description: seriesForm.description,
            thumbnail_url: seriesForm.thumbnail_url,
            is_published: seriesForm.is_published,
            order: seriesForm.order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSeriesId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('test_series')
          .insert({
            title: seriesForm.title,
            description: seriesForm.description,
            thumbnail_url: seriesForm.thumbnail_url,
            is_published: seriesForm.is_published,
            order: seriesForm.order,
          });

        if (error) throw error;
      }

      setSeriesForm(emptySeriesForm());
      setEditingSeriesId(null);
      await loadAll();
    } catch (error) {
      console.error('Save series error:', error);
      alert('Could not save Test Series.');
    }
  };

  const handleSeriesDelete = async (seriesId: string) => {
    if (!confirm('Delete this Test Series and all of its subjects, tests and questions?')) return;

    const { error } = await supabase.from('test_series').delete().eq('id', seriesId);
    if (error) {
      alert(error.message);
      return;
    }

    setSelectedSeriesId('');
    await loadAll();
  };

  const handleSubjectSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const seriesId = selectedSeriesId;
    if (!seriesId) return;

    try {
      if (editingSubjectId) {
        const { error } = await supabase
          .from('test_series_subjects')
          .update({
            name: subjectForm.name,
            icon_url: subjectForm.icon_url,
            order: subjectForm.order,
            is_enabled: subjectForm.is_enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSubjectId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('test_series_subjects')
          .insert({
            series_id: seriesId,
            name: subjectForm.name,
            icon_url: subjectForm.icon_url,
            order: subjectForm.order,
            is_enabled: subjectForm.is_enabled,
          });

        if (error) throw error;
      }

      setSubjectForm(emptySubjectForm(seriesId));
      setEditingSubjectId(null);
      await loadSeriesHierarchy(seriesId);
    } catch (error) {
      console.error('Save subject error:', error);
      alert('Could not save subject.');
    }
  };

  const handleSubjectDelete = async (subjectId: string) => {
    if (!confirm('Delete this subject and all tests under it?')) return;

    const { error } = await supabase.from('test_series_subjects').delete().eq('id', subjectId);
    if (error) {
      alert(error.message);
      return;
    }

    if (selectedSeriesId) await loadSeriesHierarchy(selectedSeriesId);
  };

  const handleTestSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const subjectId = testForm.subject_id;
    if (!subjectId) return;

    const payload = {
      ...testForm,
      is_paid: isPaidMode,
    };

    try {
      let createdTestId = editingTestId;

      if (editingTestId) {
        const { error } = await supabase
          .from('tests')
          .update({
            title: payload.title,
            date_label: payload.date_label,
            duration_minutes: payload.duration_minutes,
            max_marks: payload.max_marks,
            marks_per_correct: payload.marks_per_correct,
            negative_marks: payload.negative_marks,
            language: payload.language,
            instructions: payload.instructions,
            is_paid: payload.is_paid,
            price: payload.price,
            is_published: payload.is_published,
            scheduled_start: payload.scheduled_start || null,
            scheduled_end: payload.scheduled_end || null,
            order: payload.order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTestId);

        if (error) throw error;
      } else {
        const { data: createdTest, error } = await supabase
          .from('tests')
          .insert({
            subject_id: subjectId,
            title: payload.title,
            date_label: payload.date_label,
            duration_minutes: payload.duration_minutes,
            max_marks: payload.max_marks,
            marks_per_correct: payload.marks_per_correct,
            negative_marks: payload.negative_marks,
            language: payload.language,
            instructions: payload.instructions,
            is_paid: payload.is_paid,
            price: payload.price,
            is_published: payload.is_published,
            scheduled_start: payload.scheduled_start || null,
            scheduled_end: payload.scheduled_end || null,
            order: payload.order,
          })
          .select('id')
          .single();

        if (error) throw error;
        createdTestId = createdTest?.id ?? null;
      }

      if (createdTestId) {
        setTestSubjectAssignments((current) => ({
          ...current,
          [createdTestId]: Array.from(new Set([...(current[createdTestId] ?? []), subjectId].filter(Boolean))),
        }));
        setSelectedTestId(createdTestId);
      }

      setTestForm(emptyTestForm(subjectId, mode));
      setEditingTestId(null);
      if (selectedSeriesId) await loadSeriesHierarchy(selectedSeriesId);
    } catch (error) {
      console.error('Save test error:', error);
      alert('Could not save test.');
    }
  };

  const handleTestDelete = async (testId: string) => {
    if (!confirm('Delete this test and all questions inside it?')) return;

    const { error } = await supabase.from('tests').delete().eq('id', testId);
    if (error) {
      alert(error.message);
      return;
    }

    if (selectedSeriesId) await loadSeriesHierarchy(selectedSeriesId);
  };

  const handleQuestionSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSeriesId) return;

    const activeTestId = editingQuestionId
      ? questions.find((question) => question.id === editingQuestionId)?.test_id ?? questionForm.test_id
      : questionForm.test_id;

    if (!activeTestId) {
      alert('Select a Test before adding a question.');
      return;
    }

    const allowedSubjectIds = new Set(
      (testSubjectAssignments[activeTestId] ?? [tests.find((test) => test.id === activeTestId)?.subject_id ?? '']).filter(Boolean)
    );

    if (!questionForm.question_subject_id) {
      alert('Select a subject assigned to the chosen test before adding a question.');
      return;
    }

    if (!allowedSubjectIds.has(questionForm.question_subject_id)) {
      alert('Choose a subject that belongs to the selected Test before saving the question.');
      return;
    }

    try {
      const payload = {
        test_id: activeTestId,
        subject_id: questionForm.question_subject_id || null,
        question_text: questionForm.question_text,
        option_a: questionForm.option_a,
        option_b: questionForm.option_b,
        option_c: questionForm.option_c,
        option_d: questionForm.option_d,
        correct_option: questionForm.correct_option,
        explanation: questionForm.explanation,
        marks: questionForm.marks,
        negative_marks: questionForm.negative_marks,
        language: questionForm.language,
        order: questionForm.order,
      };

      if (editingQuestionId) {
        const { error } = await supabase
          .from('questions')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingQuestionId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('questions').insert(payload);

        if (error) throw error;
      }

      const nextQuestionForm = {
        ...emptyQuestionForm(),
        test_id: activeTestId,
        question_subject_id: questionForm.question_subject_id,
      };
      setQuestionForm(nextQuestionForm);
      setEditingQuestionId(null);
      if (selectedSeriesId) await loadSeriesHierarchy(selectedSeriesId);
    } catch (error) {
      console.error('Save question error:', error);
      alert('Could not save question.');
    }
  };

  const handleQuestionDelete = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;

    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) {
      alert(error.message);
      return;
    }

    if (selectedSeriesId) await loadSeriesHierarchy(selectedSeriesId);
  };

  const startEditSeries = (item: TestSeries) => {
    setEditingSeriesId(item.id);
    setSeriesForm({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      thumbnail_url: item.thumbnail_url ?? '',
      is_published: item.is_published,
      order: item.order,
    });
  };

  const startEditSubject = (item: TestSeriesSubject) => {
    setEditingSubjectId(item.id);
    setSubjectForm({
      id: item.id,
      series_id: item.series_id,
      name: item.name,
      icon_url: item.icon_url ?? '',
      order: item.order,
      is_enabled: item.is_enabled,
    });
  };

  const startEditTest = (item: Test) => {
    setEditingTestId(item.id);
    setTestForm({
      id: item.id,
      subject_id: item.subject_id,
      title: item.title,
      date_label: item.date_label ?? '',
      duration_minutes: item.duration_minutes,
      max_marks: item.max_marks,
      marks_per_correct: item.marks_per_correct,
      negative_marks: item.negative_marks,
      language: item.language,
      instructions: item.instructions ?? '',
      is_paid: item.is_paid,
      price: item.price,
      is_published: item.is_published,
      scheduled_start: item.scheduled_start ? new Date(item.scheduled_start).toISOString().slice(0, 16) : '',
      scheduled_end: item.scheduled_end ? new Date(item.scheduled_end).toISOString().slice(0, 16) : '',
      order: item.order,
    });
  };

  const startEditQuestion = (item: Question) => {
    const parentTest = tests.find((test) => test.id === item.test_id);
    setEditingQuestionId(item.id);
    setQuestionForm({
      id: item.id,
      test_id: parentTest?.id ?? (questionForm.test_id || selectedTestId || ''),
      question_subject_id: item.subject_id ?? parentTest?.subject_id ?? questionForm.question_subject_id,
      question_text: item.question_text,
      option_a: item.option_a,
      option_b: item.option_b,
      option_c: item.option_c,
      option_d: item.option_d,
      correct_option: item.correct_option,
      explanation: item.explanation ?? '',
      marks: Number(item.marks),
      negative_marks: Number(item.negative_marks),
      language: item.language,
      order: item.order,
    });
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Loading {headingLabel} Test Series admin...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin</p>
            <h2 className="text-2xl font-bold text-slate-900">Manage {headingLabel} Test Series</h2>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              setEditingSeriesId(null);
              setSeriesForm(emptySeriesForm());
            }}
          >
            + Add Series
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          This section is only for {isPaidMode ? 'paid' : 'free'} tests and series. Use the hierarchy below to manage series, subjects, tests, and questions.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Test Series</h3>
        <form onSubmit={handleSeriesSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Series Title</label>
            <input
              value={seriesForm.title}
              onChange={(event) => setSeriesForm({ ...seriesForm, title: event.target.value })}
              placeholder="Enter series title"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Order</label>
            <input
              type="number"
              value={seriesForm.order}
              onChange={(event) => setSeriesForm({ ...seriesForm, order: Number(event.target.value) })}
              placeholder="Display order"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <ImageUploadField
              label="Thumbnail Image"
              buttonLabel="Upload Image"
              folder="test-series"
              existingUrl={seriesForm.thumbnail_url}
              onUrlChange={(nextUrl) => setSeriesForm({ ...seriesForm, thumbnail_url: nextUrl })}
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={seriesForm.description}
              onChange={(event) => setSeriesForm({ ...seriesForm, description: event.target.value })}
              placeholder="Add a short series description"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 min-h-28"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={seriesForm.is_published} onChange={(event) => setSeriesForm({ ...seriesForm, is_published: event.target.checked })} />
              Published
            </label>
          </div>

          <div className="md:col-span-2 flex gap-2 flex-wrap">
            <Button variant="primary" type="submit">{editingSeriesId ? 'Update Series' : 'Create Series'}</Button>
            <Button variant="ghost" type="button" onClick={() => { setEditingSeriesId(null); setSeriesForm(emptySeriesForm()); }}>Cancel</Button>
          </div>
        </form>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {seriesList.length === 0 ? (
            <p className="text-slate-500">No {headingLabel.toLowerCase()} test series yet.</p>
          ) : (
            seriesList.map((item) => (
              <div key={item.id} className={`border rounded-xl p-4 ${selectedSeriesId === item.id ? 'border-brand-primary bg-blue-50/60' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.title}</h4>
                    <p className="text-sm text-slate-500">{item.is_published ? 'Published' : 'Draft'}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedSeriesId(item.id)}>Select</Button>
                    <Button size="sm" variant="ghost" onClick={() => startEditSeries(item)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleSeriesDelete(item.id)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedSeries && (
        <>
          <section className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Subjects</h3>
            <form onSubmit={handleSubjectSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Subject Name</label>
                <input
                  value={subjectForm.name}
                  onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })}
                  placeholder="Enter subject name"
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Order</label>
                <input
                  type="number"
                  value={subjectForm.order}
                  onChange={(event) => setSubjectForm({ ...subjectForm, order: Number(event.target.value) })}
                  placeholder="Display order"
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <ImageUploadField
                  label="Subject Icon"
                  buttonLabel="Upload Icon"
                  folder="subjects"
                  existingUrl={subjectForm.icon_url}
                  onUrlChange={(nextUrl) => setSubjectForm({ ...subjectForm, icon_url: nextUrl })}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={subjectForm.is_enabled} onChange={(event) => setSubjectForm({ ...subjectForm, is_enabled: event.target.checked })} />
                  Enabled
                </label>
              </div>

              <div className="md:col-span-2 flex gap-2 flex-wrap">
                <Button variant="primary" type="submit">{editingSubjectId ? 'Update Subject' : 'Create Subject'}</Button>
                <Button variant="ghost" type="button" onClick={() => { setEditingSubjectId(null); setSubjectForm(emptySubjectForm(selectedSeriesId)); }}>Cancel</Button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {subjects.length === 0 ? (
                <p className="text-slate-500">No subjects yet.</p>
              ) : (
                subjects.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-lg p-4 flex justify-between items-center gap-3">
                    <div>
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.is_enabled ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => startEditSubject(item)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleSubjectDelete(item.id)}>Delete</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tests</h3>
            <form onSubmit={handleTestSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Subject</label>
                <select value={testForm.subject_id} onChange={(event) => setTestForm({ ...testForm, subject_id: event.target.value })} className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required>
                  <option value="">Select subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Test Title</label>
                <input value={testForm.title} onChange={(event) => setTestForm({ ...testForm, title: event.target.value })} placeholder="Enter test title" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Date Label</label>
                <input value={testForm.date_label} onChange={(event) => setTestForm({ ...testForm, date_label: event.target.value })} placeholder="Example: 13 SEP 2026" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Duration (minutes)</label>
                <input type="number" value={testForm.duration_minutes} onChange={(event) => setTestForm({ ...testForm, duration_minutes: Number(event.target.value) })} placeholder="Duration in minutes" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Total Questions</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 font-medium">
                  {questions.length}
                </div>
                <p className="text-xs text-slate-500">Current count of questions added to this test.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Marks Per Correct Answer</label>
                <input type="number" value={testForm.marks_per_correct} onChange={(event) => setTestForm({ ...testForm, marks_per_correct: Number(event.target.value) })} placeholder="Marks awarded for each correct answer" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Negative Marking</label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Number(testForm.negative_marks) > 0}
                    onChange={(event) => setTestForm({
                      ...testForm,
                      negative_marks: event.target.checked ? Math.max(Number(testForm.negative_marks) || 1, 1) : 0,
                    })}
                  />
                  Enable negative marking
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Negative Marks Per Wrong Answer</label>
                <input
                  type="number"
                  value={testForm.negative_marks}
                  onChange={(event) => setTestForm({ ...testForm, negative_marks: Number(event.target.value) })}
                  placeholder="Set 0 if there is no negative marking"
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                  min="0"
                  step="0.25"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Start Date & Time</label>
                <input type="datetime-local" value={testForm.scheduled_start} onChange={(event) => setTestForm({ ...testForm, scheduled_start: event.target.value })} className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">End Date & Time</label>
                <input type="datetime-local" value={testForm.scheduled_end} onChange={(event) => setTestForm({ ...testForm, scheduled_end: event.target.value })} className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Test Type (Free/Paid)</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 font-medium">
                  {headingLabel} test
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Published</label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input type="checkbox" checked={testForm.is_published} onChange={(event) => setTestForm({ ...testForm, is_published: event.target.checked })} />
                  Publish this test
                </label>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Instructions</label>
                <textarea value={testForm.instructions} onChange={(event) => setTestForm({ ...testForm, instructions: event.target.value })} placeholder="Add instructions for students" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 min-h-24" />
              </div>

              <div className="md:col-span-2 flex gap-2 flex-wrap">
                <Button variant="primary" type="submit">{editingTestId ? 'Update Test' : 'Create Test'}</Button>
                <Button variant="ghost" type="button" onClick={() => { setEditingTestId(null); setTestForm(emptyTestForm(subjects[0]?.id ?? '', mode)); }}>Cancel</Button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {tests.length === 0 ? (
                <p className="text-slate-500">No tests yet.</p>
              ) : (
                tests.map((item) => (
                  <div key={item.id} className={`border rounded-lg p-4 ${selectedTestId === item.id ? 'border-brand-primary bg-blue-50/50' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">{item.title}</div>
                        <div className="text-xs text-slate-500">{item.is_paid ? `Paid · ₹${item.price}` : 'Free'} · {item.is_published ? 'Published' : 'Draft'} · {item.duration_minutes} mins</div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedTestId(item.id)}>Select</Button>
                        <Button size="sm" variant="ghost" onClick={() => startEditTest(item)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleTestDelete(item.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {currentTest && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Subjects in This Test</p>
                    <h4 className="mt-1 text-lg font-bold text-slate-900">{currentTest.title}</h4>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-primary">{currentTestQuestionCount} Questions</span>
                </div>

                <div className="mt-4 space-y-3">
                  {subjects.length === 0 ? (
                    <p className="text-sm text-slate-500">Create a subject first before assigning it to this test.</p>
                  ) : (
                    subjects.map((subject) => {
                      const assigned = (testSubjectAssignments[currentTest.id] ?? [currentTest.subject_id]).includes(subject.id);
                      return (
                        <label key={subject.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={(event) => {
                                const nextIds = new Set(testSubjectAssignments[currentTest.id] ?? [currentTest.subject_id]);
                                if (event.target.checked) nextIds.add(subject.id); else nextIds.delete(subject.id);
                                setTestSubjectAssignments((existing) => ({
                                  ...existing,
                                  [currentTest.id]: [...nextIds].filter(Boolean),
                                }));
                              }}
                            />
                            <span>{subject.name}</span>
                          </span>
                          <span className="text-xs text-slate-500">{subjectQuestionCounts.get(subject.id) ?? 0} Questions</span>
                        </label>
                      );
                    })
                  )}
                </div>

                {assignedSubjectsForCurrentTest.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-sm font-semibold text-slate-700">Summary</p>
                    <div className="mt-2 space-y-2">
                      {assignedSubjectsForCurrentTest.map((subject) => (
                        <div key={subject.id} className="flex items-center justify-between gap-3 text-sm text-slate-600">
                          <span>{subject.name}</span>
                          <span>{subjectQuestionCounts.get(subject.id) ?? 0} Questions</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-semibold text-slate-800">
                        <span>Total</span>
                        <span>{assignedSubjectsForCurrentTest.reduce((total, subject) => total + (subjectQuestionCounts.get(subject.id) ?? 0), 0)} Questions</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-lg font-bold text-slate-900">Questions</h3>
              <p className="text-sm text-slate-600">Create one or more subjects for this series, then add questions under each subject separately.</p>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Select Subject</label>
                <select
                  value={selectedQuestionSubjectId}
                  onChange={(event) => setSelectedQuestionSubjectId(event.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">Subject-wise question distribution</p>
                  <span className="text-xs font-semibold text-slate-500">Total: {questions.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {subjects.length === 0 ? (
                    <p className="text-sm text-slate-500">No subjects created yet.</p>
                  ) : (
                    subjects.map((subject) => {
                      const count = subjectQuestionCounts.get(subject.id) ?? 0;
                      return (
                        <div key={subject.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 border border-slate-200">
                          <span className="text-sm font-medium text-slate-700">{subject.name}</span>
                          <span className="text-sm text-slate-600">{count} Questions</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              {selectedQuestionSubjectId === 'all' ? (
                <div className="mb-4 text-sm text-slate-600">Showing all questions across all subjects.</div>
              ) : (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected Subject</p>
                    <h4 className="text-lg font-bold text-slate-900">
                      {subjects.find((subject) => subject.id === selectedQuestionSubjectId)?.name ?? 'Subject'}
                    </h4>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-primary">
                    {visibleQuestions.length} Question{visibleQuestions.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              {visibleQuestions.length === 0 ? (
                <p className="text-slate-500">No questions available for this subject.</p>
              ) : (
                <div className="space-y-3">
                  {visibleQuestions.map((item, index) => (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question {index + 1}</p>
                          <div className="mt-2 font-semibold text-slate-800 whitespace-pre-wrap">{item.question_text}</div>
                          <div className="mt-2 text-xs text-slate-500">{item.correct_option} · {item.marks} marks</div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => startEditQuestion(item)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleQuestionDelete(item.id)}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleQuestionSave} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Test</label>
                <select
                  value={questionForm.test_id || selectedTestId || ''}
                  onChange={(event) => {
                    const nextTestId = event.target.value;
                    setSelectedTestId(nextTestId);
                    setQuestionForm((current) => ({
                      ...current,
                      test_id: nextTestId,
                      question_subject_id: '',
                    }));
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                  required
                >
                  <option value="">Select Test</option>
                  {tests.map((test) => (
                    <option key={test.id} value={test.id}>{test.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Subject</label>
                <select
                  value={questionForm.question_subject_id}
                  onChange={(event) => setQuestionForm({ ...questionForm, question_subject_id: event.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                  disabled={!questionForm.test_id || assignedSubjectsForQuestionTest.length === 0}
                  required
                >
                  <option value="">Select Subject</option>
                  {assignedSubjectsForQuestionTest.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Question Order</label>
                <input type="number" value={questionForm.order} onChange={(event) => setQuestionForm({ ...questionForm, order: Number(event.target.value) })} placeholder="Question order" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Question Text</label>
                <textarea value={questionForm.question_text} onChange={(event) => setQuestionForm({ ...questionForm, question_text: event.target.value })} placeholder="Enter the question" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 min-h-24" required />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Option A</label>
                <input value={questionForm.option_a} onChange={(event) => setQuestionForm({ ...questionForm, option_a: event.target.value })} placeholder="Option A" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Option B</label>
                <input value={questionForm.option_b} onChange={(event) => setQuestionForm({ ...questionForm, option_b: event.target.value })} placeholder="Option B" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Option C</label>
                <input value={questionForm.option_c} onChange={(event) => setQuestionForm({ ...questionForm, option_c: event.target.value })} placeholder="Option C" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Option D</label>
                <input value={questionForm.option_d} onChange={(event) => setQuestionForm({ ...questionForm, option_d: event.target.value })} placeholder="Option D" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Correct Option</label>
                <select value={questionForm.correct_option} onChange={(event) => setQuestionForm({ ...questionForm, correct_option: event.target.value as 'A' | 'B' | 'C' | 'D' })} className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required>
                  <option value="A">Correct: A</option>
                  <option value="B">Correct: B</option>
                  <option value="C">Correct: C</option>
                  <option value="D">Correct: D</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Marks</label>
                <input type="number" value={questionForm.marks} onChange={(event) => setQuestionForm({ ...questionForm, marks: Number(event.target.value) })} placeholder="Marks for correct answer" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Negative Marks</label>
                <input type="number" value={questionForm.negative_marks} onChange={(event) => setQuestionForm({ ...questionForm, negative_marks: Number(event.target.value) })} placeholder="Negative marks for wrong answer" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Language</label>
                <input value={questionForm.language} onChange={(event) => setQuestionForm({ ...questionForm, language: event.target.value })} placeholder="Language" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900" required />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Explanation</label>
                <textarea value={questionForm.explanation} onChange={(event) => setQuestionForm({ ...questionForm, explanation: event.target.value })} placeholder="Add explanation for the correct answer" className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 min-h-20" />
              </div>
              <div className="md:col-span-2 flex gap-2 flex-wrap">
                <Button variant="primary" type="submit">{editingQuestionId ? 'Update Question' : 'Create Question'}</Button>
                <Button variant="ghost" type="button" onClick={() => {
                  setEditingQuestionId(null);
                  setQuestionForm({
                    ...emptyQuestionForm(),
                    test_id: selectedTestId || questionForm.test_id || tests[0]?.id || '',
                    question_subject_id: assignedSubjectsForQuestionTest[0]?.id ?? '',
                  });
                }}>Cancel</Button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
