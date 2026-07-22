import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UsersManager from '@/components/UsersManager';

export default async function AdminUsersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
  if (profile?.role !== 'admin') redirect('/requests');

  const { data: users } = await supabase.from('profiles').select('*').order('full_name');

  return <UsersManager users={users ?? []} />;
}
