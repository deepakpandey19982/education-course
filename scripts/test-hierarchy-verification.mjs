import { createClient } from '@supabase/supabase-js';

function encodeSubjectTag(explanation, subjectId) {
  const cleanExp = (explanation || '').replace(/<!--subj:[a-f0-9-]+-->/gi, '').trim();
  if (!subjectId) return cleanExp;
  return `<!--subj:${subjectId}-->${cleanExp}`;
}

function decodeSubjectTag(explanation) {
  if (!explanation) return { subjectId: null, cleanExplanation: '' };
  const match = explanation.match(/<!--subj:([a-f0-9-]+)-->/i);
  const cleanExplanation = explanation.replace(/<!--subj:[a-f0-9-]+-->/gi, '').trim();
  return { subjectId: match ? match[1] : null, cleanExplanation };
}

function encodeTestSubjectsTag(instructions, subjectIds) {
  const cleanInst = (instructions || '').replace(/<!--subjects:\[[^\]]*\]-->/gi, '').trim();
  if (!subjectIds || subjectIds.length === 0) return cleanInst;
  return `<!--subjects:${JSON.stringify(subjectIds)}-->${cleanInst}`;
}

function decodeTestSubjectsTag(instructions) {
  if (!instructions) return { subjectIds: [], cleanInstructions: '' };
  const match = instructions.match(/<!--subjects:(\[[^\]]*\])-->/i);
  let subjectIds = [];
  if (match) {
    try {
      subjectIds = JSON.parse(match[1]);
    } catch {
      subjectIds = [];
    }
  }
  const cleanInstructions = instructions.replace(/<!--subjects:\[[^\]]*\]-->/gi, '').trim();
  return { subjectIds, cleanInstructions };
}

function resolveTestSubjectIds(test) {
  if (!test) return [];
  const ids = new Set();
  if (Array.isArray(test.subject_ids) && test.subject_ids.length > 0) {
    test.subject_ids.forEach((id) => {
      if (id && typeof id === 'string') ids.add(id);
    });
  }
  if (test.instructions) {
    const decoded = decodeTestSubjectsTag(test.instructions);
    decoded.subjectIds.forEach((id) => {
      if (id && typeof id === 'string') ids.add(id);
    });
  }
  if (test.subject_id && typeof test.subject_id === 'string') {
    ids.add(test.subject_id);
  }
  return Array.from(ids);
}

