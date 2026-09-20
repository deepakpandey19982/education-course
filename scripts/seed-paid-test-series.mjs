import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedPaidTestSeries() {
  console.log('Starting seed for Paid Test Series Demo...');

  const seriesId = 'b5c28222-d6d5-4469-a985-899eed4e0446';
  const subjectId = 'e8820024-f07b-4b0a-b3c8-498416b25e60';
  const testId = '96d60548-8114-45f1-9ef6-825eb7c30c20';

  // 1. Upsert Series
  const { error: seriesErr } = await admin.from('test_series').upsert({
    id: seriesId,
    title: 'Demo Paid Test Series',
    description: 'A premium practice test series demonstrating timed exam attempts, subject management, and in-depth performance analysis for paid courses.',
    thumbnail_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    is_published: true,
    order: 1,
    updated_at: new Date().toISOString(),
  });
  if (seriesErr) throw seriesErr;
  console.log('✓ Series upserted');

  // 2. Upsert Subject
  const { error: subErr } = await admin.from('test_series_subjects').upsert({
    id: subjectId,
    series_id: seriesId,
    name: 'Advanced Aptitude & Reasoning',
    icon_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=400&q=80',
    order: 1,
    is_enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (subErr) throw subErr;
  console.log('✓ Subject upserted');

  // 3. Upsert Test
  const { error: testErr } = await admin.from('tests').upsert({
    id: testId,
    subject_id: subjectId,
    title: 'Demo Paid Practice Test',
    date_label: '20 SEP 2026',
    duration_minutes: 15,
    max_marks: 10,
    marks_per_correct: 2,
    negative_marks: 0.5,
    language: 'English',
    instructions: 'This is a premium demo practice test. Each question carries 2 marks with 0.5 negative marking for incorrect answers. Once started, the timer cannot be paused. Submit your test to view detailed performance metrics and solution explanations.',
    is_paid: true,
    price: 199,
    is_published: true,
    order: 1,
    updated_at: new Date().toISOString(),
  });
  if (testErr) throw testErr;
  console.log('✓ Test upserted');

  // 4. Questions
  const questions = [
    {
      id: '11111111-1111-4111-a111-111111111101',
      test_id: testId,
      question_text: 'A train 240 m in length crosses a platform in 36 seconds at a speed of 72 km/h. What is the length of the platform?',
      option_a: '480 m',
      option_b: '360 m',
      option_c: '420 m',
      option_d: '540 m',
      correct_option: 'A',
      explanation: 'Speed = 72 * (5/18) = 20 m/s. Total distance in 36s = 20 * 36 = 720 m. Length of platform = 720 - 240 = 480 m.',
      marks: 2,
      negative_marks: 0.5,
      language: 'English',
      order: 1,
      updated_at: new Date().toISOString(),
    },
    {
      id: '11111111-1111-4111-a111-111111111102',
      test_id: testId,
      question_text: 'If in a certain code language "TEACHER" is written as "VGCEJGT", how will "STUDENT" be written in that code?',
      option_a: 'UVWFGPV',
      option_b: 'UVWFHPV',
      option_c: 'TVWFGPU',
      option_d: 'UVVFGPU',
      correct_option: 'A',
      explanation: 'Each letter is shifted by +2 positions in the alphabet: S+2=U, T+2=V, U+2=W, D+2=F, E+2=G, N+2=P, T+2=V.',
      marks: 2,
      negative_marks: 0.5,
      language: 'English',
      order: 2,
      updated_at: new Date().toISOString(),
    },
    {
      id: '11111111-1111-4111-a111-111111111103',
      test_id: testId,
      question_text: 'A sum of money doubles itself in 5 years at simple interest. In how many years will it become 4 times of itself at the same rate?',
      option_a: '10 years',
      option_b: '12 years',
      option_c: '15 years',
      option_d: '20 years',
      correct_option: 'C',
      explanation: 'To double, interest earned is P in 5 years. To become 4 times, interest earned must be 3P. Time required = 3 * 5 = 15 years.',
      marks: 2,
      negative_marks: 0.5,
      language: 'English',
      order: 3,
      updated_at: new Date().toISOString(),
    },
    {
      id: '11111111-1111-4111-a111-111111111104',
      test_id: testId,
      question_text: 'Pointing to a photograph, a woman says: "He is the son of the only daughter of the father of my brother." How is the boy related to the woman?',
      option_a: 'Brother',
      option_b: 'Son',
      option_c: 'Nephew',
      option_d: 'Father',
      correct_option: 'B',
      explanation: 'The father of the woman’s brother is the woman’s father. The only daughter of her father is the woman herself. Therefore, the boy is her son.',
      marks: 2,
      negative_marks: 0.5,
      language: 'English',
      order: 4,
      updated_at: new Date().toISOString(),
    },
    {
      id: '11111111-1111-4111-a111-111111111105',
      test_id: testId,
      question_text: 'What is the angle between the hour hand and the minute hand of a clock at 3:40?',
      option_a: '120°',
      option_b: '130°',
      option_c: '140°',
      option_d: '150°',
      correct_option: 'B',
      explanation: 'Angle = |30*H - (11/2)*M| = |30*3 - 5.5*40| = |90 - 220| = 130°.',
      marks: 2,
      negative_marks: 0.5,
      language: 'English',
      order: 5,
      updated_at: new Date().toISOString(),
    },
  ];

  for (const q of questions) {
    const { error: qErr } = await admin.from('questions').upsert(q);
    if (qErr) throw qErr;
  }
  console.log('✓ 5 Questions upserted');
  console.log('Seed completed successfully!');
}

seedPaidTestSeries().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
