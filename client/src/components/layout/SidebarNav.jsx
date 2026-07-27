import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/collaborations', label: 'Collaborations' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

export function SidebarNav() {
  return (
    <nav className="flex gap-2 lg:flex-col">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-lg px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-indigo-tint text-indigo-dark'
                : 'text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
