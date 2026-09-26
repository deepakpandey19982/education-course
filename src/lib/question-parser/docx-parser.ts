import mammoth from 'mammoth';
import { extractQuestionsWithRangeFromText, TextExtractOptions, TextExtractRangeResult } from './text-extractor';

export async function parseDocx(
  buffer: Buffer,
  options: TextExtractOptions = {}
): Promise<{
  questions: TextExtractRangeResult['questions'];
  rawText: string;
  sections?: TextExtractRangeResult['sections'];
  requested_range?: TextExtractRangeResult['requested_range'];
  found_question_numbers?: TextExtractRangeResult['found_question_numbers'];
  missing_question_numbers?: TextExtractRangeResult['missing_question_numbers'];
  is_range_complete?: boolean;
  total_requested?: number;
}> {
  // Check for legacy binary .doc signature (OLE compound document: D0 CF 11 E0)
  if (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    throw new Error(
      'Legacy binary Word (.doc) format detected. Please save or export your document as standard Word (.docx) or PDF and upload again.'
    );
  }

  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value || '';

  const rangeResult = extractQuestionsWithRangeFromText(rawText, options);

  return {
    questions: rangeResult.questions,
    rawText,
    sections: rangeResult.sections,
    requested_range: rangeResult.requested_range,
    found_question_numbers: rangeResult.found_question_numbers,
    missing_question_numbers: rangeResult.missing_question_numbers,
    is_range_complete: rangeResult.is_range_complete,
    total_requested: rangeResult.total_requested,
  };
}
