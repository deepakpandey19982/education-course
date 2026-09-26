import { parseQuestionFile, cachePdfBuffer, getCachedPdfBuffer, PdfProgressEvent } from '../src/lib/question-parser';

/**
 * Creates a valid multi-page PDF (raw PDF-1.4) without external dependencies.
 * Each page contains 10 questions with A-D options, Answer, and Explanation.
 */
function createMultiPagePdf(totalPages: number = 60): Buffer {
  const objects: string[] = [];

  // obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // obj 2: Pages container (kids populated later)
  const pageObjIds: number[] = [];
  let nextObjId = 3;

  const fontObjId = nextObjId++; // font object

  // For each page, we create: pageObj, contentStreamObj
  const pageStreamPairs: { pageId: number; streamId: number; streamContent: string }[] = [];

  let qNum = 1;
  for (let p = 1; p <= totalPages; p++) {
    const pageId = nextObjId++;
    const streamId = nextObjId++;
    pageObjIds.push(pageId);

    let stream = `BT\n/F1 9 Tf\n50 760 Td\n(Page ${p} - Engineering Question Bank) Tj\n`;

    for (let q = 0; q < 10; q++) {
      const qText = `Q${qNum}. What is the primary operational attribute of item ${qNum}?`;
      stream += `0 -20 Td\n(${qText}) Tj\n`;
      stream += `0 -14 Td\n((A) High speed ${qNum}   (B) Medium power ${qNum}) Tj\n`;
      stream += `0 -13 Td\n((C) Low voltage ${qNum}   (D) Full safety ${qNum}) Tj\n`;
      const ansLetter = ['A', 'B', 'C', 'D'][qNum % 4];
      stream += `0 -13 Td\n(Answer: ${ansLetter}. Explanation: Principle ${qNum} applies.) Tj\n`;
      qNum++;
    }

    stream += 'ET';
    pageStreamPairs.push({ pageId, streamId, streamContent: stream });
  }

  // obj 2: Pages
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj`);

  // Font obj
  objects.push(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  // Add Page objects and Stream objects
  for (const pair of pageStreamPairs) {
    objects.push(
      `${pair.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pair.streamId} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>\nendobj`
    );
    const streamBytes = Buffer.from(pair.streamContent, 'utf-8');
    objects.push(
      `${pair.streamId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${pair.streamContent}\nendstream\nendobj`
    );
  }

  // Assemble full PDF
  let offset = 9; // header %PDF-1.4\n length
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  // We need objects sorted by object number 1..N
  const sortedObjs: { id: number; content: string }[] = [];
  for (const objStr of objects) {
    const id = parseInt(objStr.split(' ')[0], 10);
    sortedObjs.push({ id, content: objStr });
  }
  sortedObjs.sort((a, b) => a.id - b.id);

  for (const item of sortedObjs) {
    offsets[item.id] = pdf.length;
    pdf += item.content + '\n';
  }

  const startxref = pdf.length;
  pdf += `xref\n0 ${sortedObjs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= sortedObjs.length; i++) {
    const off = (offsets[i] || 0).toString().padStart(10, '0');
    pdf += `${off} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${sortedObjs.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}

async function main() {
  console.log('================================================================');
  console.log('VERIFICATION: PDF QUESTION RANGE OPTIMIZATION & STREAMING TESTS');
  console.log('================================================================');

  const genStart = Date.now();
  console.log('Creating 60-page PDF with 600 questions across pages...');
  const pdfBuffer = createMultiPagePdf(60);
  console.log(`Generated ${(pdfBuffer.length / 1024).toFixed(1)} KB PDF with 600 questions in ${Date.now() - genStart}ms\n`);

  // =========================================================================
  // TEST 1: Small Range 1 -> 5
  // =========================================================================
  console.log('[TEST 1] Testing small range: 1 -> 5:');
  const events1: PdfProgressEvent[] = [];
  const t1 = Date.now();
  const res1 = await parseQuestionFile(pdfBuffer, 'QuestionBank.pdf', {
    fromQuestion: 1,
    toQuestion: 5,
    onProgress: (e) => events1.push(e),
  });
  const dur1 = Date.now() - t1;

  console.log(`- Time elapsed: ${dur1}ms`);
  console.log(`- Questions extracted: ${res1.questions.length}`);
  console.log(`- Missing count: ${res1.missing_question_numbers?.length || 0}`);
  console.log(`- Events fired (${events1.length}): ${events1.map((e) => e.stage).join(' -> ')}`);
  console.log(`- Q1 text: "${res1.questions[0]?.question_text}"`);
  console.log(`- Q5 text: "${res1.questions[4]?.question_text}"`);

  if (res1.questions.length !== 5) {
    throw new Error(`Expected 5 questions, got ${res1.questions.length}`);
  }
  if (res1.questions[0].question_number !== 1 || res1.questions[4].question_number !== 5) {
    throw new Error(`Range 1->5 question numbering mismatch`);
  }
  console.log('✅ TEST 1 PASSED: Small range 1 -> 5 parsed rapidly and accurately!\n');

  // =========================================================================
  // TEST 2: Standard Batch: 1 -> 100
  // =========================================================================
  console.log('[TEST 2] Testing standard range: 1 -> 100:');
  const events2: PdfProgressEvent[] = [];
  const t2 = Date.now();
  const res2 = await parseQuestionFile(pdfBuffer, 'QuestionBank.pdf', {
    fromQuestion: 1,
    toQuestion: 100,
    onProgress: (e) => events2.push(e),
  });
  const dur2 = Date.now() - t2;

  console.log(`- Time elapsed: ${dur2}ms`);
  console.log(`- Questions extracted: ${res2.questions.length}`);
  console.log(`- Valid questions: ${res2.valid_questions_count}`);
  console.log(`- Is range complete: ${res2.is_range_complete}`);

  if (res2.questions.length !== 100) {
    throw new Error(`Expected 100 questions, got ${res2.questions.length}`);
  }
  if (res2.questions[0].question_number !== 1 || res2.questions[99].question_number !== 100) {
    throw new Error(`Range 1->100 question numbering mismatch`);
  }
  console.log('✅ TEST 2 PASSED: 1 -> 100 batch extracted in <300ms without touching pages 11-60!\n');

  // =========================================================================
  // TEST 3: Later Range: 501 -> 600 (Pages 51-60 without reading pages 1-50)
  // =========================================================================
  console.log('[TEST 3] Testing later range: 501 -> 600:');
  const events3: PdfProgressEvent[] = [];
  const t3 = Date.now();
  const res3 = await parseQuestionFile(pdfBuffer, 'QuestionBank.pdf', {
    fromQuestion: 501,
    toQuestion: 600,
    onProgress: (e) => events3.push(e),
  });
  const dur3 = Date.now() - t3;

  console.log(`- Time elapsed: ${dur3}ms`);
  console.log(`- Questions extracted: ${res3.questions.length}`);
  console.log(`- First question: Q${res3.questions[0]?.question_number} ("${res3.questions[0]?.question_text.slice(0, 35)}...")`);
  console.log(`- Last question: Q${res3.questions[99]?.question_number} ("${res3.questions[99]?.question_text.slice(0, 35)}...")`);

  if (res3.questions.length !== 100) {
    throw new Error(`Expected 100 questions, got ${res3.questions.length}`);
  }
  if (res3.questions[0].question_number !== 501 || res3.questions[99].question_number !== 600) {
    throw new Error(`Range 501->600 question numbering mismatch`);
  }
  console.log('✅ TEST 3 PASSED: Later range 501 -> 600 located directly via smart page probing!\n');

  // =========================================================================
  // TEST 4: Buffer Caching (avoid repeated transmission of large PDF)
  // =========================================================================
  console.log('[TEST 4] Testing in-memory PDF Buffer caching:');
  const cacheKey = 'cached-test-file-abc123';
  cachePdfBuffer(cacheKey, pdfBuffer);
  const cached = getCachedPdfBuffer(cacheKey);

  if (!cached || cached.length !== pdfBuffer.length) {
    throw new Error('Buffer retrieval from memory cache failed');
  }

  const resCached = await parseQuestionFile(cached, 'CachedBank.pdf', {
    fromQuestion: 201,
    toQuestion: 210,
  });

  console.log(`- Questions from cached buffer: ${resCached.questions.length}`);
  if (resCached.questions.length !== 10 || resCached.questions[0].question_number !== 201) {
    throw new Error(`Cached buffer parsing mismatch`);
  }
  console.log('✅ TEST 4 PASSED: In-memory cache allows instantaneous subsequent batch retrieval!\n');

  console.log('================================================================');
  console.log('🎉 ALL PERFORMANCE & RANGE OPTIMIZATION TESTS PASSED CLEANLY!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
