import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { collaborationService } from '../../services/collaborationService.js';

export function SidebarNav() {
  const [turnCount, setTurnCount] = useState(0);

  useEffect(() => {
    collaborationService
      .getTurnCount()
      .then(({ data }) => setTurnCount(data.count))
      .catch(() => {});
  }, []);

  const navLinkClass = ({ isActive }) =>
    `flex items-center justify-between gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
      isActive ? 'bg-indigo-tint text-indigo-dark' : 'text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal'
    }`;

  return (
    <nav className="flex gap-2 lg:flex-col">
      <NavLink to="/collaborations" className={navLinkClass}>
        <span>Collaborations</span>
        {turnCount > 0 && (
          <span className="rounded-full bg-indigo px-1.5 py-0.5 text-[11px] font-medium leading-none text-paper">
            {turnCount}
          </span>
        )}
      </NavLink>
      <NavLink to="/leaderboard" className={navLinkClass}>
        <span>Leaderboard</span>
      </NavLink>
      <NavLink to="/discover" className={navLinkClass}>
        <span>Discover</span>
      </NavLink>
    </nav>
  );
}
