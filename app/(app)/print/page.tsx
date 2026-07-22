import { createClient } from '@/lib/supabase/server';
import PrintSlips from '@/components/PrintSlips';

export default async function PrintPage({ searchParams }: { searchParams: { ids?: string } }) {
  const ids = (searchParams.ids ?? '').split(',').filter(Boolean);
  const supabase = createClient();

  const { data: requests } = await supabase.from('requests').select('*').in('id', ids);
  const { data: profiles } = await supabase.from('profiles').select('*');
  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Preserve the order the user selected them in.
  const ordered = ids
    .map((id) => requests?.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return <PrintSlips requests={ordered} profilesById={profilesById} />;
}
