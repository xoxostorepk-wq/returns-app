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
        <div key={r.id} className="print-page bg-white border border-line rounded-xl p-10 mb-8 max-w-[210mm] mx-auto">
          <div className="flex items-start justify-between border-b border-ink/20 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Exchange / Return Slip</h1>
              <p className="text-sm text-ink/50 mt-1">
                {r.request_type === 'other' ? r.request_type_other : REQUEST_TYPE_LABELS[r.request_type]}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-semibold text-ink">{r.order_number}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <Field label="Item to send" value={r.item_to_send} />
            <Field label="Payment instructions" value={r.payment_instructions || '—'} />
            <Field label="Created by" value={profilesById[r.created_by]?.full_name ?? '—'} />
            <Field label="Created date & time" value={new Date(r.created_at).toLocaleString()} />
          </div>

          <div className="flex items-center gap-8 mt-10 pt-6 border-t border-ink/10">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 border-2 border-ink/40 inline-block" />
              <span className="text-sm text-ink/60">Packed</span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-ink/40 mb-6">Packer signature</p>
              <div className="border-t border-ink/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink/50 uppercase tracking-wide">{label}</p>
      <p className="text-ink mt-1">{value}</p>
    </div>
  );
}
