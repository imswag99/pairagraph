export function PenMark({ className = 'h-8 w-8' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15.5 3.5 20.5 8.5 9 20H4V15L15.5 3.5Z" />
      <path d="M13.5 5.5 18.5 10.5" />
    </svg>
  );
}
