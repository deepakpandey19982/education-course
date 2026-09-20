import { NextResponse } from 'next/server';
import { getRequestUser, getSupabaseAdmin } from '@/lib/test-series-server';
import { getAllDownloads } from '@/lib/download-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify admin role
    const { data: adminProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    // Case 1: Fetch single user detailed view
    if (userId) {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Fetch all paid orders for this user
      const { data: orders } = await admin
        .from('orders')
        .select(`
          id,
          course_id,
          amount,
          status,
          payment_id,
          created_at,
          courses (title)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const purchasedCourses = (orders || [])
        .filter(o => o.status === 'paid')
        .map(o => ({
          order_id: o.id,
          course_id: o.course_id,
          course_name: (o.courses as any)?.title || 'Course',
          purchase_date: o.created_at,
          amount_paid: o.amount,
          status: o.status,
          payment_id: o.payment_id,
        }));

      // Fetch verified download events for this user
      const allUserDownloads = await getAllDownloads(userId);

      const downloadHistory = allUserDownloads.map(d => {
        // Find matching paid order if applicable
        const matchingOrder = (orders || []).find(
          o => o.course_id === d.course_id && o.status === 'paid'
        );
        return {
          id: d.id,
          course_id: d.course_id,
          course_name: d.course_title || d.file_name || 'Course Document',
          file_name: d.file_name,
          download_date: d.created_at,
          access_type: d.access_type,
          related_order: matchingOrder ? {
            order_id: matchingOrder.id,
            amount: matchingOrder.amount,
            status: matchingOrder.status,
          } : null,
        };
      });

      return NextResponse.json({
        profile: {
          id: profile.id,
          name: profile.full_name || 'Anonymous User',
          email: profile.email,
          avatar_url: profile.avatar_url || null,
          role: profile.role,
          joined_date: profile.created_at,
        },
        purchased_courses: purchasedCourses,
        download_history: downloadHistory,
        stats: {
          total_purchased: purchasedCourses.length,
          total_downloads: downloadHistory.length,
        },
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
        },
      });
    }

    // Case 2: Fetch all registered users with summary counts
    const { data: allProfiles, error: profilesError } = await admin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }

    // Fetch all paid orders to compute counts per user
    const { data: paidOrders } = await admin
      .from('orders')
      .select('user_id')
      .eq('status', 'paid');

    const ordersCountMap: Record<string, number> = {};
    (paidOrders || []).forEach(o => {
      ordersCountMap[o.user_id] = (ordersCountMap[o.user_id] || 0) + 1;
    });

    // Fetch all downloads to compute counts per user
    const allDownloads = await getAllDownloads();
    const downloadsCountMap: Record<string, number> = {};
    allDownloads.forEach(d => {
      downloadsCountMap[d.user_id] = (downloadsCountMap[d.user_id] || 0) + 1;
    });

    const usersList = (allProfiles || []).map(p => ({
      id: p.id,
      name: p.full_name || 'Anonymous User',
      email: p.email,
      avatar_url: p.avatar_url || null,
      role: p.role || 'user',
      joined_date: p.created_at,
      total_purchased_courses: ordersCountMap[p.id] || 0,
      total_downloads: downloadsCountMap[p.id] || 0,
    }));

    return NextResponse.json({
      users: usersList,
      total: usersList.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
