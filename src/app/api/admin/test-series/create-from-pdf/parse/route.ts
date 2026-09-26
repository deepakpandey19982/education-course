import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { parseQuestionFile, cachePdfBuffer, getCachedPdfBuffer } from '@/lib/question-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max duration for PDF parsing

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify admin privileges
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
    const fileIdParam = (formData.get('fileId') as string | null) || undefined;
    const fromQuestionRaw = formData.get('fromQuestion') as string | null;
    const toQuestionRaw = formData.get('toQuestion') as string | null;
    const defaultSubjectName = (formData.get('defaultSubjectName') as string | null) || undefined;
    const defaultMarksRaw = formData.get('defaultMarks') as string | null;
    const defaultNegativeMarksRaw = formData.get('defaultNegativeMarks') as string | null;
    const defaultLanguage = (formData.get('defaultLanguage') as string | null) || 'English';

    const fromQuestion = fromQuestionRaw ? parseInt(fromQuestionRaw, 10) : undefined;
    const toQuestion = toQuestionRaw ? parseInt(toQuestionRaw, 10) : undefined;

    if (fromQuestion === undefined || isNaN(fromQuestion) || fromQuestion < 1) {
      return NextResponse.json({ error: 'Valid "From Question Number" (>= 1) is required.' }, { status: 400 });
    }

    if (toQuestion === undefined || isNaN(toQuestion) || toQuestion < fromQuestion) {
      return NextResponse.json({ error: 'Valid "To Question Number" (>= From Question) is required.' }, { status: 400 });
    }

    // Resolve PDF Buffer: Check in-memory cache first if fileId provided
    let buffer: Buffer | null = null;
    let activeFileId = fileIdParam;
    let fileName = file?.name || 'document.pdf';

    if (activeFileId) {
      buffer = getCachedPdfBuffer(activeFileId);
    }

    if (!buffer) {
      if (!file) {
        return NextResponse.json(
          { error: 'No PDF file provided or session expired. Please re-select the PDF file.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File size exceeds the 50MB limit (provided: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
          { status: 400 }
        );
      }

      const crypto = await import('crypto');
      buffer = Buffer.from(await file.arrayBuffer());
      activeFileId = `pdf-${crypto.randomBytes(8).toString('hex')}`;
      cachePdfBuffer(activeFileId, buffer);
    }

    const ext = fileName.toLowerCase().split('.').pop() || '';

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file format ".${ext}". Please upload a PDF file (.pdf).`,
        },
        { status: 400 }
      );
    }

    // Fetch existing series and subjects for matching & duplicate warning
    const { data: allSeries } = await admin.from('test_series').select('id, title');
    const { data: allSubjects } = await admin.from('test_series_subjects').select('id, name');

    // Fetch a sample of existing questions for duplicate text detection
    const { data: recentQuestions } = await admin
      .from('questions')
      .select('id, question_text')
      .order('created_at', { ascending: false })
      .limit(500);

    const parseResult = await parseQuestionFile(buffer, fileName, {
      fromQuestion,
      toQuestion,
      seriesSubjects: allSubjects || [],
      existingQuestions: recentQuestions || [],
      defaultSubjectName,
      defaultMarks: defaultMarksRaw ? parseFloat(defaultMarksRaw) : 1,
      defaultNegativeMarks: defaultNegativeMarksRaw ? parseFloat(defaultNegativeMarksRaw) : 0,
      defaultLanguage,
    });

    // Check if any existing series title is similar (for duplicate series alert)
    const existingSeriesTitles = (allSeries || []).map((s) => s.title);

    return NextResponse.json({
      ...parseResult,
      file_id: activeFileId,
      existing_series_titles: existingSeriesTitles,
      all_subjects: (allSubjects || []).map((s) => s.name),
    });

  } catch (error: any) {
    console.error('API /api/admin/test-series/create-from-pdf/parse error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while parsing the PDF file',
      },
      { status: 500 }
    );
  }
}
