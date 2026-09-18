import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function AdminTestSeriesPage() {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Manage Test Series</h2>
        <p className="mt-2 text-sm text-slate-600">Choose the section you want to manage. Free and paid test series are handled separately.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-2xl">🧪</div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Manage Free Test Series</h3>
              <p className="text-sm text-slate-500">Create and manage free test series</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">This section is only for free series, subjects, tests and questions.</p>
          <div className="mt-5">
            <Link href="/admin/test-series/free">
              <Button variant="primary" fullWidth>Open Free Test Series</Button>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 soft-shadow p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-2xl">💳</div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Manage Paid Test Series</h3>
              <p className="text-sm text-slate-500">Create and manage paid test series</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">This section is only for paid series, subjects, tests and questions.</p>
          <div className="mt-5">
            <Link href="/admin/test-series/paid">
              <Button variant="secondary" fullWidth>Open Paid Test Series</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
