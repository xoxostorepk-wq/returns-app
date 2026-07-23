'use client';

import { useEffect, useState } from 'react';
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

  // The dropdown's displayed value lives in local state so it updates the
  // instant you pick something. It used to rely purely on data passed down
  // from the page's initial load, which doesn't refresh on its own when you
  // just switch stores — so clicking a new store looked like nothing
  // happened (it snapped back to the old value) until a slow background
  // refresh eventually caught up.
  const [selected, setSelected] = useState(searchParams.get('store') ?? currentStoreId);

  useEffect(() => {
    const urlStore = searchParams.get('store');
    if (urlStore) setSelected(urlStore);
  }, [searchParams]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStoreId = e.target.value;

    // Update the visible dropdown immediately — don't wait on the network.
    setSelected(newStoreId);

    const params = new URLSearchParams(searchParams.toString());
    params.set('store', newStoreId);
    router.push(`${pathname}?${params.toString()}`);

    // Remember this as the user's default store for next time they log in.
    // This runs in the background — it doesn't block the dropdown from
    // updating, and doesn't need a full page refresh to "take effect."
    supabase.from('profiles').update({ last_store_id: newStoreId }).eq('id', userId);
  }

  return (
    <select
      value={selected}
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
