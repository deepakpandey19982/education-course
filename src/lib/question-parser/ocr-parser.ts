import Tesseract from 'tesseract.js';
import { extractQuestionsWithRangeFromText, TextExtractOptions, TextExtractRangeResult } from './text-extractor';

export async function parseImageOcr(
  buffer: Buffer,
  options: TextExtractOptions = {}
): Promise<{
  questions: TextExtractRangeResult['questions'];
  rawText: string;
  confidence: number;
  sections?: TextExtractRangeResult['sections'];
  requested_range?: TextExtractRangeResult['requested_range'];
  found_question_numbers?: TextExtractRangeResult['found_question_numbers'];
  missing_question_numbers?: TextExtractRangeResult['missing_question_numbers'];
  is_range_complete?: boolean;
  total_requested?: number;
}> {
  let worker: any = null;
  try {
    // Try English + Hindi first for Indian test series, fallback to English if network/lang issue
    try {
      worker = await Tesseract.createWorker(['eng', 'hin'], 1, {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      });
    } catch {
      worker = await Tesseract.createWorker('eng');
    }

    const { data } = await worker.recognize(buffer);
    const rawText = data?.text || '';
    const confidence = data?.confidence || 0;

    await worker.terminate();
    worker = null;

    if (!rawText.trim()) {
      return {
        questions: [],
        rawText: '',
        confidence: 0,
        found_question_numbers: [],
        missing_question_numbers: [],
        is_range_complete: false,
        total_requested: 0,
      };
    }

    const rangeResult = extractQuestionsWithRangeFromText(rawText, options);

    // If OCR confidence is low (< 70) or text looks suspicious, mark questions as needs_review
    const parsedQuestions = rangeResult.questions.map((q) => {
      const issues = [...q.validation_issues];
      if (confidence < 70) {
        issues.push(`Low OCR confidence (${Math.round(confidence)}%). Please review carefully.`);
      }
      return {
        ...q,
        validation_issues: issues,
        status: (issues.length > 0 && q.status === 'valid' ? 'needs_review' : q.status) as any,
      };
    });

    return {
      questions: parsedQuestions,
      rawText,
      confidence,
      sections: rangeResult.sections,
      requested_range: rangeResult.requested_range,
      found_question_numbers: rangeResult.found_question_numbers,
      missing_question_numbers: rangeResult.missing_question_numbers,
      is_range_complete: rangeResult.is_range_complete,
      total_requested: rangeResult.total_requested,
    };
  } catch (error) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
    }
    throw error;
  }
}
