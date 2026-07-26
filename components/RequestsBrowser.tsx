'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from './StatusBadge';
import type { Profile, RequestRecord, RequestStatus } from '@/lib/types';
import { REQUEST_TYPE_LABELS } from '@/lib/types';

const STATUS_TABS: { key: RequestStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'packed', label: 'Packed' },
  { key: 'processed', label: 'Processed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function RequestsBrowser({
  initialRequests,
  profilesById,
  currentProfile,
  storeId,
}: {
  initialRequests: RequestRecord[];
  profilesById: Record<string, Profile>;
  currentProfile: Profile;
  storeId: string;
}) {
  const supabase = createClient();
  const [requests, setRequests] = useState(initialRequests);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>(
    currentProfile.role === 'order_taker' ? 'pending' : 'all'
  );
  const [search, setSearch] = useState('');
  // Defaults to the current month (e.g. "2026-07") so the list starts
  // useful without anyone having to set a filter first.
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Keep the list live: new requests / status changes appear without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`requests-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests((prev) => [payload.new as RequestRecord, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRequests((prev) =>
              prev.map((r) => (r.id === (payload.new as RequestRecord).id ? (payload.new as RequestRecord) : r))
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Same as `filtered`, but ignoring the status tab — used to show a count
  // next to each tab (e.g. "Pending (3)") for the currently selected month.
  const withinTimeframe = useMemo(() => {
    return requests.filter((r) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.order_number.toLowerCase().includes(q) && !r.item_to_send.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (!showAllMonths) {
        const [year, monthNum] = month.split('-').map(Number);
        const createdAt = new Date(r.created_at);
        if (createdAt.getFullYear() !== year || createdAt.getMonth() + 1 !== monthNum) return false;
      }
      return true;
    });
  }, [requests, search, month, showAllMonths]);

  const counts = useMemo(() => {
    const result: Record<RequestStatus | 'all', number> = {
      all: withinTimeframe.length,
      pending: 0,
      packed: 0,
      processed: 0,
      cancelled: 0,
    };
    for (const r of withinTimeframe) result[r.status]++;
    return result;
  }, [withinTimeframe]);

  const amountSums = useMemo(() => {
    const result: Record<RequestStatus, number> = { pending: 0, packed: 0, processed: 0, cancelled: 0 };
    for (const r of withinTimeframe) {
      if (r.amount != null) result[r.status] += r.amount;
    }
    return result;
  }, [withinTimeframe]);

  const filtered = useMemo(() => {
    return withinTimeframe.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  }, [withinTimeframe, statusFilter]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-ink">Requests</h1>
        {selected.size > 0 && (
          <Link
            href={`/print?ids=${Array.from(selected).join(',')}`}
            className="text-sm font-medium bg-ink text-white rounded-lg px-3 py-1.5 hover:bg-ink/90"
          >
            Print {selected.size} selected slip{selected.size > 1 ? 's' : ''}
          </Link>
        )}
      </div>

      {currentProfile.role === 'cs' && (
        <Link
          href={`/create?store=${storeId}`}
          aria-label="New Request"
          title="New Request"
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors flex items-center justify-center text-2xl font-light"
        >
          +
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pending" value={counts.pending} amount={amountSums.pending} tone="pending" icon={<ClockIcon />} />
        <StatCard label="Packed" value={counts.packed} amount={amountSums.packed} tone="packed" icon={<PackageIcon />} />
        <StatCard label="Processed" value={counts.processed} amount={amountSums.processed} tone="processed" icon={<CheckIcon />} />
        <StatCard label="Cancelled" value={counts.cancelled} amount={amountSums.cancelled} tone="cancelled" icon={<XIcon />} />
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.key
                ? 'bg-primary text-white'
                : 'bg-card border border-line text-ink/60 hover:text-ink'
            }`}
          >
            {tab.label} <span className="opacity-70">({counts[tab.key]})</span>
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number or item…"
          className="ml-auto min-w-[200px] rounded-lg border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <label className="text-sm text-ink/60">Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setShowAllMonths(false);
          }}
          disabled={showAllMonths}
          className="rounded-lg border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          onClick={() => setShowAllMonths((v) => !v)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            showAllMonths
              ? 'bg-primary text-white border-primary'
              : 'border-line text-ink/60 hover:text-ink'
          }`}
        >
          All time
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-ink/50 text-sm border border-dashed border-line rounded-xl">
          No requests match this view.
        </div>
      ) : (
        <div className="bg-card border border-line rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[24px_1fr_1fr_1.5fr_1fr_100px] gap-3 px-4 py-2.5 text-xs font-semibold text-ink/50 border-b border-line uppercase tracking-wide">
            <span />
            <span>Order #</span>
            <span>Type</span>
            <span>Item</span>
            <span>Created</span>
            <span>Status</span>
          </div>
          {filtered.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-1 sm:grid-cols-[24px_1fr_1fr_1.5fr_1fr_100px] gap-1 sm:gap-3 px-4 py-3 border-b border-line last:border-0 items-center hover:bg-ink/[0.02] transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleSelected(r.id)}
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:block h-4 w-4"
              />
              <Link href={`/requests/${r.id}?store=${storeId}`} className="contents">
                <span className="font-mono text-sm text-ink">{r.order_number}</span>
                <span className="text-sm text-ink/70">
                  {r.request_type === 'other' ? r.request_type_other : REQUEST_TYPE_LABELS[r.request_type]}
                </span>
                <span className="text-sm text-ink/70 truncate">{r.item_to_send}</span>
                <span className="text-sm sm:text-xs text-ink/50">
                  {new Date(r.created_at).toLocaleDateString()}{' '}
                  {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>
                  <StatusBadge status={r.status} />
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STAT_TONES: Record<RequestStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-status-pending-bg', text: 'text-status-pending' },
  packed: { bg: 'bg-status-packed-bg', text: 'text-status-packed' },
  processed: { bg: 'bg-status-processed-bg', text: 'text-status-processed' },
  cancelled: { bg: 'bg-status-cancelled-bg', text: 'text-status-cancelled' },
};

function StatCard({
  label,
  value,
  amount,
  tone,
  icon,
}: {
  label: string;
  value: number;
  amount: number;
  tone: RequestStatus;
  icon: React.ReactNode;
}) {
  const { bg, text } = STAT_TONES[tone];
  return (
    <div className="bg-card border border-line rounded-xl p-4 flex items-start justify-between">
      <div>
        <p className="text-2xl font-semibold text-ink leading-none">{value}</p>
        <p className="text-xs text-ink/50 mt-1.5">{label}</p>
        {amount > 0 && <p className="text-xs font-mono text-ink/40 mt-1">Rs {amount.toLocaleString()}</p>}
      </div>
      <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${bg} ${text}`}>{icon}</span>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" strokeLinejoin="round" />
      <path d="M3 8v8l9 5 9-5V8" strokeLinejoin="round" />
      <path d="M12 13v8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.2 2.2L15.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" strokeLinecap="round" />
    </svg>
  );
}
