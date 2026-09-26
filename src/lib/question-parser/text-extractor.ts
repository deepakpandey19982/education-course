import { ParsedQuestion, DetectedSection, QuestionValidationStatus } from './types';
import { normalizeKrutiDevText } from './krutidev-converter';

// Map option identifiers (letters, numbers, Hindi characters) to standard A, B, C, D
export function normalizeOptionKey(key: string): 'A' | 'B' | 'C' | 'D' | null {
  const clean = key.trim().toUpperCase();
  if (['A', '1', 'क'].includes(clean)) return 'A';
  if (['B', '2', 'ख'].includes(clean)) return 'B';
  if (['C', '3', 'ग'].includes(clean)) return 'C';
  if (['D', '4', 'घ'].includes(clean)) return 'D';
  return null;
}

// Check if a line appears to be a Practice Set or Exam Section header
export function detectPracticeSetHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return null;

  // 1. Practice Set / Model Paper / Mock Test variations:
  // "Practice Set - 1", "Practice Set 1", "Practice Set-1", "प्रैक्टिस सेट - 1", "प्रैक्टिस सेट 1", "izSfDVl lsV- 1"
  // "Model Paper - 1", "Model Paper 1", "मॉडल पेपर 1", "Mock Test 1"
  const psMatch = trimmed.match(
    /^(?:practice\s*set|प्रैक्टिस\s*सेट|izSfDVl\s*lsV|मॉडल\s*पेपर|model\s*(?:test\s*)?paper|sample\s*paper|mock\s*test|अभ्यास\s*प्रश्न\s*पत्र)\s*[:\.\-\—]?\s*(\d{1,4})/i
  );
  if (psMatch) {
    return `Practice Set-${parseInt(psMatch[1], 10)}`;
  }

  // 2. Set / सेट / Test / टेस्ट patterns:
  // "Set - 1", "Set 1", "Set-1", "सेट 1", "सेट - 1", "Test 1"
  const setMatch = trimmed.match(/^(?:set|सेट|test|टेस्ट)\s*[:\-\—]?\s*(\d{1,4})$/i);
  if (setMatch) {
    return `Set ${parseInt(setMatch[1], 10)}`;
  }

  // 3. Section / Part / खंड / भाग:
  // "Section A", "Section 1", "Part A", "Part 1", "खंड क", "भाग 1"
  const partMatch = trimmed.match(/^(?:section|part|खंड|भाग)\s*[:\-\—]?\s*([a-zA-Z0-9\u0900-\u097F]+)$/i);
  if (partMatch) {
    const val = partMatch[1].toUpperCase();
    return `Section ${val}`;
  }

  return null;
}

