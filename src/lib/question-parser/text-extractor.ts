import { ParsedQuestion } from './types';

// Map Hindi option identifiers to standard A, B, C, D
function normalizeOptionKey(key: string): 'A' | 'B' | 'C' | 'D' | null {
  const clean = key.trim().toUpperCase();
  if (['A', '1', 'क'].includes(clean)) return 'A';
  if (['B', '2', 'ख'].includes(clean)) return 'B';
  if (['C', '3', 'ग'].includes(clean)) return 'C';
  if (['D', '4', 'घ'].includes(clean)) return 'D';
  return null;
}

// Check if a line appears to be a Subject header
export function detectSubjectHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return null;

  // Patterns like: "Subject: Computer", "Section A: Reasoning", "विषय: सामान्य ज्ञान"
  const explicitMatch = trimmed.match(/^(?:subject|section|part|topic|खंड|भाग|विषय)\s*[:\-\—]\s*([a-zA-Z0-9\u0900-\u097F\s&/]+)$/i);
  if (explicitMatch && explicitMatch[1].trim()) {
    return explicitMatch[1].trim();
  }

  // Standalone capital words like: "COMPUTER KNOWLEDGE", "GENERAL AWARENESS", "REASONING", "MATHEMATICS"
  const commonSubjects = [
    'COMPUTER', 'COMPUTER KNOWLEDGE', 'COMPUTER OPERATOR', 'GENERAL KNOWLEDGE', 'GENERAL AWARENESS',
    'REASONING', 'MENTAL APTITUDE', 'QUANTITATIVE APTITUDE', 'MATHEMATICS', 'MATHS', 'HINDI', 'ENGLISH',
    'CURRENT AFFAIRS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'POLITY', 'ECONOMICS', 'LEGAL APTITUDE'
  ];

  const upper = trimmed.toUpperCase();
  for (const s of commonSubjects) {
    if (upper === s || upper === `SECTION - ${s}` || upper === `SECTION: ${s}` || upper === `PART - ${s}`) {
      return s;
    }
  }

  // All caps standalone heading of 3-30 chars without punctuation that isn't a question or answer
  if (/^[A-Z\s&/]{3,35}$/.test(trimmed) && !trimmed.startsWith('Q') && !trimmed.startsWith('ANSWER') && !trimmed.startsWith('ANS')) {
    // Avoid single option lines like "A"
    if (trimmed.length > 4 && !/^[A-D]$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

export interface TextExtractOptions {
  fromQuestion?: number;
  toQuestion?: number;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  defaultLanguage?: string;
}

export interface TextExtractRangeResult {
  questions: ParsedQuestion[];
  requested_range?: { from: number; to: number };
  found_question_numbers: number[];
  missing_question_numbers: number[];
  is_range_complete: boolean;
  total_requested: number;
}

// Check if a line is a document page header/footer line to avoid polluting questions
function isHeaderOrFooterLine(line: string): boolean {
  const clean = line.trim();
  if (!clean) return false;
  // Match lines like: Page 1, Page 1 of 400, 1 of 50, -- 1 --, - 1 -, --- Page 1 ---
  if (/^page\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(clean)) return true;
  if (/^\d+\s*(?:of|\/)\s*\d+$/i.test(clean)) return true;
  if (/^[-–—]{1,3}\s*\d+\s*[-–—]{1,3}$/.test(clean)) return true;
  if (/^---+.*---+$/.test(clean) && !clean.includes('=')) return true;
  return false;
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
    };
  }

  // Pre-process: normalize bullet/dash characters, standardize newlines
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  const lines = normalized.split('\n');

  // Check if an Answer Key exists at the end of the text
  const answerKeyMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const answerKeyRegex = /(?:answer\s*key|answers|उत्तर\s*कुंजी)[\s\S]*$/i;
  const answerKeySection = normalized.match(answerKeyRegex);
  if (answerKeySection) {
    const akText = answerKeySection[0];
    const pairMatches = akText.matchAll(/(?:(?:Q(?:uestion|\.)?|प्रश्न\s*)?(\d{1,5}))\s*[:\.\-\)]\s*\(?([A-Da-d1-4क-घ])\)?/gi);
    for (const match of pairMatches) {
      const qNum = parseInt(match[1], 10);
      const opt = normalizeOptionKey(match[2]);
      if (opt && !isNaN(qNum)) {
        answerKeyMap.set(qNum, opt);
      }
    }
  }

  // Regex for question starters:
  // Q1. / Q.1 / Q-1 / Q. 1 / Q 1 / Question 1 / Question No. 1 / Que. 1 / प्रश्न 1 / प्र. 1 / 1. / 1) / (1) / [1]
  // Group 1: Q / Question / Que / प्रश्न / प्र followed by number
  // Group 2: (123)
  // Group 3: [123]
  // Group 4: 123. or 123) or 123:
  // Group 5: Trailing question text
  const questionStartRegex = /^(?:(?:Q(?:uestion|ue)?\.?|प्रश्न|प्र\.?)(?:\s*(?:no\.?|नंबर|संख्या|सं\.?|क्र\.?|number|num\.?))?\s*(\d{1,5})(?:[\s:\.\-\)]+|$)|(?:(?:\((\d{1,5})\)|\[(\d{1,5})\]|(\d{1,5})\s*[\.\:\-\)])(?:\s+|$)))\s*(.*)$/i;


  // Regex for option starters:
  // (A) / A. / A) / [A] / (क) / क.
  const optionStartRegex = /^(?:\(([A-Da-dक-घ1-4])\)|([A-Da-dक-घ1-4])\s*[\.\)\-\]]|\[([A-Da-dक-घ1-4])\])\s*(.*)$/;

  // Regex for answer indicators:
  // Answer: B / Ans: B / उत्तर: B / Answer - B / Ans. B / Option B / Correct: B
  const answerLineRegex = /^(?:(?:correct\s*)?(?:answer|ans|उत्तर|option|विकल्प)\s*[:\.\-\—]\s*\(?([A-Da-dक-घ1-4])\)?|(?:उत्तर|ans|answer)\s+([A-Da-dक-घ1-4]))\s*(.*)$/i;

  // Regex for explanation:
  // Explanation: ... / व्याख्या: ... / Solution: ... / हल: ...
  const explanationLineRegex = /^(?:explanation|व्याख्या|solution|हल|नोट|note)\s*[:\.\-\—]\s*(.*)$/i;

  interface RawBlock {
    qNum: number;
    subjectName: string;
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

  const rawBlocks: RawBlock[] = [];
  let currentSubject = '';
  let activeBlock: RawBlock | null = null;
  let currentTargetOption: 'A' | 'B' | 'C' | 'D' | null = null;
  let inExplanation = false;
  let runningAutoQNum = 1;

  const pushActiveBlock = () => {
    if (activeBlock) {
      // Check answer key map if answer was not in block
      if (!activeBlock.answer && activeBlock.qNum && answerKeyMap.has(activeBlock.qNum)) {
        activeBlock.answer = answerKeyMap.get(activeBlock.qNum) || null;
      }
      rawBlocks.push(activeBlock);
      activeBlock = null;
      currentTargetOption = null;
      inExplanation = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    // Ignore page headers/footers
    if (isHeaderOrFooterLine(line)) {
      continue;
    }

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

      // Guard against false positive option numbers:
      // If we are currently inside a question with question number > 4 (e.g. Q5, Q101),
      // and a line like "1." or "(1)" appears with NO options A populated yet,
      // it could be Option 1 of this question rather than restarting Question 1.
      const isLikelyOption1 =
        activeBlock &&
        activeBlock.qNum > 4 &&
        parsedQNum <= 4 &&
        !activeBlock.options.A &&
        !qMatch[1]; // Only if it was plain "1." or "(1)", not explicit "Q1." or "Question 1"

      if (!isLikelyOption1) {
        pushActiveBlock();

        runningAutoQNum = parsedQNum + 1;

        activeBlock = {
          qNum: parsedQNum,
          subjectName: currentSubject,
          questionLines: initialText ? [initialText] : [],
          options: {},
          answer: null,
          explanation: '',
          rawSnippet: line,
        };
        continue;
      }
    }

    if (!activeBlock) {
      // Line before first question started (e.g. title/instruction), ignore
      continue;
    }

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

      // Rest of line could be explanation
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

    // Check if line contains inline multiple options, e.g. "(A) Apple (B) Banana (C) Cherry (D) Date"
    const inlineOptionsRegex = /(?:\(([A-Da-dक-घ1-4])\)|(?:\b|^)([A-Da-dक-घ1-4])\s*[\.\)\-\]])\s*([^\(\[\nA-Da-dक-घ1-4]+?)(?=(?:\(([A-Da-dक-घ1-4])\)|(?:\b|^)([A-Da-dक-घ1-4])\s*[\.\)\-\]])|$)/g;
    const inlineMatches = Array.from(line.matchAll(inlineOptionsRegex));

    if (inlineMatches.length >= 2) {
      // Process inline options
      for (const m of inlineMatches) {
        const optKey = normalizeOptionKey(m[1] || m[2]);
        const optText = (m[3] || '').trim();
        if (optKey && optText) {
          activeBlock.options[optKey] = optText;
        }
      }
      currentTargetOption = null;
      continue;
    }

    // Check for single Option start: e.g. "A. शेर" or "(A) Tiger"
    const optMatch = line.match(optionStartRegex);
    if (optMatch) {
      const optKey = normalizeOptionKey(optMatch[1] || optMatch[2] || optMatch[3]);
      if (optKey) {
        currentTargetOption = optKey;
        activeBlock.options[optKey] = (optMatch[4] || '').trim();
        continue;
      }
    }

    // If we are currently inside an option, this line is a continuation of that option
    if (currentTargetOption && activeBlock.options[currentTargetOption] !== undefined) {
      activeBlock.options[currentTargetOption] += ' ' + line;
      continue;
    }

    // Otherwise, this line is a continuation of question text
    activeBlock.questionLines.push(line);
  }

  // Push final block
  pushActiveBlock();

  // Convert raw blocks to ParsedQuestion objects with validation
  const allParsedQuestions: ParsedQuestion[] = rawBlocks.map((block, idx) => {
    const questionText = block.questionLines.join('\n').trim();
    const optA = (block.options.A || '').trim();
    const optB = (block.options.B || '').trim();
    const optC = (block.options.C || '').trim();
    const optD = (block.options.D || '').trim();
    const correctOption = block.answer || null;

    const validationIssues: string[] = [];
    if (!questionText) {
      validationIssues.push('Question text missing or incomplete');
    }
    if (!optA) validationIssues.push('Missing Option A');
    if (!optB) validationIssues.push('Missing Option B');
    if (!optC) validationIssues.push('Missing Option C');
    if (!optD) validationIssues.push('Missing Option D');
    if (!correctOption) validationIssues.push('Missing Correct Answer');

    const isValid = validationIssues.length === 0;

    return {
      id: `parsed-q-${block.qNum || idx + 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
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
      status: isValid ? 'valid' : 'needs_review',
      validation_issues: validationIssues,
      is_duplicate: false,
      raw_snippet: block.rawSnippet,
    };
  });

  // If question range is specified (fromQuestion and toQuestion)
  if (options.fromQuestion !== undefined && options.toQuestion !== undefined) {
    const fromQ = Math.min(options.fromQuestion, options.toQuestion);
    const toQ = Math.max(options.fromQuestion, options.toQuestion);
    const totalRequested = toQ - fromQ + 1;

    // Filter questions whose detected question_number falls within the requested range
    const inRange = allParsedQuestions.filter(
      (q) => q.question_number !== undefined && q.question_number >= fromQ && q.question_number <= toQ
    );

    // Sort in ascending order of question_number
    inRange.sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));

    // Reset sequential order for test
    inRange.forEach((q, idx) => {
      q.order = idx + 1;
    });

    // Detect missing question numbers
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
    };
  }

  // No range specified: return all questions
  const allNumbers = allParsedQuestions.map((q) => q.question_number ?? q.order);
  return {
    questions: allParsedQuestions,
    found_question_numbers: allNumbers,
    missing_question_numbers: [],
    is_range_complete: true,
    total_requested: allParsedQuestions.length,
  };
}

export function extractQuestionsFromText(
  rawText: string,
  options: TextExtractOptions = {}
): ParsedQuestion[] {
  return extractQuestionsWithRangeFromText(rawText, options).questions;
}

