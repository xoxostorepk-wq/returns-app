'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, TabKey, UserRole } from '@/lib/types';
import { ALL_TABS, TAB_LABELS, defaultTabsForRole } from '@/lib/types';

const ROLES: UserRole[] = ['cs', 'order_taker', 'admin'];
const ROLE_LABELS: Record<UserRole, string> = {
  cs: 'Customer Support',
  order_taker: 'Order Taker',
  admin: 'Admin',
};

export default function UsersManager({ users, canManage }: { users: Profile[]; canManage: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cs');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Local optimistic copy so a tab checkbox flips instantly rather than
  // waiting on a full page refresh.
  const [localUsers, setLocalUsers] = useState(users);
  const [savingTabs, setSavingTabs] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      return;
    }

    setFullName('');
    setEmail('');
    setPassword('');
    setRole('cs');
    setShowForm(false);
    router.refresh();
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    router.refresh();
  }

  async function handleTabToggle(userId: string, tab: TabKey, currentTabs: TabKey[]) {
    const nextTabs = currentTabs.includes(tab)
      ? currentTabs.filter((t) => t !== tab)
      : [...currentTabs, tab];

    setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, tab_access: nextTabs } : u)));
    setSavingTabs(userId);

    await fetch('/api/admin/update-tab-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tabAccess: nextTabs }),
    });

    setSavingTabs(null);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-ink">Users</h1>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-sm font-medium bg-primary text-white rounded-lg px-3 py-1.5 hover:bg-primary-dark"
          >
            {showForm ? 'Cancel' : '+ Add user'}
          </button>
        )}
      </div>

      {!canManage && (
        <p className="text-sm text-ink/50 bg-card border border-line rounded-xl px-4 py-3 mb-6">
          You can see who's on the team here, but only an Admin can add users, change roles, or edit tab access.
        </p>
      )}

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="bg-card border border-line rounded-xl p-5 mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Temporary password</label>
            <input
              required
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="They can change this later"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink/40 mt-1">
              Starts with the usual tabs for that role — you can fine-tune exactly which tabs they see below,
              once they're created.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </form>
      )}

      <div className="bg-card border border-line rounded-xl overflow-hidden divide-y divide-line">
        {localUsers.map((u) => {
          const tabs = u.tab_access?.length ? u.tab_access : defaultTabsForRole(u.role);
          return (
            <div key={u.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-ink font-medium">{u.full_name}</span>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                  disabled={!canManage}
                  className="text-sm border border-line rounded-lg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 flex-wrap mt-2.5">
                <span className="text-xs text-ink/40">Visible tabs:</span>
                {ALL_TABS.map((tab) => (
                  <label
                    key={tab}
                    className="flex items-center gap-1.5 text-xs text-ink/70 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={tabs.includes(tab)}
                      onChange={() => handleTabToggle(u.id, tab, tabs)}
                      disabled={!canManage || savingTabs === u.id}
                      className="h-3.5 w-3.5 disabled:cursor-not-allowed"
                    />
                    {TAB_LABELS[tab]}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e1;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
      `}</style>
    </div>
  );
}
