import * as XLSX from 'xlsx';
import { ParsedQuestion } from './types';

// Map recognized column variations to standard keys
const COLUMN_ALIASES: Record<string, string[]> = {
  question: [
    'question', 'question text', 'question_text', 'questiontext', 'q', 'ques',
    'query', 'item', 'प्रश्न', 'सवाल'
  ],
  option_a: [
    'option a', 'option_a', 'optiona', 'opt a', 'opt_a', 'opta', 'a',
    'option 1', 'option_1', 'opt 1', 'विकल्प a', 'विकल्प 1', 'क'
  ],
  option_b: [
    'option b', 'option_b', 'optionb', 'opt b', 'opt_b', 'optb', 'b',
    'option 2', 'option_2', 'opt 2', 'विकल्प b', 'विकल्प 2', 'ख'
  ],
  option_c: [
    'option c', 'option_c', 'optionc', 'opt c', 'opt_c', 'optc', 'c',
    'option 3', 'option_3', 'opt 3', 'विकल्प c', 'विकल्प 3', 'ग'
  ],
  option_d: [
    'option d', 'option_d', 'optiond', 'opt d', 'opt_d', 'optd', 'd',
    'option 4', 'option_4', 'opt 4', 'विकल्प d', 'विकल्प 4', 'घ'
  ],
  answer: [
    'answer', 'correct answer', 'correct_answer', 'correctanswer', 'ans',
    'correct option', 'correct_option', 'correctoption', 'key', 'answer key',
    'right answer', 'उत्तर', 'सही उत्तर'
  ],
  subject: [
    'subject', 'subject name', 'subject_name', 'topic', 'section',
    'category', 'विषय', 'भाग', 'खंड'
  ],
  explanation: [
    'explanation', 'solution', 'rationale', 'desc', 'description',
    'व्याख्या', 'हल', 'विवरण'
  ],
  question_number: [
    'question no', 'question_no', 'question number', 'question_number',
    'qno', 'q no', 'q_no', 'sl no', 'sr no', 's no', 'क्रमांक', 'प्र. सं.', 'प्रश्न संख्या'
  ],
  marks: ['marks', 'mark', 'points', 'score', 'अंक'],
  negative_marks: ['negative marks', 'negative_marks', 'neg marks', 'penalty'],
  language: ['language', 'lang', 'भाषा']
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s\-_]+/g, ' ');
}

function normalizeAnswerValue(val: any): 'A' | 'B' | 'C' | 'D' | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toUpperCase();

  if (['A', '1', 'OPTION A', 'OPT A', '(A)', 'क'].includes(s)) return 'A';
  if (['B', '2', 'OPTION B', 'OPT B', '(B)', 'ख'].includes(s)) return 'B';
  if (['C', '3', 'OPTION C', 'OPT C', '(C)', 'ग'].includes(s)) return 'C';
  if (['D', '4', 'OPTION D', 'OPT D', '(D)', 'घ'].includes(s)) return 'D';

  // Maybe starts with A., B., etc.
  if (/^[A-D]\b/.test(s)) return s[0] as 'A' | 'B' | 'C' | 'D';

  return null;
}

