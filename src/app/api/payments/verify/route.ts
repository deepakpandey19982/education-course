import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getRequestUser, getSupabaseAdmin, getEnvironmentVar } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = body;

    const targetOrderId = razorpay_order_id || orderId;
    if (!targetOrderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const keySecret = getEnvironmentVar(['RAZORPAY_KEY_SECRET', 'RAZORPAY_SECRET']);
    const keyId = getEnvironmentVar(['RAZORPAY_KEY_ID', 'NEXT_PUBLIC_RAZORPAY_KEY_ID']);

    if (!keySecret || !keyId) {
      return NextResponse.json(
        { error: 'Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in Vercel environment variables.' },
        { status: 500 }
      );
    }

    let isVerified = false;

    // Method 1: Cryptographic HMAC Signature Verification (Standard Razorpay Checkout Flow)
    if (razorpay_signature && razorpay_payment_id && razorpay_order_id) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature === razorpay_signature) {
        isVerified = true;
      } else {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }
    }

    // Method 2: Server-to-Server Razorpay API Verification (for sync, recovery, or missing signatures)
    if (!isVerified) {
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const fetchedOrder = await razorpay.orders.fetch(targetOrderId);
      if (fetchedOrder && fetchedOrder.status === 'paid') {
        isVerified = true;
      } else {
        return NextResponse.json({
          error: `Razorpay order is not paid (status: ${fetchedOrder?.status || 'unknown'})`,
        }, { status: 400 });
      }
    }

    const admin = getSupabaseAdmin();

    // Verify order ownership or admin status
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    // Find the corresponding order in our database
    // Note: /api/payments/create stores the razorpayOrder.id in the payment_id column
    let query = admin
      .from('orders')
      .select('*')
      .eq('payment_id', targetOrderId);

    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data: existingOrder, error: findError } = await query.maybeSingle();

    if (findError || !existingOrder) {
      return NextResponse.json({ error: 'Order not found in database' }, { status: 404 });
    }

    // Update the order to 'paid'
    const { data: updatedOrder, error: updateError } = await admin
      .from('orders')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingOrder.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update order status:', updateError);
      return NextResponse.json({ error: 'Failed to update order in database' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order updated successfully',
      order: updatedOrder,
    });

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
