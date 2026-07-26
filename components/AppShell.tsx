'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import StoreSwitcher from './StoreSwitcher';
import NotificationBell from './NotificationBell';
import SignOutButton from './SignOutButton';
import Logo from './Logo';
import type { Profile, Store, TabKey } from '@/lib/types';
import { TAB_LABELS, TAB_PATHS, hasTabAccess } from '@/lib/types';

const NAV_ITEMS: { tab: TabKey; icon: (active: boolean) => React.ReactNode }[] = [
  { tab: 'requests', icon: (a) => <RequestsIcon active={a} /> },
  { tab: 'confirmations', icon: (a) => <ConfirmationsIcon active={a} /> },
  { tab: 'returned_by_courier', icon: (a) => <ReturnedIcon active={a} /> },
  { tab: 'users', icon: (a) => <UsersIcon active={a} /> },
];

export default function AppShell({
  profile,
  stores,
  children,
}: {
  profile: Profile;
  stores: Store[];
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleItems = NAV_ITEMS.filter((item) => hasTabAccess(profile, item.tab));

  return (
    <div className="min-h-screen flex">
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="no-print fixed inset-0 bg-ink/40 z-40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-line flex flex-col transition-transform duration-200 md:translate-x-0 md:sticky md:top-0 md:h-screen ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-5 border-b border-line">
          <Logo size="md" />
        </div>

        <div className="px-4 pt-4">
          <Suspense fallback={null}>
            <StoreSwitcher
              stores={stores}
              currentStoreId={profile.last_store_id ?? stores[0]?.id ?? ''}
              userId={profile.id}
            />
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <nav className="flex-1 px-3 pt-5 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <SidebarLink
                key={item.tab}
                href={TAB_PATHS[item.tab]}
                label={TAB_LABELS[item.tab]}
                icon={item.icon}
                onNavigate={() => setMobileNavOpen(false)}
              />
            ))}
          </nav>
        </Suspense>

        <div className="px-5 py-4 border-t border-line">
          <p className="text-xs font-medium text-ink capitalize">{profile.full_name}</p>
          <p className="text-[11px] text-ink/50 capitalize mb-2">{profile.role.replace('_', ' ')}</p>
          <div className="text-[10px] leading-relaxed text-ink/40">
            <p>0318-7545957 · 0307-6494437</p>
            <p>xoxostore.pk@gmail.com</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print border-b border-line bg-card sticky top-0 z-30">
          <div className="h-16 flex items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-ink/5 transition-colors -ml-1"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
                </svg>
              </button>
              <Logo size="sm" />
            </div>

            <div className="hidden md:block" />

            <div className="flex items-center gap-3 ml-auto">
              <RefreshButton />
              <NotificationBell userId={profile.id} initialMuted={profile.notifications_muted} />
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function RefreshButton() {
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    // A full reload, not just a data refresh — this guarantees you're
    // seeing the latest data AND the latest version of the app itself,
    // which matters right after an update has been pushed.
    window.location.reload();
  }

  return (
    <button
      onClick={handleRefresh}
      aria-label="Refresh"
      title="Refresh"
      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-ink/5 transition-colors"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={spinning ? 'animate-spin' : ''}
      >
        <path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  onNavigate: () => void;
}) {
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
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-ink/60 hover:text-ink hover:bg-ink/5'
      }`}
    >
      {icon(active)}
      {label}
    </Link>
  );
}

function RequestsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className="shrink-0">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3" />
      <path d="M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

function ConfirmationsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.2 2.2L15.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReturnedIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className="shrink-0">
      <path d="M3 7h11a4 4 0 0 1 4 4v1" strokeLinecap="round" />
      <path d="M8 3L3 7l5 4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="14" width="8" height="7" rx="1.2" />
      <path d="M14 15.5h7M18 12.5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className="shrink-0">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" strokeLinecap="round" />
      <circle cx="17.5" cy="8.5" r="2.2" />
      <path d="M15.8 14.7c2.3.4 4 2.5 4.2 5.3" strokeLinecap="round" />
    </svg>
  );
}
