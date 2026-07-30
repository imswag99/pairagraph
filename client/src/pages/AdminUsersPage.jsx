import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AdminShell } from '../components/layout/AdminShell.jsx';
import { adminService } from '../services/adminService.js';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function UserRow({ user, isSelf, onBan, onUnban, onDelete }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState('');

  async function handleBanToggle() {
    setIsSaving(true);
    setError('');
    try {
      if (user.isBanned) {
        await onUnban(user.id);
      } else {
        await onBan(user.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    setError('');
    try {
      await onDelete(user.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
      setIsConfirmingDelete(false);
    }
  }

  const isLocked = isSelf || user.role === 'admin' || user.isDeleted;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-charcoal/10 bg-white/50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-charcoal">
          <strong>{user.displayName}</strong> ({user.email})
          {isSelf && <span className="ml-2 text-xs text-charcoal/40">You</span>}
          {user.role === 'admin' && !isSelf && (
            <span className="ml-2 text-xs text-charcoal/40">Admin</span>
          )}
        </p>
        <span className="text-xs text-charcoal/40">Joined {formatDate(user.createdAt)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {user.openReportCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
            {user.openReportCount} open report{user.openReportCount === 1 ? '' : 's'}
          </span>
        )}
        {user.isBanned && (
          <span className="rounded-full bg-charcoal/10 px-2 py-0.5 font-medium text-charcoal/70">
            Banned
          </span>
        )}
        {user.isDeleted && (
          <span className="rounded-full bg-charcoal/10 px-2 py-0.5 font-medium text-charcoal/70">
            Deleted
          </span>
        )}
      </div>

      {!isLocked && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBanToggle}
            disabled={isSaving}
            className="rounded-full border border-charcoal/15 px-3 py-1 text-xs text-charcoal/70 transition hover:border-indigo/40 hover:text-charcoal disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : user.isBanned ? 'Unban' : 'Ban'}
          </button>

          {isConfirmingDelete ? (
            <span className="flex items-center gap-1.5 text-xs text-charcoal/50">
              Delete this account?
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="font-medium text-red-600 hover:underline disabled:opacity-60"
              >
                Yes
              </button>
              <button type="button" onClick={() => setIsConfirmingDelete(false)} className="hover:underline">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              disabled={isSaving}
              className="rounded-full border border-charcoal/15 px-3 py-1 text-xs text-charcoal/50 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AdminUsersPage() {
  const { currentUser, logout, isLoading } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    adminService
      .listUsers()
      .then(({ data }) => setUsers(data.users))
      .catch((err) => setError(err.message));
  }, [currentUser]);

  async function handleBan(userId) {
    await adminService.banUser(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isBanned: true } : u)));
  }

  async function handleUnban(userId) {
    await adminService.unbanUser(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isBanned: false } : u)));
  }

  async function handleDelete(userId) {
    await adminService.deleteUser(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isDeleted: true } : u)));
  }

  if (isLoading) return null;
  if (currentUser?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <AdminShell currentUser={currentUser} logout={logout}>
      <h1 className="font-serif text-2xl text-charcoal">Users</h1>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : users === null ? (
        <p className="text-sm text-charcoal/50">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUser.id}
              onBan={handleBan}
              onUnban={handleUnban}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
