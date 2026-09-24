import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { parseQuestionFile } from '@/lib/question-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max duration for OCR/PDF

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify admin role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const seriesId = formData.get('seriesId') as string | null;
    const testId = formData.get('testId') as string | null;
    const defaultSubjectId = (formData.get('defaultSubjectId') as string | null) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!seriesId || !testId) {
      return NextResponse.json({ error: 'seriesId and testId are required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 25MB limit (provided: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const fileName = file.name || 'document';
    const ext = fileName.toLowerCase().split('.').pop() || '';

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file format ".${ext}". Supported formats: PDF, DOCX, XLSX, CSV, JPG, JPEG, PNG.`,
        },
        { status: 400 }
      );
    }

    // Fetch Series Subjects
    const { data: subjectsData, error: subError } = await admin
      .from('test_series_subjects')
      .select('id, name')
      .eq('series_id', seriesId);

    if (subError) {
      console.error('Failed to fetch series subjects:', subError);
    }
    const seriesSubjects = subjectsData ?? [];

    // Fetch Test info
    const { data: testData, error: testError } = await admin
      .from('tests')
      .select('id, marks_per_correct, negative_marks, language')
      .eq('id', testId)
      .maybeSingle();

    if (testError || !testData) {
      return NextResponse.json({ error: 'Target test not found' }, { status: 404 });
    }

    // Fetch Existing Questions in this test for duplicate detection
    const { data: existingQuestionsData, error: existError } = await admin
      .from('questions')
      .select('id, question_text')
      .eq('test_id', testId);

    if (existError) {
      console.warn('Failed to fetch existing questions for duplicate check:', existError);
    }
    const existingQuestions = existingQuestionsData ?? [];

    const buffer = Buffer.from(await file.arrayBuffer());

    const parseResult = await parseQuestionFile(buffer, fileName, {
      seriesSubjects,
      existingQuestions,
      defaultSubjectId,
      defaultMarks: Number(testData.marks_per_correct) || 1,
      defaultNegativeMarks: Number(testData.negative_marks) || 0,
      defaultLanguage: testData.language || 'English',
    });

    return NextResponse.json(parseResult);
  } catch (error: any) {
    console.error('API /api/admin/test-series/import-parse error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while processing the file',
      },
      { status: 500 }
    );
  }
}
