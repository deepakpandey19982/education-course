import { PDFParse } from 'pdf-parse';
import { extractQuestionsFromText, extractQuestionsWithRangeFromText, TextExtractRangeResult } from './text-extractor';
import { parseImageOcr } from './ocr-parser';
import { ParsedQuestion } from './types';

// Helper to extract embedded JPEG streams from raw PDF buffer if getImage has canvas restrictions
function extractRawJpegsFromPdf(buffer: Buffer): Buffer[] {
  const images: Buffer[] = [];
  let pos = 0;
  while (pos < buffer.length) {
    const start = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]), pos);
    if (start === -1) break;
    const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
    if (end === -1) break;
    const jpegBuf = buffer.slice(start, end + 2);
    // Only consider images larger than 5KB (ignoring tiny icons/masks)
    if (jpegBuf.length > 5120) {
      images.push(jpegBuf);
    }
    pos = end + 2;
  }
  return images;
}

export interface PdfParseOptions {
  fromQuestion?: number;
  toQuestion?: number;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  defaultLanguage?: string;
}

export async function parsePdf(
  buffer: Buffer,
  options: PdfParseOptions = {}
): Promise<{
  questions: ParsedQuestion[];
  pagesProcessed: number;
  parsingMethod: 'text' | 'ocr';
  rawText: string;
  isScanned: boolean;
  rangeInfo?: {
    requested_range?: { from: number; to: number };
    found_question_numbers: number[];
    missing_question_numbers: number[];
    is_range_complete: boolean;
    total_requested: number;
  };
}> {
  const parser = new PDFParse({ data: buffer });
  let pagesProcessed = 1;
  let rawText = '';

  try {
    const textResult = await parser.getText();
    pagesProcessed = textResult?.total || 1;
    rawText = textResult?.text || '';
  } catch (err) {
    console.warn('PDF text extraction warning, falling back to OCR:', err);
  }

  // Check if PDF has meaningful selectable text
  const cleanText = rawText.replace(/\s+/g, ' ').trim();
  const textHasContent = cleanText.length > 60;

  if (textHasContent) {
    const rangeResult = extractQuestionsWithRangeFromText(rawText, options);
    if (rangeResult.questions.length > 0 || (options.fromQuestion !== undefined && rangeResult.found_question_numbers.length >= 0)) {
      return {
        questions: rangeResult.questions,
        pagesProcessed,
        parsingMethod: 'text',
        rawText,
        isScanned: false,
        rangeInfo: {
          requested_range: rangeResult.requested_range,
          found_question_numbers: rangeResult.found_question_numbers,
          missing_question_numbers: rangeResult.missing_question_numbers,
          is_range_complete: rangeResult.is_range_complete,
          total_requested: rangeResult.total_requested,
        },
      };
    }
  }


  // If text is absent or 0 questions were extracted, attempt Scanned / Image PDF OCR
  console.log('PDF has minimal selectable text or 0 questions. Attempting OCR on scanned pages...');
  let ocrQuestions: ParsedQuestion[] = [];
  let combinedOcrText = '';

  // 1. Try getImage from PDFParse
  let imageBuffers: Buffer[] = [];
  try {
    const imgResult = await parser.getImage({ imageBuffer: true });
    if (imgResult && Array.isArray(imgResult.pages)) {
      for (const page of imgResult.pages) {
        if (Array.isArray(page.images)) {
          for (const img of page.images) {
            if (img.data && img.data.length > 5120) {
              imageBuffers.push(Buffer.from(img.data));
            }
          }
        }
      }
    }
  } catch (imgErr) {
    console.warn('PDF getImage error, trying direct stream scan:', imgErr);
  }

  // 2. Fallback to extracting direct JPEG streams if PDFParse getImage found none
  if (imageBuffers.length === 0) {
    imageBuffers = extractRawJpegsFromPdf(buffer);
  }

  if (imageBuffers.length > 0) {
    pagesProcessed = Math.max(pagesProcessed, imageBuffers.length);
    for (let i = 0; i < imageBuffers.length; i++) {
      try {
        const ocrRes = await parseImageOcr(imageBuffers[i], options);
        if (ocrRes.rawText) {
          combinedOcrText += `\n--- Page ${i + 1} ---\n` + ocrRes.rawText;
        }
      } catch (ocrErr) {
        console.error(`OCR failed on page image ${i + 1}:`, ocrErr);
      }
    }

    if (combinedOcrText.trim()) {
      ocrQuestions = extractQuestionsFromText(combinedOcrText, options);
    }
  }

  return {
    questions: ocrQuestions,
    pagesProcessed,
    parsingMethod: 'ocr',
    rawText: combinedOcrText || rawText,
    isScanned: true,
  };
}
