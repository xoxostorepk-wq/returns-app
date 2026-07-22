'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Store } from '@/lib/types';

export default function StoreSwitcher({
  stores,
  currentStoreId,
  userId,
}: {
  stores: Store[];
  currentStoreId: string;
  userId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStoreId = e.target.value;

    // Remember this as the user's default store for next time they log in.
    await supabase.from('profiles').update({ last_store_id: newStoreId }).eq('id', userId);

    const params = new URLSearchParams(searchParams.toString());
    params.set('store', newStoreId);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <select
      value={currentStoreId}
      onChange={handleChange}
      className="text-sm font-medium bg-ink/5 hover:bg-ink/10 border border-line rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors"
    >
      {stores.map((store) => (
        <option key={store.id} value={store.id}>
          {store.name}
        </option>
      ))}
    </select>
  );
}
