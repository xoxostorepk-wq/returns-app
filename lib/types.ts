export type UserRole = 'cs' | 'order_taker' | 'admin';
export type RequestStatus = 'pending' | 'packed' | 'processed' | 'cancelled';
export type RequestType = 'exchange' | 'replacement' | 'reverse_pickup' | 'other';
export type TabKey = 'requests' | 'confirmations' | 'returned_by_courier' | 'users';

export interface Store {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  last_store_id: string | null;
  notifications_muted: boolean;
  tab_access: TabKey[];
}

export const ALL_TABS: TabKey[] = ['requests', 'confirmations', 'returned_by_courier', 'users'];

export const TAB_LABELS: Record<TabKey, string> = {
  requests: 'Requests',
  confirmations: 'Confirmations',
  returned_by_courier: 'Returned by Courier',
  users: 'Users',
};

export const TAB_PATHS: Record<TabKey, string> = {
  requests: '/requests',
  confirmations: '/confirmations',
  returned_by_courier: '/returned-by-courier',
  users: '/admin/users',
};

// Sensible defaults if tab_access ever comes back empty/null (shouldn't
// happen once the migration runs, but keeps the app from locking someone
// out entirely if a profile row is ever missing the column value).
export function defaultTabsForRole(role: UserRole): TabKey[] {
  return role === 'admin'
    ? ['requests', 'confirmations', 'returned_by_courier', 'users']
    : ['requests', 'confirmations', 'returned_by_courier'];
}

export function hasTabAccess(profile: Profile, tab: TabKey): boolean {
  const tabs = profile.tab_access?.length ? profile.tab_access : defaultTabsForRole(profile.role);
  return tabs.includes(tab);
}

// Where to send someone if they land on a tab they no longer have access
// to — the first tab (in a sensible order) that they can actually see.
export function firstAccessibleTabPath(profile: Profile): string | null {
  const tabs = profile.tab_access?.length ? profile.tab_access : defaultTabsForRole(profile.role);
  for (const tab of ALL_TABS) {
    if (tabs.includes(tab)) return TAB_PATHS[tab];
  }
  return null;
}

export interface RequestRecord {
  id: string;
  store_id: string;
  order_number: string;
  request_type: RequestType;
  request_type_other: string | null;
  item_to_send: string;
  payment_instructions: string;
  amount: number | null;
  status: RequestStatus;
  created_by: string;
  created_at: string;
  packed_at: string | null;
  packed_by: string | null;
  processed_at: string | null;
  processed_by: string | null;
  tracking_number: string | null;
  cancelled_reason: string | null;
  reminder_sent: boolean;
}

export interface RequestImage {
  id: string;
  request_id: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface RequestComment {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  request_id: string;
  actor_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  recipient_id: string;
  request_id: string | null;
  type: 'new_request' | 'manual_reminder' | 'auto_reminder';
  message: string;
  read: boolean;
  created_at: string;
}

export interface OrderConfirmation {
  id: string;
  store_id: string;
  order_number: string;
  shopify_created: boolean;
  amount: number | null;
  created_by: string;
  created_at: string;
}

export interface OrderConfirmationComment {
  id: string;
  order_confirmation_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ReturnedByCourier {
  id: string;
  store_id: string;
  order_number: string;
  courier: string;
  resent: boolean;
  amount: number | null;
  created_by: string;
  created_at: string;
}

export interface ReturnedByCourierComment {
  id: string;
  returned_by_courier_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  exchange: 'Exchange',
  replacement: 'Replacement',
  reverse_pickup: 'Reverse Pickup',
  other: 'Other',
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  packed: 'Packed',
  processed: 'Processed',
  cancelled: 'Cancelled',
};
