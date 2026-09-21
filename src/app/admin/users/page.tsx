'use client';

import React, { useEffect, useState } from 'react';
import { supabase, resolveStorageUrl } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { getApiUrl } from '@/lib/api-config';

interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'user';
  joined_date: string;
  total_purchased_courses: number;
  total_downloads: number;
}

interface PurchasedCourseItem {
  order_id: string;
  course_id: string;
  course_name: string;
  purchase_date: string;
  amount_paid: number;
  status: string;
  payment_id: string;
}

interface DownloadHistoryItem {
  id: string;
  course_id: string;
  course_name: string;
  file_name?: string | null;
  download_date: string;
  access_type: 'FREE' | 'PAID';
  related_order?: {
    order_id: string;
    amount: number;
    status: string;
  } | null;
}

interface UserDetailResponse {
  profile: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: 'admin' | 'user';
    joined_date: string;
  };
  purchased_courses: PurchasedCourseItem[];
  download_history: DownloadHistoryItem[];
  stats: {
    total_purchased: number;
    total_downloads: number;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Avatar URLs mapped by user ID with storage resolved URLs
  const [resolvedAvatars, setResolvedAvatars] = useState<Record<string, string>>({});

  const fetchUsers = async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Obtain current user session token
      let token: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || null;
      } catch (sessionErr) {
        console.warn('Could not get session:', sessionErr);
      }

      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 2. Fetch from API route with 12s timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let apiSuccess = false;
      try {
        const res = await fetch(getApiUrl(`/api/admin/users?_t=${Date.now()}`), {
          headers,
          cache: 'no-store',
          signal: controller.signal,
          credentials: 'include',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const usersList: UserSummary[] = data.users || [];
          setUsers(usersList);
          apiSuccess = true;

          // Resolve avatars asynchronously in background
          for (const u of usersList) {
            if (u.avatar_url) {
              resolveStorageUrl(u.avatar_url)
                .then((resolved) => {
                  setResolvedAvatars((prev) => ({ ...prev, [u.id]: resolved }));
                })
                .catch(() => {});
            }
          }
        } else {
          const errData = await res.json().catch(() => null);
          const msg = errData?.error || `Request failed with status ${res.status}`;
          console.warn('API fetch admin users returned error:', msg);
          if (res.status === 401 || res.status === 403) {
            setError(msg);
          }
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        console.warn('API fetch admin users failed:', fetchErr);
      }

      // 3. Fallback to direct Supabase query if API didn't succeed
      if (!apiSuccess) {
        try {
          const { data: allProfiles, error: profilesErr } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (profilesErr) {
            console.error('Supabase fallback profiles error:', profilesErr);
            setError((prev) => prev || profilesErr.message);
          } else if (allProfiles && allProfiles.length > 0) {
            const { data: paidOrders } = await supabase
              .from('orders')
              .select('user_id')
              .eq('status', 'paid');

            const ordersCountMap: Record<string, number> = {};
            (paidOrders || []).forEach((o: any) => {
              if (o.user_id) {
                ordersCountMap[o.user_id] = (ordersCountMap[o.user_id] || 0) + 1;
              }
            });

            const usersList: UserSummary[] = allProfiles.map((p: any) => ({
              id: p.id,
              name: p.full_name || 'Anonymous User',
              email: p.email,
              avatar_url: p.avatar_url || null,
              role: p.role || 'user',
              joined_date: p.created_at,
              total_purchased_courses: ordersCountMap[p.id] || 0,
              total_downloads: 0,
            }));
            setUsers(usersList);
            setError(null);
          }
        } catch (directErr: any) {
          console.error('Supabase direct users fallback error:', directErr);
          setError((prev) => prev || directErr?.message || 'Failed to load registered users');
        }
      }
    } catch (unexpectedErr: any) {
      console.error('Unexpected error in fetchUsers:', unexpectedErr);
      setError(unexpectedErr?.message || 'An unexpected error occurred while loading users');
    } finally {
      // GUARANTEED: Spinner is always dismissed!
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Re-fetch on focus / visibility change
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUsers();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, []);

  const openUserDetails = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setDetailError(null);
    setUserDetail(null);

    try {
      let token: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || null;
      } catch (sessionErr) {
        console.warn('Could not get session:', sessionErr);
      }

      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let detailLoaded = false;
      try {
        const res = await fetch(
          getApiUrl(`/api/admin/users?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`),
          {
            headers,
            cache: 'no-store',
            signal: controller.signal,
            credentials: 'include',
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: UserDetailResponse = await res.json();
          if (data.profile.avatar_url) {
            data.profile.avatar_url = await resolveStorageUrl(data.profile.avatar_url);
          }
          setUserDetail(data);
          detailLoaded = true;
        } else {
          const errData = await res.json().catch(() => null);
          console.warn('API openUserDetails error:', errData);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('API openUserDetails failed, falling back to Supabase:', err);
      }

      // Direct Supabase fallback
      if (!detailLoaded) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (profile) {
            const { data: orders } = await supabase
              .from('orders')
              .select('id, course_id, amount, status, payment_id, created_at, courses(title)')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            const purchasedCourses = (orders || [])
              .filter((o: any) => o.status === 'paid')
              .map((o: any) => ({
                order_id: o.id,
                course_id: o.course_id,
                course_name: (o.courses as any)?.title || 'Course',
                purchase_date: o.created_at,
                amount_paid: o.amount,
                status: o.status,
                payment_id: o.payment_id,
              }));

            let resolvedAvatar = profile.avatar_url;
            if (resolvedAvatar) {
              resolvedAvatar = await resolveStorageUrl(resolvedAvatar);
            }

            setUserDetail({
              profile: {
                id: profile.id,
                name: profile.full_name || 'Anonymous User',
                email: profile.email,
                avatar_url: resolvedAvatar || null,
                role: profile.role || 'user',
                joined_date: profile.created_at,
              },
              purchased_courses: purchasedCourses,
              download_history: [],
              stats: {
                total_purchased: purchasedCourses.length,
                total_downloads: 0,
              },
            });
            detailLoaded = true;
          }
        } catch (directErr) {
          console.error('Failed to load user details from Supabase fallback:', directErr);
        }
      }

      if (!detailLoaded) {
        setDetailError('Could not load activity details for this user.');
      }
    } catch (err: any) {
      console.error('Error in openUserDetails:', err);
      setDetailError(err?.message || 'Error loading user details.');
    } finally {
      // GUARANTEED: Detail modal spinner is always dismissed!
      setLoadingDetail(false);
    }
  };

  const closeUserDetails = () => {
    setSelectedUserId(null);
    setUserDetail(null);
    setDetailError(null);
  };

  // Filter users by name or email
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            View all registered users, monitor course purchases, and track PDF downloads.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers(true)}
            disabled={isRefreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
            title="Refresh user list"
          >
            <svg
              className={`w-4 h-4 text-brand-primary dark:text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-grow bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-hidden"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* User Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading registered users...</p>
          </div>
        ) : error && users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
              !
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Unable to Load Users</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {error}
            </p>
            <div className="mt-4">
              <Button onClick={() => fetchUsers(true)} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-2">👥</div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">No Users Found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {searchQuery ? 'No users matching your search query.' : 'No registered users found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-center">Courses</th>
                  <th className="py-3.5 px-4 text-center">Downloads</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {filteredUsers.map((user) => {
                  const avatarSrc = resolvedAvatars[user.id] || user.avatar_url;
                  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => openUserDetails(user.id)}
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-primary/10 dark:bg-blue-950 text-brand-primary dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-brand-primary/20">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            USER
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(user.joined_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Purchased Courses Count */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          user.total_purchased_courses > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {user.total_purchased_courses}
                        </span>
                      </td>

                      {/* Total Downloads Count */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          user.total_downloads > 0
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {user.total_downloads}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openUserDetails(user.id)}
                          className="text-xs font-semibold text-brand-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 cursor-pointer"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={closeUserDetails}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto soft-shadow border border-slate-200 dark:border-slate-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-4">
                {userDetail?.profile?.avatar_url ? (
                  <img
                    src={userDetail.profile.avatar_url}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border-2 border-brand-primary/20 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-brand-primary/10 dark:bg-blue-950 text-brand-primary dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0 border border-brand-primary/20">
                    {(userDetail?.profile?.name || userDetail?.profile?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {userDetail?.profile?.name || 'User Details'}
                    </h3>
                    {userDetail?.profile?.role === 'admin' ? (
                      <span className="text-2xs font-extrabold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        ADMIN
                      </span>
                    ) : (
                      <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        USER
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {userDetail?.profile?.email}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Member since {userDetail?.profile?.joined_date ? new Date(userDetail.profile.joined_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '...'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeUserDetails}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-grow">
              {loadingDetail ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading user activity and history...</p>
                </div>
              ) : detailError || !userDetail ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-red-500 font-medium">
                    {detailError || 'Could not load details for this user.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Purchased Courses
                      </p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {userDetail.purchased_courses.length}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Total PDF Downloads
                      </p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {userDetail.download_history.length}
                      </p>
                    </div>
                  </div>

                  {/* Section: Purchased Courses */}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <span>📚</span> Purchased Courses ({userDetail.purchased_courses.length})
                    </h4>
                    {userDetail.purchased_courses.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 text-center border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          This user has not purchased any paid courses yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {userDetail.purchased_courses.map((course) => (
                          <div
                            key={course.order_id}
                            className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                {course.course_name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Purchased on {new Date(course.purchase_date).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-brand-primary dark:text-blue-400">
                                ₹{Number(course.amount_paid).toFixed(2)}
                              </p>
                              <span className="inline-block mt-0.5 text-2xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                {course.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section: PDF Download History */}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <span>📥</span> PDF Download History ({userDetail.download_history.length})
                    </h4>
                    {userDetail.download_history.length === 0 ? (
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 text-center border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No verified PDF downloads recorded for this user yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {userDetail.download_history.map((dl) => (
                          <div
                            key={dl.id}
                            className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                {dl.course_name}
                              </p>
                              {dl.file_name && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                  File: {dl.file_name}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Downloaded on {new Date(dl.download_date).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {dl.access_type === 'FREE' ? (
                                <span className="inline-block text-2xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  FREE ACCESS
                                </span>
                              ) : (
                                <span className="inline-block text-2xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  PAID PURCHASE
                                </span>
                              )}
                              {dl.related_order && (
                                <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
                                  Order ₹{dl.related_order.amount} ({dl.related_order.status})
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 rounded-b-2xl flex justify-end">
              <Button variant="outline" size="sm" onClick={closeUserDetails}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
