import { createClient } from '@/lib/supabase/server';
import RequestsBrowser from '@/components/RequestsBrowser';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: { store?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: stores }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('stores').select('*').order('name'),
    supabase.from('profiles').select('*'),
  ]);

  const storeId = searchParams.store ?? profile?.last_store_id ?? stores?.[0]?.id;

  const { data: requests } = await supabase
    .from('requests')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(200);

  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (
    <RequestsBrowser
      initialRequests={requests ?? []}
      profilesById={profilesById}
      currentProfile={profile!}
      storeId={storeId ?? ''}
    />
  );
}
