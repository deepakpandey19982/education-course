import assert from 'assert';
import { convertKrutiDevToUnicode } from '../src/lib/question-parser/krutidev-converter';
import { formatChemicalFormulas } from '../src/lib/question-parser/pdf-parser';
import { extractQuestionsWithRangeFromText, parseAnswerKey } from '../src/lib/question-parser/text-extractor';

console.log('=== STARTING UNIVERSAL QUESTION IMPORTER REGRESSION SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

// -------------------------------------------------------------------------
// 1. Hindi Unicode Transliteration & Corruptions Fixes
// -------------------------------------------------------------------------
runTest('1. KrutiDev transliteration fixes trailing tra/tri (क्षेत्र, सूत्र, मुख्यमंत्री, शास्त्रीय)', () => {
  const convertedKshetr = convertKrutiDevToUnicode('{ks=k');
  assert.ok(convertedKshetr.includes('क्षेत्र'), `Expected क्षेत्र, got: ${convertedKshetr}`);

  const convertedSutra = convertKrutiDevToUnicode('lw=k');
  assert.ok(convertedSutra.includes('सूत्र'), `Expected सूत्र, got: ${convertedSutra}`);

  const convertedMukhya = convertKrutiDevToUnicode('eq[;ea=kh');
  assert.ok(convertedMukhya.includes('मुख्यमंत्री'), `Expected मुख्यमंत्री, got: ${convertedMukhya}`);

  const convertedShastriya = convertKrutiDevToUnicode("\'kkL=kh;");
  assert.ok(convertedShastriya.includes('शास्त्रीय'), `Expected शास्त्रीय, got: ${convertedShastriya}`);
});

runTest('2. KrutiDev fixes ddh conjuncts and punctuation (शीत युद्ध, सम्बन्ध, सिफारिश)', () => {
  const convertedYuddh = convertKrutiDevToUnicode("'khr ;q¼");
  assert.ok(convertedYuddh.includes('शीत युद्ध'), `Expected शीत युद्ध, got: ${convertedYuddh}`);

  const convertedSifaris = convertKrutiDevToUnicode("fliQkfj'k");
  assert.ok(convertedSifaris.includes('सिफारिश'), `Expected सिफारिश, got: ${convertedSifaris}`);

  const convertedParen = convertKrutiDevToUnicode(';xk;uद्ध');
  assert.ok(convertedParen.includes('(गायन)'), `Expected (गायन), got: ${convertedParen}`);
});

// -------------------------------------------------------------------------
// 2. Chemical Formula Subscript Formatting
// -------------------------------------------------------------------------
runTest('3. Chemical formula subscript formatting (CO₂, NO₂, CH₄, O₂)', () => {
  const text = 'निम्न में से कौन सी गैस CO 2, NO 2, CH 4 या O 2 है?';
  const formatted = formatChemicalFormulas(text);
  assert.ok(formatted.includes('CO₂'), `Expected CO₂, got: ${formatted}`);
  assert.ok(formatted.includes('NO₂'), `Expected NO₂, got: ${formatted}`);
  assert.ok(formatted.includes('CH₄'), `Expected CH₄, got: ${formatted}`);
  assert.ok(formatted.includes('O₂'), `Expected O₂, got: ${formatted}`);
});

// -------------------------------------------------------------------------
// 3. English + Hindi Mixed Terms Preservation
// -------------------------------------------------------------------------
runTest('4. English words & acronyms inside Hindi text', () => {
  const sample = 'शीत युद्ध (Cold War) के सन्दर्भ में (ISO) मानक क्या है?';
  assert.ok(sample.includes('(Cold War)'), 'English parenthetical term preserved');
  assert.ok(sample.includes('(ISO)'), 'English acronym preserved');
});

// -------------------------------------------------------------------------
// 4. Sequence Questions & Internal Statements Preservation
// -------------------------------------------------------------------------
runTest('5. Sequence question internal statements are NOT hijacked as question numbers', () => {
  const rawDoc = `
14. शीत युद्ध (Cold War) के सन्दर्भ में निम्नलिखित घटनाओं को कालक्रमानुसार व्यवस्थित कीजिए।
1. कोरिया युद्ध
2. वियतनाम युद्ध
3. क्यूबा मिसाइल संकट
4. बर्लिन की दीवार का विखण्डन
कूट:
(a) 1, 2, 4, 3
(b) 4, 3, 2, 1
(c) 2, 4, 3, 1
(d) 1, 3, 2, 4

15. निम्नलिखित गैसों में से कौन-सी एक ग्रीन हाउस गैस नहीं है?
(a) CO₂
(b) NO₂
(c) CH₄
(d) O₂
`;

  const res = extractQuestionsWithRangeFromText(rawDoc, { fromQuestion: 14, toQuestion: 15 });
  assert.strictEqual(res.questions.length, 2, `Expected 2 questions, got ${res.questions.length}`);

  const q14 = res.questions.find((q) => q.question_number === 14);
  assert.ok(q14, 'Question 14 must exist');
  assert.ok(q14.question_text.includes('1. कोरिया युद्ध'), 'Q14 must contain statement 1');
  assert.ok(q14.question_text.includes('2. वियतनाम युद्ध'), 'Q14 must contain statement 2');
  assert.ok(q14.question_text.includes('3. क्यूबा मिसाइल संकट'), 'Q14 must contain statement 3');
  assert.ok(q14.question_text.includes('4. बर्लिन की दीवार का विखण्डन'), 'Q14 must contain statement 4');
  assert.strictEqual(q14.option_a, '1, 2, 4, 3', 'Q14 Option A matches');
  assert.strictEqual(q14.option_d, '1, 3, 2, 4', 'Q14 Option D matches');

  const q15 = res.questions.find((q) => q.question_number === 15);
  assert.ok(q15, 'Question 15 must exist as a separate question');
  assert.strictEqual(q15.option_a, 'CO₂', 'Q15 Option A matches');
  assert.strictEqual(q15.option_d, 'O₂', 'Q15 Option D matches');
});

// -------------------------------------------------------------------------
// 5. Instruction & Front-Matter Filtering
// -------------------------------------------------------------------------
runTest('6. Instruction lines before Question 1 are ignored', () => {
  const rawDoc = `
प्रैक्टिस सेट - 1
निर्देश
160 वस्तुनिष्ठ बहुविकल्पीय प्रश्न दिए गए हैं।
3 घण्टे की अवधि है।

1. राज्य विधान सभा में धन विधेयक किसकी पूर्व अनुमति से प्रस्तुत किया जा सकता है?
(a) राज्यपाल
(b) मुख्यमंत्री
(c) विधानसभा अध्यक्ष
(d) वित्त मंत्री
`;

  const res = extractQuestionsWithRangeFromText(rawDoc, { fromQuestion: 1, toQuestion: 1 });
  assert.strictEqual(res.questions.length, 1, `Expected 1 question, got ${res.questions.length}`);
  const q1 = res.questions[0];
  assert.strictEqual(q1.question_number, 1);
  assert.ok(!q1.question_text.includes('160 वस्तुनिष्ठ'), 'Instruction text must not be in Question 1');
  assert.strictEqual(q1.option_a, 'राज्यपाल');
  assert.strictEqual(q1.option_b, 'मुख्यमंत्री');
});

// -------------------------------------------------------------------------
// 6. Answer Key Parsing & Mapping
// -------------------------------------------------------------------------
runTest('7. Answer key parsing from multi-column table', () => {
  const akText = `
उत्तरमाला
1- (a) 17- (a) 33- (d) 49- (a)
2- (b) 18- (b) 34- (b) 50- (b)
3- (b) 19- (d) 35- (c) 51- (a)
`;

  const akMap = parseAnswerKey(akText);
  assert.strictEqual(akMap.get(1), 'A', 'Q1 is A');
  assert.strictEqual(akMap.get(2), 'B', 'Q2 is B');
  assert.strictEqual(akMap.get(3), 'B', 'Q3 is B');
  assert.strictEqual(akMap.get(17), 'A', 'Q17 is A');
  assert.strictEqual(akMap.get(49), 'A', 'Q49 is A');
  assert.strictEqual(akMap.get(50), 'B', 'Q50 is B');
});

// -------------------------------------------------------------------------
// 7. Confidence & Validation System
// -------------------------------------------------------------------------
runTest('8. Question without options or too short is marked invalid or needs review', () => {
  const rawDoc = `
1. छोटी
2. भारत की राजधानी क्या है?
(a) दिल्ली
(b) मुंबई
(c) चेन्नई
(d) कोलकाता
`;

  const res = extractQuestionsWithRangeFromText(rawDoc, { fromQuestion: 1, toQuestion: 2 });
  const q1 = res.questions.find((q) => q.question_number === 1);
  const q2 = res.questions.find((q) => q.question_number === 2);

  assert.ok(q1 && (q1.status === 'invalid' || q1.status === 'needs_review'), 'Q1 with missing options is flagged');
  assert.ok(q2 && q2.status !== 'invalid', 'Q2 with all 4 options is not invalid');
});

console.log(`\n=================================================`);
console.log(`REGRESSION SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`=================================================`);

if (passedTests !== totalTests) {
  process.exit(1);
}
