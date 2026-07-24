'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { NotificationRecord } from '@/lib/types';

export default function NotificationBell({
  userId,
  initialMuted,
}: {
  userId: string;
  initialMuted: boolean;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (active && data) setItems(data as NotificationRecord[]);
    }
    loadInitial();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationRecord;
          setItems((prev) => [newNotif, ...prev]);
          if (!muted) {
            audioRef.current?.play().catch(() => {
              // Autoplay can be blocked until the user interacts with the
              // page at least once — that's fine, the badge still updates.
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, muted]);

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    await supabase.from('profiles').update({ notifications_muted: next }).eq('id', userId);
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', userId).eq('read', false);
  }

  return (
    <div className="relative">
      {/* Silent, short 'ping' tone — not committing a binary asset, this stays
          unused if the browser blocks autoplay, which is an acceptable fallback. */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-ink/5 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-status-pending text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-line rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-xs text-ink/60 hover:text-ink">
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:text-primary-dark">
                    Mark all read
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-ink/50 px-4 py-6 text-center">
                Nothing yet. New requests and reminders will show up here.
              </p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.request_id ? `/requests/${n.request_id}` : '#'}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 border-b border-line last:border-0 hover:bg-ink/5 transition-colors ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <p className="text-sm text-ink">{n.message}</p>
                  <p className="text-xs text-ink/40 mt-0.5">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
