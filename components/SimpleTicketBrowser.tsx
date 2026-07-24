'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface TicketItem {
  id: string;
  order_number: string;
  created_by: string;
  created_at: string;
  [key: string]: any;
}

interface CommentItem {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  [key: string]: any;
}

export default function SimpleTicketBrowser({
  storeId,
  currentProfile,
  profilesById: initialProfilesById,
  initialItems,
  table,
  commentsTable,
  parentIdField,
  doneField,
  doneLabel,
  extraField,
  placeholder,
}: {
  storeId: string;
  currentProfile: Profile;
  profilesById: Record<string, Profile>;
  initialItems: TicketItem[];
  table: string;
  commentsTable: string;
  parentIdField: string;
  doneField: string;
  doneLabel: string;
  extraField?: { key: string; label: string; placeholder: string };
  placeholder: string;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<TicketItem[]>(initialItems);
  const [profilesById] = useState(initialProfilesById);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({});
  const [newComment, setNewComment] = useState('');

  const [orderNumber, setOrderNumber] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [payload.new as TicketItem, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((i) => (i.id === (payload.new as TicketItem).id ? (payload.new as TicketItem) : i))
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, table]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim()) return;
    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const row: Record<string, any> = {
      store_id: storeId,
      order_number: orderNumber.trim(),
      created_by: user.id,
    };
    if (extraField) row[extraField.key] = extraValue.trim();

    await supabase.from(table).insert(row);

    setOrderNumber('');
    setExtraValue('');
    setCreating(false);
  }

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!comments[id]) {
      const { data } = await supabase
        .from(commentsTable)
        .select('*')
        .eq(parentIdField, id)
        .order('created_at');
      setComments((prev) => ({ ...prev, [id]: (data as CommentItem[]) ?? [] }));
    }
  }

  async function handleAddComment(id: string) {
    if (!newComment.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from(commentsTable)
      .insert({ [parentIdField]: id, author_id: user.id, body: newComment.trim() })
      .select()
      .single();

    if (data) {
      setComments((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), data as CommentItem] }));
    }
    setNewComment('');
  }

  async function toggleDone(id: string, current: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [doneField]: !current } : i)));
    await supabase.from(table).update({ [doneField]: !current }).eq('id', id);
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="bg-card border border-line rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-ink/60 mb-1">Order number</label>
          <input
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {extraField && (
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-ink/60 mb-1">{extraField.label}</label>
            <input
              value={extraValue}
              onChange={(e) => setExtraValue(e.target.value)}
              placeholder={extraField.placeholder}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={creating}
          className="bg-primary text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-primary-dark disabled:opacity-60"
        >
          {creating ? 'Adding…' : '+ Add'}
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-center py-16 text-ink/50 text-sm border border-dashed border-line rounded-xl">
          Nothing here yet.
        </div>
      ) : (
        <div className="bg-card border border-line rounded-xl overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="border-b border-line last:border-0">
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.02] transition-colors text-left"
              >
                <input
                  type="checkbox"
                  checked={!!item[doneField]}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleDone(item.id, item[doneField]);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 shrink-0"
                />
                <span className="font-mono text-sm text-ink shrink-0">{item.order_number}</span>
                {extraField && item[extraField.key] && (
                  <span className="text-sm text-ink/60 shrink-0">{item[extraField.key]}</span>
                )}
                <span className={`text-xs shrink-0 ${item[doneField] ? 'text-status-processed' : 'text-status-pending'}`}>
                  {item[doneField] ? doneLabel : 'Pending'}
                </span>
                <span className="text-xs text-ink/40 ml-auto shrink-0">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </button>

              {expanded === item.id && (
                <div className="px-4 pb-4">
                  <div className="space-y-2 mb-3">
                    {(comments[item.id] ?? []).length === 0 ? (
                      <p className="text-sm text-ink/50">No comments yet.</p>
                    ) : (
                      (comments[item.id] ?? []).map((c) => (
                        <div key={c.id} className="text-sm">
                          <p className="text-ink">{c.body}</p>
                          <p className="text-xs text-ink/40 mt-0.5">
                            {profilesById[c.author_id]?.full_name ?? 'Unknown'} ·{' '}
                            {new Date(c.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment…"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment(item.id)}
                      className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      onClick={() => handleAddComment(item.id)}
                      className="bg-ink text-white text-sm font-medium rounded-lg px-4 hover:bg-ink/90"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
