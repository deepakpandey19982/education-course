import { redirect } from 'next/navigation';

export default function PaidTestSeriesAdminPage() {
  redirect('/admin/test-series?filter=paid');
}
