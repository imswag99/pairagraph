export function PickerField({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-charcoal/40">{label}</span>
      {children}
    </label>
  );
}
