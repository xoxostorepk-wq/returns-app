import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UsersManager from '@/components/UsersManager';
import { hasTabAccess, firstAccessibleTabPath } from '@/lib/types';

export default async function AdminUsersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
  if (!profile) redirect('/login');
  if (!hasTabAccess(profile, 'users')) {
    redirect(firstAccessibleTabPath(profile) ?? '/login');
  }

  const { data: users } = await supabase.from('profiles').select('*').order('full_name');

  return <UsersManager users={users ?? []} canManage={profile.role === 'admin'} />;
}
