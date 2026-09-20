import { NextResponse } from 'next/server';
import { getEnvironmentVar } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(
      getEnvironmentVar(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'])
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
      getEnvironmentVar(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_KEY'])
    ),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(
      getEnvironmentVar([
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_SERVICE_KEY',
        'SUPABASE_SERVICE_ROLE',
        'SERVICE_ROLE_KEY',
      ])
    ),
    RAZORPAY_KEY_ID: Boolean(
      getEnvironmentVar(['RAZORPAY_KEY_ID', 'NEXT_PUBLIC_RAZORPAY_KEY_ID'])
    ),
    RAZORPAY_KEY_SECRET: Boolean(
      getEnvironmentVar(['RAZORPAY_KEY_SECRET', 'RAZORPAY_SECRET'])
    ),
    RAZORPAY_WEBHOOK_SECRET: Boolean(
      getEnvironmentVar(['RAZORPAY_WEBHOOK_SECRET', 'WEBHOOK_SECRET'])
    ),
  };

  const allConfigured = Object.values(envStatus).every(Boolean);

  return NextResponse.json(
    {
      status: allConfigured ? 'healthy' : 'configuration_missing',
      environment: envStatus,
      timestamp: new Date().toISOString(),
    },
    {
      status: allConfigured ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}
