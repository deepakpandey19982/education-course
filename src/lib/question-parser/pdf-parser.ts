import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
// Pre-register fake worker handler for Node.js / server runtime to prevent dynamic import failure
// @ts-ignore
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// Register worker handler on globalThis so pdfjs finds #mainThreadWorkerMessageHandler directly
if (typeof (globalThis as any).pdfjsWorker === 'undefined') {
  (globalThis as any).pdfjsWorker = pdfjsWorker;
}

import { extractQuestionsFromText, extractQuestionsWithRangeFromText, TextExtractRangeResult } from './text-extractor';
import { parseImageOcr } from './ocr-parser';
import { convertKrutiDevToUnicode, isKrutiDevEncoded } from './krutidev-converter';
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

// Indicator patterns for legacy KrutiDev fonts
function isKrutiDevFont(fontSample: string): boolean {
  const indicators = [
    'izSfDVl', 'lsV', 'Hkkx', 'mÙkj', 'foèkku', 'lkekU;', 'gS\\', 'jkT;', 'D;k',
    'fØ;k', 'fuEufyf[kr', ';q¼', "'khr", 'vkSj', 'dFkuksa', 'lfefr', 'dkSu',
    'moZjd', 'lafoèkku', 'fp=k', 'fliQkfj', 'vFkZ', 'dÙkZO;ksa'
  ];
  return indicators.some((ind) => fontSample.includes(ind));
}

// Check if a line is an instruction or noise header to exclude
function isInstructionOrNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/For More PDF Download/i.test(trimmed)) return true;
  if (/^EBD_\d+/i.test(trimmed)) return true;
  if (/^\.\.\s*\d+\s*(?:व\s*ि|of)\s*\d+\s*\.\./i.test(trimmed)) return true;
  if (/^(?:निर्देश|funsZ'k|instructions?)\b/i.test(trimmed)) return true;
  if (/^(?:\d+[\.\-\s]*)?(?:इस\s*प्रैक्टिस\s*सेट\s*में|bl\s*izSfDVl\s*lsV\s*esa)/i.test(trimmed)) return true;
  if (/^प्रैक्टिस\s*सेट\s*में\s*(?:गणित|xf\.kr)/i.test(trimmed)) return true;
  if (/^प्रैक्टिस\s*सेट\s*को\s*हल\s*करने/i.test(trimmed)) return true;
  if (/^(?:समय\s*[:रू]|le;\s*[:])/i.test(trimmed) && /(?:घण्टे|\?k\.Vs)/i.test(trimmed)) return true;
  if (/(?:अधिकतम\s*अंक|vf\/dre\s*vad)/i.test(trimmed)) return true;
  if (/^(?:भाग|Hkkx)\s*\d+[\s%:रू]/i.test(trimmed)) return true;
  // Solo digits or page numbers
  if (/^\d{1,3}$/.test(trimmed)) return true;
  return false;
}

// Formats subscripts in chemical formulas: CO 2 -> CO₂, NO 2 -> NO₂, CH 4 -> CH₄, O 2 -> O₂
export function formatChemicalFormulas(line: string): string {
  const subscriptMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  return line.replace(
    /\b(CO|NO|CH|SO|H2O|NH3|O|H|N|Cl|C)\s*([0-9])\b/g,
    (_, element, num) => `${element}${subscriptMap[num] || num}`
  );
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
    if (jpegBuf.length > 5120) {
      images.push(jpegBuf);
    }
    pos = end + 2;
  }
  return images;
}

/**
 * Generic column-aware text extractor for a PDF page.
 * Detects fonts, translates KrutiDev items, preserves English and chemical formulas,
 * removes noise/watermarks/instructions, and orders columns left-to-right.
 */
