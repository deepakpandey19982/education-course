import { supabase } from '@/lib/supabase';
import type { TestSeries, TestSeriesSubject, Test, Question } from '@/types/supabase';

export function encodeSubjectTag(explanation: string | null | undefined, subjectId: string | null | undefined): string {
  const cleanExp = (explanation || '')
    .replace(/<!--subj:[a-f0-9-]+-->/gi, '')
    .replace(/<!--qimg:[^>]+-->/gi, '')
    .replace(/<!--opt_[a-d]_img:[^>]+-->/gi, '')
    .trim();
  if (!subjectId) return cleanExp;
  return `<!--subj:${subjectId}-->${cleanExp}`;
}

export function encodeQuestionExplanation(
  explanation: string | null | undefined,
  meta: {
    subjectId?: string | null;
    questionImageUrl?: string | null;
    optionAImageUrl?: string | null;
    optionBImageUrl?: string | null;
    optionCImageUrl?: string | null;
    optionDImageUrl?: string | null;
  }
): string {
  const cleanExp = (explanation || '')
    .replace(/<!--subj:[a-f0-9-]+-->/gi, '')
    .replace(/<!--qimg:[^>]+-->/gi, '')
    .replace(/<!--opt_[a-d]_img:[^>]+-->/gi, '')
    .trim();

  let tags = '';
  if (meta.subjectId) tags += `<!--subj:${meta.subjectId}-->`;
  if (meta.questionImageUrl) tags += `<!--qimg:${meta.questionImageUrl}-->`;
  if (meta.optionAImageUrl) tags += `<!--opt_a_img:${meta.optionAImageUrl}-->`;
  if (meta.optionBImageUrl) tags += `<!--opt_b_img:${meta.optionBImageUrl}-->`;
  if (meta.optionCImageUrl) tags += `<!--opt_c_img:${meta.optionCImageUrl}-->`;
  if (meta.optionDImageUrl) tags += `<!--opt_d_img:${meta.optionDImageUrl}-->`;

  return `${tags}${cleanExp}`;
}

export function decodeSubjectTag(explanation: string | null | undefined): {
  subjectId: string | null;
  questionImageUrl?: string | null;
  optionAImageUrl?: string | null;
  optionBImageUrl?: string | null;
  optionCImageUrl?: string | null;
  optionDImageUrl?: string | null;
  cleanExplanation: string;
} {
  if (!explanation) {
    return {
      subjectId: null,
      questionImageUrl: null,
      optionAImageUrl: null,
      optionBImageUrl: null,
      optionCImageUrl: null,
      optionDImageUrl: null,
      cleanExplanation: '',
    };
  }
  const match = explanation.match(/<!--subj:([a-f0-9-]+)-->/i);
  const qImgMatch = explanation.match(/<!--qimg:([^\s>]+)-->/i);
  const optAMatch = explanation.match(/<!--opt_a_img:([^\s>]+)-->/i);
  const optBMatch = explanation.match(/<!--opt_b_img:([^\s>]+)-->/i);
  const optCMatch = explanation.match(/<!--opt_c_img:([^\s>]+)-->/i);
  const optDMatch = explanation.match(/<!--opt_d_img:([^\s>]+)-->/i);

  const cleanExplanation = explanation
    .replace(/<!--subj:[a-f0-9-]+-->/gi, '')
    .replace(/<!--qimg:[^>]+-->/gi, '')
    .replace(/<!--opt_[a-d]_img:[^>]+-->/gi, '')
    .trim();

  return {
    subjectId: match ? match[1] : null,
    questionImageUrl: qImgMatch ? qImgMatch[1] : null,
    optionAImageUrl: optAMatch ? optAMatch[1] : null,
    optionBImageUrl: optBMatch ? optBMatch[1] : null,
    optionCImageUrl: optCMatch ? optCMatch[1] : null,
    optionDImageUrl: optDMatch ? optDMatch[1] : null,
    cleanExplanation,
  };
}

export function encodeTestSubjectsTag(instructions: string | null | undefined, subjectIds: string[]): string {
  const cleanInst = (instructions || '').replace(/<!--subjects:\[[^\]]*\]-->/gi, '').trim();
  if (!subjectIds || subjectIds.length === 0) return cleanInst;
  return `<!--subjects:${JSON.stringify(subjectIds)}-->${cleanInst}`;
}

