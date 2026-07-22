import type { RequestRecord, Profile } from '@/lib/types';

const STEPS: { key: 'pending' | 'packed' | 'processed'; label: string }[] = [
  { key: 'pending', label: 'Request received' },
  { key: 'packed', label: 'Packed' },
  { key: 'processed', label: 'Processed & handed to courier' },
];

export default function StatusTracker({
  request,
  profilesById,
}: {
  request: RequestRecord;
  profilesById: Record<string, Profile>;
}) {
  if (request.status === 'cancelled') {
    return (
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 rounded-full bg-status-cancelled shrink-0" />
        <div>
          <p className="text-sm font-medium text-ink">Cancelled</p>
          {request.cancelled_reason && (
            <p className="text-sm text-ink/60 mt-0.5">{request.cancelled_reason}</p>
          )}
        </div>
      </div>
    );
  }

  const currentIndex =
    request.status === 'pending' ? 0 : request.status === 'packed' ? 1 : 2;

  const timestamps: Record<string, string | null> = {
    pending: request.created_at,
    packed: request.packed_at,
    processed: request.processed_at,
  };
  const actors: Record<string, string | null> = {
    pending: request.created_by,
    packed: request.packed_by,
    processed: request.processed_by,
  };

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const isLast = i === STEPS.length - 1;
        const ts = timestamps[step.key];
        const actorId = actors[step.key];
        const actorName = actorId ? profilesById[actorId]?.full_name : null;

        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`h-3 w-3 rounded-full shrink-0 ${
                  done ? 'bg-primary' : 'bg-line'
                }`}
              />
              {!isLast && (
                <span className={`w-px flex-1 min-h-8 ${done ? 'bg-primary/40' : 'bg-line'}`} />
              )}
            </div>
            <div className="pb-6">
              <p className={`text-sm font-medium ${done ? 'text-ink' : 'text-ink/40'}`}>
                {step.label}
              </p>
              {done && ts && (
                <p className="text-xs text-ink/50 mt-0.5">
                  {new Date(ts).toLocaleString()}
                  {actorName ? ` · ${actorName}` : ''}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
