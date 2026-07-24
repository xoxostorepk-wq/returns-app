import { createClient } from '@/lib/supabase/server';
import SimpleTicketBrowser from '@/components/SimpleTicketBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReturnedByCourierPage({
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

  const { data: items } = await supabase
    .from('returned_by_courier')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(200);

  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink mb-1">Returned by Courier</h1>
      <p className="text-sm text-ink/60 mb-6">
        Parcels that came back via courier — check with the customer, then note which courier to resend with.
      </p>
      <SimpleTicketBrowser
        storeId={storeId ?? ''}
        currentProfile={profile!}
        profilesById={profilesById}
        initialItems={items ?? []}
        table="returned_by_courier"
        commentsTable="returned_by_courier_comments"
        parentIdField="returned_by_courier_id"
        doneField="resent"
        doneLabel="Resent"
        extraField={{ key: 'courier', label: 'Courier', placeholder: 'e.g. TCS, Leopard' }}
        placeholder="#153"
      />
    </div>
  );
}
