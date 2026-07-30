import { Link, NavLink } from 'react-router-dom';
import { PenMark } from '../PenMark.jsx';

const navLinkClass = ({ isActive }) =>
  `flex items-center justify-between gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
    isActive ? 'bg-indigo-tint text-indigo-dark' : 'text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal'
  }`;

export function AdminShell({ currentUser, logout, children }) {
  return (
    <div className="min-h-screen bg-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12 animate-fade-in">
        <header className="flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-2">
            <PenMark className="h-6 w-6 text-indigo" />
            <span className="font-serif text-xl text-charcoal">Pairagraph</span>
            <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-charcoal/50">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="max-w-[10rem] truncate text-sm text-charcoal/70">{currentUser.displayName}</span>
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
          <nav className="flex gap-2 lg:flex-col">
            <NavLink to="/admin" end className={navLinkClass}>
              <span>Reports</span>
            </NavLink>
            <NavLink to="/admin/users" className={navLinkClass}>
              <span>Users</span>
            </NavLink>
          </nav>
          <main id="main-content" className="flex flex-col gap-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
