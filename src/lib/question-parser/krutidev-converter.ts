import { krutiDevToUnicode } from '@bharattype/hindi-transliteration';

/**
 * Detects if the extracted text from PDF/DOC is encoded in KrutiDev / DevLys-010 legacy Hindi font.
 */
export function isKrutiDevEncoded(text: string): boolean {
  if (!text || text.length < 15) return false;
  const sample = text.slice(0, 5000);
  const indicators = [
    'izSfDVl', // प्रैक्टिस
    'lsV',     // सेट
    'Hkkx',    // भाग
    'mÙkj',    // उत्तर
    'mÙkjekyk',// उत्तरमाला
    'foèkkulHkk', // विधानसभा
    'lkekU;',  // सामान्य
    'gS\\',    // है?
    'jkT;',    // राज्य
    'D;k ',    // क्या 
    'fØ;k',    // क्रिया
    'fuEufyf[kr', // निम्नलिखित
  ];
  let matches = 0;
  for (const ind of indicators) {
    if (sample.includes(ind)) {
      matches++;
      if (matches >= 2) return true;
    }
  }
  return false;
}

/**
 * Normalizes KrutiDev / DevLys text into clean, standard Unicode Devanagari Hindi.
 * Preserves option labels (a), (b), (c), (d) and answer key notation.
 */
export function normalizeKrutiDevText(rawText: string): string {
  if (!rawText || !isKrutiDevEncoded(rawText)) {
    return rawText;
  }

  // Pre-process known KrutiDev font conjuncts and anomalies before transliteration:
  // 1. In KrutiDev 010, 'fpÉ' represents 'चिह्न' (chihna). The transliteration library
  //    replaces 'É' with 'र्fa' (short-i + anusvara), which across newlines leaks a stray 'िं'
  //    onto the following line, turning e.g. "49." into "िं49.", breaking question detection.
  const pre = rawText
    .replace(/fpÉ/g, 'चिह्न')
    .replace(/ÉLo/g, 'ह्रस्व')
    .replace(/É/g, 'ह्न');

  // Run standard KrutiDev to Unicode conversion
  let text = krutiDevToUnicode(pre);

  // Map converted option brackets:
  // In KrutiDev font:
  // ( is ; and ) is द्ध
  // a -> ं, b -> इ, c -> ब, d -> क
  text = text
    .replace(/[;\(]\s*ं\s*द्ध/g, '(a)')
    .replace(/[;\(]\s*इ\s*द्ध/g, '(b)')
    .replace(/[;\(]\s*ब\s*द्ध/g, '(c)')
    .replace(/[;\(]\s*क\s*द्ध/g, '(d)')
    .replace(/[;\(]\s*a\s*[\)द्ध]/gi, '(a)')
    .replace(/[;\(]\s*b\s*[\)द्ध]/gi, '(b)')
    .replace(/[;\(]\s*c\s*[\)द्ध]/gi, '(c)')
    .replace(/[;\(]\s*d\s*[\)द्ध]/gi, '(d)')
    .replace(/mÙkjekyk/g, 'उत्तरमाला')
    .replace(/mÙkj/g, 'उत्तर')
    .replace(/izSfDVl\s*lsV/g, 'प्रैक्टिस सेट')
    // In KrutiDev, period '.' typed on English keyboard converts to 'ण्'.
    // Restore question numbering like "84ण्", "91ण्", "111ण्" to "84.", "91.", "111."
    .replace(/(\d{1,5})ण्/g, '$1.')
    // Clean any stray combining marks / vowel signs that precede a question number at line start
    .replace(/(?:^|\n)[\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]+(\d{1,5})/g, '\n$1');

  return text;
}

