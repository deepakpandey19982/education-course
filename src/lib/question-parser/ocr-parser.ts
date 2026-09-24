import Tesseract from 'tesseract.js';
import { extractQuestionsFromText } from './text-extractor';
import { ParsedQuestion } from './types';

export async function parseImageOcr(
  buffer: Buffer,
  options: {
    defaultMarks?: number;
    defaultNegativeMarks?: number;
    defaultLanguage?: string;
  } = {}
): Promise<{
  questions: ParsedQuestion[];
  rawText: string;
  confidence: number;
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
      return { questions: [], rawText: '', confidence: 0 };
    }

    const extracted = extractQuestionsFromText(rawText, options);

    // If OCR confidence is low (< 70) or text looks suspicious, mark questions as needs_review
    const parsedQuestions = extracted.map((q) => {
      const issues = [...q.validation_issues];
      if (confidence < 70) {
        issues.push(`Low OCR confidence (${Math.round(confidence)}%). Please review carefully.`);
      }
      return {
        ...q,
        validation_issues: issues,
        status: (issues.length > 0 ? 'needs_review' : q.status) as any,
      };
    });

    return {
      questions: parsedQuestions,
      rawText,
      confidence,
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