export function parseExcelOrCsv(
  buffer: Buffer,
  options: {
    defaultMarks?: number;
    defaultNegativeMarks?: number;
    defaultLanguage?: string;
  } = {}
): {
  questions: ParsedQuestion[];
  detectedMapping: Record<string, string>;
  rowCount: number;
} {
  const marks = options.defaultMarks ?? 1;
  const negMarks = options.defaultNegativeMarks ?? 0;
  const lang = options.defaultLanguage || 'English';

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { questions: [], detectedMapping: {}, rowCount: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  // Parse rows as raw 2D array to inspect headers and handle any format
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 2) {
    return { questions: [], detectedMapping: {}, rowCount: 0 };
  }

  // Find header row (usually row 0, but check first 3 rows if empty titles)
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(5, rawRows.length); r++) {
    const row = rawRows[r].map((cell) => normalizeHeader(String(cell)));
    const hasQuestion = row.some((c) => COLUMN_ALIASES.question.includes(c));
    const hasOption = row.some((c) => COLUMN_ALIASES.option_a.includes(c));
    if (hasQuestion || hasOption) {
      headerRowIndex = r;
      break;
    }
  }

  const headers = rawRows[headerRowIndex].map((cell) => String(cell).trim());
  const detectedMapping: Record<string, string> = {}; // standardKey -> originalHeader
  const colIndexMap: Record<string, number> = {}; // standardKey -> column index

  // Detect column mapping
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const norm = normalizeHeader(headers[colIdx]);
    if (!norm) continue;

    for (const [standardKey, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (!colIndexMap[standardKey] && aliases.includes(norm)) {
        colIndexMap[standardKey] = colIdx;
        detectedMapping[standardKey] = headers[colIdx];
        break;
      }
    }
  }

  // Fallback positional detection if headers are completely generic (e.g., Col1, Col2)
  if (colIndexMap.question === undefined && headers.length >= 5) {
    // If first column looks like question or subject
    if (headers.length >= 6) {
      colIndexMap.subject = 0;
      colIndexMap.question = 1;
      colIndexMap.option_a = 2;
      colIndexMap.option_b = 3;
      colIndexMap.option_c = 4;
      colIndexMap.option_d = 5;
      if (headers.length >= 7) colIndexMap.answer = 6;
    } else {
      colIndexMap.question = 0;
      colIndexMap.option_a = 1;
      colIndexMap.option_b = 2;
      colIndexMap.option_c = 3;
      colIndexMap.option_d = 4;
      if (headers.length >= 6) colIndexMap.answer = 5;
    }
  }

  const dataRows = rawRows.slice(headerRowIndex + 1);
  const questions: ParsedQuestion[] = [];

  dataRows.forEach((row, rowIdx) => {
    // Skip completely empty rows
    const isRowEmpty = row.every((c) => c === null || c === undefined || String(c).trim() === '');
    if (isRowEmpty) return;

    const getVal = (key: string) => {
      const idx = colIndexMap[key];
      return idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : '';
    };

    const questionText = getVal('question');
    const optA = getVal('option_a');
    const optB = getVal('option_b');
    const optC = getVal('option_c');
    const optD = getVal('option_d');
    const rawAnswer = getVal('answer');
    const correctOption = normalizeAnswerValue(rawAnswer);
    const subjectName = getVal('subject');
    const explanation = getVal('explanation');
    const rowMarks = parseFloat(getVal('marks')) || marks;
    const rowNeg = parseFloat(getVal('negative_marks')) || negMarks;
    const rowLang = getVal('language') || lang;

    const rawQNum = getVal('question_number');
    const parsedQNum = parseInt(rawQNum, 10);
    const questionNumber = !isNaN(parsedQNum) ? parsedQNum : rowIdx + 1;

    const validationIssues: string[] = [];
    if (!questionText) validationIssues.push('Question text missing');
    if (!optA) validationIssues.push('Missing Option A');
    if (!optB) validationIssues.push('Missing Option B');
    if (!optC) validationIssues.push('Missing Option C');
    if (!optD) validationIssues.push('Missing Option D');
    if (!correctOption) validationIssues.push('Missing Correct Answer');

    const isValid = validationIssues.length === 0;

    questions.push({
      id: `excel-q-${rowIdx + 1}-${Date.now().toString(36)}`,
      order: questions.length + 1,
      question_number: questionNumber,
      question_text: questionText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correctOption,
      explanation,
      marks: rowMarks,
      negative_marks: rowNeg,
      language: rowLang,
      subject_id: null,
      subject_name: subjectName,
      status: isValid ? 'valid' : 'needs_review',
      validation_issues: validationIssues,
      is_duplicate: false,
      raw_snippet: row.join(' | '),
    });
  });

  return {
    questions,
    detectedMapping,
    rowCount: dataRows.length,
  };
}
