import { PDFParse } from 'pdf-parse';
import { extractQuestionsFromText, extractQuestionsWithRangeFromText, TextExtractRangeResult } from './text-extractor';
import { parseImageOcr } from './ocr-parser';
import { ParsedQuestion } from './types';

// In-memory cache for large PDF buffers (15-minute TTL) to avoid repeated uploads over the wire
const pdfBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();

export function cachePdfBuffer(id: string, buffer: Buffer): void {
  const now = Date.now();
  // Clean expired entries
  for (const [k, v] of pdfBufferCache.entries()) {
    if (now - v.timestamp > 15 * 60 * 1000) {
      pdfBufferCache.delete(k);
    }
  }
  pdfBufferCache.set(id, { buffer, timestamp: now });
}

export function getCachedPdfBuffer(id: string): Buffer | null {
  const item = pdfBufferCache.get(id);
  if (!item) return null;
  if (Date.now() - item.timestamp > 15 * 60 * 1000) {
    pdfBufferCache.delete(id);
    return null;
  }
  return item.buffer;
}

export interface PdfProgressEvent {
  stage:
    | 'reading'
    | 'probing'
    | 'extracting'
    | 'detecting_sections'
    | 'detecting_questions'
    | 'detecting_answer_key'
    | 'matching_answers'
    | 'validating'
    | 'found_question'
    | 'preparing'
    | 'ocr_scanned';
  message: string;
  currentQuestion?: number;
  totalPages?: number;
  currentPage?: number;
}

export interface PdfParseOptions {
  fromQuestion?: number;
  toQuestion?: number;
  sectionId?: string;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  defaultLanguage?: string;
  onProgress?: (event: PdfProgressEvent) => void;
}

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

// Fast scanner to detect question numbers present on a single text string
function scanQuestionNumbers(text: string): number[] {
  const nums: number[] = [];
  // Match Q1., Q.1, Question 1, 1., 1) etc.
  const regex = /(?:(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)(?:\s*(?:no\.?|संख्या|सं\.?|क्र\.?|number|num\.?))?\s*(\d{1,5})|(?:\b|^)(\d{1,5})\s*[\.\:\-\)])/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1] || match[2], 10);
    if (!isNaN(num) && num > 0) {
      nums.push(num);
    }
  }
  return nums;
}

/**
 * Generic column-aware text extractor for a PDF page.
 * Detects whether a page has two columns (left and right) separated by a gutter.
 * If two columns are detected, items are ordered Column 1 (top to bottom),
 * followed by Column 2 (top to bottom), preserving top headers and bottom footers.
 */
