import { ParsedQuestion, ParseResult } from './types';
import { extractQuestionsFromText, extractQuestionsWithRangeFromText } from './text-extractor';
import { parseExcelOrCsv } from './excel-csv-parser';
import { parseDocx } from './docx-parser';
import { parsePdf } from './pdf-parser';
import { parseImageOcr } from './ocr-parser';

export * from './types';
export * from './text-extractor';
export * from './excel-csv-parser';
export * from './docx-parser';
export * from './pdf-parser';
export * from './ocr-parser';

// String normalizer for duplicate comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match detected subject string to existing subjects in the series
export function matchSubject(
  detectedName: string,
  seriesSubjects: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  if (!detectedName || !detectedName.trim() || !seriesSubjects || seriesSubjects.length === 0) {
    return null;
  }

  const cleanDetected = detectedName.toLowerCase().trim();

  // 1. Exact match
  const exact = seriesSubjects.find((s) => s.name.toLowerCase().trim() === cleanDetected);
  if (exact) return exact;

  // 2. Contains match (e.g., "Computer Knowledge" matches "Computer")
  const contains = seriesSubjects.find(
    (s) =>
      cleanDetected.includes(s.name.toLowerCase().trim()) ||
      s.name.toLowerCase().trim().includes(cleanDetected)
  );
  if (contains) return contains;

  // 3. Normalized alias matching
  const aliases: Record<string, string[]> = {
    computer: ['computer operator', 'computer awareness', 'computer science', 'it', 'कंप्यूटर'],
    'general awareness': ['gk', 'general knowledge', 'current affairs', 'सामान्य ज्ञान', 'सामान्य चेतना'],
    reasoning: ['mental aptitude', 'logical reasoning', 'mental ability', 'तर्कशक्ति'],
    mathematics: ['quant', 'quantitative aptitude', 'maths', 'गणित'],
    hindi: ['सामान्य हिंदी', 'hindi language'],
    english: ['general english', 'english comprehension'],
  };

  for (const [key, aliasList] of Object.entries(aliases)) {
    const isTarget = aliasList.some((a) => cleanDetected.includes(a)) || cleanDetected.includes(key);
    if (isTarget) {
      const match = seriesSubjects.find(
        (s) => s.name.toLowerCase().includes(key) || aliasList.some((a) => s.name.toLowerCase().includes(a))
      );
      if (match) return match;
    }
  }

  return null;
}

