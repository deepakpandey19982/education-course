'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import type { TestSeriesSubject, Test } from '@/types/supabase';
import type { ParsedQuestion, ParseResult } from '@/lib/question-parser/types';

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  seriesId: string;
  currentTest: Test | null;
  subjects: TestSeriesSubject[];
  activeSubjectFilter?: string;
}

type Step = 'upload' | 'processing' | 'review' | 'importing';

export function ImportQuestionsModal({
  isOpen,
  onClose,
  onSuccess,
  seriesId,
  currentTest,
  subjects,
  activeSubjectFilter,
}: ImportQuestionsModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [defaultSubjectId, setDefaultSubjectId] = useState<string>(
    activeSubjectFilter && activeSubjectFilter !== 'all'
      ? activeSubjectFilter
      : currentTest?.subject_id || subjects[0]?.id || ''
  );
  const [isDragOver, setIsDragOver] = useState(false);

  // Parsing result & questions state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [reviewFilter, setReviewFilter] = useState<'all' | 'valid' | 'needs_review' | 'duplicate'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Question currently being edited
  const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectFile = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
  };

  // Step 1 -> Step 2: Upload and Parse File via API
  const handleStartParsing = async () => {
    if (!selectedFile || !currentTest) return;

    setStep('processing');
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('seriesId', seriesId);
    formData.append('testId', currentTest.id);
    if (defaultSubjectId) {
      formData.append('defaultSubjectId', defaultSubjectId);
    }

    try {
      const res = await fetch('/api/admin/test-series/import-parse', {
        method: 'POST',
        body: formData,
      });

      const data: ParseResult = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process file');
      }

      setParseResult(data);
      setQuestions(data.questions);

      // Pre-select all valid questions
      const validIds = new Set<string>();
      data.questions.forEach((q) => {
        if (q.status === 'valid') {
          validIds.add(q.id);
        }
      });
      setSelectedQuestionIds(validIds);

      setStep('review');
    } catch (err: any) {
      console.error('File parsing failed:', err);
      setErrorMsg(err.message || 'Could not parse questions from file.');
      setStep('upload');
    }
  };

  // Re-validate a question after edit
  const revalidateQuestion = (q: ParsedQuestion): ParsedQuestion => {
    const issues: string[] = [];
    if (!q.question_text.trim()) issues.push('Question text missing');
    if (!q.option_a.trim()) issues.push('Missing Option A');
    if (!q.option_b.trim()) issues.push('Missing Option B');
    if (!q.option_c.trim()) issues.push('Missing Option C');
    if (!q.option_d.trim()) issues.push('Missing Option D');
    if (!q.correct_option) issues.push('Missing Correct Answer');
    if (!q.subject_id) issues.push('Subject not detected (please select subject)');

    let status: 'valid' | 'needs_review' | 'duplicate' = 'valid';
    if (q.is_duplicate) {
      status = 'duplicate';
    } else if (issues.length > 0) {
      status = 'needs_review';
    }

    return {
      ...q,
      validation_issues: issues,
      status,
    };
  };

  // Save changes from Question Edit Sub-Modal
  const handleSaveQuestionEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    const validated = revalidateQuestion(editingQuestion);
    setQuestions((prev) => prev.map((q) => (q.id === validated.id ? validated : q)));

    // If it became valid, auto-select it
    if (validated.status === 'valid') {
      setSelectedQuestionIds((prev) => new Set(prev).add(validated.id));
    }

    setEditingQuestion(null);
  };

  // Delete question from review list
  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Change subject for a single question
  const handleQuestionSubjectChange = (id: string, newSubjectId: string) => {
    const subName = subjects.find((s) => s.id === newSubjectId)?.name || '';
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const updated = { ...q, subject_id: newSubjectId, subject_name: subName };
        return revalidateQuestion(updated);
      })
    );
  };

  // Bulk assign selected questions to subject
  const handleBulkAssignSubject = (subId: string) => {
    if (!subId) return;
    const subName = subjects.find((s) => s.id === subId)?.name || '';
    setQuestions((prev) =>
      prev.map((q) => {
        if (!selectedQuestionIds.has(q.id)) return q;
        const updated = { ...q, subject_id: subId, subject_name: subName };
        return revalidateQuestion(updated);
      })
    );
  };

  // Toggle selection
  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllValid = () => {
    const validIds = new Set<string>();
    questions.forEach((q) => {
      if (q.status === 'valid') validIds.add(q.id);
    });
    setSelectedQuestionIds(validIds);
  };

  const handleSelectAllVisible = () => {
    const ids = new Set<string>(selectedQuestionIds);
    filteredQuestions.forEach((q) => ids.add(q.id));
    setSelectedQuestionIds(ids);
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds(new Set());
  };

  // Filter questions for display
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (reviewFilter === 'valid') return q.status === 'valid';
      if (reviewFilter === 'needs_review') return q.status === 'needs_review';
      if (reviewFilter === 'duplicate') return q.status === 'duplicate';
      return true;
    });
  }, [questions, reviewFilter]);

  // Counts
  const validCount = useMemo(() => questions.filter((q) => q.status === 'valid').length, [questions]);
  const reviewCount = useMemo(() => questions.filter((q) => q.status === 'needs_review').length, [questions]);
  const duplicateCount = useMemo(() => questions.filter((q) => q.status === 'duplicate').length, [questions]);

  // Step 3 -> Step 4: Import selected / valid questions
  const handleCommitImport = async (importMode: 'selected' | 'all_valid') => {
    if (!currentTest) return;

    const targetList =
      importMode === 'selected'
        ? questions.filter((q) => selectedQuestionIds.has(q.id))
        : questions.filter((q) => q.status === 'valid');

    if (targetList.length === 0) {
      alert('No questions selected for import.');
      return;
    }

    // Check if any selected question has critical issues
    const invalidInSelected = targetList.filter((q) => !q.question_text || !q.correct_option || !q.option_a);
    if (invalidInSelected.length > 0) {
      if (
        !window.confirm(
          `${invalidInSelected.length} of the selected questions have incomplete options or answers. Import anyway?`
        )
      ) {
        return;
      }
    }

    setStep('importing');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/test-series/import-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: currentTest.id,
          seriesId,
          questions: targetList.map((q) => ({
            subject_id: q.subject_id,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_option: q.correct_option,
            explanation: q.explanation,
            marks: q.marks,
            negative_marks: q.negative_marks,
            language: q.language,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import questions');
      }

      onSuccess(data.count || targetList.length);
      onClose();
    } catch (err: any) {
      console.error('Import commit error:', err);
      setErrorMsg(err.message || 'Could not import questions to database.');
      setStep('review');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📥</span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Smart Question Import
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Target Test: <span className="font-semibold text-brand-primary">{currentTest?.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Body based on current Step */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {/* ================================================================= */}
          {/* STEP 1: UPLOAD */}
          {/* ================================================================= */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Supported Formats Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/60 dark:to-indigo-950/40 p-4 rounded-xl border border-blue-100 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white mb-2">
                  ✨ Supported Question Document & Image Types:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-medium">
                  <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                    <span>📄</span> PDF (Text & Scanned OCR)
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                    <span>📝</span> Word (.docx)
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                    <span>📊</span> Excel & CSV (.xlsx, .csv)
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                    <span>🖼️</span> Images (.jpg, .jpeg, .png OCR)
                  </div>
                </div>
              </div>

              {/* Default Subject Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Default Subject (used when subject is not detected in file)
                </label>
                <select
                  value={defaultSubjectId}
                  onChange={(e) => setDefaultSubjectId(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  If your document contains subject headings (e.g. COMPUTER, GENERAL KNOWLEDGE), they will be automatically detected!
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-brand-primary bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-950/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleSelectFile(e.target.files[0]);
                    }
                  }}
                />
                <span className="text-4xl block mb-3">📁</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedFile ? selectedFile.name : 'Choose a file or drag and drop here'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Supports PDF, DOCX, XLSX, CSV, JPG, JPEG, and PNG files up to 25MB
                </p>
                {selectedFile && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    ✓ Selected: {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: PROCESSING */}
          {/* ================================================================= */}
          {step === 'processing' && (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-brand-primary dark:border-slate-700 dark:border-t-brand-primary" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Parsing & Extracting Questions...
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Processing document content, recognizing questions, options, answers, subject sections, and running OCR if required.
              </p>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: REVIEW & PREVIEW */}
          {/* ================================================================= */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="block text-2xl font-black text-slate-900 dark:text-white">
                    {questions.length}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Total Detected
                  </span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="block text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {validCount}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase">
                    Valid (Ready)
                  </span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="block text-2xl font-black text-amber-600 dark:text-amber-400">
                    {reviewCount}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase">
                    Needs Review
                  </span>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                  <span className="block text-2xl font-black text-purple-600 dark:text-purple-400">
                    {duplicateCount}
                  </span>
                  <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase">
                    Duplicates
                  </span>
                </div>
              </div>

              {/* Detected Column Mapping for Excel */}
              {parseResult?.detected_column_mapping && Object.keys(parseResult.detected_column_mapping).length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    📊 Detected Excel Columns:
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {Object.entries(parseResult.detected_column_mapping).map(([k, v]) => (
                      <span key={k} className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <b>{k}:</b> &ldquo;{v}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter Tabs & Bulk Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setReviewFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reviewFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('valid')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reviewFilter === 'valid'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Valid ({validCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('needs_review')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reviewFilter === 'needs_review'
                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Needs Review ({reviewCount})
                  </button>
                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setReviewFilter('duplicate')}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        reviewFilter === 'duplicate'
                          ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Duplicates ({duplicateCount})
                    </button>
                  )}
                </div>

                {/* Bulk tools */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllValid}
                    className="text-brand-primary hover:underline font-semibold"
                  >
                    Select Valid ({validCount})
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-slate-600 dark:text-slate-400 hover:underline"
                  >
                    Select All Visible
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-slate-600 dark:text-slate-400 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Bulk Subject Assignment Bar */}
              {selectedQuestionIds.size > 0 && (
                <div className="bg-blue-50/80 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    {selectedQuestionIds.size} questions selected
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Assign to:</span>
                    <select
                      onChange={(e) => handleBulkAssignSubject(e.target.value)}
                      defaultValue=""
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="" disabled>
                        Choose Subject
                      </option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Questions List */}
              <div className="space-y-3">
                {filteredQuestions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No questions in this filter tab.
                  </div>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const isSelected = selectedQuestionIds.has(q.id);

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          q.status === 'valid'
                            ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            : q.status === 'duplicate'
                            ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/20'
                            : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectQuestion(q.id)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <div className="space-y-1.5">
                              {/* Top Bar: Question #, Subject, Status */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  #{idx + 1}
                                </span>

                                {/* Subject Selector */}
                                <select
                                  value={q.subject_id || ''}
                                  onChange={(e) => handleQuestionSubjectChange(q.id, e.target.value)}
                                  className="text-[11px] font-semibold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                                >
                                  <option value="">Subject not detected</option>
                                  {subjects.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>

                                {/* Status Badge */}
                                {q.status === 'valid' ? (
                                  <span className="text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                    ✓ Valid
                                  </span>
                                ) : q.status === 'duplicate' ? (
                                  <span className="text-[11px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                    ⚠️ Possible Duplicate
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                                    ⚠️ Needs Review
                                  </span>
                                )}
                              </div>

                              {/* Issues list if any */}
                              {q.validation_issues.length > 0 && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                  Issues: {q.validation_issues.join(', ')}
                                </p>
                              )}

                              {/* Question Text */}
                              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                                {q.question_text || <span className="text-rose-500 italic">[Empty Question Text]</span>}
                              </p>

                              {/* Options */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                                <div
                                  className={`p-2 rounded border ${
                                    q.correct_option === 'A'
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="font-bold mr-1">A.</span> {q.option_a || '—'}
                                </div>
                                <div
                                  className={`p-2 rounded border ${
                                    q.correct_option === 'B'
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="font-bold mr-1">B.</span> {q.option_b || '—'}
                                </div>
                                <div
                                  className={`p-2 rounded border ${
                                    q.correct_option === 'C'
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="font-bold mr-1">C.</span> {q.option_c || '—'}
                                </div>
                                <div
                                  className={`p-2 rounded border ${
                                    q.correct_option === 'D'
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="font-bold mr-1">D.</span> {q.option_d || '—'}
                                </div>
                              </div>

                              {/* Explanation if present */}
                              {q.explanation && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded">
                                  💡 <b>Explanation:</b> {q.explanation}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Edit, Delete */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingQuestion({ ...q })}
                              className="p-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"
                              title="Edit question"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                              title="Delete from import"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: IMPORTING IN PROGRESS */}
          {/* ================================================================= */}
          {step === 'importing' && (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-500 dark:border-slate-700 dark:border-t-emerald-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Importing Questions into Database...
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Saving questions, assigning subjects, and ordering items for &ldquo;{currentTest?.title}&rdquo;.
              </p>
            </div>
          )}
        </div>

        {/* Viewport-Safe Sticky Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
          {step === 'upload' && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleStartParsing}
                disabled={!selectedFile}
              >
                Process & Extract Questions →
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                  ← Upload Different File
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCommitImport('selected')}
                  disabled={selectedQuestionIds.size === 0}
                >
                  Import Selected ({selectedQuestionIds.size})
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCommitImport('all_valid')}
                  disabled={validCount === 0}
                >
                  Import All Valid ({validCount})
                </Button>
              </div>
            </>
          )}

          {(step === 'processing' || step === 'importing') && (
            <div className="w-full flex justify-end">
              <span className="text-xs text-slate-500 italic">Please wait...</span>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-MODAL: EDIT QUESTION INLINE */}
      {/* =================================================================== */}
      {editingQuestion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white">Edit Extracted Question</h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuestionEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Subject *
                  </label>
                  <select
                    value={editingQuestion.subject_id || ''}
                    onChange={(e) => {
                      const sId = e.target.value;
                      const sName = subjects.find((s) => s.id === sId)?.name || '';
                      setEditingQuestion({ ...editingQuestion, subject_id: sId, subject_name: sName });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
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
                    rows={3}
                    value={editingQuestion.question_text}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, question_text: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Options A & B */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Option A *
                    </label>
                    <input
                      type="text"
                      value={editingQuestion.option_a}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, option_a: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Option B *
                    </label>
                    <input
                      type="text"
                      value={editingQuestion.option_b}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, option_b: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Options C & D */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Option C *
                    </label>
                    <input
                      type="text"
                      value={editingQuestion.option_c}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, option_c: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Option D *
                    </label>
                    <input
                      type="text"
                      value={editingQuestion.option_d}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, option_d: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Correct Option */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Correct Option *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setEditingQuestion({ ...editingQuestion, correct_option: opt })}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          editingQuestion.correct_option === opt
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
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
                    value={editingQuestion.explanation}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
                <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
