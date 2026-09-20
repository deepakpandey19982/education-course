import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import {
  getEnvironmentVar,
  getSupabaseAdmin,
} from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

function getRazorpayInstance(): { razorpay: Razorpay; keyId: string } {
  const keyId = getEnvironmentVar(['RAZORPAY_KEY_ID', 'NEXT_PUBLIC_RAZORPAY_KEY_ID']);
  const keySecret = getEnvironmentVar(['RAZORPAY_KEY_SECRET', 'RAZORPAY_SECRET']);

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in Vercel environment variables.'
    );
  }

  return {
    razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
  };
}

export async function POST(req: Request) {
  try {
    const { courseId, userId } = await req.json();

    if (!courseId || !userId) {
      return NextResponse.json(
        { error: 'Course ID and User ID are required' },
        { status: 400 }
      );
    }

    // 1. Verify Razorpay credentials
    let razorpay: Razorpay;
    let keyId: string;
    try {
      const rzp = getRazorpayInstance();
      razorpay = rzp.razorpay;
      keyId = rzp.keyId;
    } catch (rzpErr: any) {
      return NextResponse.json(
        {
          error:
            rzpErr.message ||
            'Razorpay environment variables (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing on Vercel.',
        },
        { status: 500 }
      );
    }

    // 2. Initialize Supabase Admin with service role to bypass RLS for internal order creation
    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch (adminErr: any) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel Environment Variables. Please add SUPABASE_SERVICE_ROLE_KEY in your Vercel project settings to enable order creation.',
        },
        { status: 500 }
      );
    }

    // 3. Fetch course price and discount from database to prevent price manipulation
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('price, discount, title')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const finalPrice = course.price * (1 - (course.discount || 0) / 100);
    const amount = Math.round(finalPrice * 100); // Razorpay expects amount in paise

    // 4. Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    // 4. Create pending order in database using Supabase Admin service-role privileges
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        course_id: courseId,
        amount: finalPrice,
        status: 'pending',
        payment_id: razorpayOrder.id,
      });

    if (orderError) {
      console.error('Failed to create internal order in Supabase:', orderError);
      return NextResponse.json(
        {
          error: `Failed to create internal order: ${
            orderError.message || orderError.code || 'database RLS error'
          }. (Verify that SUPABASE_SERVICE_ROLE_KEY is added to Vercel Project Settings)`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: keyId,
    });
  } catch (error: any) {
    console.error('Payment create order error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