// Check if a line appears to be a Subject header
export function detectSubjectHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return null;

  // Patterns like: "Subject: Computer", "Section A: Reasoning", "विषय: सामान्य ज्ञान"
  const explicitMatch = trimmed.match(
    /^(?:subject|section|part|topic|खंड|भाग|विषय)\s*[:\-\—]\s*([a-zA-Z0-9\u0900-\u097F\s&/]+)$/i
  );
  if (explicitMatch && explicitMatch[1].trim()) {
    return explicitMatch[1].trim();
  }

  // Standalone capital words like: "COMPUTER KNOWLEDGE", "GENERAL AWARENESS", "REASONING", "MATHEMATICS"
  const commonSubjects = [
    'COMPUTER', 'COMPUTER KNOWLEDGE', 'COMPUTER OPERATOR', 'GENERAL KNOWLEDGE', 'GENERAL AWARENESS',
    'REASONING', 'MENTAL APTITUDE', 'QUANTITATIVE APTITUDE', 'MATHEMATICS', 'MATHS', 'HINDI', 'ENGLISH',
    'CURRENT AFFAIRS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'POLITY', 'ECONOMICS', 'LEGAL APTITUDE',
  ];

  const upper = trimmed.toUpperCase();
  for (const s of commonSubjects) {
    if (upper === s || upper === `SECTION - ${s}` || upper === `SECTION: ${s}` || upper === `PART - ${s}`) {
      return s;
    }
  }

  // All caps standalone heading of 3-35 chars without punctuation that isn't a question, answer, or practice set
  if (
    /^[A-Z\s&/]{3,35}$/.test(trimmed) &&
    !trimmed.startsWith('Q') &&
    !trimmed.startsWith('ANSWER') &&
    !trimmed.startsWith('ANS') &&
    !trimmed.startsWith('PRACTICE') &&
    !trimmed.startsWith('SET')
  ) {
    if (trimmed.length > 4 && !/^[A-D]$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

// Parse answer key section into a Map<questionNumber, 'A'|'B'|'C'|'D'>
export function parseAnswerKey(text: string): Map<number, 'A' | 'B' | 'C' | 'D'> {
  const answerMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  if (!text || !text.trim()) return answerMap;

  // Pattern 1: Delimited pairs like:
  // "1-(a)", "2-(b)", "3-(b)", "160-(c)"
  // "1 - a", "1-a", "1-A", "1-b"
  // "1.(a)", "1. a", "1.A"
  // "1) (a)", "1) a", "1) A"
  // "1: a", "1: A", "1 = a"
  // "Q1. B", "Q. 1 - C", "प्रश्न 1 - ख"
  const pairRegex = /(?:(?:Q(?:uestion|\.)?|प्रश्न|प्र\.?)?\s*(\d{1,5}))\s*(?:[-–—.:=)]\s*|\s+)\(?([A-Da-d1-4क-घ])\)?(?=[\s,;\n\)\/\|]|$)/gi;

  const matches = text.matchAll(pairRegex);
  for (const match of matches) {
    const qNum = parseInt(match[1], 10);
    const opt = normalizeOptionKey(match[2]);
    if (!isNaN(qNum) && opt) {
      answerMap.set(qNum, opt);
    }
  }

  return answerMap;
}

// Check if a line is a document page header/footer line to avoid polluting questions
function isHeaderOrFooterLine(line: string): boolean {
  const clean = line.trim();
  if (!clean) return false;
  if (/^page\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(clean)) return true;
  if (/^\d+\s*(?:of|\/)\s*\d+$/i.test(clean)) return true;
  if (/^[-–—]{1,3}\s*\d+\s*[-–—]{1,3}$/.test(clean)) return true;
  if (/^---+.*---+$/.test(clean) && !clean.includes('=')) return true;
  return false;
}

export interface TextExtractOptions {
  fromQuestion?: number;
  toQuestion?: number;
  sectionId?: string;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  defaultLanguage?: string;
  onProgress?: (event: import('./pdf-parser').PdfProgressEvent) => void;
}

export interface TextExtractRangeResult {
  questions: ParsedQuestion[];
  requested_range?: { from: number; to: number };
  found_question_numbers: number[];
  missing_question_numbers: number[];
  is_range_complete: boolean;
  total_requested: number;
  sections?: DetectedSection[];
  selected_section_id?: string;
}

interface RawBlock {
  qNum: number;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  questionLines: string[];
  options: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  answer?: 'A' | 'B' | 'C' | 'D' | null;
  explanation?: string;
  rawSnippet: string;
}

/**
 * Extracts questions and detects Practice Sets / Sections.
 * Understands multi-set PDFs (e.g. Practice Set-1 with Answers 1-160, then Practice Set-2 with Answers 1-160).
 */
// Extract inline options from a single line with multiple options (e.g. (a) ... (b) ...)
function extractInlineOptions(line: string): Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }> | null {
  const regex = /(?:^|\s|\t)(?:\(([a-dA-D1-4क-घ])\)|([a-dA-D1-4क-घ])[\.\)\-\]])\s*(.*?)(?=(?:(?:\s|\t)(?:\([a-dA-D1-4क-घ]\)|[a-dA-D1-4क-घ][\.\)\-\]])\s*)|$)/g;
  const matches = Array.from(line.matchAll(regex));
  if (matches.length >= 2) {
    const res: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }> = [];
    for (const m of matches) {
      const key = normalizeOptionKey(m[1] || m[2]);
      const text = (m[3] || '').trim();
      if (key && text) {
        res.push({ key, text });
      }
    }
    if (res.length >= 2) return res;
  }
  return null;
}

