import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin, getEnvironmentVar } from '@/lib/test-series-server';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 1. Verify Webhook Signature
    const webhookSecret = getEnvironmentVar(['RAZORPAY_WEBHOOK_SECRET', 'WEBHOOK_SECRET']);
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // 1. Verify Webhook Signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    // 2. Handle 'payment.captured' or 'order.paid' events
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const orderId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;

      if (orderId) {
        const supabaseAdmin = getSupabaseAdmin();
        const { error } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('payment_id', orderId);

        if (error) {
          console.error('Error updating order status in webhook:', error);
          return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
