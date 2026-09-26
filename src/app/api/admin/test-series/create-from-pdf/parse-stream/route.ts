import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { parseQuestionFile, cachePdfBuffer, getCachedPdfBuffer, PdfProgressEvent } from '@/lib/question-parser';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max duration

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const admin = getSupabaseAdmin();

    // Verify admin role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Valid "From Question Number" (>= 1) is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (toQuestion === undefined || isNaN(toQuestion) || toQuestion < fromQuestion) {
      return new Response(JSON.stringify({ error: 'Valid "To Question Number" (>= From Question) is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
        return new Response(
          JSON.stringify({ error: 'No PDF file provided or cached session expired. Please upload the PDF.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({
            error: `File size exceeds the 50MB limit (provided: ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      buffer = Buffer.from(await file.arrayBuffer());
      activeFileId = `pdf-${crypto.randomBytes(8).toString('hex')}`;
      cachePdfBuffer(activeFileId, buffer);
    }

    // Fetch existing series and subjects
    const { data: allSeries } = await admin.from('test_series').select('id, title');
    const { data: allSubjects } = await admin.from('test_series_subjects').select('id, name');
    const { data: recentQuestions } = await admin
      .from('questions')
      .select('id, question_text')
      .order('created_at', { ascending: false })
      .limit(500);

    const encoder = new TextEncoder();

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
          } catch {
            // Controller might be closed if client disconnected
          }
        };

        try {
          sendEvent({
            type: 'progress',
            stage: 'reading',
            message: 'Reading PDF document...',
          });

          const parseResult = await parseQuestionFile(buffer!, fileName, {
            fromQuestion,
            toQuestion,
            seriesSubjects: allSubjects || [],
            existingQuestions: recentQuestions || [],
            defaultSubjectName,
            defaultMarks: defaultMarksRaw ? parseFloat(defaultMarksRaw) : 1,
            defaultNegativeMarks: defaultNegativeMarksRaw ? parseFloat(defaultNegativeMarksRaw) : 0,
            defaultLanguage,
            onProgress: (evt: PdfProgressEvent) => {
              sendEvent({
                type: 'progress',
                stage: evt.stage,
                message: evt.message,
                currentQuestion: evt.currentQuestion,
                currentPage: evt.currentPage,
                totalPages: evt.totalPages,
              });
            },
          });

          sendEvent({
            type: 'result',
            data: {
              ...parseResult,
              file_id: activeFileId,
              existing_series_titles: (allSeries || []).map((s) => s.title),
              all_subjects: (allSubjects || []).map((s) => s.name),
            },
          });

          controller.close();
        } catch (err: any) {
          console.error('Error during streaming parse:', err);
          sendEvent({
            type: 'error',
            error: err.message || 'An error occurred while parsing the PDF.',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('API /api/admin/test-series/create-from-pdf/parse-stream error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while processing the request',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
