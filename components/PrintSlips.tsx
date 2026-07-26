'use client';

import type { Profile, RequestRecord } from '@/lib/types';
import { REQUEST_TYPE_LABELS } from '@/lib/types';

export default function PrintSlips({
  requests,
  profilesById,
  storeName,
}: {
  requests: RequestRecord[];
  profilesById: Record<string, Profile>;
  storeName: string;
}) {
  return (
    <div>
      <div className="no-print flex justify-end mb-4">
        <button
          onClick={() => window.print()}
          className="bg-primary text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-primary-dark"
        >
          Print {requests.length > 1 ? `${requests.length} slips` : 'slip'}
        </button>
      </div>

      {requests.map((r) => (
        <div key={r.id} className="print-page bg-white border border-line rounded-xl p-6 mb-8 max-w-[210mm] mx-auto">
          <BrandHeader />

          <SlipCopy
            label="Customer Copy"
            request={r}
            createdByDisplay={storeName}
            showSignature={false}
          />

          <div className="my-4 border-t-2 border-dashed border-ink/30 relative">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-2 text-xs text-ink/40">
              ✂ cut here
            </span>
          </div>

          <SlipCopy
            label="Company Copy"
            request={r}
            createdByDisplay={profilesById[r.created_by]?.full_name ?? '—'}
            showSignature={true}
          />
        </div>
      ))}
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3 mb-3">
      <div className="flex items-center gap-2">
        <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
          <path
            d="M22 35C13 29 7 22.5 7 15.5C7 10.3 11 7 15.2 7C18.4 7 20.8 8.9 22 11.4C23.2 8.9 25.6 7 28.8 7C33 7 37 10.3 37 15.5C37 22.5 31 29 22 35Z"
            fill="#E84E8A"
          />
        </svg>
        <div className="leading-none">
          <p className="font-script text-lg leading-none" style={{ color: '#E84E8A' }}>
            XOXO
          </p>
          <p className="text-[7px] font-semibold tracking-[0.2em] text-ink/50 leading-none mt-0.5">
            XOXOSTORE.PK
          </p>
        </div>
      </div>
      <p className="text-[10px] text-ink/50 text-right leading-snug">
        0318-7545957 · 0307-6494437
        <br />
        xoxostore.pk@gmail.com
      </p>
    </div>
  );
}

function SlipCopy({
  label,
  request: r,
  createdByDisplay,
  showSignature,
}: {
  label: string;
  request: RequestRecord;
  createdByDisplay: string;
  showSignature: boolean;
}) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between border-b border-ink/20 pb-3 mb-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Exchange / Return Slip</h1>
          <p className="text-xs text-ink/50 mt-0.5">
            {r.request_type === 'other' ? r.request_type_other : REQUEST_TYPE_LABELS[r.request_type]}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-wide bg-ink/5 text-ink/60 rounded px-2 py-1 mb-1">
            {label}
          </span>
          <p className="font-mono text-lg font-semibold text-ink">{r.order_number}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <Field label="Item to send" value={r.item_to_send} />
        <Field label="Payment instructions" value={r.payment_instructions || '—'} />
        <Field label="Created by" value={createdByDisplay} />
        <Field label="Created date & time" value={new Date(r.created_at).toLocaleString()} />
      </div>

      {showSignature && (
        <div className="flex items-center gap-8 pt-3 border-t border-ink/10">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-ink/40 inline-block" />
            <span className="text-xs text-ink/60">Packed</span>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-ink/40 mb-4">Packer signature</p>
            <div className="border-t border-ink/30" />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-ink/50 uppercase tracking-wide">{label}</p>
      <p className="text-ink mt-0.5 text-sm">{value}</p>
    </div>
  );
}
