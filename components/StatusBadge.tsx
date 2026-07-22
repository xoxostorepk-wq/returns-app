import type { RequestStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const STYLES: Record<RequestStatus, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  packed: 'bg-status-packed-bg text-status-packed',
  processed: 'bg-status-processed-bg text-status-processed',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled',
};

export default function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
