import { Link } from 'react-router-dom';
import { PenMark } from '../PenMark.jsx';
import { SidebarNav } from './SidebarNav.jsx';

export function AppShell({ currentUser, logout, children }) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12 animate-fade-in">
        <header className="flex flex-wrap items-center justify-between gap-y-2">
          <Link to="/" className="flex items-center gap-2">
            <PenMark className="h-6 w-6 text-indigo" />
            <span className="font-serif text-xl text-charcoal">Pairagraph</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="max-w-[10rem] truncate text-sm text-charcoal/60">{currentUser.displayName}</span>
            <Link
              to="/account"
              className="text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal"
            >
              Account
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-4 transition hover:text-charcoal"
            >
              Log out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
          <SidebarNav />
          <main className="flex flex-col gap-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
