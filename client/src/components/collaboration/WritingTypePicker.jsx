const OPTIONS = [
  { value: 'story', label: 'Story' },
  { value: 'poem', label: 'Poem' },
];

export function WritingTypePicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${
            value === option.value
              ? 'border-indigo bg-indigo text-paper'
              : 'border-charcoal/15 text-charcoal/60 hover:border-indigo/50 hover:text-charcoal'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
