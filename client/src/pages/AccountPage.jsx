import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { AdminShell } from '../components/layout/AdminShell.jsx';
import { moderationService } from '../services/moderationService.js';

const inputClasses =
  'w-full rounded-lg border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15';

function ProfileSection({ currentUser }) {
  const { updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSaving(true);
    try {
      await updateProfile(displayName);
      setMessage('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white/50 p-5">
      <h2 className="font-serif text-lg text-charcoal">Profile</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label htmlFor="account-display-name" className="sr-only">Display name</label>
        <input
          id="account-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className={inputClasses}
        />
        <button
          type="submit"
          disabled={isSaving || !displayName.trim()}
          className="shrink-0 rounded-lg bg-indigo px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </form>
      {message && <p role="status" className="text-sm text-indigo-dark">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

function ProfileVisibilitySection({ currentUser }) {
  const { setProfileVisibility } = useAuth();
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle() {
    setError('');
    setIsSaving(true);
    try {
      await setProfileVisibility(!currentUser.isProfilePublic);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white/50 p-5">
      <h2 className="font-serif text-lg text-charcoal">Public profile</h2>
      <p className="text-sm text-charcoal/70">
        A public profile shows your badges, streak, and any pieces you've personally consented to
        publish — private by default, off unless you turn it on.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={currentUser.isProfilePublic}
            onChange={handleToggle}
            disabled={isSaving}
            className="h-4 w-4 rounded border-charcoal/30 text-indigo focus:ring-indigo/40"
          />
          Make my profile public
        </label>
        {currentUser.isProfilePublic && (
          <Link
            to={`/profile/${currentUser.id}`}
            className="text-sm text-indigo-dark underline decoration-indigo/30 underline-offset-4 transition hover:text-indigo"
          >
            View my public profile
          </Link>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

function PasswordSection({ currentUser }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setMessage('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white/50 p-5">
      <h2 className="font-serif text-lg text-charcoal">Password</h2>
      {!currentUser.hasPassword ? (
        <p className="text-sm text-charcoal/70">
          This account signs in with Google and has no password set. Use "Forgot password" from the
          login screen to set one.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="account-current-password" className="sr-only">Current password</label>
          <input
            id="account-current-password"
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className={inputClasses}
          />
          <label htmlFor="account-new-password" className="sr-only">New password (min 8 characters)</label>
          <input
            id="account-new-password"
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className={inputClasses}
          />
          {message && <p role="status" className="text-sm text-indigo-dark">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="self-start rounded-lg bg-indigo px-5 py-2.5 text-sm font-medium text-paper shadow-soft transition hover:bg-indigo-dark disabled:opacity-60"
          >
            {isSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </section>
  );
}

function BlockedUsersSection() {
  const [blockedUsers, setBlockedUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    moderationService
      .getBlockedUsers()
      .then(({ data }) => setBlockedUsers(data.blockedUsers))
      .catch((err) => setError(err.message));
  }, []);

  async function handleUnblock(userId) {
    try {
      await moderationService.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white/50 p-5">
      <h2 className="font-serif text-lg text-charcoal">Blocked users</h2>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {blockedUsers === null ? null : blockedUsers.length === 0 ? (
        <p className="text-sm text-charcoal/50">You haven't blocked anyone.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blockedUsers.map((user) => (
            <li
              key={user._id}
              className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-2.5 text-sm"
            >
              <span className="text-charcoal">{user.displayName}</span>
              <button
                type="button"
                onClick={() => handleUnblock(user._id)}
                className="text-xs text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DangerZoneSection() {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setError('');
    setIsDeleting(true);
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {
      setError(err.message);
      setIsDeleting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/50 p-5">
      <h2 className="font-serif text-lg text-charcoal">Danger zone</h2>
      <p className="text-sm text-charcoal/70">
        Deleting your account removes your login and personal info. Collaborations you were part of
        stay visible to the other participant, attributed to "Deleted user". This can't be undone.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="account-delete-confirm" className="sr-only">Type "delete" to confirm</label>
        <input
          id="account-delete-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type "delete" to confirm'
          className={inputClasses}
        />
        <button
          type="button"
          onClick={handleDelete}
          disabled={confirmText !== 'delete' || isDeleting}
          className="shrink-0 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
        >
          {isDeleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

export function AccountPage() {
  const { currentUser, logout, isLoading } = useAuth();

  if (isLoading) return null;
  if (!currentUser) return <Navigate to="/" replace />;

  const isAdmin = currentUser.role === 'admin';
  const Shell = isAdmin ? AdminShell : AppShell;

  return (
    <Shell currentUser={currentUser} logout={logout}>
      <h1 className="font-serif text-2xl text-charcoal">Account</h1>
      <ProfileSection currentUser={currentUser} />
      {!isAdmin && <ProfileVisibilitySection currentUser={currentUser} />}
      <PasswordSection currentUser={currentUser} />
      {!isAdmin && <BlockedUsersSection />}
      <DangerZoneSection />
    </Shell>
  );
}
