export type QuestionValidationStatus = 'valid' | 'needs_review' | 'invalid' | 'duplicate';

export interface DetectedSection {
  id: string;
  name: string;
  total_questions: number;
  from_question: number;
  to_question: number;
  has_answer_key: boolean;
}

export interface ParsedQuestion {
  id: string; // Client/preview unique ID
  order: number;
  question_number?: number; // Parsed question number from the document (e.g. 1, 101)
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
  section_id?: string;
  section_name?: string; // Detected practice set or section name (e.g., "Practice Set-1")
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
  invalid_count?: number;
  duplicate_count: number;
  detected_subjects: string[];
  sections?: DetectedSection[];
  selected_section_id?: string;
  detected_column_mapping?: Record<string, string>;
  requested_range?: { from: number; to: number };
  total_requested?: number;
  found_question_numbers?: number[];
  missing_question_numbers?: number[];
  is_range_complete?: boolean;
  file_id?: string;
  is_scanned?: boolean;
  warnings?: string[];
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

export interface CreateSeriesFromPdfCommitPayload {
  existingSeriesId?: string | null;
  series: {
    title: string;
    description?: string | null;
    thumbnail_url?: string | null;
    is_paid: boolean;
    is_published: boolean;
    order?: number;
  };
  subjectName: string;
  test: {
    title: string;
    date_label?: string | null;
    duration_minutes: number;
    max_marks: number;
    marks_per_correct: number;
    negative_marks: number;
    language: string;
    instructions?: string | null;
    is_paid: boolean;
    price: number;
    is_published: boolean;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
  };
  questions: Array<{
    question_number?: number;
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
  sourceMetadata?: {
    fileName: string;
    fromQuestion: number;
    toQuestion: number;
  };
}

