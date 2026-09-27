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

// In-memory cache for large PDF buffers (15-minute TTL) attached to globalThis
const pdfBufferCache: Map<string, { buffer: Buffer; timestamp: number }> =
  (globalThis as any).__pdfBufferCache ||
  ((globalThis as any).__pdfBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>());

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

// Check if a line is a document-level noise header to exclude
function isInstructionOrNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/For More PDF Download/i.test(trimmed)) return true;
  if (/^EBD_\d+/i.test(trimmed)) return true;
  if (/^\.\.\s*\d+\s*(?:व\s*ि|of)\s*\d+\s*\.\./i.test(trimmed)) return true;
  if (/^(?:\d+[\.\-\s]*)?(?:इस\s*प्रैक्टिस\s*सेट\s*में|bl\s*izSfDVl\s*lsV\s*esa)/i.test(trimmed)) return true;
  if (/^प्रैक्टिस\s*सेट\s*में\s*(?:गणित|xf\.kr)/i.test(trimmed)) return true;
  if (/^प्रैक्टिस\s*सेट\s*को\s*हल\s*करने/i.test(trimmed)) return true;
  if (/^(?:समय\s*[:रू]|le;\s*[:])/i.test(trimmed)) return true;
  if (/(?:अधिकतम|अध्कितम|पूर्णांक)\s*अंक|vf\/dre\s*vad|iw\.kkZad/i.test(trimmed)) return true;
  if (/^(?:भाग|Hkkx)\s*\d+[\s%:रू]/i.test(trimmed)) return true;
  // Solo digits or page numbers
  if (/^\d{1,3}$/.test(trimmed)) return true;
  // Standalone practice set header without set number (noise artifact from column splitting)
  if (/^(?:प्रैक्टिस\s*सेट|izSfDVl\s*lsV)$/i.test(trimmed)) return true;
  // URLs or download links
  if (/^https?:\/\//i.test(trimmed)) return true;
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

// Preserves colon ':' and proportion '::' in analogy and reasoning questions (e.g. 624 : 426 :: 745 : ?)
export function normalizeColonAndPunctuation(line: string): string {
  return line
    .replace(/ः\s*ः/g, '::')
    .replace(/([0-9a-zA-Z\?]+)\s*ः\s*([0-9a-zA-Z\?]+)/g, '$1 : $2')
    .replace(/([0-9a-zA-Z]+)\s*ः\s*(\?)/g, '$1 : $2')
    .replace(/(\?)\s*ः\s*([0-9a-zA-Z]+)/g, '$1 : $2')
    .replace(/\s*::\s*/g, ' :: ');
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
 * isolates top header banner items across the page, and sequences columns left-to-right.
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

  // 3. Separate Top Header Zone & Two Columns based on geometry
  const midX = viewport.width / 2;
  const leftItemsRaw = processedItems.filter((it) => (it.transform[4] + (it.width || 0) / 2) < midX);
  const rightItemsRaw = processedItems.filter((it) => (it.transform[4] + (it.width || 0) / 2) >= midX);

  const isTwoColumn = leftItemsRaw.length >= 8 && rightItemsRaw.length >= 8;

  // If two column, identify Top Header Zone (items above the two-column questions region)
  let columnTopY = viewport.height;
  if (isTwoColumn) {
    const questionStartPattern = /^(?:\d{1,4}\s*[\.\-\—]|Q\d+)/i;
    const rightQuestionStarts = rightItemsRaw.filter((it) =>
      questionStartPattern.test((it.str || '').trim())
    );
    const leftQuestionStarts = leftItemsRaw.filter((it) =>
      questionStartPattern.test((it.str || '').trim())
    );

    if (rightQuestionStarts.length > 0 && leftQuestionStarts.length > 0) {
      const highestRightQ = Math.max(...rightQuestionStarts.map((it) => it.transform[5]));
      const highestLeftQ = Math.max(...leftQuestionStarts.map((it) => it.transform[5]));
      columnTopY = Math.max(highestRightQ, highestLeftQ) + 15;
    } else if (rightQuestionStarts.length > 0) {
      const highestRightQ = Math.max(...rightQuestionStarts.map((it) => it.transform[5]));
      columnTopY = highestRightQ + 15;
    } else if (leftQuestionStarts.length > 0) {
      const highestLeftQ = Math.max(...leftQuestionStarts.map((it) => it.transform[5]));
      columnTopY = highestLeftQ + 15;
    }
  }

  const topHeaderItems: any[] = [];
  const colLeft: any[] = [];
  const colRight: any[] = [];

  for (const it of processedItems) {
    const y = it.transform[5];
    const centerX = it.transform[4] + (it.width || 0) / 2;

    if (isTwoColumn && y > columnTopY) {
      topHeaderItems.push(it);
    } else if (centerX < midX) {
      colLeft.push(it);
    } else {
      colRight.push(it);
    }
  }

  const formatColumn = async (colItems: any[], isRightCol: boolean = false) => {
    // Pre-pass: Reconstruct vertically stacked fractions (e.g. 169/121 in Q86, 1/2 in Q149)
    const itemsToMerge = colItems.map((it) => ({
      ...it,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width || 0,
      str: it.str || '',
    }));

    const mergedColItems: any[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < itemsToMerge.length; i++) {
      if (usedIndices.has(i)) continue;
      const itA = itemsToMerge[i];
      const strA = itA.str.trim();

      if (/^\d+(?:\.\d+)?$/.test(strA)) {
        let bestMatchIdx = -1;
        let minXDiff = 999;

        for (let j = 0; j < itemsToMerge.length; j++) {
          if (i === j || usedIndices.has(j)) continue;
          const itB = itemsToMerge[j];
          const strB = itB.str.trim();
          if (!/^\d+(?:\.\d+)?$/.test(strB)) continue;

          const yDiff = itA.y - itB.y;
          const xDiff = Math.abs(itA.x - itB.x);

          if (yDiff >= 6 && yDiff <= 22 && xDiff <= 8) {
            const midY = (itA.y + itB.y) / 2;
            const minX = Math.min(itA.x, itB.x);
            const maxX = Math.max(itA.x + itA.w, itB.x + itB.w);

            const neighborsA = itemsToMerge.filter((k, idx) => idx !== i && Math.abs(k.y - itA.y) <= 3.0 && Math.abs(k.x - itA.x) < 45);
            const neighborsB = itemsToMerge.filter((k, idx) => idx !== j && Math.abs(k.y - itB.y) <= 3.0 && Math.abs(k.x - itB.x) < 45);

            if (neighborsA.length === 0 && neighborsB.length === 0) {
              const baselineItems = itemsToMerge.filter((k, idx) => idx !== i && idx !== j && Math.abs(k.y - midY) <= 3.5);
              const hasLeft = baselineItems.some((k) => k.x + k.w <= minX + 2 && minX - (k.x + k.w) < 30);
              const hasRight = baselineItems.some((k) => k.x >= maxX - 2 && k.x - maxX < 30);

              if (hasLeft || hasRight) {
                if (xDiff < minXDiff) {
                  minXDiff = xDiff;
                  bestMatchIdx = j;
                }
              }
            }
          }
        }

        if (bestMatchIdx !== -1) {
          const itB = itemsToMerge[bestMatchIdx];
          usedIndices.add(i);
          usedIndices.add(bestMatchIdx);
          const midY = (itA.y + itB.y) / 2;
          const minX = Math.min(itA.x, itB.x);
          const fracStr = `${strA}/${itB.str.trim()}`;
          mergedColItems.push({
            ...itA,
            str: fracStr,
            transform: [itA.transform[0], itA.transform[1], itA.transform[2], itA.transform[3], minX, midY],
            width: Math.max(itA.w, itB.w) + 8,
          });
          continue;
        }
      }

      mergedColItems.push(itA);
    }

    mergedColItems.sort((a, b) => {
      const yA = a.transform[5];
      const yB = b.transform[5];
      if (Math.abs(yA - yB) > 3.5) {
        return yB - yA; // Top to bottom
      }
      return a.transform[4] - b.transform[4]; // Left to right
    });

    interface VisualLine {
      y: number;
      text: string;
      items: any[];
    }

    const visualLines: VisualLine[] = [];
    let currentLine: string[] = [];
    let currentItems: any[] = [];
    let currentY: number | null = null;
    let lastX = 0;

    for (const it of mergedColItems) {
      const y = it.transform[5];
      const x = it.transform[4];
      if (currentY === null || Math.abs(currentY - y) > 3.5) {
        if (currentLine.length > 0) {
          const l = normalizeColonAndPunctuation(formatChemicalFormulas(currentLine.join(' ').trim()));
          if (!isInstructionOrNoise(l)) {
            visualLines.push({ y: currentY!, text: l, items: currentItems });
          }
        }
        currentLine = [it.str];
        currentItems = [it];
        currentY = y;
        lastX = x + (it.width || 0);
      } else {
        if (x - lastX > 15) {
          currentLine.push('\t' + it.str);
        } else {
          currentLine.push(it.str);
        }
        currentItems.push(it);
        lastX = x + (it.width || 0);
      }
    }
    if (currentLine.length > 0) {
      const l = normalizeColonAndPunctuation(formatChemicalFormulas(currentLine.join(' ').trim()));
      if (!isInstructionOrNoise(l)) {
        visualLines.push({ y: currentY!, text: l, items: currentItems });
      }
    }

    // Detect diagram regions across questions in this column
    const qStartRegex = /^(?:[\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963•\-\*\~›»\>\.\|\u2022\u25cf\u25cb\s]*)(?:(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)(?:\s*(?:no\.?|नंबर|संख्या|सं\.?|क्र\.?|number|num\.?))?\s*(\d{1,5})(?:[\s:\.\-\)\]\|ण्।]+|$)|(?:(?:\((\d{1,5})\)|\[(\d{1,5})\]|(\d{1,5})\s*[\.\:\-\)\]\|ण्।])(?:\s+|$)))/i;
    const optMarkerRegex = /(?:^|\s|\t)(?:\(([a-dA-D1-4क-घ])\)|([a-dA-Dक-घ])[\.\)\-\]]|\[([a-dA-D1-4क-घ])\])/;
    const diagramKeywordRegex =
      /vkÑfr|vkÑfÙk|आकृति|आकृतियाँ|आकृत्तियाँ|चित्र|चित्रों|fp=|fp=kksa|दर्पण|प्रतिबिम्ब|niZ\.k|izfrfcEc|पासा|पासे|iklk|ikls|yqIr\s*vkÑfr|लुप्त\s*आकृति|iz'u\s*vkÑfr|mÙkj\s*vkÑfr|mRrj\s*vkÑfÙk/i;

    interface DiagramPlan {
      qLineIdx: number;
      topY: number;
      bottomY: number;
      skipLineIndices: Set<number>;
      isOptionsDiagram?: boolean;
    }

    const diagrams: DiagramPlan[] = [];

    // Check if column starts with leading options or options diagram continuing from previous column (e.g. Q114)
    const firstQLineIdx = visualLines.findIndex((vl) => qStartRegex.test(vl.text));
    const leadingLimit = firstQLineIdx !== -1 ? firstQLineIdx : visualLines.length;
    if (leadingLimit > 0) {
      const leadingLines = visualLines.slice(0, leadingLimit);
      const hasLeadingOptDiagram = leadingLines.some((x) =>
        /mÙkj\s*vkÑfr|उत्तर\s*आकृतियाँ|mRrj\s*vkÑfÙk|उत्तर\s*आकृत्तियाँ/i.test(x.text) ||
        optMarkerRegex.test(x.text)
      );
      if (hasLeadingOptDiagram) {
        const topY = leadingLines[0].y + 5;
        const bottomY = firstQLineIdx !== -1 ? visualLines[firstQLineIdx].y + 12 : 35;
        const leadingSkipSet = new Set<number>();
        for (let lk = 0; lk < leadingLimit; lk++) {
          if (/^(?:उत्तर\s*आकृ|mÙkj\s*vkÑ|mRrj\s*vkÑ)/i.test(visualLines[lk].text.trim())) {
            leadingSkipSet.add(lk);
          }
        }
        if (topY - bottomY >= 35) {
          diagrams.push({
            qLineIdx: -1, // token injected at start of column
            topY,
            bottomY,
            skipLineIndices: leadingSkipSet,
            isOptionsDiagram: true,
          });
        }
      }
    }

    let runningQNum = 0;
    for (let i = 0; i < visualLines.length; i++) {
      const line = visualLines[i];
      const qm = line.text.match(qStartRegex);
      if (qm) {
        const parsedQNum = parseInt(qm[1] || qm[2] || qm[3] || qm[4], 10);
        const isExplicit = Boolean(
          line.text.match(
            /^(?:[\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963•\-\*\~›»\>\.\|\u2022\u25cf\u25cb\s]*)(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)/i
          )
        );

        // If this line has an un-prefixed number <= runningQNum, it is an internal numbered statement (e.g. 1. Necrology), NOT a question start!
        if (runningQNum > 1 && !isExplicit && parsedQNum <= runningQNum) {
          continue;
        }
        runningQNum = parsedQNum;

        // Find where options start for this question
        let optLineIdx = -1;
        let nextQIdx = -1;

        for (let j = i + 1; j < Math.min(visualLines.length, i + 15); j++) {
          const nextQm = visualLines[j].text.match(qStartRegex);
          if (nextQm) {
            const nextQNum = parseInt(nextQm[1] || nextQm[2] || nextQm[3] || nextQm[4], 10);
            const isExplicitNext = Boolean(
              visualLines[j].text.match(
                /^(?:[\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963•\-\*\~›»\>\.\|\u2022\u25cf\u25cb\s]*)(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)/i
              )
            );
            if (isExplicitNext || nextQNum > parsedQNum) {
              nextQIdx = j;
              break;
            }
          }
          if (optLineIdx === -1 && optMarkerRegex.test(visualLines[j].text)) {
            optLineIdx = j;
          }
        }

        const questionEndLimit = optLineIdx !== -1 ? optLineIdx : (nextQIdx !== -1 ? nextQIdx : visualLines.length);
        const fullQText = visualLines.slice(i, questionEndLimit).map((x) => x.text).join(' ');
        const hasDiagKeyword =
          diagramKeywordRegex.test(fullQText) ||
          visualLines.slice(i, questionEndLimit).some((x) => /^[MN]$/i.test(x.text.trim()) || diagramKeywordRegex.test(x.text));

        // Find where readable question sentence ends and diagram region begins
        let qSentenceEndIdx = i;
        for (let k = i; k < questionEndLimit; k++) {
          const txt = visualLines[k].text.trim();
          // Stop if line is explicitly a diagram marker header or isolated marker
          if (
            /^(?:प्रश्न\s*आकृति(?:याँ)?|iz'u\s*vkÑfr|उत्तर\s*आकृति(?:याँ|त्तियाँ)?|mÙkj\s*vkÑfr|mRrj\s*vkÑfÙk)/i.test(txt) ||
            /^[MN]$/.test(txt) ||
            /^[A-D](\s+[A-D])*$/.test(txt)
          ) {
            break;
          }
          qSentenceEndIdx = k;
          // If line ends with sentence terminator and this is a diagram question, or next line has diagram marker/gap
          if (/(?:[\?।!\.:\\]|\bहोगी\?|\bहोगा\?|\bहैं\?|\bहै\?|\bकीजिए[।\.]|\bकरें[।\.]|\bचुनिए[।\.]|\bबताइए[।\.])$/.test(txt)) {
            if (k + 1 < questionEndLimit) {
              const nextTxt = visualLines[k + 1].text.trim();
              const nextGap = visualLines[k].y - visualLines[k + 1].y;
              if (
                /^(?:प्रश्न\s*आकृति|iz'u\s*vkÑfr|उत्तर\s*आकृति|mÙkj\s*vkÑfr|mRrj\s*vkÑfÙk)/i.test(nextTxt) ||
                /^[MN]$/.test(nextTxt) ||
                /^[A-D](\s+[A-D])*$/.test(nextTxt) ||
                nextGap >= 32 ||
                hasDiagKeyword
              ) {
                break;
              }
            }
          }
        }

        // Check if Question Diagram exists (either before options in same column, OR before column bottom/next question)
        const qEndLine = visualLines[qSentenceEndIdx];
        const lowerBoundY = optLineIdx !== -1 ? visualLines[optLineIdx].y : 40;
        const qGap = qEndLine.y - lowerBoundY;
        const intermediateLines = visualLines.slice(qSentenceEndIdx + 1, questionEndLimit);

        // Real diagram: explicit visual keywords/markers, OR an empty gap >= 45 with only numbers/symbols or no text (e.g. Q93 circle drawing with numbers 2, 3, 4, 8, 27)
        const hasOnlySymbolsOrNumbers =
          intermediateLines.length > 0 &&
          intermediateLines.every((x) => /^[\d\\\/\s\.\,\-\?\*\^\#\$\@\!]+$/.test(x.text.trim()));
        const isRealDiagram = hasDiagKeyword || (qGap >= 45 && (intermediateLines.length === 0 || hasOnlySymbolsOrNumbers));

        if (isRealDiagram && (qGap >= 30 || intermediateLines.length > 0)) {
          const skipSet = new Set<number>();
          // When this is a verified diagram question, all intermediate lines between question sentence end and options/next are diagram OCR/labels
          for (let k = qSentenceEndIdx + 1; k < questionEndLimit; k++) {
            skipSet.add(k);
          }
          diagrams.push({
            qLineIdx: qSentenceEndIdx,
            topY: qEndLine.y - 2,
            bottomY: lowerBoundY + (optLineIdx !== -1 ? 2 : 0),
            skipLineIndices: skipSet,
          });
        }

        // Check if option figures (उत्तर आकृतियाँ) exist in this column
        const optSearchRange = visualLines.slice(qSentenceEndIdx + 1, nextQIdx !== -1 ? nextQIdx : visualLines.length);
        const optDiagRelIdx = optSearchRange.findIndex((x) =>
          /mÙkj\s*vkÑ|उत्तर\s*आकृ/i.test(x.text)
        );
        if (optDiagRelIdx !== -1) {
          const optDiagLineIdx = (qSentenceEndIdx + 1) + optDiagRelIdx;
          const optEndIdx = nextQIdx !== -1 ? nextQIdx - 1 : visualLines.length - 1;
          const optTopY = visualLines[optDiagLineIdx].y + 5;
          const optBottomY = Math.max(35, visualLines[optEndIdx].y - 20);
          diagrams.push({
            qLineIdx: optLineIdx !== -1 ? optLineIdx : optDiagLineIdx,
            topY: optTopY,
            bottomY: optBottomY,
            skipLineIndices: new Set<number>([optDiagLineIdx]),
            isOptionsDiagram: true,
          });
        }
      }
    }

    // Render diagram crops if any detected
    const diagramTokens = new Map<number, string[]>();
    const allSkipLines = new Set<number>();

    if (diagrams.length > 0) {
      try {
        const { createCanvas } = await import('@napi-rs/canvas');
        const scale = 2.0;
        const renderViewport = page.getViewport({ scale });
        const canvas = createCanvas(renderViewport.width, renderViewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport: renderViewport }).promise;

        for (const diag of diagrams) {
          diag.skipLineIndices.forEach((idx) => allSkipLines.add(idx));

          const cropX = Math.max(0, Math.floor((isRightCol ? midX + 5 : 25) * scale));
          const cropWidth = Math.min(renderViewport.width - cropX, Math.floor((isRightCol ? (viewport.width - midX - 25) : (midX - 25)) * scale));
          const cropTop = Math.max(0, Math.floor((viewport.height - diag.topY) * scale));
          const cropHeight = Math.min(renderViewport.height - cropTop, Math.max(15, Math.floor((diag.topY - diag.bottomY) * scale)));

          if (cropWidth > 20 && cropHeight > 15) {
            const cropCanvas = createCanvas(cropWidth, cropHeight);
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(canvas, cropX, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            const dataUrl = 'data:image/png;base64,' + cropCanvas.toBuffer('image/png').toString('base64');
            const token = diag.isOptionsDiagram ? `[[OPTIONS_DIAGRAM_IMAGE:${dataUrl}]]` : `[[QUESTION_IMAGE:${dataUrl}]]`;

            if (!diagramTokens.has(diag.qLineIdx)) {
              diagramTokens.set(diag.qLineIdx, []);
            }
            diagramTokens.get(diag.qLineIdx)!.push(token);
          }
        }
      } catch (err) {
        console.error('Diagram rendering fallback:', err);
      }
    }

    // Assemble final column lines
    const finalLines: string[] = [];
    if (diagramTokens.has(-1)) {
      for (const token of diagramTokens.get(-1)!) {
        finalLines.push(token);
      }
    }
    for (let i = 0; i < visualLines.length; i++) {
      if (allSkipLines.has(i)) continue;
      finalLines.push(visualLines[i].text);
      if (diagramTokens.has(i)) {
        for (const token of diagramTokens.get(i)!) {
          finalLines.push(token);
        }
      }
    }

    return finalLines.join('\n');
  };

  const isAnswerKeyPage = processedItems.some((it) =>
    /mÙkjekyk|उत्तरमाला|उत्तर\s*कुंजी|answer\s*key/i.test(it.str)
  );

  if (isTwoColumn && !isAnswerKeyPage) {
    const parts: string[] = [];
    if (topHeaderItems.length > 0) {
      const hText = await formatColumn(topHeaderItems, false);
      if (hText.trim()) parts.push(hText);
    }
    const lText = await formatColumn(colLeft, false);
    if (lText.trim()) parts.push(lText);
    const rText = await formatColumn(colRight, true);
    if (rText.trim()) parts.push(rText);
    return parts.join('\n');
  }

  return await formatColumn(processedItems, false);
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

    // Find answer key pages (probe end of document only when no range is provided)
    const answerKeyPages = new Set<number>();
    if (!hasRange) {
      for (let p = Math.max(1, totalPages - 15); p <= totalPages; p++) {
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
        const hasFrom = !isTOC && (hasOptions || p >= 6) && new RegExp(`(?:^|\\s)${fromQ}[\\.\\-\\—\\)\\:\\]ण्]`).test(raw);
        const hasTo = new RegExp(`(?:^|\\s)${toQ}[\\.\\-\\—\\)\\:\\]ण्]`).test(raw);

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
      // If no questions found via probe when range was requested, return early
      if (pagesToExtract.length === 0) {
        return {
          questions: [],
          pagesProcessed: totalPages,
          parsingMethod: 'text',
          rawText: '',
          isScanned: false,
          sections: [],
          rangeInfo: {
            requested_range: { from: fromQ, to: toQ },
            found_question_numbers: [],
            missing_question_numbers: Array.from({ length: Math.max(0, toQ - fromQ + 1) }, (_, i) => fromQ + i),
            is_range_complete: false,
            total_requested: Math.max(0, toQ - fromQ + 1),
          },
        };
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