export function extractPageTextColumnAware(items: any[], viewportWidth: number, viewportHeight: number): string {
  if (!items || items.length === 0) return '';
  const textItems = items.filter((it: any) => typeof it.str === 'string' && it.str.length > 0);
  if (textItems.length === 0) return '';

  const midX = viewportWidth / 2;
  const topHeaderThreshold = viewportHeight * 0.92;
  const bottomFooterThreshold = viewportHeight * 0.06;

  const topItems: any[] = [];
  const bottomItems: any[] = [];
  const colLeftItems: any[] = [];
  const colRightItems: any[] = [];

  for (const it of textItems) {
    const x = it.transform[4];
    const y = it.transform[5];
    const w = it.width || 0;
    const centerX = x + w / 2;

    if (y > topHeaderThreshold) {
      topItems.push(it);
    } else if (y < bottomFooterThreshold) {
      bottomItems.push(it);
    } else {
      if (centerX < midX) {
        colLeftItems.push(it);
      } else {
        colRightItems.push(it);
      }
    }
  }

  const isTwoColumn = colLeftItems.length >= 8 && colRightItems.length >= 8;

  const formatCluster = (clusterItems: any[]) => {
    const sorted = [...clusterItems].sort((a, b) => {
      const yA = a.transform[5];
      const yB = b.transform[5];
      const xA = a.transform[4];
      const xB = b.transform[4];
      if (Math.abs(yA - yB) > 3.5) {
        return yB - yA;
      }
      return xA - xB;
    });

    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentY: number | null = null;
    let lastX = 0;

    for (const it of sorted) {
      const y = it.transform[5];
      const x = it.transform[4];
      if (currentY === null || Math.abs(currentY - y) > 3.5) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
        }
        currentLine = [it.str];
        currentY = y;
        lastX = x + (it.width || 0);
      } else {
        if (x - lastX > 15) {
          currentLine.push('\t' + it.str);
        } else {
          currentLine.push(it.str);
        }
        lastX = x + (it.width || 0);
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }
    return lines.join('\n');
  };

  const parts: string[] = [];
  if (topItems.length > 0) parts.push(formatCluster(topItems));
  if (isTwoColumn) {
    parts.push(formatCluster(colLeftItems));
    parts.push(formatCluster(colRightItems));
  } else {
    parts.push(formatCluster([...colLeftItems, ...colRightItems]));
  }
  if (bottomItems.length > 0) parts.push(formatCluster(bottomItems));

  return parts.join('\n');
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
  sections?: import('./types').DetectedSection[];
  rangeInfo?: {
    requested_range?: { from: number; to: number };
    found_question_numbers: number[];
    missing_question_numbers: number[];
    is_range_complete: boolean;
    total_requested: number;
  };
}> {
  const onProgress = options.onProgress;
  onProgress?.({ stage: 'reading', message: 'Reading PDF document...' });

  const uint8Data = new Uint8Array(buffer);
  const parser = new PDFParse({ data: uint8Data });
  let totalPages = 1;

  // -------------------------------------------------------------------------
  // STEP 1: Fast Extraction to Check if PDF has Selectable Digital Text
  // -------------------------------------------------------------------------
  let isDigitalText = false;
  let accumulatedText = '';
  let pagesRead = 1;

  try {
    const fullTextResult = await parser.getText();
    accumulatedText = fullTextResult?.text || '';
    pagesRead = fullTextResult?.total || 1;
    totalPages = pagesRead;
    if (accumulatedText.trim().length > 50) {
      isDigitalText = true;
    }
  } catch (probeErr: any) {
    const errMsg = probeErr?.message || String(probeErr);
    console.error('Text extraction error in parsePdf:', errMsg);
    onProgress?.({
      stage: 'reading',
      message: `PDF text probe notice: ${errMsg.slice(0, 100)}`,
    });
  }

  // -------------------------------------------------------------------------
  // STEP 2: Digital Text PDF Path (No OCR, 100% Blazing Fast)
  // -------------------------------------------------------------------------
  if (isDigitalText) {
    onProgress?.({
      stage: 'reading',
      message: `Extracting text from PDF (${pagesRead} pages)...`,
      totalPages: pagesRead,
    });

    onProgress?.({
      stage: 'preparing',
      message: 'Analyzing sections, questions and answer keys...',
      totalPages,
    });

    // Extract questions strictly with boundary and validation checks
    const rangeResult = extractQuestionsWithRangeFromText(accumulatedText, options);

    return {
      questions: rangeResult.questions,
      pagesProcessed: pagesRead,
      parsingMethod: 'text',
      rawText: accumulatedText,
      isScanned: false,
      sections: rangeResult.sections,
      rangeInfo: {
        requested_range: rangeResult.requested_range,
        found_question_numbers: rangeResult.found_question_numbers,
        missing_question_numbers: rangeResult.missing_question_numbers,
        is_range_complete: rangeResult.is_range_complete,
        total_requested: rangeResult.total_requested,
      },
    };
  }

  // -------------------------------------------------------------------------
  // STEP 3: Genuine Scanned / Image PDF Fallback (With Safeguards & Progress)
  // -------------------------------------------------------------------------
  onProgress?.({
    stage: 'ocr_scanned',
    message: 'Scanned PDF detected. OCR processing may take longer.',
  });

  console.log('PDF is image-based/scanned. Running controlled OCR...');
  let ocrQuestions: ParsedQuestion[] = [];
  let combinedOcrText = '';
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
    console.warn('PDF getImage error, trying raw jpeg scan:', imgErr);
  }

  if (imageBuffers.length === 0) {
    imageBuffers = extractRawJpegsFromPdf(buffer);
  }

  // Cap OCR to first 12 image pages to avoid infinite hang on huge scanned books
  const MAX_OCR_PAGES = 12;
  const ocrLimit = Math.min(imageBuffers.length, MAX_OCR_PAGES);

  for (let i = 0; i < ocrLimit; i++) {
    onProgress?.({
      stage: 'ocr_scanned',
      message: `Running OCR on page ${i + 1} of ${ocrLimit}...`,
      currentPage: i + 1,
      totalPages: ocrLimit,
    });

    try {
      const ocrRes = await parseImageOcr(imageBuffers[i], options);
      if (ocrRes.rawText) {
        combinedOcrText += `\n--- Page ${i + 1} ---\n` + ocrRes.rawText;
      }
    } catch (ocrErr) {
      console.error(`OCR failed on page image ${i + 1}:`, ocrErr);
    }
  }

  onProgress?.({ stage: 'preparing', message: 'Preparing preview...' });

  if (combinedOcrText.trim()) {
    const rangeResult = extractQuestionsWithRangeFromText(combinedOcrText, options);
    return {
      questions: rangeResult.questions,
      pagesProcessed: ocrLimit,
      parsingMethod: 'ocr',
      rawText: combinedOcrText,
      isScanned: true,
      sections: rangeResult.sections,
      rangeInfo: {
        requested_range: rangeResult.requested_range,
        found_question_numbers: rangeResult.found_question_numbers,
        missing_question_numbers: rangeResult.missing_question_numbers,
        is_range_complete: rangeResult.is_range_complete,
        total_requested: rangeResult.total_requested,
      },
    };
  }

  return {
    questions: [],
    pagesProcessed: totalPages,
    parsingMethod: 'text',
    rawText: '',
    isScanned: true,
  };
}
