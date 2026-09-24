export type QuestionValidationStatus = 'valid' | 'needs_review' | 'duplicate';

export interface ParsedQuestion {
  id: string; // Client/preview unique ID
  order: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D' | null;
  explanation: string;
  marks: number;
  negative_marks: number;
  language: string;
  subject_id: string | null;
  subject_name: string; // Detected subject name (e.g., "Computer", "General Awareness")
  status: QuestionValidationStatus;
  validation_issues: string[];
  is_duplicate: boolean;
  raw_snippet?: string;
}

export interface ParseResult {
  success: boolean;
  error?: string;
  file_name: string;
  file_type: string;
  parsing_method: 'text' | 'ocr' | 'excel' | 'docx';
  pages_or_rows_processed: number;
  questions_detected: number;
  valid_questions_count: number;
  needs_review_count: number;
  duplicate_count: number;
  detected_subjects: string[];
  detected_column_mapping?: Record<string, string>;
  questions: ParsedQuestion[];
}

export interface QuestionImportCommitPayload {
  testId: string;
  seriesId: string;
  questions: Array<{
    subject_id?: string | null;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: 'A' | 'B' | 'C' | 'D';
    explanation?: string | null;
    marks?: number;
    negative_marks?: number;
    language?: string;
    order?: number;
  }>;
}
