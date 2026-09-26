'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { ParsedQuestion, ParseResult } from '@/lib/question-parser/types';

interface CreateSeriesFromPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (seriesId: string, count: number) => void;
  existingSeriesList?: Array<{ id: string; title: string }>;
}

type ModalStep = 'config' | 'processing' | 'preview' | 'committing' | 'success';

export function CreateSeriesFromPdfModal({
  isOpen,
  onClose,
  onSuccess,
  existingSeriesList = [],
}: CreateSeriesFromPdfModalProps) {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<ModalStep>('config');

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [fromQuestion, setFromQuestion] = useState<number>(1);
  const [toQuestion, setToQuestion] = useState<number>(100);
  const [seriesTitle, setSeriesTitle] = useState<string>('General Knowledge Set 01');
  const [subjectName, setSubjectName] = useState<string>('General Knowledge');
  const [targetMode, setTargetMode] = useState<'new_series' | 'existing_series'>('new_series');
  const [selectedExistingSeriesId, setSelectedExistingSeriesId] = useState<string>(
    existingSeriesList[0]?.id || ''
  );

  // Settings
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [price, setPrice] = useState<number>(199);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [marksPerCorrect, setMarksPerCorrect] = useState<number>(1);
  const [negativeMarks, setNegativeMarks] = useState<number>(0);
  const [language, setLanguage] = useState<string>('English');
  const [instructions, setInstructions] = useState<string>(
    '1. Each question carries marks as indicated.\n2. Select one correct option per question.\n3. Do not refresh during the test.'
  );

  // Parsing result & questions state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'needs_review'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cached file id for subsequent batch requests without re-uploading
  const [cachedFileId, setCachedFileId] = useState<string | null>(null);
  const [isScannedPdf, setIsScannedPdf] = useState<boolean>(false);

  // Real-time progress message state during parsing
  const [progressMsg, setProgressMsg] = useState<string>('Reading PDF document...');

  // Question editing sub-modal state
  const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);

  // Success summary state
  const [createdSummary, setCreatedSummary] = useState<{
    seriesId: string;
    seriesTitle: string;
    questionsCount: number;
    nextFrom: number;
    nextTo: number;
    nextSeriesTitle: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate expected question count from range
  const expectedCount = useMemo(() => {
    if (toQuestion >= fromQuestion) {
      return toQuestion - fromQuestion + 1;
    }
    return 0;
  }, [fromQuestion, toQuestion]);

  // Auto-generate test series title suggestion if user modifies range or subject
  const updateSuggestedTitle = (from: number, to: number, subj: string) => {
    // Determine set number: if range is 1-100 -> Set 01, 101-200 -> Set 02, etc.
    const setNum = Math.ceil(to / Math.max(1, to - from + 1));
    const setStr = setNum < 10 ? `0${setNum}` : `${setNum}`;
    setSeriesTitle(`${subj || 'Exam'} Set ${setStr}`);
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

  // Step 4: Find Questions in PDF with real-time streaming progress
  const handleFindQuestions = async () => {
    if (!file && !cachedFileId) {
      setErrorMsg('Please select a PDF file first.');
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
    if (!subjectName.trim()) {
      setErrorMsg('Please specify a Subject name.');
      return;
    }

    setStep('processing');
    setErrorMsg(null);
    setIsScannedPdf(false);
    setProgressMsg('Reading PDF...');

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 60000); // 60-second safety timeout

    try {
      const formData = new FormData();
      if (cachedFileId) {
        formData.append('fileId', cachedFileId);
      } else if (file) {
        formData.append('file', file);
      }
      formData.append('fromQuestion', String(fromQuestion));
      formData.append('toQuestion', String(toQuestion));
      formData.append('defaultSubjectName', subjectName.trim());
      formData.append('defaultMarks', String(marksPerCorrect));
      formData.append('defaultNegativeMarks', String(negativeMarks));
      formData.append('defaultLanguage', language);

      const res = await fetch('/api/admin/test-series/create-from-pdf/parse-stream', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let message = 'Failed to extract questions from PDF.';
        try {
          const json = JSON.parse(errorText);
          message = json.error || message;
        } catch {
          message = errorText || message;
        }
        throw new Error(message);
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';
      let receivedResult: (ParseResult & { existing_series_titles?: string[] }) | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        // Keep unfinished trailing chunk in buffer
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);
            if (event.type === 'progress') {
              if (event.message) {
                setProgressMsg(event.message);
              }
              if (event.stage === 'ocr_scanned') {
                setIsScannedPdf(true);
              }
            } else if (event.type === 'result') {
              receivedResult = event.data;
              if (event.data?.file_id) {
                setCachedFileId(event.data.file_id);
              }
              if (event.data?.is_scanned) {
                setIsScannedPdf(true);
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Failed to extract questions from PDF.');
            }
          } catch (jsonErr: any) {
            if (jsonErr.message && !jsonErr.message.includes('JSON')) {
              throw jsonErr;
            }
          }
        }
      }

      clearTimeout(timeoutId);

      if (!receivedResult || !receivedResult.success) {
        throw new Error(receivedResult?.error || 'Failed to extract questions from PDF.');
      }

      setParseResult(receivedResult);
      setQuestions(receivedResult.questions);
      setStep('preview');
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Find questions error:', err);
      if (err.name === 'AbortError') {
        setErrorMsg('PDF processing timed out after 60 seconds. The PDF may be very complex or image-heavy. Please try a smaller range.');
      } else {
        setErrorMsg(err.message || 'An unexpected error occurred while parsing the PDF.');
      }
      setStep('config');
    }
  };

  // Question editing within preview
  const handleSaveEditedQuestion = (updated: ParsedQuestion) => {
    // Recheck validation issues
    const issues: string[] = [];
    if (!updated.question_text.trim()) issues.push('Question text missing or incomplete');
    if (!updated.option_a.trim()) issues.push('Missing Option A');
    if (!updated.option_b.trim()) issues.push('Missing Option B');
    if (!updated.option_c.trim()) issues.push('Missing Option C');
    if (!updated.option_d.trim()) issues.push('Missing Option D');
    if (!updated.correct_option) issues.push('Missing Correct Answer');

    const isValid = issues.length === 0;

    const validated: ParsedQuestion = {
      ...updated,
      validation_issues: issues,
      status: isValid ? 'valid' : 'needs_review',
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

  // Step 6: Confirm & Create Test Series in Database
  const handleConfirmAndCreate = async () => {
    if (questions.length === 0) {
      setErrorMsg('No questions to import.');
      return;
    }

    setStep('committing');
    setErrorMsg(null);

    try {
      const payload = {
        existingSeriesId: targetMode === 'existing_series' ? selectedExistingSeriesId : null,
        series: {
          title: seriesTitle.trim(),
          description: `Imported from ${file?.name || 'PDF'} (Questions ${fromQuestion} - ${toQuestion})`,
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
          instructions: instructions,
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
          order: idx + 1,
        })),
        sourceMetadata: {
          fileName: file?.name || 'document.pdf',
          fromQuestion,
          toQuestion,
        },
      };

      const res = await fetch('/api/admin/test-series/create-from-pdf/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to save Test Series to database.');
      }

      // Prepare next range suggestion (e.g., if current was 1-100, next is 101-200)
      const rangeSpan = toQuestion - fromQuestion + 1;
      const nextFrom = toQuestion + 1;
      const nextTo = toQuestion + rangeSpan;
      const nextSetNum = Math.ceil(nextTo / rangeSpan);
      const nextSetTitle = `${subjectName.trim()} Set ${nextSetNum < 10 ? `0${nextSetNum}` : nextSetNum}`;

      setCreatedSummary({
        seriesId: result.seriesId,
        seriesTitle: result.seriesTitle,
        questionsCount: result.questionsCount,
        nextFrom,
        nextTo,
        nextSeriesTitle: nextSetTitle,
      });

      setStep('success');

      if (onSuccess) {
        onSuccess(result.seriesId, result.questionsCount);
      }
    } catch (err: any) {
      console.error('Commit error:', err);
      setErrorMsg(err.message || 'Failed to create Test Series in database.');
      setStep('preview');
    }
  };

  // Reset to create the next set (e.g. 101 - 200) reusing same PDF
  const handleSetupNextSet = () => {
    if (!createdSummary) return;
    setFromQuestion(createdSummary.nextFrom);
    setToQuestion(createdSummary.nextTo);
    setSeriesTitle(createdSummary.nextSeriesTitle);
    setQuestions([]);
    setParseResult(null);
    setCreatedSummary(null);
    setStep('config');
  };

  // Filter questions in preview
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (previewFilter === 'valid') return q.status === 'valid';
      if (previewFilter === 'needs_review') return q.status === 'needs_review';
      return true;
    });
  }, [questions, previewFilter]);

  const validCount = useMemo(() => questions.filter((q) => q.status === 'valid').length, [questions]);
  const reviewCount = useMemo(() => questions.filter((q) => q.status === 'needs_review').length, [questions]);

  // Check if range is incomplete
  const missingCount = parseResult?.missing_question_numbers?.length ?? 0;
  const isRangeIncomplete = missingCount > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* ============================================================== */}
        {/* MODAL HEADER */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-lg font-bold">
              📄
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Create Test Series from PDF
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Question Range Importer
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extract questions automatically by Question Number range (e.g. 1 → 100, 101 → 200).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl p-1 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* ============================================================== */}
        {/* STEP PROGRESS BREADCRUMBS */}
        {/* ============================================================== */}
        <div className="bg-slate-50/80 dark:bg-slate-950/40 px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 overflow-x-auto gap-2">
            <div
              className={`flex items-center gap-1.5 ${
                step === 'config' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === 'config'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                1
              </span>
              <span>1. PDF & Range</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">→</span>
            <div
              className={`flex items-center gap-1.5 ${
                step === 'processing' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === 'processing'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                2
              </span>
              <span>2. Locate Questions</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">→</span>
            <div
              className={`flex items-center gap-1.5 ${
                step === 'preview' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                3
              </span>
              <span>3. Review Preview</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">→</span>
            <div
              className={`flex items-center gap-1.5 ${
                step === 'success' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === 'success'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                4
              </span>
              <span>4. Created</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ERROR NOTIFICATION BANNER */}
        {/* ============================================================== */}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900/60 p-4 shrink-0 flex items-start gap-3">
            <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
            <div className="flex-1 text-xs sm:text-sm text-red-700 dark:text-red-300">
              <strong className="font-semibold">Import Alert: </strong>
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

        {/* ============================================================== */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {/* ------------------------------------------------------------ */}
          {/* STEP 1: CONFIGURATION (Select PDF, Question Range, Subject) */}
          {/* ------------------------------------------------------------ */}
          {step === 'config' && (
            <div className="space-y-6">
              {/* Box 1: PDF File Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                      1
                    </span>
                    Upload Question-Bank PDF
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">PDF, Word, or Excel</span>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    file || cachedFileId
                      ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-brand-primary hover:bg-blue-50/30 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
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
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl">📄</span>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {file?.name || 'Question-Bank PDF'}
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • ` : ''}
                          {cachedFileId ? 'Cached in Server Memory (Fast Range Parsing)' : 'Ready to process'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setCachedFileId(null);
                          setIsScannedPdf(false);
                        }}
                        className="ml-4 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div>
                      <span className="text-4xl">📥</span>
                      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Click to browse or drop your question-bank PDF here
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Handles large multi-page books with hundreds of pages and questions
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: QUESTION NUMBER RANGE (The Primary Mechanism) */}
              <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-xl p-5 border border-blue-200 dark:border-blue-900/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                      2
                    </span>
                    Question Number Range (Source of Truth)
                  </label>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
                    Target: {expectedCount} Questions
                  </span>
                </div>

                {/* Clear distinction notice */}
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2 shadow-xs">
                  <span className="text-base shrink-0">💡</span>
                  <span>
                    <strong>IMPORTANT:</strong> Enter the <u>Question Numbers</u> printed inside the PDF (e.g. Q1., 1., Question 101), <strong>NOT the PDF page numbers</strong>. The system scans the entire document to locate these exact questions.
                  </span>
                </div>

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
                    <p className="text-[11px] text-slate-500 mt-1">First question to locate (e.g. 1, 101, 201, 501)</p>
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
                    <p className="text-[11px] text-slate-500 mt-1">Last question to locate (e.g. 100, 200, 300, 650)</p>
                  </div>
                </div>

                {/* Quick preset buttons for common batch sizes */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Common Batches:</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleFromChange(1);
                      handleToChange(50);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-primary"
                  >
                    1 → 50 (50 Qs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFromChange(1);
                      handleToChange(100);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-primary"
                  >
                    1 → 100 (100 Qs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFromChange(101);
                      handleToChange(200);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-primary"
                  >
                    101 → 200 (100 Qs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFromChange(201);
                      handleToChange(300);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-primary"
                  >
                    201 → 300 (100 Qs)
                  </button>
                </div>
              </div>

              {/* Box 3: Target Series & Subject Setup */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                    3
                  </span>
                  Subject & Test Series Details
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Subject Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Subject Name *
                    </label>
                    <input
                      type="text"
                      value={subjectName}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      placeholder="e.g. General Knowledge, Computer, Reasoning"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-primary"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Questions will be assigned to this subject</p>
                  </div>

                  {/* Target Mode: New Series or Existing Series */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Series Destination
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={targetMode}
                        onChange={(e) => setTargetMode(e.target.value as any)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-primary"
                      >
                        <option value="new_series">+ Create New Test Series</option>
                        {existingSeriesList.length > 0 && (
                          <option value="existing_series">Add to Existing Test Series</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {targetMode === 'new_series' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Series & Test Name *
                      </label>
                      <input
                        type="text"
                        value={seriesTitle}
                        onChange={(e) => setSeriesTitle(e.target.value)}
                        placeholder="e.g. General Knowledge Set 01"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={isPaid}
                          onChange={(e) => setIsPaid(e.target.checked)}
                          className="h-4 w-4 rounded text-brand-primary focus:ring-brand-primary"
                        />
                        <span>Paid Series</span>
                      </label>
                      {isPaid && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Existing Series *
                    </label>
                    <select
                      value={selectedExistingSeriesId}
                      onChange={(e) => setSelectedExistingSeriesId(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                    >
                      {existingSeriesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Additional Test Parameters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Duration (Mins)
                    </label>
                    <input
                      type="number"
                      min="10"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 60)}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
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
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
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
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Bilingual">Bilingual</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* STEP 2: PROCESSING ANIMATION */}
          {/* ------------------------------------------------------------ */}
          {step === 'processing' && (
            <div className="py-16 text-center space-y-6">
              <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 dark:border-slate-800 border-t-brand-primary" />
                <span className="absolute text-xl">📄</span>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Extracting Question Range: {fromQuestion} → {toQuestion}
                </h3>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-300 font-semibold shadow-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  <span>{progressMsg}</span>
                </div>

                {isScannedPdf && (
                  <div className="max-w-md mx-auto p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
                    <span>⚠️</span>
                    <span>Scanned PDF detected. OCR processing may take longer.</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Locating question range directly without loading unnecessary pages.
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* STEP 3: PREVIEW & REVIEW (Before Saving to DB) */}
          {/* ------------------------------------------------------------ */}
          {step === 'preview' && (
            <div className="space-y-5">
              {isScannedPdf && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 font-medium">
                  <span>ℹ️</span>
                  <span>Scanned PDF detected. Text was extracted via OCR processing.</span>
                </div>
              )}

              {/* Range & Found Summary Bar */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      Import Preview:
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      Question {fromQuestion} → Question {toQuestion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Target: <strong>{expectedCount}</strong> questions • Located in PDF:{' '}
                    <strong className="text-slate-900 dark:text-white">{questions.length}</strong> questions
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-900 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      previewFilter === 'all'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      previewFilter === 'valid'
                        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ✓ Valid ({validCount})
                  </button>
                  {reviewCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('needs_review')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        previewFilter === 'needs_review'
                          ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      ⚠️ Needs Review ({reviewCount})
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 7: MISSING QUESTIONS WARNING BANNER */}
              {isRangeIncomplete && (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900/60 rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-amber-600 text-lg">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        Requested {expectedCount} questions, but only {questions.length} questions were found.
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                        <strong>Missing Question Numbers: </strong>
                        {parseResult?.missing_question_numbers?.slice(0, 25).join(', ')}
                        {(parseResult?.missing_question_numbers?.length ?? 0) > 25 && ' ...and more'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => setStep('config')}
                      variant="outline"
                      size="sm"
                      className="border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950"
                    >
                      ← Go Back and Change Range
                    </Button>
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      Or review the questions below and confirm if you wish to proceed with the found set.
                    </span>
                  </div>
                </div>
              )}

              {/* Question Cards List */}
              <div className="space-y-4">
                {filteredQuestions.map((q, idx) => {
                  const hasIssues = q.validation_issues && q.validation_issues.length > 0;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border transition-all ${
                        hasIssues
                          ? 'border-amber-300 dark:border-amber-900/70 bg-amber-50/20 dark:bg-amber-950/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Top Bar of Card */}
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            Q {q.question_number || q.order}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              q.status === 'valid'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {q.status === 'valid' ? '✓ Valid' : '⚠️ Needs Review'}
                          </span>
                          {q.subject_name && (
                            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                              • {q.subject_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingQuestion(q)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
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

                      {/* Validation Issues Highlight */}
                      {hasIssues && (
                        <div className="mb-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 p-2 rounded-lg font-medium">
                          <strong>Needs Verification:</strong> {q.validation_issues.join(', ')}
                        </div>
                      )}

                      {/* Question Text */}
                      <p className="text-sm font-semibold text-slate-900 dark:text-white whitespace-pre-wrap mb-3">
                        {q.question_text || <span className="italic text-red-500">[Missing Question Text]</span>}
                      </p>

                      {/* 4 Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(['A', 'B', 'C', 'D'] as const).map((key) => {
                          const optKey = `option_${key.toLowerCase()}` as keyof ParsedQuestion;
                          const optVal = (q[optKey] as string) || '';
                          const isCorrect = q.correct_option === key;

                          return (
                            <div
                              key={key}
                              className={`p-2 rounded-lg border flex items-start gap-2 ${
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
                  );
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* STEP 4: COMMITTING IN DATABASE */}
          {/* ------------------------------------------------------------ */}
          {step === 'committing' && (
            <div className="py-20 text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Creating Test Series in Database...
              </h3>
              <p className="text-xs text-slate-500">
                Saving series, subject, test, and inserting {questions.length} questions cleanly.
              </p>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* STEP 5: SUCCESS CELEBRATION & NEXT SET ACTION */}
          {/* ------------------------------------------------------------ */}
          {step === 'success' && createdSummary && (
            <div className="py-12 text-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 text-3xl mx-auto shadow-sm">
                🎉
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Test Series Created Successfully!
                </h3>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  &ldquo;{createdSummary.seriesTitle}&rdquo;
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {createdSummary.questionsCount} questions extracted from PDF question range and committed to database.
                </p>
              </div>

              {/* Fast Next Set Action Box */}
              <div className="max-w-md mx-auto bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                    Ready for Next Batch?
                  </span>
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Would you like to import the next range <strong>{createdSummary.nextFrom} → {createdSummary.nextTo}</strong> from the same PDF as <em>{createdSummary.nextSeriesTitle}</em>?
                </p>
                <Button
                  onClick={handleSetupNextSet}
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                >
                  🚀 Setup Next Set ({createdSummary.nextFrom} → {createdSummary.nextTo})
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* MODAL FOOTER (FIXED / VIEWPORT-SAFE) */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
          {step === 'config' && (
            <>
              <Button onClick={onClose} variant="ghost" size="md">
                Cancel
              </Button>
              <Button
                onClick={handleFindQuestions}
                variant="primary"
                size="md"
                disabled={!file}
                className="shadow-md"
              >
                🔍 Find Questions ({fromQuestion} → {toQuestion})
              </Button>
            </>
          )}

          {step === 'processing' && (
            <div className="w-full flex justify-end">
              <Button onClick={() => setStep('config')} variant="ghost" size="sm">
                Cancel Parsing
              </Button>
            </div>
          )}

          {step === 'preview' && (
            <>
              <Button onClick={() => setStep('config')} variant="outline" size="md">
                ← Change Range / File
              </Button>
              <div className="flex items-center gap-3">
                <Button onClick={onClose} variant="ghost" size="md">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAndCreate}
                  variant="primary"
                  size="md"
                  disabled={questions.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-bold"
                >
                  Confirm & Create Series ({questions.length} Qs)
                </Button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex items-center justify-between">
              <Button onClick={onClose} variant="ghost" size="md">
                Done
              </Button>
              {createdSummary && (
                <Button
                  onClick={() => {
                    onClose();
                    router.push(`/admin/test-series/${createdSummary.seriesId}`);
                  }}
                  variant="primary"
                  size="md"
                  className="shadow-md"
                >
                  View Created Series →
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* INLINE QUESTION EDIT SUB-MODAL */}
      {/* ============================================================== */}
      {editingQuestion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Question {editingQuestion.question_number || editingQuestion.order}
              </h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
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
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                />
              </div>

              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const optField = `option_${key.toLowerCase()}` as keyof ParsedQuestion;
                return (
                  <div key={key}>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Option {key} *
                    </label>
                    <input
                      type="text"
                      value={(editingQuestion[optField] as string) || ''}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, [optField]: e.target.value })
                      }
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                );
              })}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Correct Answer *
                </label>
                <div className="flex items-center gap-2">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, correct_option: key })}
                      className={`flex-1 py-1.5 rounded-lg font-bold border transition-colors ${
                        editingQuestion.correct_option === key
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {key}
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
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
              <Button onClick={() => setEditingQuestion(null)} variant="ghost" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveEditedQuestion(editingQuestion)}
                variant="primary"
                size="sm"
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
