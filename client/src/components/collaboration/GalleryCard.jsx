import { Link } from 'react-router-dom';

export function GalleryCard({ item }) {
  return (
    <Link
      to={`/discover/${item.id}`}
      className="flex flex-col gap-2 rounded-xl border border-charcoal/10 bg-white/50 p-5 transition hover:border-indigo/30 hover:bg-indigo-tint/20"
    >
      <div className="flex items-center gap-2 text-xs text-charcoal/40">
        <span className="rounded-full bg-charcoal/5 px-2.5 py-1 capitalize">{item.writingType}</span>
        {item.theme !== 'classic' && (
          <span className="rounded-full bg-indigo-tint px-2.5 py-1 capitalize text-indigo-dark">
            {item.theme}
          </span>
        )}
      </div>
      <p className="font-serif text-base leading-relaxed text-charcoal">{item.excerpt}</p>
      <div className="flex items-center justify-between text-xs text-charcoal/40">
        <span className="truncate">{item.authors.join(' & ')}</span>
        <span className="shrink-0">{new Date(item.publishedAt).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
