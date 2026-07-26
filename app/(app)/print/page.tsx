import { createClient } from '@/lib/supabase/server';
import PrintSlips from '@/components/PrintSlips';

export default async function PrintPage({ searchParams }: { searchParams: { ids?: string } }) {
  const ids = (searchParams.ids ?? '').split(',').filter(Boolean);
  const supabase = createClient();

  const { data: requests } = await supabase.from('requests').select('*').in('id', ids);
  const { data: profiles } = await supabase.from('profiles').select('*');
  const { data: stores } = await supabase.from('stores').select('*');
  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // All slips being printed together are always from the same store (you
  // print from within a single store's Requests page), so one store name
  // covers the whole batch. Falls back gracefully if that ever isn't true.
  const storeName = requests?.[0]?.store_id
    ? stores?.find((s) => s.id === requests[0].store_id)?.name ?? 'Xoxostore'
    : 'Xoxostore';

  // Preserve the order the user selected them in.
  const ordered = ids
    .map((id) => requests?.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return <PrintSlips requests={ordered} profilesById={profilesById} storeName={storeName} />;
}
