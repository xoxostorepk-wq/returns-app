export type UserRole = 'cs' | 'order_taker' | 'admin';
export type RequestStatus = 'pending' | 'packed' | 'processed' | 'cancelled';
export type RequestType = 'exchange' | 'replacement' | 'reverse_pickup' | 'other';

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
}

export interface RequestRecord {
  id: string;
  store_id: string;
  order_number: string;
  request_type: RequestType;
  request_type_other: string | null;
  item_to_send: string;
  payment_instructions: string;
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
