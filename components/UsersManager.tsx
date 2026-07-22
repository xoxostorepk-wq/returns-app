'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, UserRole } from '@/lib/types';

const ROLES: UserRole[] = ['cs', 'order_taker', 'admin'];
const ROLE_LABELS: Record<UserRole, string> = {
  cs: 'Customer Support',
  order_taker: 'Order Taker',
  admin: 'Admin',
};

export default function UsersManager({ users }: { users: Profile[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cs');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-ink">Users</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium bg-primary text-white rounded-lg px-3 py-1.5 hover:bg-primary-dark"
        >
          {showForm ? 'Cancel' : '+ Add user'}
        </button>
      </div>

      {showForm && (
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

      <div className="bg-card border border-line rounded-xl overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0">
            <span className="text-sm text-ink font-medium">{u.full_name}</span>
            <select
              value={u.role}
              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
              className="text-sm border border-line rounded-lg px-2 py-1"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        ))}
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
