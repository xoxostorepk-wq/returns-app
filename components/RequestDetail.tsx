'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from './StatusBadge';
import StatusTracker from './StatusTracker';
import type {
  Profile,
  RequestComment,
  RequestRecord,
  RequestType,
  TimelineEntry,
} from '@/lib/types';
import { REQUEST_TYPE_LABELS } from '@/lib/types';

type ImageWithUrl = { id: string; url: string; uploaded_by: string; uploaded_at: string };

const REQUEST_TYPES: RequestType[] = ['exchange', 'replacement', 'reverse_pickup', 'other'];

const EDITABLE_FIELDS: { key: keyof RequestRecord; label: string }[] = [
  { key: 'order_number', label: 'Order number' },
  { key: 'item_to_send', label: 'Item to send' },
  { key: 'payment_instructions', label: 'Payment instructions' },
];

export default function RequestDetail({
  request,
  images,
  comments,
  timeline,
  profilesById,
  currentProfile,
}: {
  request: RequestRecord;
  images: ImageWithUrl[];
  comments: RequestComment[];
  timeline: TimelineEntry[];
  profilesById: Record<string, Profile>;
  currentProfile: Profile;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    order_number: request.order_number,
    item_to_send: request.item_to_send,
    payment_instructions: request.payment_instructions,
    request_type: request.request_type,
    request_type_other: request.request_type_other ?? '',
  });
  const [saving, setSaving] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [trackingNumber, setTrackingNumber] = useState(request.tracking_number ?? '');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const canEdit = currentProfile.role === 'cs' || currentProfile.role === 'admin';
  const canAct = currentProfile.role === 'order_taker' || currentProfile.role === 'admin';
  const isAdmin = currentProfile.role === 'admin';

  async function handleSaveEdit() {
    setSaving(true);
    const changes: { field: string; old: string; new: string }[] = [];

    for (const { key, label } of EDITABLE_FIELDS) {
      const oldVal = String(request[key] ?? '');
      const newVal = String(form[key as keyof typeof form] ?? '');
      if (oldVal !== newVal) changes.push({ field: label, old: oldVal, new: newVal });
    }
    if (form.request_type !== request.request_type) {
      changes.push({
        field: 'Request type',
        old: REQUEST_TYPE_LABELS[request.request_type],
        new: REQUEST_TYPE_LABELS[form.request_type],
      });
    }

    await supabase
      .from('requests')
      .update({
        order_number: form.order_number,
        item_to_send: form.item_to_send,
        payment_instructions: form.payment_instructions,
        request_type: form.request_type,
        request_type_other: form.request_type === 'other' ? form.request_type_other : null,
      })
      .eq('id', request.id);

    for (const change of changes) {
      await supabase.from('request_timeline').insert({
        request_id: request.id,
        actor_id: currentProfile.id,
        action: 'edited',
        field_name: change.field,
        old_value: change.old,
        new_value: change.new,
      });
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    await supabase.from('request_comments').insert({
      request_id: request.id,
      author_id: currentProfile.id,
      body: newComment.trim(),
    });
    setNewComment('');
    router.refresh();
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    for (const file of Array.from(fileList)) {
      const path = `${request.id}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from('request-images').upload(path, file);
      if (!error) {
        await supabase.from('request_images').insert({
          request_id: request.id,
          storage_path: path,
          uploaded_by: currentProfile.id,
        });
      }
    }
    setBusy(false);
    router.refresh();
  }

  async function handleMarkPacked() {
    setBusy(true);
    await supabase
      .from('requests')
      .update({ status: 'packed', packed_at: new Date().toISOString(), packed_by: currentProfile.id })
      .eq('id', request.id);
    await supabase.from('request_timeline').insert({
      request_id: request.id,
      actor_id: currentProfile.id,
      action: 'packed',
    });
    setBusy(false);
    router.refresh();
  }

  async function handleMarkProcessed() {
    setBusy(true);
    await supabase
      .from('requests')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        processed_by: currentProfile.id,
        tracking_number: trackingNumber.trim() || null,
      })
      .eq('id', request.id);
    await supabase.from('request_timeline').insert({
      request_id: request.id,
      actor_id: currentProfile.id,
      action: 'processed',
      field_name: trackingNumber.trim() ? 'Tracking number' : undefined,
      new_value: trackingNumber.trim() || undefined,
    });

    // Close the loop: let CS know it's done.
    await supabase.from('notifications').insert({
      recipient_id: request.created_by,
      request_id: request.id,
      type: 'new_request',
      message: `Order ${request.order_number} has been processed and handed to courier.`,
    });

    setBusy(false);
    router.refresh();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    setBusy(true);
    await supabase
      .from('requests')
      .update({ status: 'cancelled', cancelled_reason: cancelReason.trim() })
      .eq('id', request.id);
    await supabase.from('request_timeline').insert({
      request_id: request.id,
      actor_id: currentProfile.id,
      action: 'cancelled',
      new_value: cancelReason.trim(),
    });
    setBusy(false);
    setShowCancel(false);
    router.refresh();
  }

  async function handleSendReminder() {
    setBusy(true);
    const { data: recipients } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['order_taker', 'admin']);

    if (recipients) {
      await supabase.from('notifications').insert(
        recipients.map((r) => ({
          recipient_id: r.id,
          request_id: request.id,
          type: 'manual_reminder',
          message: `Reminder: order ${request.order_number} is still ${request.status}.`,
        }))
      );
    }
    await supabase.from('request_timeline').insert({
      request_id: request.id,
      actor_id: currentProfile.id,
      action: 'manual_reminder_sent',
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-mono text-xl font-semibold text-ink">{request.order_number}</p>
            <p className="text-sm text-ink/60">
              {request.request_type === 'other' ? request.request_type_other : REQUEST_TYPE_LABELS[request.request_type]}
              {' · '}
              Created by {profilesById[request.created_by]?.full_name ?? 'Unknown'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} />
            <Link
              href={`/print?ids=${request.id}`}
              className="text-sm font-medium border border-line rounded-lg px-3 py-1.5 hover:bg-ink/5"
            >
              Print slip
            </Link>
          </div>
        </div>

        {/* Details / Edit form */}
        <div className="bg-card border border-line rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">Details</h2>
            {canEdit && !editing && request.status !== 'cancelled' && (
              <button onClick={() => setEditing(true)} className="text-sm text-primary hover:text-primary-dark">
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Order number</label>
                <input
                  value={form.order_number}
                  onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Request type</label>
                <div className="grid grid-cols-2 gap-2">
                  {REQUEST_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, request_type: t }))}
                      className={`py-2 rounded-lg text-sm font-medium border ${
                        form.request_type === t ? 'bg-primary text-white border-primary' : 'border-line text-ink/70'
                      }`}
                    >
                      {REQUEST_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              {form.request_type === 'other' && (
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Specify type</label>
                  <input
                    value={form.request_type_other}
                    onChange={(e) => setForm((f) => ({ ...f, request_type_other: e.target.value }))}
                    className="input"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Item to send</label>
                <textarea
                  value={form.item_to_send}
                  onChange={(e) => setForm((f) => ({ ...f, item_to_send: e.target.value }))}
                  rows={2}
                  className="input resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Payment instructions</label>
                <textarea
                  value={form.payment_instructions}
                  onChange={(e) => setForm((f) => ({ ...f, payment_instructions: e.target.value }))}
                  rows={2}
                  className="input resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="bg-primary text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-primary-dark disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm font-medium text-ink/60 px-4 py-2 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-ink/40">Every change here is recorded on the timeline with your name and the time.</p>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <Row label="Item to send" value={request.item_to_send} />
              <Row label="Payment instructions" value={request.payment_instructions || '—'} />
            </dl>
          )}
        </div>

        {/* Images */}
        <div className="bg-card border border-line rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">Screenshots ({images.length})</h2>
            <label className="text-sm text-primary hover:text-primary-dark cursor-pointer">
              {busy ? 'Uploading…' : '+ Add photos'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </label>
          </div>
          {images.length === 0 ? (
            <p className="text-sm text-ink/50">No screenshots uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((img) => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-line block">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-card border border-line rounded-xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Comments</h2>
          <div className="space-y-3 mb-4">
            {comments.length === 0 && <p className="text-sm text-ink/50">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <p className="text-ink">{c.body}</p>
                <p className="text-xs text-ink/40 mt-0.5">
                  {profilesById[c.author_id]?.full_name ?? 'Unknown'} · {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment or correction…"
              className="input"
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <button
              onClick={handleAddComment}
              className="shrink-0 bg-ink text-white text-sm font-medium rounded-lg px-4 hover:bg-ink/90"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      {/* Right column: status tracker + actions */}
      <div className="space-y-6">
        <div className="bg-card border border-line rounded-xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Status</h2>
          <StatusTracker request={request} profilesById={profilesById} />
        </div>

        {request.status !== 'cancelled' && request.status !== 'processed' && canAct && (
          <div className="bg-card border border-line rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-ink mb-1">Actions</h2>
            {request.status === 'pending' && (
              <button
                onClick={handleMarkPacked}
                disabled={busy}
                className="w-full bg-status-packed text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-60"
              >
                Mark Packed
              </button>
            )}
            {request.status === 'packed' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Tracking number</label>
                  <input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Courier tracking #"
                    className="input font-mono"
                  />
                </div>
                <button
                  onClick={handleMarkProcessed}
                  disabled={busy}
                  className="w-full bg-status-processed text-white text-sm font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-60"
                >
                  Mark Processed
                </button>
              </>
            )}
          </div>
        )}

        {request.status !== 'cancelled' && request.status !== 'processed' && currentProfile.role === 'cs' && (
          <div className="bg-card border border-line rounded-xl p-5">
            <button
              onClick={handleSendReminder}
              disabled={busy}
              className="w-full text-sm font-medium border border-line rounded-lg py-2.5 hover:bg-ink/5 disabled:opacity-60"
            >
              Send reminder to Order Taker
            </button>
          </div>
        )}

        {isAdmin && request.status !== 'cancelled' && (
          <div className="bg-card border border-line rounded-xl p-5">
            {!showCancel ? (
              <button
                onClick={() => setShowCancel(true)}
                className="w-full text-sm font-medium text-red-600 border border-red-200 rounded-lg py-2.5 hover:bg-red-50"
              >
                Cancel request
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancelling…"
                  rows={2}
                  className="input resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-red-600 text-white text-sm font-medium rounded-lg py-2 hover:bg-red-700"
                  >
                    Confirm cancel
                  </button>
                  <button onClick={() => setShowCancel(false)} className="text-sm text-ink/60 px-3">
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card border border-line rounded-xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Timeline</h2>
          <div className="space-y-3">
            {timeline.map((t) => (
              <div key={t.id} className="text-xs">
                <p className="text-ink">{describeTimelineEntry(t, profilesById)}</p>
                <p className="text-ink/40 mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e1;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
        .input:focus {
          outline: none;
          border-color: #0f6e63;
          box-shadow: 0 0 0 2px rgba(15, 110, 99, 0.15);
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink/50">{label}</dt>
      <dd className="text-ink mt-0.5">{value}</dd>
    </div>
  );
}

function describeTimelineEntry(t: TimelineEntry, profilesById: Record<string, Profile>) {
  const actor = profilesById[t.actor_id]?.full_name ?? 'Unknown';
  switch (t.action) {
    case 'created':
      return `Created by ${actor}`;
    case 'edited':
      return `${t.field_name} changed from "${t.old_value}" to "${t.new_value}" by ${actor}`;
    case 'packed':
      return `Marked Packed by ${actor}`;
    case 'processed':
      return t.new_value ? `Marked Processed by ${actor} · tracking ${t.new_value}` : `Marked Processed by ${actor}`;
    case 'cancelled':
      return `Cancelled by ${actor} — ${t.new_value}`;
    case 'manual_reminder_sent':
      return `${actor} sent a manual reminder`;
    case 'reminder_sent':
      return `Automatic reminder sent`;
    default:
      return `${t.action} by ${actor}`;
  }
}
