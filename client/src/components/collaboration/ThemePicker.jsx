import { THEME_OPTIONS } from '../../constants/themes.js';

// A native <select> (real keyboard support/accessibility for free), but
// restyled with appearance-none + a custom arrow to match the pill-button
// language used everywhere else (WritingTypePicker, RangeToggle, etc.)
// instead of looking like a stray native form control dropped into a page
// full of button-pills.
export function ThemePicker({ value, onChange }) {
  return (
    <div className="relative w-fit">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-charcoal/15 bg-transparent py-1.5 pl-4 pr-9 text-sm text-charcoal/60 transition hover:border-indigo/50 hover:text-charcoal focus:border-indigo focus:text-charcoal focus:outline-none focus:ring-2 focus:ring-indigo/15"
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal/40"
      >
        <path
          d="M5 7.5L10 12.5L15 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