export function extractQuestionsWithRangeFromText(
  rawText: string,
  options: TextExtractOptions = {}
): TextExtractRangeResult {
  const marks = options.defaultMarks ?? 1;
  const negMarks = options.defaultNegativeMarks ?? 0;
  const lang = options.defaultLanguage || 'English';

  if (!rawText || !rawText.trim()) {
    return {
      questions: [],
      found_question_numbers: [],
      missing_question_numbers: [],
      is_range_complete: false,
      total_requested: 0,
      sections: [],
    };
  }

  // Pre-process: normalize KrutiDev font encoding if present, standardizing newlines and dashes
  const cleanedRawText = normalizeKrutiDevText(rawText);
  const normalized = cleanedRawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  const lines = normalized.split('\n');

  // Regex patterns:
  // Question starters: Q1. / Q.1 / Question 1 / प्रश्न 1 / 1. / 1) / (1) / [1]
  const questionStartRegex = /^(?:(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)(?:\s*(?:no\.?|नंबर|संख्या|सं\.?|क्र\.?|number|num\.?))?\s*(\d{1,5})(?:[\s:\.\-\)]+|$)|(?:(?:\((\d{1,5})\)|\[(\d{1,5})\]|(\d{1,5})\s*[\.\:\-\)])(?:\s+|$)))\s*(.*)$/i;

  // Single Option starters: (A) / A. / A) / [A] / (क) / क. / 1. / (1)
  const optionStartRegex = /^(?:\(([A-Da-dक-घ1-4])\)|([A-Da-dक-घ1-4])\s*[\.\)\-\]]|\[([A-Da-dक-घ1-4])\])\s*(.*)$/;

  // Answer indicators: Answer: B / Ans: B / उत्तर: B / Answer - B / Ans. B / Option B / Correct: B
  const answerLineRegex = /^(?:(?:correct\s*)?(?:answer|ans|उत्तर|option|विकल्प)\s*[:\.\-\—]\s*\(?([A-Da-d1-4]|(?:[क-घ](?![\u0900-\u097F])))\)?|(?:उत्तर|ans|answer)\s+([A-Da-d1-4]|(?:[क-घ](?![\u0900-\u097F]))))\s*(.*)$/i;

  // Explanation indicators: Explanation: ... / व्याख्या: ... / Solution: ... / हल: ...
  const explanationLineRegex = /^(?:explanation|व्याख्या|solution|हल|नोट|note)\s*[:\.\-\—]\s*(.*)$/i;

  // Answer key section header indicator (must be a standalone section header, NOT an individual answer line)
  const answerKeyHeaderRegex = /^(?:answer\s*key|answers\s*(?:key|sheet|table)?|answer-key|उत्तर\s*कुंजी|उत्तर\s*माला|उत्तरमाला|उत्तर-कुंजी|उत्तर\s*तालिका|key\s*answers?)(?:\s*[:\-]|\s*$)/i;

  // -------------------------------------------------------------------------
  // PHASE 1: Scan for Practice Sets / Sections across lines
  // -------------------------------------------------------------------------
  options.onProgress?.({
    stage: 'detecting_sections',
    message: 'Finding Practice Sets...',
  });

  interface SectionDraft {
    id: string;
    name: string;
    startLine: number;
    endLine: number;
  }

  const detectedSectionDrafts: SectionDraft[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    const psName = detectPracticeSetHeader(l);
    if (psName) {
      const lastSection = detectedSectionDrafts[detectedSectionDrafts.length - 1];
      if (!lastSection || lastSection.name !== psName) {
        if (lastSection) {
          lastSection.endLine = i - 1;
        }
        detectedSectionDrafts.push({
          id: `sec-${detectedSectionDrafts.length + 1}`,
          name: psName,
          startLine: detectedSectionDrafts.length === 0 ? 0 : i,
          endLine: lines.length - 1,
        });
      }
    }
  }

  // If no practice sets detected, treat whole document as single section
  if (detectedSectionDrafts.length === 0) {
    detectedSectionDrafts.push({
      id: 'sec-all',
      name: 'Full Document',
      startLine: 0,
      endLine: lines.length - 1,
    });
  }

  // -------------------------------------------------------------------------
  // PHASE 2: Process each section independently to prevent cross-contamination
  // -------------------------------------------------------------------------
  options.onProgress?.({
    stage: 'detecting_questions',
    message: 'Finding Questions...',
  });

  const allRawBlocks: RawBlock[] = [];
  const sectionSummaryList: DetectedSection[] = [];

  for (const draft of detectedSectionDrafts) {
    const sectionLines = lines.slice(draft.startLine, draft.endLine + 1);

    // Locate answer key block within this section
    const sectionAnswerKeyMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
    let answerKeyStartIndex = -1;

    for (let j = 0; j < sectionLines.length; j++) {
      const trimmed = sectionLines[j].trim();
      if (answerKeyHeaderRegex.test(trimmed)) {
        answerKeyStartIndex = j;
        break;
      }
    }

    if (answerKeyStartIndex !== -1) {
      options.onProgress?.({
        stage: 'detecting_answer_key',
        message: 'Detecting Answer Key...',
      });
      const akText = sectionLines.slice(answerKeyStartIndex).join('\n');
      const parsedAk = parseAnswerKey(akText);
      for (const [k, v] of parsedAk.entries()) {
        sectionAnswerKeyMap.set(k, v);
      }
    }

    // Now extract questions for this section (only lines before the answer key if answer key exists)
    const contentLines = answerKeyStartIndex !== -1
      ? sectionLines.slice(0, answerKeyStartIndex)
      : sectionLines;

    let currentSubject = '';
    let activeBlock: RawBlock | null = null;
    let currentTargetOption: 'A' | 'B' | 'C' | 'D' | null = null;
    let inExplanation = false;
    let runningAutoQNum = 1;

    const pushSectionBlock = () => {
      if (activeBlock) {
        // If answer was not in block itself, try section's answer key map
        if (!activeBlock.answer && activeBlock.qNum && sectionAnswerKeyMap.has(activeBlock.qNum)) {
          options.onProgress?.({
            stage: 'matching_answers',
            message: 'Matching Answer Key...',
          });
          activeBlock.answer = sectionAnswerKeyMap.get(activeBlock.qNum) || null;
        }
        allRawBlocks.push(activeBlock);
        activeBlock = null;
        currentTargetOption = null;
        inExplanation = false;
      }
    };

    for (let k = 0; k < contentLines.length; k++) {
      const rawLine = contentLines[k];
      const line = rawLine.trim();
      if (!line || isHeaderOrFooterLine(line)) continue;

      // Skip practice set title line itself if it matches
      if (detectPracticeSetHeader(line)) continue;

      // Check for Subject header
      const subjectHeader = detectSubjectHeader(line);
      if (subjectHeader) {
        currentSubject = subjectHeader;
        continue;
      }

      // Check for Question start
      const qMatch = line.match(questionStartRegex);
      if (qMatch) {
        const qNumStr = qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4];
        const parsedQNum = qNumStr ? parseInt(qNumStr, 10) : runningAutoQNum;
        const initialText = (qMatch[5] || '').trim();

        const isExplicit = Boolean(qMatch[1]);
        // False-positive sub-list or option guard:
        // Inside a question or after question 1:
        // If it lacks explicit prefix (Q./Question/प्रश्न) and parsedQNum is backwards (< runningAutoQNum - 1)
        // or parsedQNum leaps forward by more than 10 (e.g. 1990., 2014.),
        // it is a numbered point inside the question body or explanation!
        const isInternalNumberedItem =
          !isExplicit &&
          (parsedQNum < runningAutoQNum - 1 || (runningAutoQNum > 1 && parsedQNum > runningAutoQNum + 10));

        if (!isInternalNumberedItem) {
          pushSectionBlock();
          runningAutoQNum = parsedQNum + 1;
          activeBlock = {
            qNum: parsedQNum,
            subjectName: currentSubject,
            sectionId: draft.id,
            sectionName: draft.name,
            questionLines: initialText ? [initialText] : [],
            options: {},
            answer: null,
            explanation: '',
            rawSnippet: line,
          };
          continue;
        }
      }

      if (!activeBlock) continue;

      activeBlock.rawSnippet += '\n' + line;

      // Check for Answer line
      const ansMatch = line.match(answerLineRegex);
      if (ansMatch) {
        const optKey = normalizeOptionKey(ansMatch[1] || ansMatch[2]);
        if (optKey) {
          activeBlock.answer = optKey;
        }
        currentTargetOption = null;
        inExplanation = false;

        const trailing = (ansMatch[3] || '').trim();
        if (trailing) {
          activeBlock.explanation = trailing;
        }
        continue;
      }

      // Check for Explanation line
      const expMatch = line.match(explanationLineRegex);
      if (expMatch) {
        inExplanation = true;
        currentTargetOption = null;
        const expText = expMatch[1].trim();
        activeBlock.explanation = activeBlock.explanation
          ? activeBlock.explanation + '\n' + expText
          : expText;
        continue;
      }

      if (inExplanation) {
        activeBlock.explanation += '\n' + line;
        continue;
      }

      // Check for inline multiple options (e.g. (a) ... (b) ... or (c) ... (d) ...)
      const inlineOpts = extractInlineOptions(line);
      if (inlineOpts && inlineOpts.length >= 2) {
        for (const opt of inlineOpts) {
          activeBlock.options[opt.key] = opt.text;
        }
        currentTargetOption = null;
        continue;
      }

      // Check for single Option start
      const optMatch = line.match(optionStartRegex);
      if (optMatch) {
        const optKey = normalizeOptionKey(optMatch[1] || optMatch[2] || optMatch[3]);
        if (optKey) {
          currentTargetOption = optKey;
          activeBlock.options[optKey] = (optMatch[4] || '').trim();
          continue;
        }
      }

      // Option continuation
      if (currentTargetOption && activeBlock.options[currentTargetOption] !== undefined) {
        activeBlock.options[currentTargetOption] += ' ' + line;
        continue;
      }

      // Question text continuation
      activeBlock.questionLines.push(line);
    }

    pushSectionBlock();

    // Calculate section summary stats
    const sectionBlocks = allRawBlocks.filter((b) => b.sectionId === draft.id);
    const qNums = sectionBlocks.map((b) => b.qNum).filter((n) => !isNaN(n));
    const minQ = qNums.length > 0 ? Math.min(...qNums) : 1;
    const maxQ = qNums.length > 0 ? Math.max(...qNums) : sectionBlocks.length;

    sectionSummaryList.push({
      id: draft.id,
      name: draft.name,
      total_questions: sectionBlocks.length,
      from_question: minQ,
      to_question: maxQ,
      has_answer_key: sectionAnswerKeyMap.size > 0,
    });
  }

  // -------------------------------------------------------------------------
  // PHASE 3: Convert Raw Blocks to ParsedQuestion with Strict Validation
  // -------------------------------------------------------------------------
  options.onProgress?.({
    stage: 'validating',
    message: 'Validating Questions...',
  });

  // Check for duplicate question numbers per section
  const sectionQNumCount = new Map<string, number>();
  for (const block of allRawBlocks) {
    const key = `${block.sectionId}:${block.qNum}`;
    sectionQNumCount.set(key, (sectionQNumCount.get(key) || 0) + 1);
  }

  const allParsedQuestions: ParsedQuestion[] = allRawBlocks.map((block, idx) => {
    const questionText = block.questionLines.join('\n').trim();
    const optA = (block.options.A || '').trim();
    const optB = (block.options.B || '').trim();
    const optC = (block.options.C || '').trim();
    const optD = (block.options.D || '').trim();
    const correctOption = block.answer || null;

    const validationIssues: string[] = [];

    // Critical failures (Invalid)
    if (!questionText) {
      validationIssues.push('Question text missing or incomplete');
    }
    const hasAnyOption = optA || optB || optC || optD;
    if (!hasAnyOption) {
      validationIssues.push('No options found for this question');
    }

    // Warnings / Review required
    if (!optA) validationIssues.push('Missing Option A');
    if (!optB) validationIssues.push('Missing Option B');
    if (!optC) validationIssues.push('Missing Option C');
    if (!optD) validationIssues.push('Missing Option D');
    if (!correctOption) validationIssues.push('Missing Correct Answer');

    // Duplicate question number within the same section
    const dupCount = sectionQNumCount.get(`${block.sectionId}:${block.qNum}`) || 1;
    const isDup = dupCount > 1;
    if (isDup) {
      validationIssues.push(`Duplicate Question #${block.qNum} in ${block.sectionName}`);
    }

    let status: QuestionValidationStatus = 'valid';
    if (!questionText || !hasAnyOption) {
      status = 'invalid';
    } else if (validationIssues.length > 0) {
      status = 'needs_review';
    }

    return {
      id: `parsed-q-${block.sectionId}-${block.qNum || idx + 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      order: idx + 1,
      question_number: block.qNum || idx + 1,
      question_text: questionText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correctOption,
      explanation: block.explanation || '',
      marks,
      negative_marks: negMarks,
      language: lang,
      subject_id: null,
      subject_name: block.subjectName || '',
      section_id: block.sectionId,
      section_name: block.sectionName,
      status,
      validation_issues: validationIssues,
      is_duplicate: isDup,
      raw_snippet: block.rawSnippet,
    };
  });

  // -------------------------------------------------------------------------
  // PHASE 4: Filter by Section and/or Question Range if specified
  // -------------------------------------------------------------------------
  let targetQuestions = allParsedQuestions;

  // Filter by sectionId if requested
  const activeSectionId = options.sectionId;
  if (activeSectionId && activeSectionId !== 'all') {
    targetQuestions = targetQuestions.filter((q) => q.section_id === activeSectionId);
  }

  // Filter by fromQuestion and toQuestion range if requested
  if (options.fromQuestion !== undefined && options.toQuestion !== undefined) {
    const fromQ = Math.min(options.fromQuestion, options.toQuestion);
    const toQ = Math.max(options.fromQuestion, options.toQuestion);
    const totalRequested = toQ - fromQ + 1;

    const inRange = targetQuestions.filter(
      (q) => q.question_number !== undefined && q.question_number >= fromQ && q.question_number <= toQ
    );

    inRange.sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));
    inRange.forEach((q, idx) => {
      q.order = idx + 1;
    });

    const foundNumSet = new Set(inRange.map((q) => q.question_number!));
    const missingQuestionNumbers: number[] = [];
    const foundQuestionNumbers: number[] = [];

    for (let n = fromQ; n <= toQ; n++) {
      if (foundNumSet.has(n)) {
        foundQuestionNumbers.push(n);
      } else {
        missingQuestionNumbers.push(n);
      }
    }

    return {
      questions: inRange,
      requested_range: { from: fromQ, to: toQ },
      found_question_numbers: foundQuestionNumbers,
      missing_question_numbers: missingQuestionNumbers,
      is_range_complete: missingQuestionNumbers.length === 0,
      total_requested: totalRequested,
      sections: sectionSummaryList,
      selected_section_id: activeSectionId,
    };
  }

  // No question range specified
  const allNumbers = targetQuestions.map((q) => q.question_number ?? q.order);
  return {
    questions: targetQuestions,
    found_question_numbers: allNumbers,
    missing_question_numbers: [],
    is_range_complete: true,
    total_requested: targetQuestions.length,
    sections: sectionSummaryList,
    selected_section_id: activeSectionId,
  };
}

export function extractQuestionsFromText(
  rawText: string,
  options: TextExtractOptions = {}
): ParsedQuestion[] {
  return extractQuestionsWithRangeFromText(rawText, options).questions;
}