export async function extractPageTextColumnAware(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 1.0 });
  const content = await page.getTextContent();
  const items = (content.items || []) as any[];
  if (items.length === 0) return '';

  // 1. Classify fonts on page
  const fontTexts: Record<string, string[]> = {};
  for (const it of items) {
    if (!it.str) continue;
    if (!fontTexts[it.fontName]) fontTexts[it.fontName] = [];
    fontTexts[it.fontName].push(it.str);
  }

  const fontIsKrutiDev: Record<string, boolean> = {};
  for (const [fn, strs] of Object.entries(fontTexts)) {
    fontIsKrutiDev[fn] = isKrutiDevFont(strs.join(' '));
  }

  // 2. Filter noise and transliterate only KrutiDev items (preserving Latin/English)
  const processedItems = items
    .filter((it) => {
      const str = (it.str || '').trim();
      if (!str) return false;
      if (/For More PDF Download/i.test(str)) return false;
      if (/^EBD_\d+/i.test(str)) return false;
      if (/^\.\.\s*\d+\s*(?:व\s*ि|of)\s*\d+\s*\.\./i.test(str)) return false;
      return true;
    })
    .map((it) => {
      const isKruti = fontIsKrutiDev[it.fontName] ?? false;
      let text = it.str;
      if (isKruti) {
        text = convertKrutiDevToUnicode(text);
      }
      return {
        ...it,
        str: text,
      };
    });

  // 3. Separate Columns
  const midX = viewport.width / 2;
  const colLeft: any[] = [];
  const colRight: any[] = [];

  for (const it of processedItems) {
    const x = it.transform[4];
    const w = it.width || 0;
    const centerX = x + w / 2;
    if (centerX < midX) {
      colLeft.push(it);
    } else {
      colRight.push(it);
    }
  }

  const isTwoColumn = colLeft.length >= 8 && colRight.length >= 8;

  const formatColumn = (colItems: any[]) => {
    colItems.sort((a, b) => {
      const yA = a.transform[5];
      const yB = b.transform[5];
      if (Math.abs(yA - yB) > 3.5) {
        return yB - yA; // Top to bottom
      }
      return a.transform[4] - b.transform[4]; // Left to right
    });

    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentY: number | null = null;
    let lastX = 0;

    for (const it of colItems) {
      const y = it.transform[5];
      const x = it.transform[4];
      if (currentY === null || Math.abs(currentY - y) > 3.5) {
        if (currentLine.length > 0) {
          const l = formatChemicalFormulas(currentLine.join(' ').trim());
          if (!isInstructionOrNoise(l)) {
            lines.push(l);
          }
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
      const l = formatChemicalFormulas(currentLine.join(' ').trim());
      if (!isInstructionOrNoise(l)) {
        lines.push(l);
      }
    }
    return lines.join('\n');
  };

  const isAnswerKeyPage = processedItems.some(it =>
    /mÙkjekyk|उत्तरमाला|उत्तर\s*कुंजी|answer\s*key/i.test(it.str)
  );

  if (isTwoColumn && !isAnswerKeyPage) {
    return formatColumn(colLeft) + '\n' + formatColumn(colRight);
  }
  return formatColumn([...colLeft, ...colRight]);
}

/**
 * Detects whether a PDF is digital selectable text, scanned image, or mixed.
 */
export async function detectPdfType(doc: any): Promise<'text' | 'scanned' | 'mixed'> {
  let textPages = 0;
  let emptyPages = 0;
  const sampleLimit = Math.min(doc.numPages, 10);

  for (let i = 1; i <= sampleLimit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const str = content.items.map((it: any) => it.str || '').join('');
    if (str.trim().length > 30) {
      textPages++;
    } else {
      emptyPages++;
    }
  }

  if (textPages > 0 && emptyPages === 0) return 'text';
  if (textPages === 0 && emptyPages > 0) return 'scanned';
  return 'mixed';
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
  const doc = await pdfjsLib.getDocument({ data: uint8Data }).promise;
  const totalPages = doc.numPages;

  // -------------------------------------------------------------------------
  // STEP 1: Detect PDF Type (Selectable Text vs Scanned Images)
  // -------------------------------------------------------------------------
  onProgress?.({ stage: 'probing', message: 'Checking PDF structure & text layers...' });
  const pdfType = await detectPdfType(doc);
  const isDigital = pdfType === 'text' || pdfType === 'mixed';

  // -------------------------------------------------------------------------
  // STEP 2: Digital Text PDF Path (High Accuracy Column-Aware Pipeline)
  // -------------------------------------------------------------------------
  if (isDigital) {
    onProgress?.({
      stage: 'extracting',
      message: `Extracting text & layout from PDF (${totalPages} pages)...`,
      totalPages,
    });

    let accumulatedText = '';
    let pagesProcessed = 0;

    // Range-aware page processing:
    // If a specific question range is requested (e.g. 1 to 60), find the relevant page window
    // so we don't load 400 pages unnecessarily.
    const hasRange = options.fromQuestion !== undefined && options.toQuestion !== undefined;
    const fromQ = options.fromQuestion ?? 1;
    const toQ = options.toQuestion ?? 100;

    // Find answer key pages (scan from end backwards or check pages with 'उत्तरमाला')
    const answerKeyPages = new Set<number>();
    // Fast probe for answer keys
    for (let p = Math.max(1, totalPages - 25); p <= totalPages; p++) {
      try {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const raw = textContent.items.map((it: any) => it.str || '').join(' ');
        if (/उत्तरमाला|mÙkjekyk|Answer\s*Key/i.test(raw)) {
          answerKeyPages.add(p);
        }
      } catch (e) {
        // ignore
      }
    }

    // Determine target pages to extract
    const pagesToExtract: number[] = [];
    if (hasRange && totalPages > 10) {
      // Find which pages contain the requested questions
      let foundStart = false;
      let lastQuestionPage = -1;

      for (let p = 1; p <= totalPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const raw = content.items.map((it: any) => it.str || '').join(' ');

        const hasOptions = /\([a-dA-D1-4]\)|[a-dA-D][\.\)]\s+/.test(raw);
        const isTOC = /CONTENTS|विषय\s*सूची|ब्व्छज्म्छज्/i.test(raw);

        // A question page must have question numbers and options, not TOC headers
        const hasFrom = !isTOC && (hasOptions || p >= 6) && new RegExp(`(?:^|\\s)${fromQ}[\\.\\-\\—\\)]`).test(raw);
        const hasTo = new RegExp(`(?:^|\\s)${toQ}[\\.\\-\\—\\)]`).test(raw);

        if (hasFrom) foundStart = true;
        if (foundStart) {
          pagesToExtract.push(p);
          lastQuestionPage = p;
        }

        if (hasTo && foundStart) {
          // Look ahead up to 15 pages to find the answer key for this set/section
          for (let ap = p + 1; ap <= Math.min(totalPages, p + 15); ap++) {
            try {
              const aPage = await doc.getPage(ap);
              const aContent = await aPage.getTextContent();
              const aRaw = aContent.items.map((it: any) => it.str || '').join(' ');
              const aConverted = convertKrutiDevToUnicode(aRaw);
              const isOmrSheet = /a\s*b\s*c\s*d/i.test(aRaw);
              const answerKeyMatches = aRaw.match(/\d{1,3}\s*[-–—.]\s*\(?[a-dA-D]\)?/g);
              const hasKeyWord =
                /उत्तरमाला|उत्तर-माला|उत्तर\s*कुंजी|उत्तर\s*तालिका/i.test(aConverted) ||
                /mÙkjekyk/i.test(aRaw) ||
                /answer\s*key/i.test(aRaw);
              const hasKeyPattern = !isOmrSheet && answerKeyMatches && answerKeyMatches.length >= 10;

              if (hasKeyWord || hasKeyPattern) {
                pagesToExtract.push(ap);
                break;
              }
            } catch (e) {
              // ignore
            }
          }
          break;
        }
      }
      // If no questions found via probe, fallback to all pages
      if (pagesToExtract.length === 0) {
        for (let p = 1; p <= totalPages; p++) pagesToExtract.push(p);
      }
    } else {
      for (let p = 1; p <= totalPages; p++) {
        pagesToExtract.push(p);
      }
    }

    // Extract pages
    for (let idx = 0; idx < pagesToExtract.length; idx++) {
      const pageNum = pagesToExtract[idx];
      onProgress?.({
        stage: 'extracting',
        message: `Processing page ${pageNum} (${idx + 1}/${pagesToExtract.length})...`,
        currentPage: pageNum,
        totalPages,
      });

      const page = await doc.getPage(pageNum);
      const pageText = await extractPageTextColumnAware(page);
      accumulatedText += '\n' + pageText;
      pagesProcessed++;
    }

    onProgress?.({
      stage: 'detecting_questions',
      message: 'Parsing questions, statements, and options...',
    });

    const rangeResult = extractQuestionsWithRangeFromText(accumulatedText, options);

    return {
      questions: rangeResult.questions,
      pagesProcessed,
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
  // STEP 3: Genuine Scanned / Image PDF Fallback (OCR)
  // -------------------------------------------------------------------------
  onProgress?.({
    stage: 'ocr_scanned',
    message: 'Scanned PDF detected. OCR processing may take longer.',
  });

  let imageBuffers: Buffer[] = extractRawJpegsFromPdf(buffer);
  const MAX_OCR_PAGES = 12;
  const ocrLimit = Math.min(imageBuffers.length, MAX_OCR_PAGES);
  let combinedOcrText = '';

  for (let i = 0; i < ocrLimit; i++) {
    onProgress?.({
      stage: 'ocr_scanned',
      message: `Running OCR on page ${i + 1} of ${ocrLimit}...`,
      currentPage: i + 1,
      totalPages: ocrLimit,
    });

    try {
      const pageText = await parseImageOcr(imageBuffers[i]);
      combinedOcrText += '\n' + pageText;
    } catch (ocrErr) {
      console.warn(`OCR error on page ${i + 1}:`, ocrErr);
    }
  }

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
