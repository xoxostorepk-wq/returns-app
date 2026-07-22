import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only Admins can change roles' }, { status: 403 });
  }

  const { userId, role } = await request.json();
  if (!userId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
