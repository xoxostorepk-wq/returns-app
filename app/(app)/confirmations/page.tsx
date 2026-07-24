import { createClient } from '@/lib/supabase/server';
import SimpleTicketBrowser from '@/components/SimpleTicketBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfirmationsPage({
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
    .from('order_confirmations')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(200);

  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink mb-1">Order Confirmations</h1>
      <p className="text-sm text-ink/60 mb-6">
        Track orders that need a customer confirmation call — replaces the group chat for this.
      </p>
      <SimpleTicketBrowser
        storeId={storeId ?? ''}
        currentProfile={profile!}
        profilesById={profilesById}
        initialItems={items ?? []}
        table="order_confirmations"
        commentsTable="order_confirmation_comments"
        parentIdField="order_confirmation_id"
        doneField="shopify_created"
        doneLabel="Order created in Shopify"
        placeholder="#1535"
      />
    </div>
  );
}
