import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { cachePdfBuffer, getCachedPdfBuffer } from '@/lib/question-parser';
import { createJob, updateJob, executeJobInBackground } from '@/lib/question-parser/job-manager';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
// Trigger dev server recompilation of parser modules


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
    const fileIdParam = (formData.get('fileId') as string | null) || undefined;
    const sectionId = (formData.get('sectionId') as string | null) || undefined;
    const fromQuestionRaw = formData.get('fromQuestion') as string | null;
    const toQuestionRaw = formData.get('toQuestion') as string | null;
    const defaultSubjectName = (formData.get('defaultSubjectName') as string | null) || undefined;
    const defaultMarksRaw = formData.get('defaultMarks') as string | null;
    const defaultNegativeMarksRaw = formData.get('defaultNegativeMarks') as string | null;
    const defaultLanguage = (formData.get('defaultLanguage') as string | null) || 'English';

    const fromQuestion = fromQuestionRaw ? parseInt(fromQuestionRaw, 10) : undefined;
    const toQuestion = toQuestionRaw ? parseInt(toQuestionRaw, 10) : undefined;

    // Resolve File Buffer
    let buffer: Buffer | null = null;
    let activeFileId = fileIdParam;
    let fileName = file?.name || 'document';

    if (activeFileId) {
      buffer = getCachedPdfBuffer(activeFileId);
    }

    if (!buffer) {
      if (!file) {
        return NextResponse.json(
          { error: 'No source file provided or session expired. Please upload the file.' },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File size exceeds the 50MB limit (provided: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
          { status: 400 }
        );
      }

      const ext = (file.name || '').toLowerCase().split('.').pop() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported file format ".${ext}". Supported formats: PDF, DOCX, DOC, XLSX, XLS, CSV, JPG, JPEG, PNG.` },
          { status: 400 }
        );
      }

      buffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
      activeFileId = `file-${crypto.randomBytes(8).toString('hex')}`;
      cachePdfBuffer(activeFileId, buffer);
    }

    // Fetch existing series and subjects for target configuration
    const { data: allSeries } = await admin.from('test_series').select('id, title, is_paid');
    const { data: allSubjects } = await admin.from('test_series_subjects').select('id, name');
    const { data: allTests } = await admin.from('tests').select('id, title, test_series_id, duration_minutes, max_marks');
    const { data: recentQuestions } = await admin
      .from('questions')
      .select('id, question_text')
      .order('created_at', { ascending: false })
      .limit(500);

    // Create background job
    const job = createJob(fileName);

    // Spawn background task asynchronously without blocking this response
    executeJobInBackground(job.id, buffer, fileName, {
      fromQuestion,
      toQuestion,
      sectionId,
      seriesSubjects: allSubjects || [],
      existingQuestions: recentQuestions || [],
      defaultSubjectName,
      defaultMarks: defaultMarksRaw ? parseFloat(defaultMarksRaw) : 1,
      defaultNegativeMarks: defaultNegativeMarksRaw ? parseFloat(defaultNegativeMarksRaw) : 0,
      defaultLanguage,
      existingSeriesList: allSeries || [],
      existingTestsList: allTests || [],
    }).catch((err) => {
      console.error(`Unhandled error in job ${job.id}:`, err);
      updateJob(job.id, {
        status: 'FAILED',
        progressPercent: 100,
        message: err.message || 'Processing failed',
        error: err.message || 'Processing failed',
      });
    });

    // Return immediate response with jobId and activeFileId
    return NextResponse.json({
      success: true,
      jobId: job.id,
      fileId: activeFileId,
      status: job.status,
      message: 'Background processing job initiated successfully.',
    });
  } catch (error: any) {
    console.error('Job creation error:', error);
    return NextResponse.json(
      { error: `Failed to create job: ${error.message || 'Server error'}` },
      { status: 500 }
    );
  }
}
