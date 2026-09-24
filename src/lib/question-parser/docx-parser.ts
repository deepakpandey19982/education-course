import mammoth from 'mammoth';
import { extractQuestionsFromText } from './text-extractor';
import { ParsedQuestion } from './types';

export async function parseDocx(
  buffer: Buffer,
  options: {
    defaultMarks?: number;
    defaultNegativeMarks?: number;
    defaultLanguage?: string;
  } = {}
): Promise<{
  questions: ParsedQuestion[];
  rawText: string;
}> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value || '';

  const questions = extractQuestionsFromText(rawText, options);

  return {
    questions,
    rawText,
  };
}
