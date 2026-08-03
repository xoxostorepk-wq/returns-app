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
  notesField,
  showAmount,
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
  notesField?: { key: string; label: string; placeholder: string };
  showAmount?: boolean;
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
  const [notesValue, setNotesValue] = useState('');
  const [amountValue, setAmountValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Editing an existing item's notes after creation.
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

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
    setCreateError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const trimmedOrderNumber = orderNumber.trim();

    // Same order number can exist once per tab, but not twice within this
    // same tab (two agents entering the same order independently, etc.).
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('store_id', storeId)
      .ilike('order_number', trimmedOrderNumber)
      .limit(1);

    if (existing && existing.length > 0) {
      setCreateError('This order number already exists in this tab.');
      setCreating(false);
      return;
    }

    const row: Record<string, any> = {
      store_id: storeId,
      order_number: trimmedOrderNumber,
      created_by: user.id,
    };
    if (extraField) row[extraField.key] = extraValue.trim();
    if (notesField) row[notesField.key] = notesValue.trim() || null;
    if (showAmount) row.amount = amountValue.trim() ? Number(amountValue) : null;

    const { error: insertError } = await supabase.from(table).insert(row);

    if (insertError) {
      // Backstop for the rare case of two people submitting the same
      // order number at the exact same moment (the DB itself also
      // enforces this — see supabase/fix_fulfilled_lock_and_duplicate_check.sql).
      setCreateError(
        insertError.code === '23505'
          ? 'This order number already exists in this tab.'
          : 'Could not save. Please try again.'
      );
      setCreating(false);
      return;
    }

    setOrderNumber('');
    setExtraValue('');
    setNotesValue('');
    setAmountValue('');
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

  function startEditingNotes(item: TicketItem) {
    if (!notesField) return;
    setEditingNotesId(item.id);
    setNotesDraft(item[notesField.key] ?? '');
  }

  async function handleSaveNotes(id: string) {
    if (!notesField) return;
    setSavingNotes(true);
    const value = notesDraft.trim() || null;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [notesField.key]: value } : i)));
    await supabase.from(table).update({ [notesField.key]: value }).eq('id', id);
    setSavingNotes(false);
    setEditingNotesId(null);
  }

  async function toggleDone(id: string, current: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [doneField]: !current } : i)));
    await supabase.from(table).update({ [doneField]: !current }).eq('id', id);
    setPending((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const [pending, setPending] = useState<Record<string, boolean>>({});

  // CS can create and comment, but never mark something fulfilled. Order
  // Taker can mark it fulfilled, but once it's fulfilled only Admin can
  // undo it back to pending — this mirrors the DB-level lock in
  // supabase/add_tab_access_and_permission_locks.sql.
  const isAdmin = currentProfile.role === 'admin';
  const isOrderTaker = currentProfile.role === 'order_taker';

  function canToggle(actual: boolean) {
    if (isAdmin) return true;
    if (isOrderTaker) return !actual;
    return false;
  }

  function handleCheckboxClick(id: string, actual: boolean) {
    if (!canToggle(actual)) return;
    setPending((prev) => {
      const next = { ...prev };
      const currentlyPending = id in next ? next[id] : actual;
      const newlyArmed = !currentlyPending;
      if (newlyArmed === actual) {
        // Back to matching the real saved state — nothing to confirm.
        delete next[id];
      } else {
        next[id] = newlyArmed;
      }
      return next;
    });
  }

  return (
    <div>
      {currentProfile.role === 'cs' && (
        <form onSubmit={handleCreate} className="bg-card border border-line rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-ink/60 mb-1">Order number</label>
            <input
              required
              value={orderNumber}
              onChange={(e) => {
                setOrderNumber(e.target.value);
                setCreateError(null);
              }}
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
          {showAmount && (
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-ink/60 mb-1">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                value={amountValue}
                onChange={(e) => setAmountValue(e.target.value)}
                placeholder="e.g. 250"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          {notesField && (
            <div className="flex-1 min-w-[180px] basis-full">
              <label className="block text-xs font-medium text-ink/60 mb-1">{notesField.label}</label>
              <input
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder={notesField.placeholder}
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
          {createError && <p className="text-sm text-red-600 basis-full">{createError}</p>}
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 text-ink/50 text-sm border border-dashed border-line rounded-xl">
          Nothing here yet.
        </div>
      ) : (
        <div className="bg-card border border-line rounded-xl overflow-hidden">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-ink/50 border-b border-line uppercase tracking-wide">
            <span className="w-4 shrink-0" />
            <div className="grid grid-cols-[1fr_90px_120px_1fr_1fr_1fr_100px] gap-3 flex-1">
              <span>Order #</span>
              <span>Amount</span>
              <span>Status</span>
              <span>{extraField?.label ?? 'Courier'}</span>
              <span>Notes</span>
              <span>Created By</span>
              <span>Created</span>
            </div>
          </div>
          {items.map((item) => {
            const actual = !!item[doneField];
            const isArmed = item.id in pending;
            const displayedChecked = isArmed ? pending[item.id] : actual;
            const locked = !canToggle(actual);

            return (
              <div key={item.id} className="border-b border-line last:border-0">
                <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.02] transition-colors">
                  <input
                    type="checkbox"
                    checked={displayedChecked}
                    disabled={locked}
                    onChange={() => handleCheckboxClick(item.id, actual)}
                    title={
                      locked && actual
                        ? 'Locked — only Admin can undo this'
                        : locked
                        ? 'Only Order Taker / Admin can mark this'
                        : undefined
                    }
                    className="h-4 w-4 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  {locked && actual && <LockIcon />}
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="grid grid-cols-2 sm:grid-cols-[1fr_90px_120px_1fr_1fr_1fr_100px] gap-1 sm:gap-3 flex-1 text-left min-w-0 items-center"
                  >
                    <span className="font-mono text-sm text-ink shrink-0 flex items-center gap-1.5 col-span-2 sm:col-span-1">
                      {item.order_number}
                      {notesField && item[notesField.key] && <NoteIcon />}
                    </span>
                    <span className="text-sm text-ink/70 font-mono">
                      {showAmount && item.amount != null ? item.amount : '—'}
                    </span>
                    <span className={`text-xs shrink-0 ${actual ? 'text-status-processed' : 'text-status-pending'}`}>
                      {actual ? doneLabel : 'Pending'}
                    </span>
                    <span className="text-sm text-ink/70 truncate">
                      {extraField && item[extraField.key] ? item[extraField.key] : '—'}
                    </span>
                    <span className="text-sm text-red-600 truncate">
                      {notesField && item[notesField.key] ? item[notesField.key] : '—'}
                    </span>
                    <span className="text-sm text-ink/70 truncate">
                      {profilesById[item.created_by]?.full_name ?? '—'}
                    </span>
                    <span className="text-sm sm:text-xs text-ink/50">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  {isArmed && (
                    <button
                      onClick={() => toggleDone(item.id, actual)}
                      className="shrink-0 text-xs font-medium bg-primary text-white rounded-lg px-3 py-1.5 hover:bg-primary-dark"
                    >
                      Confirm {pending[item.id] ? doneLabel : 'Pending'}
                    </button>
                  )}
                </div>

                {expanded === item.id && (
                  <div className="px-4 pb-4">
                    {notesField && (
                      <div className="mb-3 pb-3 border-b border-line">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-ink/50">{notesField.label}</p>
                          {editingNotesId !== item.id && canToggle(actual) && (
                            <button
                              onClick={() => startEditingNotes(item)}
                              className="text-xs text-primary hover:text-primary-dark"
                            >
                              {item[notesField.key] ? 'Edit' : 'Add'}
                            </button>
                          )}
                        </div>
                        {editingNotesId === item.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder={notesField.placeholder}
                              rows={2}
                              className="w-full rounded-lg border border-line px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveNotes(item.id)}
                                disabled={savingNotes}
                                className="text-xs font-medium bg-primary text-white rounded-lg px-3 py-1.5 hover:bg-primary-dark disabled:opacity-60"
                              >
                                {savingNotes ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="text-xs text-ink/60 px-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-ink/70">{item[notesField.key] || '—'}</p>
                        )}
                      </div>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-ink/30 shrink-0"
      aria-label="Has notes"
    >
      <path d="M5 4h11l3 3v13H5z" strokeLinejoin="round" />
      <path d="M16 4v3h3" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className="text-ink/30 shrink-0"
    >
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}
