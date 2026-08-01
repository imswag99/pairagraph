import { BADGES, BADGE_ORDER } from '../constants/badges.js';

export function BadgeGrid({ earnedBadgeIds }) {
  const earned = new Set(earnedBadgeIds ?? []);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {BADGE_ORDER.map((id) => {
        const isEarned = earned.has(id);
        const { label, description } = BADGES[id];
        return (
          <div
            key={id}
            className={`rounded-lg border px-3 py-2 ${
              isEarned
                ? 'border-indigo/30 bg-indigo-tint'
                : 'border-dashed border-charcoal/15 bg-transparent opacity-60'
            }`}
          >
            <p className={`text-xs font-medium ${isEarned ? 'text-indigo-dark' : 'text-charcoal/50'}`}>
              {label}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-charcoal/40">{description}</p>
          </div>
        );
      })}
    </div>
  );
}
