import { THEME_OPTIONS } from '../../constants/themes.js';

// A dropdown rather than a pill row like WritingTypePicker — 6 options
// wrapped unpredictably in the narrow Quick Match / Invite cards, and a
// select stays compact and orderly regardless of container width.
export function ThemePicker({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-charcoal/15 bg-white/70 px-3 py-2 text-sm text-charcoal transition focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
    >
      {THEME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
