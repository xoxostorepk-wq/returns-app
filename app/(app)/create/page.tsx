'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { RequestType } from '@/lib/types';
import { REQUEST_TYPE_LABELS } from '@/lib/types';

const REQUEST_TYPES: RequestType[] = ['exchange', 'replacement', 'reverse_pickup', 'other'];

export default function CreateRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Prefer the store in the URL (set by the store switcher / nav links).
  // If it's ever missing — e.g. an old bookmark, or a link that didn't carry
  // it along — fall back to the user's last-used store instead of failing
  // or guessing wrong.
  const [storeId, setStoreId] = useState(searchParams.get('store') ?? '');
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveStore() {
      const urlStoreId = searchParams.get('store');

      if (urlStoreId) {
        setStoreId(urlStoreId);
        const { data } = await supabase.from('stores').select('name').eq('id', urlStoreId).single();
        if (!cancelled && data) setStoreName(data.name);
        return;
      }

      // No store in the URL — look up the signed-in user's last-used store.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('last_store_id')
        .eq('id', user.id)
        .single();

      if (!cancelled && profile?.last_store_id) {
        setStoreId(profile.last_store_id);
        const { data: store } = await supabase
          .from('stores')
          .select('name')
          .eq('id', profile.last_store_id)
          .single();
        if (!cancelled && store) setStoreName(store.name);
      }
    }

    resolveStore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [orderNumber, setOrderNumber] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('exchange');
  const [otherType, setOtherType] = useState('');
  const [itemToSend, setItemToSend] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    setImages((prev) => [...prev, ...Array.from(fileList)]);
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!storeId) {
      setError('No store selected. Pick a store from the top bar first.');
      return;
    }
    if (requestType === 'other' && !otherType.trim()) {
      setError('Please specify the request type.');
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Your session expired. Please sign in again.');
      setSubmitting(false);
      return;
    }

    // 1. Create the request row
    const { data: request, error: insertError } = await supabase
      .from('requests')
      .insert({
        store_id: storeId,
        order_number: orderNumber.trim(),
        request_type: requestType,
        request_type_other: requestType === 'other' ? otherType.trim() : null,
        item_to_send: itemToSend.trim(),
        payment_instructions: paymentInstructions.trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError || !request) {
      setError('Could not save the request. Please try again.');
      setSubmitting(false);
      return;
    }

    // 2. Log creation on the timeline
    await supabase.from('request_timeline').insert({
      request_id: request.id,
      actor_id: user.id,
      action: 'created',
    });

    // 3. Optional first comment
    if (comment.trim()) {
      await supabase.from('request_comments').insert({
        request_id: request.id,
        author_id: user.id,
        body: comment.trim(),
      });
    }

    // 4. Upload images, if any
    for (const file of images) {
      const path = `${request.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('request-images')
        .upload(path, file);

      if (!uploadError) {
        await supabase.from('request_images').insert({
          request_id: request.id,
          storage_path: path,
          uploaded_by: user.id,
        });
      }
    }

    // 5. Notify order takers & admins for this store
    const { data: recipients } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['order_taker', 'admin']);

    if (recipients) {
      const message = `New ${REQUEST_TYPE_LABELS[requestType]} request for order ${orderNumber.trim()}`;
      const notifs = recipients.map((r) => ({
        recipient_id: r.id,
        request_id: request.id,
        type: 'new_request',
        message,
      }));
      await supabase.from('notifications').insert(notifs);
    }

    setSubmitting(false);
    router.push(`/requests/${request.id}?store=${storeId}`);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-ink mb-1">New request</h1>
      <p className="text-sm text-ink/60 mb-3">
        Fill this in from what the customer sent — the Order Taker will pick it up from here.
      </p>
      {storeName && (
        <p className="text-sm font-medium text-primary bg-primary/10 rounded-lg px-3 py-2 mb-6 inline-block">
          Creating for: {storeName}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 pb-28 sm:pb-6">
        <Field label="Order number">
          <input
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="#1234"
            className="input font-mono"
          />
        </Field>

        <Field label="Request type">
          <div className="grid grid-cols-2 gap-2">
            {REQUEST_TYPES.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setRequestType(type)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  requestType === type
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card border-line text-ink/70 hover:border-ink/30'
                }`}
              >
                {REQUEST_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </Field>

        {requestType === 'other' && (
          <Field label="Specify type">
            <input
              required
              value={otherType}
              onChange={(e) => setOtherType(e.target.value)}
              placeholder="e.g. Wrong item sent"
              className="input"
            />
          </Field>
        )}

        <Field label="Item to send">
          <textarea
            required
            value={itemToSend}
            onChange={(e) => setItemToSend(e.target.value)}
            placeholder="e.g. Pack of 4 Cotton Bras, Size 36"
            rows={2}
            className="input resize-none"
          />
        </Field>

        <Field label="Payment instructions">
          <textarea
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            placeholder="e.g. Collect Rs.250 / No Charges / Exchange Free of Cost"
            rows={2}
            className="input resize-none"
          />
        </Field>

        <Field label="Upload screenshots">
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-line rounded-lg py-6 text-sm text-ink/60 cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
            <CameraIcon />
            Tap to add photos
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {images.map((file, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-line">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Field>

        <Field label="Comment (optional)">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything the Order Taker should know"
            rows={2}
            className="input resize-none"
          />
        </Field>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="fixed sm:static bottom-0 left-0 right-0 sm:mt-2 bg-paper sm:bg-transparent border-t sm:border-0 border-line p-4 sm:p-0">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium rounded-lg py-3 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Create request'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e1;
          padding: 0.625rem 0.75rem;
          font-size: 1rem;
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

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
