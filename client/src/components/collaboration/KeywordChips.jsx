export function KeywordChips({ keywords }) {
  if (!keywords?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((word) => (
        <span
          key={word}
          className="rounded-full bg-indigo-tint px-3 py-1 text-xs text-indigo-dark"
        >
          {word}
        </span>
      ))}
    </div>
  );
}