export async function parseQuestionFile(
  buffer: Buffer,
  fileName: string,
  options: {
    fromQuestion?: number;
    toQuestion?: number;
    seriesSubjects?: Array<{ id: string; name: string }>;
    existingQuestions?: Array<{ id?: string; question_text: string }>;
    defaultSubjectId?: string;
    defaultSubjectName?: string;
    defaultMarks?: number;
    defaultNegativeMarks?: number;
    defaultLanguage?: string;
  } = {}
): Promise<ParseResult> {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const seriesSubjects = options.seriesSubjects || [];
  const existingQuestions = options.existingQuestions || [];
  const defaultSubId = options.defaultSubjectId || '';
  const defaultSubName = options.defaultSubjectName || '';

  let rawQuestions: ParsedQuestion[] = [];
  let pagesOrRows = 1;
  let parsingMethod: 'text' | 'ocr' | 'excel' | 'docx' = 'text';
  let detectedColumnMapping: Record<string, string> | undefined;
  let rangeInfo: {
    requested_range?: { from: number; to: number };
    found_question_numbers: number[];
    missing_question_numbers: number[];
    is_range_complete: boolean;
    total_requested: number;
  } | undefined;

  try {
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      parsingMethod = 'excel';
      const parsed = parseExcelOrCsv(buffer, {
        defaultMarks: options.defaultMarks,
        defaultNegativeMarks: options.defaultNegativeMarks,
        defaultLanguage: options.defaultLanguage,
      });
      rawQuestions = parsed.questions;
      pagesOrRows = parsed.rowCount;
      detectedColumnMapping = parsed.detectedMapping;

      if (options.fromQuestion !== undefined && options.toQuestion !== undefined) {
        const fromQ = Math.min(options.fromQuestion, options.toQuestion);
        const toQ = Math.max(options.fromQuestion, options.toQuestion);
        rawQuestions = rawQuestions.filter(
          (q) => (q.question_number ?? q.order) >= fromQ && (q.question_number ?? q.order) <= toQ
        );
      }
    } else if (ext === 'docx') {
      parsingMethod = 'docx';
      const parsed = await parseDocx(buffer, {
        defaultMarks: options.defaultMarks,
        defaultNegativeMarks: options.defaultNegativeMarks,
        defaultLanguage: options.defaultLanguage,
      });
      rawQuestions = parsed.questions;

      if (options.fromQuestion !== undefined && options.toQuestion !== undefined) {
        const fromQ = Math.min(options.fromQuestion, options.toQuestion);
        const toQ = Math.max(options.fromQuestion, options.toQuestion);
        rawQuestions = rawQuestions.filter(
          (q) => (q.question_number ?? q.order) >= fromQ && (q.question_number ?? q.order) <= toQ
        );
      }
    } else if (ext === 'pdf') {
      const parsed = await parsePdf(buffer, {
        fromQuestion: options.fromQuestion,
        toQuestion: options.toQuestion,
        defaultMarks: options.defaultMarks,
        defaultNegativeMarks: options.defaultNegativeMarks,
        defaultLanguage: options.defaultLanguage,
      });
      rawQuestions = parsed.questions;
      pagesOrRows = parsed.pagesProcessed;
      parsingMethod = parsed.parsingMethod;
      rangeInfo = parsed.rangeInfo;
    } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
      parsingMethod = 'ocr';
      const parsed = await parseImageOcr(buffer, {
        defaultMarks: options.defaultMarks,
        defaultNegativeMarks: options.defaultNegativeMarks,
        defaultLanguage: options.defaultLanguage,
      });
      rawQuestions = parsed.questions;

      if (options.fromQuestion !== undefined && options.toQuestion !== undefined) {
        const fromQ = Math.min(options.fromQuestion, options.toQuestion);
        const toQ = Math.max(options.fromQuestion, options.toQuestion);
        rawQuestions = rawQuestions.filter(
          (q) => (q.question_number ?? q.order) >= fromQ && (q.question_number ?? q.order) <= toQ
        );
      }
    } else {
      // Fallback: try raw text parse
      const text = buffer.toString('utf-8');
      const textRes = extractQuestionsWithRangeFromText(text, options);
      rawQuestions = textRes.questions;
      rangeInfo = {
        requested_range: textRes.requested_range,
        found_question_numbers: textRes.found_question_numbers,
        missing_question_numbers: textRes.missing_question_numbers,
        is_range_complete: textRes.is_range_complete,
        total_requested: textRes.total_requested,
      };
    }
  } catch (err: any) {
    console.error('File parsing error:', err);
    return {
      success: false,
      error: `Failed to parse ${fileName}: ${err.message || 'Unknown parsing error'}`,
      file_name: fileName,
      file_type: ext,
      parsing_method: parsingMethod,
      pages_or_rows_processed: 0,
      questions_detected: 0,
      valid_questions_count: 0,
      needs_review_count: 0,
      duplicate_count: 0,
      detected_subjects: [],
      questions: [],
    };
  }


  if (rawQuestions.length === 0) {
    return {
      success: false,
      error: `No questions could be detected in "${fileName}". Please ensure the file follows standard formats (e.g. Q1., 1., options A-D, Answer: B).`,
      file_name: fileName,
      file_type: ext,
      parsing_method: parsingMethod,
      pages_or_rows_processed: pagesOrRows,
      questions_detected: 0,
      valid_questions_count: 0,
      needs_review_count: 0,
      duplicate_count: 0,
      detected_subjects: [],
      questions: [],
    };
  }

  // Pre-calculate normalized text set of existing database questions
  const existingSet = new Set<string>();
  existingQuestions.forEach((eq) => {
    if (eq.question_text) {
      existingSet.add(normalizeText(eq.question_text));
    }
  });

  const seenInBatch = new Set<string>();
  const detectedSubjectSet = new Set<string>();

  // Process subject matching, duplicates, and final validation status
  const finalQuestions: ParsedQuestion[] = rawQuestions.map((q, idx) => {
    let subjectId: string | null = null;
    let subjectName = q.subject_name || '';

    // Match detected subject name if present
    if (subjectName) {
      detectedSubjectSet.add(subjectName);
      const matched = matchSubject(subjectName, seriesSubjects);
      if (matched) {
        subjectId = matched.id;
        subjectName = matched.name;
      }
    }

    // If subject was not matched from text/header, check default subject
    if (!subjectId && defaultSubId) {
      subjectId = defaultSubId;
      const foundDefault = seriesSubjects.find((s) => s.id === defaultSubId);
      if (foundDefault) {
        subjectName = foundDefault.name;
      }
    }

    if (!subjectName && defaultSubName) {
      subjectName = defaultSubName;
    }

    const issues = [...q.validation_issues];

    // Check if subject is still missing
    if (!subjectId && !subjectName) {
      issues.push('Subject not detected (please select subject)');
    }

    // Duplicate detection
    const normText = normalizeText(q.question_text);
    let isDuplicate = false;

    if (normText.length > 10) {
      if (existingSet.has(normText)) {
        isDuplicate = true;
        issues.push('Possible duplicate of existing test question');
      } else if (seenInBatch.has(normText)) {
        isDuplicate = true;
        issues.push('Possible duplicate of another question in this upload');
      }
      seenInBatch.add(normText);
    }

    // Determine final status
    let status: 'valid' | 'needs_review' | 'duplicate' = 'valid';
    if (isDuplicate) {
      status = 'duplicate';
    } else if (issues.length > 0) {
      status = 'needs_review';
    }

    return {
      ...q,
      order: idx + 1,
      subject_id: subjectId,
      subject_name: subjectName,
      validation_issues: Array.from(new Set(issues)),
      is_duplicate: isDuplicate,
      status,
    };
  });

  const validCount = finalQuestions.filter((q) => q.status === 'valid').length;
  const duplicateCount = finalQuestions.filter((q) => q.status === 'duplicate').length;
  const reviewCount = finalQuestions.filter((q) => q.status === 'needs_review').length;

  let finalRangeInfo = rangeInfo;
  if (!finalRangeInfo && options.fromQuestion !== undefined && options.toQuestion !== undefined) {
    const fromQ = Math.min(options.fromQuestion, options.toQuestion);
    const toQ = Math.max(options.fromQuestion, options.toQuestion);
    const totalRequested = toQ - fromQ + 1;
    const foundNumSet = new Set(
      finalQuestions.map((q) => q.question_number ?? q.order)
    );
    const foundNumbers: number[] = [];
    const missingNumbers: number[] = [];
    for (let n = fromQ; n <= toQ; n++) {
      if (foundNumSet.has(n)) {
        foundNumbers.push(n);
      } else {
        missingNumbers.push(n);
      }
    }
    finalRangeInfo = {
      requested_range: { from: fromQ, to: toQ },
      total_requested: totalRequested,
      found_question_numbers: foundNumbers,
      missing_question_numbers: missingNumbers,
      is_range_complete: missingNumbers.length === 0,
    };
  }

  return {
    success: true,
    file_name: fileName,
    file_type: ext,
    parsing_method: parsingMethod,
    pages_or_rows_processed: pagesOrRows,
    questions_detected: finalQuestions.length,
    valid_questions_count: validCount,
    needs_review_count: reviewCount,
    duplicate_count: duplicateCount,
    detected_subjects: Array.from(detectedSubjectSet),
    detected_column_mapping: detectedColumnMapping,
    requested_range: finalRangeInfo?.requested_range,
    total_requested: finalRangeInfo?.total_requested,
    found_question_numbers: finalRangeInfo?.found_question_numbers,
    missing_question_numbers: finalRangeInfo?.missing_question_numbers,
    is_range_complete: finalRangeInfo?.is_range_complete,
    questions: finalQuestions,
  };
}

