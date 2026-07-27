export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-charcoal/10 ${className}`} />;
}

export function CollaborationCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-charcoal/10 bg-white/50 px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export function ChatMessageSkeleton({ align = 'start' }) {
  return (
    <div className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <Skeleton className="h-8 w-2/3 rounded-2xl" />
    </div>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-charcoal/5 px-5 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-4">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}
