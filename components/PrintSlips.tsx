'use client';

import type { Profile, RequestRecord } from '@/lib/types';
import { REQUEST_TYPE_LABELS } from '@/lib/types';

export default function PrintSlips({
  requests,
  profilesById,
}: {
  requests: RequestRecord[];
  profilesById: Record<string, Profile>;
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
          <SlipCopy label="Customer Copy" request={r} profilesById={profilesById} showSignature={false} />

          <div className="my-4 border-t-2 border-dashed border-ink/30 relative">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-2 text-xs text-ink/40">
              ✂ cut here
            </span>
          </div>

          <SlipCopy label="Company Copy" request={r} profilesById={profilesById} showSignature={true} />
        </div>
      ))}
    </div>
  );
}

function SlipCopy({
  label,
  request: r,
  profilesById,
  showSignature,
}: {
  label: string;
  request: RequestRecord;
  profilesById: Record<string, Profile>;
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
        <Field label="Created by" value={profilesById[r.created_by]?.full_name ?? '—'} />
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
