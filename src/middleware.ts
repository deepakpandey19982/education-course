import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://education-course-nine.vercel.app',
  'https://e-nine.vercel.app',
]);

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow all Vercel deployment preview / production domains
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowed = origin ? isOriginAllowed(origin) : false;

    const headers = new Headers();
    if (origin && allowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma'
      );
      headers.set('Access-Control-Max-Age', '86400');
    }

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers });
    }

    const response = NextResponse.next();
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
