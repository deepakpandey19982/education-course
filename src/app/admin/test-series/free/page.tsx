import { redirect } from 'next/navigation';

export default function FreeTestSeriesAdminPage() {
  redirect('/admin/test-series?filter=free');
}
