'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import StoreSwitcher from './StoreSwitcher';
import NotificationBell from './NotificationBell';
import SignOutButton from './SignOutButton';
import type { Profile, Store } from '@/lib/types';

export default function AppShell({
  profile,
  stores,
  children,
}: {
  profile: Profile;
  stores: Store[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print border-b border-line bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-primary text-white font-mono font-semibold text-sm flex items-center justify-center">
              R
            </span>
            <Suspense fallback={null}>
              <StoreSwitcher
                stores={stores}
                currentStoreId={profile.last_store_id ?? stores[0]?.id ?? ''}
                userId={profile.id}
              />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
              <NavLink href="/requests" label="Requests" />
              {profile.role === 'cs' && <NavLink href="/create" label="New Request" />}
              {profile.role === 'admin' && <NavLink href="/admin/users" label="Users" />}
            </nav>
          </Suspense>

          <div className="flex items-center gap-3">
            <NotificationBell userId={profile.id} initialMuted={profile.notifications_muted} />
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-medium text-ink">{profile.full_name}</p>
              <p className="text-xs text-ink/50 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>
            <SignOutButton />
          </div>
        </div>

        <Suspense fallback={null}>
          <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 text-sm font-medium overflow-x-auto">
            <NavLink href="/requests" label="Requests" />
            {profile.role === 'cs' && <NavLink href="/create" label="New Request" />}
            {profile.role === 'admin' && <NavLink href="/admin/users" label="Users" />}
          </nav>
        </Suspense>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = pathname.startsWith(href);

  // Carry the currently selected store along to whichever page we navigate
  // to, so switching pages never loses track of which store you're in.
  const storeId = searchParams.get('store');
  const destination = storeId ? `${href}?store=${storeId}` : href;

  return (
    <Link
      href={destination}
      className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-ink/60 hover:text-ink hover:bg-ink/5'
      }`}
    >
      {label}
    </Link>
  );
}
