import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ALL_TABS } from '@/lib/types';
import type { TabKey } from '@/lib/types';

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only Admins can change tab access' }, { status: 403 });
  }

  const { userId, tabAccess } = await request.json();
  if (!userId || !Array.isArray(tabAccess)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Only accept known tab keys — ignore anything unexpected sent in.
  const cleaned: TabKey[] = tabAccess.filter((t: string) => ALL_TABS.includes(t as TabKey));

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ tab_access: cleaned }).eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
