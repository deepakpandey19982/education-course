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

export function extractQuestionsFromText(
  rawText: string,
  options: {
    defaultMarks?: number;
    defaultNegativeMarks?: number;
    defaultLanguage?: string;
  } = {}
): ParsedQuestion[] {
  const marks = options.defaultMarks ?? 1;
  const negMarks = options.defaultNegativeMarks ?? 0;
  const lang = options.defaultLanguage || 'English';

  if (!rawText || !rawText.trim()) {
    return [];
  }

  // Pre-process: normalize various bullet/dash characters, standardize newlines
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  const lines = normalized.split('\n');

  // Check if an Answer Key exists at the end of the text
  // e.g. "Answer Key\n1. B\n2. C..." or "Answers: 1-B, 2-C..."
  const answerKeyMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const answerKeyRegex = /(?:answer\s*key|answers|उत्तर\s*कुंजी)[\s\S]*$/i;
  const answerKeySection = normalized.match(answerKeyRegex);
  if (answerKeySection) {
    const akText = answerKeySection[0];
    const pairMatches = akText.matchAll(/(?:(?:Q\.?|प्रश्न\s*)?(\d{1,4}))\s*[:\.\-\)]\s*\(?([A-Da-d1-4क-घ])\)?/gi);
    for (const match of pairMatches) {
      const qNum = parseInt(match[1], 10);
      const opt = normalizeOptionKey(match[2]);
      if (opt && !isNaN(qNum)) {
        answerKeyMap.set(qNum, opt);
      }
    }
  }

  // Regex for question starters:
  // Q1. / Q.1 / Q-1 / Q. 1 / Question 1: / प्रश्न 1: / प्र. 1. / 1. / 1) / (1)
  const questionStartRegex = /^(?:(?:Q(?:uestion|\.)?|प्रश्न|प्र\.)\s*(\d{1,4})(?:\s*[:\.\-\)]|\s+)|\((\d{1,4})\)|(\d{1,4})\s*[\.\)])\s*(.*)$/i;

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

    // Check for Subject header
    const subjectHeader = detectSubjectHeader(line);
    if (subjectHeader) {
      currentSubject = subjectHeader;
      continue;
    }

    // Check for Question start
    const qMatch = line.match(questionStartRegex);
    if (qMatch) {
      pushActiveBlock();

      const qNumStr = qMatch[1] || qMatch[2] || qMatch[3];
      const qNum = parseInt(qNumStr, 10);
      const initialText = (qMatch[4] || '').trim();

      activeBlock = {
        qNum,
        subjectName: currentSubject,
        questionLines: initialText ? [initialText] : [],
        options: {},
        answer: null,
        explanation: '',
        rawSnippet: line,
      };
      continue;
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
    // or "(a) Apple (b) Banana"
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
  const parsedQuestions: ParsedQuestion[] = rawBlocks.map((block, idx) => {
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
      id: `parsed-q-${idx + 1}-${Date.now().toString(36)}`,
      order: idx + 1,
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

  return parsedQuestions;
}
