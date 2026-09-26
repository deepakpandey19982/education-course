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
    ';q¼',     // युद्ध
    "'khr",    // शीत
    'vkSj',    // और
    'dFkuksa', // कथनों
    'lfefr',   // समिति
    'dkSu',    // कौन
    'moZjd',   // उर्वरक
    'lafoèkku',// संविधान
    'fp=k',    // चित्र
    'fliQkfj', // सिफारिश
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
 * Preserves option labels (a), (b), (c), (d), chemical formulas, and answer key notation.
 */
export function normalizeKrutiDevText(rawText: string): string {
  if (!rawText) return '';
  if (!isKrutiDevEncoded(rawText)) {
    return rawText;
  }

  return convertKrutiDevToUnicode(rawText);
}

/**
 * Enhanced core KrutiDev-010 to Unicode Devanagari converter with full ligature,
 * font-artifact, and conjunct correction.
 */
export function convertKrutiDevToUnicode(rawText: string): string {
  if (!rawText) return '';

  // Pre-process known KrutiDev font conjuncts and anomalies before transliteration:
  // 1. In KrutiDev '=k' is typed where standard Hindi is simply '=' (त्र):
  //    e.g. {ks=k -> {ks= (क्षेत्र), lw=k -> lw= (सूत्र), fp=kdkj -> fp=dkj (चित्रकार), ea=kh -> ea=h (मंत्री)
  // 2. 'fpÉ' represents 'चिह्न' (chihna). Transliteration library leaks stray 'िं' across newlines.
  // 3. '¼' is 'द्ध' (d-dha conjunct), which library incorrectly mapped to '('.
  // 4. 'Ú' is 'फ़्र/फ्र' (fra conjunct), e.g. vYÚsM (अल्फ्रेड).
  // 5. 'iQ' is 'फ़' (fa with nukta).
  const pre = rawText
    .replace(/=k/g, '=')
    .replace(/fpÉ/g, 'चिह्न')
    .replace(/ÉLo/g, 'ह्रस्व')
    .replace(/É/g, 'ह्न')
    .replace(/¼/g, 'द्ध')
    .replace(/Ú/g, 'Ý')
    .replace(/iQ/g, 'Q+');

  // Run standard KrutiDev to Unicode conversion
  let text = krutiDevToUnicode(pre);

  // Post-process known KrutiDev transliteration anomalies and ligatures:
  text = text
    // Fix tra+aa followed by ee: 'मंत्राी' -> 'मंत्री', 'शास्त्राीय' -> 'शास्त्रीय'
    .replace(/([क-ह]्?त्र)ा([ीि])/g, '$1$2')
    // Fix common over-extended aa-matra words
    .replace(/\bक्षेत्रा\b/g, 'क्षेत्र')
    .replace(/\bचित्राकार\b/g, 'चित्रकार')
    .replace(/\bचित्रा\b/g, 'चित्र')
    .replace(/\bपात्रा\b/g, 'पात्र')
    .replace(/\bसूत्रा\b/g, 'सूत्र')
    .replace(/\bशास्त्रा\b/g, 'शास्त्र')
    .replace(/शास्त्राी/g, 'शास्त्री')
    .replace(/मुख्यमंत्राी/g, 'मुख्यमंत्री')
    .replace(/मंत्राी/g, 'मंत्री')
    .replace(/सिपफारिश/g, 'सिफारिश')
    .replace(/सिफ़ारिश/g, 'सिफारिश')
    .replace(/पफ/g, 'फ़')
    .replace(/अल्Úेड/g, 'अल्फ्रेड')
    .replace(/Úे/g, 'फ्रे')
    .replace(/Úि/g, 'फ्रि')
    .replace(/Ú/g, 'फ्र')
    .replace(/यु\(/g, 'युद्ध')
    .replace(/सम्ब\(/g, 'सम्बद्ध')
    .replace(/बु\(/g, 'बुद्धि')
    // Map converted option brackets:
    // In KrutiDev font: ( is ; and ) is द्ध. a -> ं, b -> इ, c -> ब, d -> क
    .replace(/[;\(]\s*ं\s*द्ध/g, '(a)')
    .replace(/[;\(]\s*इ\s*द्ध/g, '(b)')
    .replace(/[;\(]\s*ब\s*द्ध/g, '(c)')
    .replace(/[;\(]\s*क\s*द्ध/g, '(d)')
    .replace(/[;\(]\s*a\s*[\)द्ध]/gi, '(a)')
    .replace(/[;\(]\s*b\s*[\)द्ध]/gi, '(b)')
    .replace(/[;\(]\s*c\s*[\)द्ध]/gi, '(c)')
    .replace(/[;\(]\s*d\s*[\)द्ध]/gi, '(d)')
    // Fix parenthetical expressions: ; गायन द्ध -> (गायन) or यगायनद्ध -> (गायन)
    .replace(/;([^\s;द्ध\(\)]+)\s*द्ध/g, '($1)')
    .replace(/;\s*([^\(\)]+?)\s*द्ध/g, '($1)')
    .replace(/य([क-ह][\u0900-\u097F]{1,30})\s*द्ध/g, '($1)')
    // Fix matra ordering: anusvara before e-matra: मंे -> में, मंै -> मैं
    .replace(/([क-ह])ंे/g, '$1ें')
    .replace(/([क-ह])ंै/g, '$1ैं')
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
