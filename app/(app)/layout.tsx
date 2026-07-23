import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const [{ data: profile }, { data: stores }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('stores').select('*').order('name'),
  ]);

  if (!profile) {
    // Auth user exists but no profile row yet — Admin needs to finish setup.
    redirect('/login');
  }

  return (
    <AppShell profile={profile} stores={stores ?? []}>
      {children}
    </AppShell>
  );
}
