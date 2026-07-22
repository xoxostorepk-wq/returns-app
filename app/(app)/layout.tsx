import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // Auth user exists but no profile row yet — Admin needs to finish setup.
    redirect('/login');
  }

  const { data: stores } = await supabase.from('stores').select('*').order('name');

  return (
    <AppShell profile={profile} stores={stores ?? []}>
      {children}
    </AppShell>
  );
}
