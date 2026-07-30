import { THEME_OPTIONS } from '../../constants/themes.js';

// A fixed 3-column grid rather than a flex-wrap row — the earlier "chaotic"
// problem was the wrap being organic (line breaks depending on label width),
// not the pill buttons themselves. A grid keeps all 6 options as a clean,
// predictable 2x3 block regardless of container width.
export function ThemePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${
            value === option.value
              ? 'border-indigo bg-indigo text-paper'
              : 'border-charcoal/15 text-charcoal/70 hover:border-indigo/50 hover:text-charcoal'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