export function decodeTestSubjectsTag(instructions: string | null | undefined): { subjectIds: string[]; cleanInstructions: string } {
  if (!instructions) return { subjectIds: [], cleanInstructions: '' };
  const match = instructions.match(/<!--subjects:(\[[^\]]*\])-->/i);
  let subjectIds: string[] = [];
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

export function resolveTestSubjectIds(test: any): string[] {
  if (!test) return [];
  const ids = new Set<string>();
  if (Array.isArray(test.subject_ids) && test.subject_ids.length > 0) {
    test.subject_ids.forEach((id: string) => {
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

export function resolveQuestionSubjectId(question: any, parentTest?: Test | null): string {
  if (question.subject_id) return question.subject_id;
  const decoded = decodeSubjectTag(question.explanation);
  if (decoded.subjectId) return decoded.subjectId;
  return parentTest?.subject_id || '';
}

export async function fetchAllSeriesWithMetrics(): Promise<Array<TestSeries & { subjectCount: number; testCount: number; questionCount: number; is_paid: boolean }>> {
  // 1. Fetch series
  let seriesList: any[] = [];
  try {
    const { data, error } = await supabase
      .from('test_series')
      .select('*')
      .order('order', { ascending: true });
    if (error) throw error;
    seriesList = data ?? [];
  } catch (err) {
    console.error('Fetch series error:', err);
    return [];
  }

  if (!seriesList.length) return [];

  const seriesIds = seriesList.map((s) => s.id);

  // 2. Fetch all subjects for these series
  const { data: subjects } = await supabase
    .from('test_series_subjects')
    .select('id, series_id')
    .in('series_id', seriesIds);

  const subjectList = subjects ?? [];
  const subjectIds = subjectList.map((s) => s.id);
  const subjectToSeriesMap = new Map<string, string>();
  for (const s of subjectList) {
    subjectToSeriesMap.set(s.id, s.series_id);
  }

  // 3. Fetch all tests
  const { data: tests } = subjectIds.length
    ? await supabase
        .from('tests')
        .select('id, subject_id, is_paid')
        .in('subject_id', subjectIds)
    : { data: [] };

  const testList = tests ?? [];
  const testIds = testList.map((t) => t.id);

  // 4. Fetch question counts
  const { data: questions } = testIds.length
    ? await supabase.from('questions').select('id, test_id').in('test_id', testIds)
    : { data: [] };

  const testToSeriesMap = new Map<string, string>();
  const seriesTestCount = new Map<string, number>();
  const seriesSubjectCount = new Map<string, number>();
  const seriesQuestionCount = new Map<string, number>();
  const seriesHasPaidTests = new Set<string>();

  for (const s of subjectList) {
    seriesSubjectCount.set(s.series_id, (seriesSubjectCount.get(s.series_id) ?? 0) + 1);
  }

  for (const t of testList) {
    const sId = subjectToSeriesMap.get(t.subject_id);
    if (sId) {
      testToSeriesMap.set(t.id, sId);
      seriesTestCount.set(sId, (seriesTestCount.get(sId) ?? 0) + 1);
      if (t.is_paid) {
        seriesHasPaidTests.add(sId);
      }
    }
  }

  for (const q of questions ?? []) {
    const sId = testToSeriesMap.get(q.test_id);
    if (sId) {
      seriesQuestionCount.set(sId, (seriesQuestionCount.get(sId) ?? 0) + 1);
    }
  }

  return seriesList.map((s) => {
    const hasPaid = seriesHasPaidTests.has(s.id);
    const explicitlyPaid = s.is_paid === true || s.title?.toLowerCase().includes('paid') || s.title?.toLowerCase().includes('premium');
    return {
      ...s,
      is_paid: Boolean(explicitlyPaid || hasPaid),
      subjectCount: seriesSubjectCount.get(s.id) ?? 0,
      testCount: seriesTestCount.get(s.id) ?? 0,
      questionCount: seriesQuestionCount.get(s.id) ?? 0,
    };
  });
}
