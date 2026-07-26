import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RequestsBrowser from '@/components/RequestsBrowser';
import { hasTabAccess, firstAccessibleTabPath } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  if (!profile) redirect('/login');
  if (!hasTabAccess(profile, 'requests')) {
    redirect(firstAccessibleTabPath(profile) ?? '/login');
  }

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
