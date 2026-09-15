import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Internal helper for server-side Supabase access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { courseId, userId } = await req.json();

    if (!courseId || !userId) {
      return NextResponse.json({ error: 'Course ID and User ID are required' }, { status: 400 });
    }

    // 1. Fetch course price and discount from database to prevent price manipulation
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

    // 2. Create Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    // 3. Create pending order in our database
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
      return NextResponse.json({ error: 'Failed to create internal order' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error: any) {
    console.error('Payment Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