function resolveQuestionSubjectId(question, parentTest) {
  if (question.subject_id) return question.subject_id;
  const decoded = decodeSubjectTag(question.explanation);
  if (decoded.subjectId) return decoded.subjectId;
  return parentTest?.subject_id || '';
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runVerification() {
  console.log('=== TEST SERIES HIERARCHY VERIFICATION ===\n');

  // 1. Get or create series
  const seriesTitle = 'UP Police Computer Operator 2026';
  let { data: series } = await admin.from('test_series').select('*').eq('title', seriesTitle).maybeSingle();

  if (!series) {
    const { data: created, error: sErr } = await admin
      .from('test_series')
      .insert({
        title: seriesTitle,
        description: 'Complete mock tests for UP Police Computer Operator 2026 with exam simulation.',
        is_published: true,
        order: 1,
      })
      .select()
      .single();
    if (sErr) throw sErr;
    series = created;
    console.log('✓ Created Test Series:', series.title);
  } else {
    console.log('✓ Using Existing Series:', series.title);
  }

  // 2. Ensure 3 Subjects exist
  const subjectsToCreate = [
    { name: 'Computer', order: 1 },
    { name: 'General Awareness', order: 2 },
    { name: 'Mental Reasoning and Intelligence', order: 3 },
  ];

  const subjects = [];
  for (const item of subjectsToCreate) {
    let { data: sub } = await admin
      .from('test_series_subjects')
      .select('*')
      .eq('series_id', series.id)
      .eq('name', item.name)
      .maybeSingle();

    if (!sub) {
      const { data: createdSub, error: subErr } = await admin
        .from('test_series_subjects')
        .insert({
          series_id: series.id,
          name: item.name,
          order: item.order,
          is_enabled: true,
        })
        .select()
        .single();
      if (subErr) throw subErr;
      sub = createdSub;
      console.log(`✓ Created Subject: ${sub.name} (${sub.id})`);
    } else {
      console.log(`✓ Subject exists: ${sub.name} (${sub.id})`);
    }
    subjects.push(sub);
  }

  const [subComp, subGK, subReasoning] = subjects;

  // 3. Create / Update Test A (Computer Operator 20 Sep 2026)
  // Included Subjects: Computer + General Awareness + Mental Reasoning
  const testASubjectIds = [subComp.id, subGK.id, subReasoning.id];
  const testATitle = 'Computer Operator 20 Sep 2026';

  let { data: testA } = await admin.from('tests').select('*').eq('title', testATitle).maybeSingle();
  const testAInstructions = encodeTestSubjectsTag(
    'Instructions for 20 Sep 2026 Mock Test: 160 Total Questions across Computer, General Awareness, and Mental Reasoning.',
    testASubjectIds
  );

  const testAPayload = {
    subject_id: subComp.id,
    title: testATitle,
    date_label: '20 SEP 2026',
    duration_minutes: 120,
    max_marks: 200,
    marks_per_correct: 1.25,
    negative_marks: 0,
    language: 'Bilingual (Hindi & English)',
    instructions: testAInstructions,
    is_paid: false,
    is_published: true,
    order: 1,
  };

  if (!testA) {
    const { data: createdA, error: tAErr } = await admin.from('tests').insert(testAPayload).select().single();
    if (tAErr) throw tAErr;
    testA = createdA;
    console.log('\n✓ Created Test A:', testA.title, `(${testA.id})`);
  } else {
    await admin.from('tests').update(testAPayload).eq('id', testA.id);
    console.log('\n✓ Updated Test A:', testA.title, `(${testA.id})`);
  }

  // 4. Create / Update Test B (Computer Operator 13 Sep 2026)
  // Included Subjects: Computer + General Awareness ONLY (Mental Reasoning omitted!)
  const testBSubjectIds = [subComp.id, subGK.id];
  const testBTitle = 'Computer Operator 13 Sep 2026';

  let { data: testB } = await admin.from('tests').select('*').eq('title', testBTitle).maybeSingle();
  const testBInstructions = encodeTestSubjectsTag(
    'Instructions for 13 Sep 2026 Mock Test: Focus on Computer and General Awareness.',
    testBSubjectIds
  );

  const testBPayload = {
    subject_id: subComp.id,
    title: testBTitle,
    date_label: '13 SEP 2026',
    duration_minutes: 90,
    max_marks: 150,
    marks_per_correct: 1.25,
    negative_marks: 0,
    language: 'Bilingual (Hindi & English)',
    instructions: testBInstructions,
    is_paid: false,
    is_published: true,
    order: 2,
  };

  if (!testB) {
    const { data: createdB, error: tBErr } = await admin.from('tests').insert(testBPayload).select().single();
    if (tBErr) throw tBErr;
    testB = createdB;
    console.log('✓ Created Test B:', testB.title, `(${testB.id})`);
  } else {
    await admin.from('tests').update(testBPayload).eq('id', testB.id);
    console.log('✓ Updated Test B:', testB.title, `(${testB.id})`);
  }

  // 5. Seed Test A Questions
  // Clear any old verification questions for these tests
  await admin.from('questions').delete().eq('test_id', testA.id);
  await admin.from('questions').delete().eq('test_id', testB.id);

  const testAQuestions = [
    {
      test_id: testA.id,
      question_text: '[Test A] What does CPU stand for in computer systems?',
      option_a: 'Central Processing Unit',
      option_b: 'Control Power Unit',
      option_c: 'Central Performance Utility',
      option_d: 'Core Processor Unified',
      correct_option: 'A',
      explanation: encodeSubjectTag('CPU is the primary component that executes computer instructions.', subComp.id),
      order: 1,
    },
    {
      test_id: testA.id,
      question_text: '[Test A] Which protocol is used for secure web browsing?',
      option_a: 'FTP',
      option_b: 'HTTP',
      option_c: 'HTTPS',
      option_d: 'SMTP',
      correct_option: 'C',
      explanation: encodeSubjectTag('HTTPS encrypts HTTP traffic via TLS/SSL.', subComp.id),
      order: 2,
    },
    {
      test_id: testA.id,
      question_text: '[Test A] Who is known as the father of the Indian Constitution?',
      option_a: 'Mahatma Gandhi',
      option_b: 'Dr. B.R. Ambedkar',
      option_c: 'Jawaharlal Nehru',
      option_d: 'Sardar Vallabhbhai Patel',
      correct_option: 'B',
      explanation: encodeSubjectTag('Dr. B.R. Ambedkar was the chairman of the drafting committee.', subGK.id),
      order: 3,
    },
    {
      test_id: testA.id,
      question_text: '[Test A] Find the next number in series: 2, 4, 8, 16, ?',
      option_a: '24',
      option_b: '30',
      option_c: '32',
      option_d: '64',
      correct_option: 'C',
      explanation: encodeSubjectTag('Each number is multiplied by 2: 16 * 2 = 32.', subReasoning.id),
      order: 4,
    },
  ];

  const { error: qAErr } = await admin.from('questions').insert(testAQuestions);
  if (qAErr) throw qAErr;
  console.log(`✓ Inserted ${testAQuestions.length} Questions for Test A`);

  // 6. Seed Test B Questions (Only Computer + GK, NO Mental Reasoning)
  const testBQuestions = [
    {
      test_id: testB.id,
      question_text: '[Test B] How many bits are in one byte?',
      option_a: '4',
      option_b: '8',
      option_c: '16',
      option_d: '32',
      correct_option: 'B',
      explanation: encodeSubjectTag('Standard 1 byte = 8 bits.', subComp.id),
      order: 1,
    },
    {
      test_id: testB.id,
      question_text: '[Test B] Which memory type is volatile in computer hardware?',
      option_a: 'ROM',
      option_b: 'Hard Disk',
      option_c: 'RAM',
      option_d: 'Flash Drive',
      correct_option: 'C',
      explanation: encodeSubjectTag('RAM loses its data when powered off.', subComp.id),
      order: 2,
    },
    {
      test_id: testB.id,
      question_text: '[Test B] What is the capital of Uttar Pradesh?',
      option_a: 'Kanpur',
      option_b: 'Lucknow',
      option_c: 'Varanasi',
      option_d: 'Prayagraj',
      correct_option: 'B',
      explanation: encodeSubjectTag('Lucknow is the administrative capital of UP.', subGK.id),
      order: 3,
    },
  ];

  const { error: qBErr } = await admin.from('questions').insert(testBQuestions);
  if (qBErr) throw qBErr;
  console.log(`✓ Inserted ${testBQuestions.length} Questions for Test B`);

  // 7. Verification: Test A vs Test B Scoping
  console.log('\n--- VERIFICATION CHECKS ---');

  // Check resolved subjects for Test A
  const resolvedASubjectIds = resolveTestSubjectIds(testA);
  console.log('Test A Configured Subject IDs count:', resolvedASubjectIds.length);
  if (resolvedASubjectIds.length !== 3) {
    throw new Error(`Test A should have 3 subjects, got ${resolvedASubjectIds.length}`);
  }

  // Check resolved subjects for Test B
  const resolvedBSubjectIds = resolveTestSubjectIds(testB);
  console.log('Test B Configured Subject IDs count:', resolvedBSubjectIds.length);
  if (resolvedBSubjectIds.length !== 2) {
    throw new Error(`Test B should have 2 subjects, got ${resolvedBSubjectIds.length}`);
  }

  if (resolvedBSubjectIds.includes(subReasoning.id)) {
    throw new Error('Test B must NOT contain Mental Reasoning!');
  }
  console.log('✓ Confirmed: Test B does NOT include Mental Reasoning subject.');

  // Fetch Questions for Test A
  const { data: loadedQA } = await admin.from('questions').select('*').eq('test_id', testA.id);
  const { data: loadedQB } = await admin.from('questions').select('*').eq('test_id', testB.id);

  console.log(`Test A Questions Count: ${loadedQA.length}`);
  console.log(`Test B Questions Count: ${loadedQB.length}`);

  // Check cross-contamination
  const qAIds = new Set(loadedQA.map((q) => q.id));
  const hasLeak = loadedQB.some((q) => qAIds.has(q.id));
  if (hasLeak) {
    throw new Error('Test A questions leaked into Test B!');
  }
  console.log('✓ Confirmed: 0 questions from Test A appear in Test B (Strict Scoping Passed).');

  // Subject-wise distribution for Test A
  const countsA = new Map();
  for (const q of loadedQA) {
    const sId = resolveQuestionSubjectId(q, testA);
    countsA.set(sId, (countsA.get(sId) || 0) + 1);
  }
  console.log('Test A Subject Distribution:');
  console.log('  Computer:', countsA.get(subComp.id) || 0);
  console.log('  General Awareness:', countsA.get(subGK.id) || 0);
  console.log('  Mental Reasoning:', countsA.get(subReasoning.id) || 0);

  if (countsA.get(subComp.id) !== 2 || countsA.get(subGK.id) !== 1 || countsA.get(subReasoning.id) !== 1) {
    throw new Error('Test A question distribution mismatch!');
  }
  console.log('✓ Confirmed: Test A subject distribution is exact (2 Computer, 1 GK, 1 Reasoning).');

  // Subject-wise distribution for Test B
  const countsB = new Map();
  for (const q of loadedQB) {
    const sId = resolveQuestionSubjectId(q, testB);
    countsB.set(sId, (countsB.get(sId) || 0) + 1);
  }
  console.log('Test B Subject Distribution:');
  console.log('  Computer:', countsB.get(subComp.id) || 0);
  console.log('  General Awareness:', countsB.get(subGK.id) || 0);
  console.log('  Mental Reasoning:', countsB.get(subReasoning.id) || 0);

  if (countsB.get(subComp.id) !== 2 || countsB.get(subGK.id) !== 1 || (countsB.get(subReasoning.id) || 0) !== 0) {
    throw new Error('Test B question distribution mismatch!');
  }
  console.log('✓ Confirmed: Test B has 2 Computer, 1 GK, and 0 Reasoning questions.');

  console.log('\n=== ALL HIERARCHY VERIFICATION CHECKS PASSED ===\n');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
