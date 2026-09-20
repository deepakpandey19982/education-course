import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify admin role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch total sales and total revenue from paid orders
    const { data: paidOrders, error: ordersError } = await admin
      .from('orders')
      .select('amount')
      .eq('status', 'paid');

    const totalSales = paidOrders?.length || 0;
    const totalRevenue = paidOrders?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

    // 2. Fetch active courses count
    const { count: activeCoursesCount } = await admin
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    // 3. Fetch total students count (profiles with role = 'user')
    const { count: totalStudentsCount } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user');

    // 4. System Status Checks
    const isRazorpayConfigured = Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    );

    return NextResponse.json({
      totalRevenue,
      activeCourses: activeCoursesCount || 0,
      totalStudents: totalStudentsCount || 0,
      totalSales,
      systemStatus: {
        database: 'CONNECTED',
        storage: 'ACTIVE',
        razorpay: isRazorpayConfigured ? 'ACTIVE' : 'PENDING SETUP',
      },
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
