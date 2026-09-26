'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { testSeriesFetch } from '@/lib/test-series-client';
import type { ParsedQuestion, ParseResult, DetectedSection } from '@/lib/question-parser/types';
import type { FormatterJobStatus } from '@/lib/question-parser/job-manager';

type FormatterStep = 'upload' | 'processing' | 'preview' | 'committing' | 'success';

interface ExistingSeriesItem {
  id: string;
  title: string;
  is_paid?: boolean;
}

interface ExistingTestItem {
  id: string;
  title: string;
  test_series_id?: string;
  duration_minutes?: number;
  max_marks?: number;
}

export default function QuestionFileFormatterPage() {
  const router = useRouter();

  // Wizard Step
  const [step, setStep] = useState<FormatterStep>('upload');

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [cachedFileId, setCachedFileId] = useState<string | null>(null);
  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);

  // Section / Practice Set selection
  const [detectedSections, setDetectedSections] = useState<DetectedSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('sec-1');

  // Question Range
  const [fromQuestion, setFromQuestion] = useState<number>(1);
  const [toQuestion, setToQuestion] = useState<number>(100);

  // Target Destination Configuration
  const [destMode, setDestMode] = useState<'create_new' | 'import_existing'>('create_new');
  const [seriesTitle, setSeriesTitle] = useState<string>('Practice Set 01');
  const [subjectName, setSubjectName] = useState<string>('General Knowledge');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [price, setPrice] = useState<number>(199);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [marksPerCorrect, setMarksPerCorrect] = useState<number>(1);
  const [negativeMarks, setNegativeMarks] = useState<number>(0);
  const [language, setLanguage] = useState<string>('English');

  // Existing Series/Test selection (when destMode === 'import_existing')
  const [existingSeriesList, setExistingSeriesList] = useState<ExistingSeriesItem[]>([]);
  const [existingTestsList, setExistingTestsList] = useState<ExistingTestItem[]>([]);
  const [selectedExistingSeriesId, setSelectedExistingSeriesId] = useState<string>('');
  const [selectedExistingTestId, setSelectedExistingTestId] = useState<string>('');

  // Parsing result & questions state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'needs_review' | 'invalid' | 'duplicate'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('Reading source document...');

  // Asynchronous Background Job Polling state
  const [jobProgressPercent, setJobProgressPercent] = useState<number>(0);
  const [jobStageStatus, setJobStageStatus] = useState<FormatterJobStatus>('QUEUED');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Inline Question editing sub-modal state
  const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);

  // Success summary state
  const [successSummary, setSuccessSummary] = useState<{
    seriesId: string;
    seriesTitle: string;
    testTitle?: string;
    questionsCount: number;
    nextFrom: number;
    nextTo: number;
    nextSeriesTitle: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expected count
  const expectedCount = useMemo(() => {
    if (toQuestion >= fromQuestion) {
      return toQuestion - fromQuestion + 1;
    }
    return 0;
  }, [fromQuestion, toQuestion]);

  // Available tests for selected series
  const filteredExistingTests = useMemo(() => {
    if (!selectedExistingSeriesId) return existingTestsList;
    return existingTestsList.filter(
      (t) => t.test_series_id === selectedExistingSeriesId
    );
  }, [existingTestsList, selectedExistingSeriesId]);

  // Auto-generate test series title suggestion if user modifies range, set, or subject
  const updateSuggestedTitle = (from: number, to: number, subj: string, secName?: string) => {
    const setNum = Math.ceil(to / Math.max(1, to - from + 1));
    const setStr = setNum < 10 ? `0${setNum}` : `${setNum}`;
    const prefix = secName ? secName : (subj || 'Exam');
    setSeriesTitle(`${prefix} Set ${setStr}`);
  };

  const handleFromChange = (val: number) => {
    setFromQuestion(val);
    updateSuggestedTitle(val, toQuestion, subjectName);
  };

  const handleToChange = (val: number) => {
    setToQuestion(val);
    updateSuggestedTitle(fromQuestion, val, subjectName);
  };

  const handleSubjectChange = (val: string) => {
    setSubjectName(val);
    updateSuggestedTitle(fromQuestion, toQuestion, val);
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      setCachedFileId(null);
      setIsScannedPdf(false);
      setErrorMsg(null);
    }
  };

  // ---------------------------------------------------------------------------
  // PROCESS & EXTRACT QUESTIONS (Asynchronous Background Job & Status Polling)
  // ---------------------------------------------------------------------------
  const handleCancelProcessing = () => {
    isCancelledRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStep('upload');
    setErrorMsg('Processing was cancelled by admin.');
  };

  const handleStartProcessing = async () => {
    if (!file && !cachedFileId) {
      setErrorMsg('Please select a question source file first.');
      return;
    }
    if (fromQuestion < 1) {
      setErrorMsg('"From Question" must be at least 1.');
      return;
    }
    if (toQuestion < fromQuestion) {
      setErrorMsg('"To Question" must be greater than or equal to "From Question".');
      return;
    }

    setStep('processing');
    setErrorMsg(null);
    setIsScannedPdf(false);
    setProgressMsg('Uploading document and initiating background job...');
    setJobProgressPercent(10);
    setJobStageStatus('UPLOADING');
    isCancelledRef.current = false;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      const formData = new FormData();
      if (cachedFileId) {
        formData.append('fileId', cachedFileId);
      } else if (file) {
        formData.append('file', file);
      }

      formData.append('fromQuestion', String(fromQuestion));
      formData.append('toQuestion', String(toQuestion));
      if (selectedSectionId && selectedSectionId !== 'all') {
        formData.append('sectionId', selectedSectionId);
      }
      formData.append('defaultSubjectName', subjectName.trim());
      formData.append('defaultMarks', String(marksPerCorrect));
      formData.append('defaultNegativeMarks', String(negativeMarks));
      formData.append('defaultLanguage', language);

      // STEP 1 & 2: Initiate background processing job (returns immediately in <100ms) with active admin auth
      const res = await testSeriesFetch('/api/admin/question-formatter/jobs/create', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to initiate processing job.');
      }

      const { jobId, fileId } = await res.json();
      if (fileId) {
        setCachedFileId(fileId);
      }

      setProgressMsg('Extracting text and analyzing question structures...');
      setJobProgressPercent(25);
      setJobStageStatus('QUEUED');

      // STEP 3 & 4: Continuously poll job status with active admin session without holding long HTTP connection
      pollingRef.current = setInterval(async () => {
        if (isCancelledRef.current) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }

        try {
          const pollRes = await testSeriesFetch(`/api/admin/question-formatter/jobs/${jobId}`, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
          });
          if (!pollRes.ok) {
            const errJson = await pollRes.json().catch(() => ({}));
            throw new Error(errJson.error || 'Failed to poll job status.');
          }

          const { job } = await pollRes.json();
          if (!job) return;

          setJobStageStatus(job.status);
          if (job.message) {
            setProgressMsg(job.message);
          }
          if (typeof job.progressPercent === 'number') {
            setJobProgressPercent(job.progressPercent);
          }

          if (job.status === 'READY_FOR_PREVIEW') {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            const data = job.result;
            if (!data || !data.questions) {
              throw new Error('No question data returned from job.');
            }

            setParseResult(data);
            setQuestions(data.questions);

            if (data.file_id) {
              setCachedFileId(data.file_id);
            }
            if (data.is_scanned) {
              setIsScannedPdf(true);
            }
            if (data.sections && data.sections.length > 0) {
              setDetectedSections(data.sections);
              if (!selectedSectionId || selectedSectionId === 'sec-1') {
                setSelectedSectionId(data.sections[0].id);
              }
            }
            if (data.existing_series_list) {
              setExistingSeriesList(data.existing_series_list);
              if (data.existing_series_list.length > 0 && !selectedExistingSeriesId) {
                setSelectedExistingSeriesId(data.existing_series_list[0].id);
              }
            }
            if (data.existing_tests_list) {
              setExistingTestsList(data.existing_tests_list);
              if (data.existing_tests_list.length > 0 && !selectedExistingTestId) {
                setSelectedExistingTestId(data.existing_tests_list[0].id);
              }
            }

            setStep('preview');
          } else if (job.status === 'FAILED') {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            throw new Error(job.error || 'Document processing failed.');
          }
        } catch (pollErr: any) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          console.error('Job polling error:', pollErr);
          setErrorMsg(pollErr.message || 'Could not complete processing.');
          setStep('upload');
        }
      }, 1500);
    } catch (err: any) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      console.error('Job initiation error:', err);
      setErrorMsg(err.message || 'Could not start background parsing.');
      setStep('upload');
    }
  };

  // Section Change Handler (re-filters or updates range limits)
  const handleSectionSelect = (secId: string) => {
    setSelectedSectionId(secId);
    const sec = detectedSections.find((s) => s.id === secId);
    if (sec) {
      setFromQuestion(sec.from_question);
      setToQuestion(Math.min(sec.to_question, sec.from_question + 99));
      updateSuggestedTitle(sec.from_question, Math.min(sec.to_question, sec.from_question + 99), subjectName, sec.name);
    }
  };

  // Question editing within preview
  const handleSaveEditedQuestion = (updated: ParsedQuestion) => {
    const issues: string[] = [];
    if (!updated.question_text.trim()) issues.push('Question text missing or incomplete');
    if (!updated.option_a.trim()) issues.push('Missing Option A');
    if (!updated.option_b.trim()) issues.push('Missing Option B');
    if (!updated.option_c.trim()) issues.push('Missing Option C');
    if (!updated.option_d.trim()) issues.push('Missing Option D');
    if (!updated.correct_option) issues.push('Missing Correct Answer');

    let status = updated.status;
    if (!updated.question_text.trim() || (!updated.option_a && !updated.option_b)) {
      status = 'invalid';
    } else if (issues.length > 0) {
      status = 'needs_review';
    } else {
      status = 'valid';
    }

    const validated: ParsedQuestion = {
      ...updated,
      validation_issues: issues,
      status,
    };

    setQuestions((prev) => prev.map((q) => (q.id === validated.id ? validated : q)));
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => {
      const remaining = prev.filter((q) => q.id !== id);
      return remaining.map((q, idx) => ({ ...q, order: idx + 1 }));
    });
  };

  // ---------------------------------------------------------------------------
  // STEP 6: CONFIRM & COMMIT QUESTIONS (To New Series or Existing Test)
  // ---------------------------------------------------------------------------
  const handleConfirmAndCommit = async () => {
    if (questions.length === 0) {
      setErrorMsg('No questions to import.');
      return;
    }

    setStep('committing');
    setErrorMsg(null);

    try {
      const payload: any = {
        mode: destMode,
        existingSeriesId: destMode === 'import_existing' ? selectedExistingSeriesId : null,
        testId: destMode === 'import_existing' ? selectedExistingTestId : null,
        series: {
          title: seriesTitle.trim(),
          description: `Imported via Question Formatter from ${file?.name || 'source file'}`,
          is_paid: isPaid,
          is_published: true,
          order: 0,
        },
        subjectName: subjectName.trim(),
        test: {
          title: seriesTitle.trim(),
          date_label: `Q${fromQuestion}-Q${toQuestion}`,
          duration_minutes: durationMinutes,
          max_marks: questions.length * marksPerCorrect,
          marks_per_correct: marksPerCorrect,
          negative_marks: negativeMarks,
          language: language,
          instructions: '1. Each question carries marks as indicated.\n2. Select one correct option.\n3. Do not refresh during the test.',
          is_paid: isPaid,
          price: isPaid ? price : 0,
          is_published: true,
        },
        questions: questions.map((q, idx) => ({
          question_number: q.question_number,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option || 'A',
          explanation: q.explanation,
          marks: q.marks || marksPerCorrect,
          negative_marks: q.negative_marks || negativeMarks,
          language: q.language || language,
          subject_name: q.subject_name || subjectName,
          order: idx + 1,
        })),
        sourceMetadata: {
          fileName: file?.name || 'document',
          fromQuestion,
          toQuestion,
          sectionId: selectedSectionId,
        },
      };

      const res = await testSeriesFetch('/api/admin/question-formatter/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to save questions to database.');
      }

      const rangeSpan = toQuestion - fromQuestion + 1;
      const nextFrom = toQuestion + 1;
      const nextTo = toQuestion + rangeSpan;
      const nextSetNum = Math.ceil(nextTo / rangeSpan);
      const nextSetTitle = `${subjectName.trim()} Set ${nextSetNum < 10 ? `0${nextSetNum}` : nextSetNum}`;

      setSuccessSummary({
        seriesId: result.seriesId,
        seriesTitle: result.seriesTitle || seriesTitle,
        testTitle: result.testTitle,
        questionsCount: result.questionsCount,
        nextFrom,
        nextTo,
        nextSeriesTitle: nextSetTitle,
      });

      setStep('success');
    } catch (err: any) {
      console.error('Commit error:', err);
      setErrorMsg(err.message || 'Failed to import questions to database.');
      setStep('preview');
    }
  };

  const handleSetupNextBatch = () => {
    if (!successSummary) return;
    setFromQuestion(successSummary.nextFrom);
    setToQuestion(successSummary.nextTo);
    setSeriesTitle(successSummary.nextSeriesTitle);
    setQuestions([]);
    setParseResult(null);
    setSuccessSummary(null);
    setStep('upload');
  };

  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const toggleSourceView = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateQuestionStatus = (id: string, newStatus: 'valid' | 'needs_review' | 'invalid') => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: newStatus,
              validation_issues: newStatus === 'valid' ? [] : q.validation_issues,
            }
          : q
      )
    );
  };

  const handleRemoveAllInvalid = () => {
    setQuestions((prev) => prev.filter((q) => q.status !== 'invalid'));
  };

  // Filter questions for display
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (previewFilter === 'valid') return q.status === 'valid';
      if (previewFilter === 'needs_review') return q.status === 'needs_review';
      if (previewFilter === 'invalid') return q.status === 'invalid';
      if (previewFilter === 'duplicate') return q.status === 'duplicate' || q.is_duplicate;
      return true;
    });
  }, [questions, previewFilter]);

  const validCount = useMemo(() => questions.filter((q) => q.status === 'valid').length, [questions]);
  const reviewCount = useMemo(() => questions.filter((q) => q.status === 'needs_review').length, [questions]);
  const invalidCount = useMemo(() => questions.filter((q) => q.status === 'invalid').length, [questions]);
  const duplicateCount = useMemo(
    () => questions.filter((q) => q.status === 'duplicate' || q.is_duplicate).length,
    [questions]
  );

  const missingCount = parseResult?.missing_question_numbers?.length ?? 0;
  const isRangeIncomplete = missingCount > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xl font-bold">
              ⚡
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Question File Formatter
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Universal Importer
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload raw question-bank files (PDF, Word DOCX, Excel XLSX/CSV, Images) to extract, format, and import.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/test-series">
            <Button variant="outline" size="sm">
              ← Test Series Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* 6-Step Visual Stepper */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 soft-shadow overflow-x-auto">
        <div className="flex items-center justify-between min-w-[620px] text-xs font-semibold text-slate-500">
          <div className={`flex items-center gap-1.5 ${step === 'upload' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
              1
            </span>
            <span>1. Upload File</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>
          <div className={`flex items-center gap-1.5 ${detectedSections.length > 1 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs bg-slate-100 dark:bg-slate-800">
              2
            </span>
            <span>2. Practice Set</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>
          <div className={`flex items-center gap-1.5 ${step === 'upload' || step === 'preview' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs bg-slate-100 dark:bg-slate-800">
              3
            </span>
            <span>3. Question Range</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>
          <div className={`flex items-center gap-1.5 ${step === 'preview' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
              4
            </span>
            <span>4. Review & Edit</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>
          <div className={`flex items-center gap-1.5 ${step === 'success' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
              5
            </span>
            <span>5. Complete</span>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 p-4 rounded-xl flex items-start gap-3">
          <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
          <div className="flex-1 text-xs sm:text-sm text-red-700 dark:text-red-300">
            <strong className="font-semibold">Notice: </strong>
            {errorMsg}
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 1: UPLOAD & CONFIGURATION */}
      {/* ===================================================================== */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: File Drag & Drop + Supported Formats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Box 1: File Uploader */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 soft-shadow space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                    1
                  </span>
                  Select Question Source File
                </label>
                <span className="text-xs text-slate-500">Up to 50MB</span>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  file || cachedFileId
                    ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-brand-primary hover:bg-blue-50/30 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                      setCachedFileId(null);
                      setIsScannedPdf(false);
                      setErrorMsg(null);
                    }
                  }}
                />
                {file || cachedFileId ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <span className="text-5xl">📄</span>
                    <div className="text-center sm:text-left">
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {file?.name || 'Source Question Document'}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • ` : ''}
                        {cachedFileId ? 'Cached in Server Memory • Instant Range Search' : 'Ready to format'}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setCachedFileId(null);
                          setIsScannedPdf(false);
                        }}
                        className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline inline-block"
                      >
                        Change File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-5xl block mb-3">📁</span>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                      Drop your question file here or click to browse
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Supports PDF books, Word DOCX documents, Excel & CSV spreadsheets, and scanned question images.
                    </p>
                  </div>
                )}
              </div>

              {/* Supported Format Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <span className="block font-bold text-slate-900 dark:text-white">📄 PDF Documents</span>
                  <span className="text-[11px] text-slate-500">Digital text & OCR</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <span className="block font-bold text-slate-900 dark:text-white">📝 Word (DOCX)</span>
                  <span className="text-[11px] text-slate-500">Native text & lists</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <span className="block font-bold text-slate-900 dark:text-white">📊 Excel / CSV</span>
                  <span className="text-[11px] text-slate-500">Flexible columns</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                  <span className="block font-bold text-slate-900 dark:text-white">🖼️ Images (OCR)</span>
                  <span className="text-[11px] text-slate-500">JPG, JPEG, PNG</span>
                </div>
              </div>
            </div>

            {/* Box 2: Practice Set & Question Range Selector */}
            <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl p-6 border border-blue-200 dark:border-blue-900/50 space-y-4 soft-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                    2
                  </span>
                  Practice Set & Question Number Range
                </label>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
                  Target: {expectedCount} Questions
                </span>
              </div>

              {/* Detected Practice Sets Selector (if multi-set detected or dropdown) */}
              {detectedSections.length > 1 && (
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 space-y-1.5 shadow-xs">
                  <label className="block text-xs font-bold text-blue-900 dark:text-blue-200">
                    Detected Practice Sets in Document:
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => handleSectionSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                  >
                    {detectedSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} ({sec.total_questions} Qs: Q{sec.from_question} → Q{sec.to_question})
                        {sec.has_answer_key ? ' • With Answer Key' : ''}
                      </option>
                    ))}
                    <option value="all">All Sets / Full Document</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Answer keys are matched specifically within the selected Practice Set!
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    From Question Number *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Q</span>
                    <input
                      type="number"
                      min="1"
                      value={fromQuestion}
                      onChange={(e) => handleFromChange(parseInt(e.target.value, 10) || 1)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-brand-primary"
                      placeholder="1"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Starting question number printed in document</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    To Question Number *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Q</span>
                    <input
                      type="number"
                      min={fromQuestion}
                      value={toQuestion}
                      onChange={(e) => handleToChange(parseInt(e.target.value, 10) || fromQuestion)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-brand-primary"
                      placeholder="100"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Ending question number printed in document</p>
                </div>
              </div>

              {/* Quick Batch Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Quick Ranges:</span>
                {[
                  { from: 1, to: 50, label: '1 → 50 (50 Qs)' },
                  { from: 1, to: 100, label: '1 → 100 (100 Qs)' },
                  { from: 101, to: 200, label: '101 → 200 (100 Qs)' },
                  { from: 201, to: 300, label: '201 → 300 (100 Qs)' },
                  { from: 501, to: 600, label: '501 → 600 (100 Qs)' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      handleFromChange(preset.from);
                      handleToChange(preset.to);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Destination Settings & Action */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 soft-shadow space-y-4">
              <label className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                  3
                </span>
                Destination & Test Config
              </label>

              {/* Destination Mode: Create New vs Import into Existing */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Import Destination
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestMode('create_new')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                      destMode === 'create_new'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    + New Test Series
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestMode('import_existing')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                      destMode === 'import_existing'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Existing Test
                  </button>
                </div>
              </div>

              {destMode === 'create_new' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Series Title *
                    </label>
                    <input
                      type="text"
                      value={seriesTitle}
                      onChange={(e) => setSeriesTitle(e.target.value)}
                      placeholder="e.g. Practice Set 01"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Subject Name *
                    </label>
                    <input
                      type="text"
                      value={subjectName}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      placeholder="e.g. General Knowledge"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={isPaid}
                        onChange={(e) => setIsPaid(e.target.checked)}
                        className="h-4 w-4 rounded text-brand-primary"
                      />
                      <span>Paid Test Series</span>
                    </label>
                    {isPaid && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={price}
                          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 font-bold"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Test Series *
                    </label>
                    <select
                      value={selectedExistingSeriesId}
                      onChange={(e) => setSelectedExistingSeriesId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    >
                      {existingSeriesList.length === 0 && <option value="">No existing series</option>}
                      {existingSeriesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Target Test *
                    </label>
                    <select
                      value={selectedExistingTestId}
                      onChange={(e) => setSelectedExistingTestId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    >
                      {filteredExistingTests.length === 0 && <option value="">No tests found in series</option>}
                      {filteredExistingTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Test Parameters */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Duration (Mins)
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Marks / Question
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={marksPerCorrect}
                    onChange={(e) => setMarksPerCorrect(parseFloat(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Negative Marks
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Bilingual">Bilingual</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3">
                <Button
                  onClick={handleStartProcessing}
                  variant="primary"
                  className="w-full py-3 text-sm font-bold shadow-md"
                  disabled={!file && !cachedFileId}
                >
                  ⚡ Extract & Format Questions →
                </Button>
                <p className="text-[11px] text-center text-slate-500 mt-2">
                  Never commits to database without admin preview & review.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: PROCESSING ANIMATION & LIVE PROGRESS TRACKER */}
      {/* ===================================================================== */}
      {step === 'processing' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-14 border border-slate-200 dark:border-slate-800 soft-shadow text-center space-y-6 max-w-3xl mx-auto">
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 dark:border-slate-800 border-t-brand-primary" />
            <span className="absolute text-xl">📄</span>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Processing Question Document
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Target Range: <strong className="text-slate-900 dark:text-white">Question {fromQuestion} → {toQuestion}</strong>
            </p>

            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-300 font-semibold shadow-xs">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <span>{progressMsg}</span>
            </div>

            {/* Progress Bar */}
            <div className="max-w-md mx-auto pt-2 space-y-1.5">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-brand-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(10, Math.min(100, jobProgressPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-400">
                <span>Status: {jobStageStatus}</span>
                <span>{jobProgressPercent}%</span>
              </div>
            </div>

            {/* Processing Stages Flow */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-4 max-w-xl mx-auto">
              <div
                className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                  jobProgressPercent >= 15
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                1. Text Extraction
              </div>
              <div
                className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                  jobProgressPercent >= 40
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                2. Practice Sets
              </div>
              <div
                className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                  jobProgressPercent >= 60
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                3. Questions & Options
              </div>
              <div
                className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                  jobProgressPercent >= 85
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
              >
                4. Answer Keys
              </div>
            </div>

            {isScannedPdf && (
              <div className="max-w-md mx-auto p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
                <span>⚠️</span>
                <span>Scanned PDF detected. OCR processing is running in background.</span>
              </div>
            )}

            <div className="pt-4">
              <button
                type="button"
                onClick={handleCancelProcessing}
                className="px-4 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors border border-rose-200 dark:border-rose-900"
              >
                ✕ Cancel Processing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3 & 4: PREVIEW, VERIFICATION & EDITING */}
      {/* ===================================================================== */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  Extraction Preview:
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  Question {fromQuestion} → Question {toQuestion}
                </span>
                {selectedSectionId && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    {detectedSections.find((s) => s.id === selectedSectionId)?.name || 'Full Document'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target: <strong>{expectedCount}</strong> requested • Located:{' '}
                <strong className="text-slate-900 dark:text-white">{questions.length}</strong> questions
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setPreviewFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  previewFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewFilter('valid')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  previewFilter === 'valid'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ✓ Valid ({validCount})
              </button>
              {reviewCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewFilter('needs_review')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    previewFilter === 'needs_review'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ⚠️ Needs Review ({reviewCount})
                </button>
              )}
              {invalidCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewFilter('invalid')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    previewFilter === 'invalid'
                      ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ✕ Invalid ({invalidCount})
                </button>
              )}
            </div>
          </div>

          {/* Warning Banner: Missing Questions in Range */}
          {isRangeIncomplete && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900/60 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="text-amber-600 text-lg">⚠️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Warning: {questions.length} of {expectedCount} requested questions detected.
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    <strong>Missing Question Numbers: </strong>
                    {parseResult?.missing_question_numbers?.slice(0, 25).join(', ')}
                    {(parseResult?.missing_question_numbers?.length ?? 0) > 25 && ' ...and more'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => setStep('upload')}
                  variant="outline"
                  size="sm"
                  className="border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950"
                >
                  ← Go Back and Adjust Range
                </Button>
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Or review and resolve the questions below before committing.
                </span>
              </div>
            </div>
          )}

          {/* Question Cards List */}
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const hasIssues = q.validation_issues && q.validation_issues.length > 0;
              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl border transition-all bg-white dark:bg-slate-900 ${
                    q.status === 'invalid'
                      ? 'border-red-300 dark:border-red-900/70 bg-red-50/20'
                      : hasIssues
                      ? 'border-amber-300 dark:border-amber-900/70 bg-amber-50/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        Q {q.question_number || q.order}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          q.status === 'valid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : q.status === 'invalid'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {q.status === 'valid'
                          ? '✓ Valid'
                          : q.status === 'invalid'
                          ? '✕ Invalid'
                          : '⚠️ Needs Review'}
                      </span>
                      {q.section_name && (
                        <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">
                          • {q.section_name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {q.status !== 'valid' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuestionStatus(q.id, 'valid')}
                          className="px-2 py-1 rounded text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          ✓ Mark Valid
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuestionStatus(q.id, 'needs_review')}
                          className="px-2 py-1 rounded text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 transition-colors"
                        >
                          ⚠️ Needs Review
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleSourceView(q.id)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                          expandedSources[q.id]
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        📄 Source Compare
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingQuestion(q)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>

                  {/* Validation issues warning */}
                  {hasIssues && (
                    <div className="mb-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 p-2.5 rounded-lg font-medium">
                      <strong>Issues:</strong> {q.validation_issues.join(', ')}
                    </div>
                  )}

                  {/* Split View for Source Comparison */}
                  <div className={`grid gap-4 ${expandedSources[q.id] ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      {/* Question Text */}
                      <p className="text-sm font-semibold text-slate-900 dark:text-white whitespace-pre-wrap mb-3 leading-relaxed">
                        {q.question_text || <span className="italic text-red-500">[Missing Question Text]</span>}
                      </p>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(['A', 'B', 'C', 'D'] as const).map((key) => {
                          const optKey = `option_${key.toLowerCase()}` as keyof ParsedQuestion;
                          const optVal = (q[optKey] as string) || '';
                          const isCorrect = q.correct_option === key;

                          return (
                            <div
                              key={key}
                              className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                                isCorrect
                                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {key}
                              </span>
                              <span className="flex-1 break-words">
                                {optVal || <span className="italic text-slate-400">Empty</span>}
                              </span>
                              {isCorrect && (
                                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                                  Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-700 dark:text-slate-300">Explanation: </strong>
                          {q.explanation}
                        </div>
                      )}
                    </div>

                    {/* Source Comparison Panel */}
                    {expandedSources[q.id] && (
                      <div className="bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 flex flex-col justify-between text-xs">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-bold">
                            <span className="text-slate-300 flex items-center gap-1.5">
                              <span>📄</span> Original Document Raw Snippet
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              PDF Raw Text
                            </span>
                          </div>
                          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800/80 max-h-72 overflow-y-auto">
                            {q.raw_snippet || 'No raw snippet recorded for this item.'}
                          </pre>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Compare text & options against original source</span>
                          <button
                            type="button"
                            onClick={() => toggleSourceView(q.id)}
                            className="text-blue-400 hover:underline"
                          >
                            Close Preview
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-4 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep('upload')}>
              ← Back to File & Range
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                <strong>{questions.length}</strong> detected •{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{validCount}</strong> valid •{' '}
                <strong className="text-amber-600 dark:text-amber-400">{reviewCount}</strong> need review
                {invalidCount > 0 && (
                  <>
                    {' '}• <strong className="text-red-600 dark:text-red-400">{invalidCount}</strong> invalid
                  </>
                )}
              </span>

              {invalidCount > 0 && (
                <Button
                  onClick={handleRemoveAllInvalid}
                  variant="outline"
                  size="sm"
                  className="text-xs border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 font-bold"
                >
                  ✕ Remove All Invalid ({invalidCount})
                </Button>
              )}

              <Button
                onClick={handleConfirmAndCommit}
                variant="primary"
                className="font-bold px-6 shadow-md"
                disabled={questions.length === 0 || invalidCount > 0}
              >
                {invalidCount > 0
                  ? `Blocked (${invalidCount} Invalid)`
                  : 'Confirm & Import Questions →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: COMMITTING IN DATABASE */}
      {/* ===================================================================== */}
      {step === 'committing' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-16 border border-slate-200 dark:border-slate-800 soft-shadow text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Saving Questions to Database...
          </h3>
          <p className="text-xs text-slate-500">
            Inserting {questions.length} standardized questions and verifying relationships.
          </p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 6: SUCCESS CELEBRATION */}
      {/* ===================================================================== */}
      {step === 'success' && successSummary && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 soft-shadow text-center space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 text-3xl mx-auto shadow-sm">
            🎉
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              Questions Imported Successfully!
            </h3>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              &ldquo;{successSummary.seriesTitle}&rdquo;
            </p>
            <p className="text-xs text-slate-500">
              {successSummary.questionsCount} questions saved with full student test engine compatibility.
            </p>
          </div>

          {/* Action to setup next batch */}
          <div className="max-w-md mx-auto bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-5 text-left space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                Import Next Batch?
              </span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Would you like to import questions <strong>{successSummary.nextFrom} → {successSummary.nextTo}</strong> from the same file as <em>{successSummary.nextSeriesTitle}</em>?
            </p>
            <Button onClick={handleSetupNextBatch} variant="primary" size="sm" className="w-full">
              🚀 Setup Next Range ({successSummary.nextFrom} → {successSummary.nextTo})
            </Button>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link href={`/admin/test-series/${successSummary.seriesId}`}>
              <Button variant="outline" size="sm">
                View in Test Series Manager →
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* INLINE EDIT QUESTION SUB-MODAL */}
      {/* ===================================================================== */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✏️</span> Edit Question #{editingQuestion.question_number || editingQuestion.order}
              </h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question Text *
                </label>
                <textarea
                  rows={3}
                  value={editingQuestion.question_text}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, question_text: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Option A *
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.option_a}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, option_a: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Option B *
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.option_b}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, option_b: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Option C *
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.option_c}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, option_c: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Option D *
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.option_d}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, option_d: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Correct Answer *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, correct_option: opt })}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        editingQuestion.correct_option === opt
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Option {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Explanation (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editingQuestion.explanation}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
              <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleSaveEditedQuestion(editingQuestion)}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
