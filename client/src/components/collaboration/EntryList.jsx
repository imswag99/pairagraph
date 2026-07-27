export function EntryList({ entries }) {
  if (!entries.length) {
    return (
      <p className="text-center font-serif text-base italic text-charcoal/40">
        The page is still blank — the first turn starts it off.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-col gap-2">
          {index > 0 && <div className="h-px w-full bg-charcoal/10" />}
          <div
            className="break-words font-serif text-lg leading-relaxed text-charcoal [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: entry.content }}
          />
          <span className="text-xs text-charcoal/40">— {entry.author.displayName}</span>
        </div>
      ))}
    </div>
  );
}
