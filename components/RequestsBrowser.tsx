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
                <span className="text-xs text-ink/50">
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
