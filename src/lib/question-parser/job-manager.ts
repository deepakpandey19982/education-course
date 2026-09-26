import crypto from 'crypto';
import { parseQuestionFile, ParseResult } from './index';

export type FormatterJobStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'EXTRACTING_TEXT'
  | 'DETECTING_SECTIONS'
  | 'DETECTING_QUESTIONS'
  | 'DETECTING_ANSWER_KEY'
  | 'MATCHING_ANSWERS'
  | 'VALIDATING'
  | 'READY_FOR_PREVIEW'
  | 'FAILED';

export interface FormatterJob {
  id: string;
  status: FormatterJobStatus;
  progressPercent: number; // 0 to 100
  message: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  result?: ParseResult & {
    existing_series_list?: Array<{ id: string; title: string; is_paid?: boolean }>;
    existing_tests_list?: Array<{
      id: string;
      title: string;
      test_series_id?: string;
      duration_minutes?: number;
      max_marks?: number;
    }>;
  };
}

// In-memory registry for background jobs (1 hour TTL)
const jobRegistry = new Map<string, FormatterJob>();

function cleanupExpiredJobs(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobRegistry.entries()) {
    if (job.updatedAt < oneHourAgo) {
      jobRegistry.delete(id);
    }
  }
}

export function createJob(fileName: string): FormatterJob {
  cleanupExpiredJobs();
  const id = `job_${crypto.randomBytes(8).toString('hex')}`;
  const job: FormatterJob = {
    id,
    status: 'QUEUED',
    progressPercent: 5,
    message: 'Job queued for background processing...',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobRegistry.set(id, job);
  return job;
}

export function getJob(id: string): FormatterJob | null {
  return jobRegistry.get(id) || null;
}

export function updateJob(id: string, updates: Partial<FormatterJob>): FormatterJob | null {
  const job = jobRegistry.get(id);
  if (!job) return null;

  Object.assign(job, updates, { updatedAt: Date.now() });
  return job;
}

/**
 * Executes file parsing in the background asynchronously, updating job status and progress.
 */
export async function executeJobInBackground(
  jobId: string,
  buffer: Buffer,
  fileName: string,
  options: {
    fromQuestion?: number;
    toQuestion?: number;
    sectionId?: string;
    seriesSubjects?: Array<{ id: string; name: string }>;
    existingQuestions?: Array<{ id?: string; question_text: string }>;
    defaultSubjectName?: string;
    defaultMarks?: number;
    defaultNegativeMarks?: number;
    defaultLanguage?: string;
    existingSeriesList?: Array<{ id: string; title: string; is_paid?: boolean }>;
    existingTestsList?: Array<{
      id: string;
      title: string;
      test_series_id?: string;
      duration_minutes?: number;
      max_marks?: number;
    }>;
  }
): Promise<void> {
  updateJob(jobId, {
    status: 'EXTRACTING_TEXT',
    progressPercent: 15,
    message: 'Extracting text from question document...',
  });

  try {
    const parseResult = await parseQuestionFile(buffer, fileName, {
      fromQuestion: options.fromQuestion,
      toQuestion: options.toQuestion,
      sectionId: options.sectionId,
      seriesSubjects: options.seriesSubjects || [],
      existingQuestions: options.existingQuestions || [],
      defaultSubjectName: options.defaultSubjectName,
      defaultMarks: options.defaultMarks,
      defaultNegativeMarks: options.defaultNegativeMarks,
      defaultLanguage: options.defaultLanguage,
      onProgress: (evt) => {
        let status: FormatterJobStatus = 'EXTRACTING_TEXT';
        let pct = 25;

        if (evt.stage === 'reading' || evt.stage === 'probing' || evt.stage === 'extracting') {
          status = 'EXTRACTING_TEXT';
          pct = 25;
        } else if (evt.stage === 'detecting_sections') {
          status = 'DETECTING_SECTIONS';
          pct = 40;
        } else if (evt.stage === 'detecting_questions' || evt.stage === 'found_question') {
          status = 'DETECTING_QUESTIONS';
          pct = 55;
        } else if (evt.stage === 'detecting_answer_key') {
          status = 'DETECTING_ANSWER_KEY';
          pct = 70;
        } else if (evt.stage === 'matching_answers') {
          status = 'MATCHING_ANSWERS';
          pct = 80;
        } else if (evt.stage === 'validating' || evt.stage === 'preparing') {
          status = 'VALIDATING';
          pct = 90;
        } else if (evt.stage === 'ocr_scanned') {
          status = 'EXTRACTING_TEXT';
          pct = 35;
        }

        updateJob(jobId, {
          status,
          progressPercent: pct,
          message: evt.message,
        });
      },
    });

    if (!parseResult.success) {
      updateJob(jobId, {
        status: 'FAILED',
        progressPercent: 100,
        message: parseResult.error || 'Failed to detect questions in file.',
        error: parseResult.error || 'Failed to detect questions in file.',
      });
      return;
    }

    // Attach contextual lists for frontend dropdowns
    const finalResult = {
      ...parseResult,
      existing_series_list: options.existingSeriesList || [],
      existing_tests_list: options.existingTestsList || [],
    };

    updateJob(jobId, {
      status: 'READY_FOR_PREVIEW',
      progressPercent: 100,
      message: `Successfully extracted ${parseResult.questions_detected} questions. Ready for preview!`,
      result: finalResult,
    });
  } catch (err: any) {
    console.error(`Background job ${jobId} error:`, err);
    updateJob(jobId, {
      status: 'FAILED',
      progressPercent: 100,
      message: err.message || 'An unexpected error occurred during processing.',
      error: err.message || 'An unexpected error occurred during processing.',
    });
  }
}
