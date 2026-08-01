import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { PenMark } from '../components/PenMark.jsx';
import { galleryService } from '../services/galleryService.js';
import { GalleryCard } from '../components/collaboration/GalleryCard.jsx';
import { THEME_OPTIONS } from '../constants/themes.js';

const PAGE_SIZE = 10;

const WRITING_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'story', label: 'Story' },
  { value: 'poem', label: 'Poem' },
];

const FILTER_THEME_OPTIONS = [{ value: '', label: 'All themes' }, ...THEME_OPTIONS];

function FilterRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            value === option.value
              ? 'border-indigo bg-indigo text-paper'
              : 'border-charcoal/15 text-charcoal/50 hover:border-indigo/50 hover:text-charcoal'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function GalleryContent() {
  const [writingType, setWritingType] = useState('');
  const [theme, setTheme] = useState('');
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setItems(null);
    setError('');
    galleryService
      .list({
        page: 1,
        limit: PAGE_SIZE,
        writingType: writingType || undefined,
        theme: theme || undefined,
      })
      .then(({ data }) => {
        setItems(data.items);
        setHasMore(data.hasMore);
        setPage(1);
      })
      .catch((err) => setError(err.message));
  }, [writingType, theme]);

  async function handleLoadMore() {
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await galleryService.list({
        page: nextPage,
        limit: PAGE_SIZE,
        writingType: writingType || undefined,
        theme: theme || undefined,
      });
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-charcoal">Discover</h1>
        <p className="text-sm text-charcoal/50">Finished pieces writers have chosen to share publicly.</p>
      </div>

      <div className="flex flex-col gap-2">
        <FilterRow options={WRITING_TYPE_OPTIONS} value={writingType} onChange={setWritingType} />
        <FilterRow options={FILTER_THEME_OPTIONS} value={theme} onChange={setTheme} />
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items === null ? (
        <p className="text-sm text-charcoal/40">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal/15 px-5 py-10 text-center text-sm text-charcoal/50">
          Nothing published here yet.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="self-center rounded-full border border-charcoal/15 px-5 py-2 text-sm text-charcoal/70 transition hover:border-indigo/40 hover:text-charcoal disabled:opacity-60"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function GalleryPage() {
  const { currentUser, logout, isLoading } = useAuth();

  if (isLoading) return null;

  if (currentUser) {
    return (
      <AppShell currentUser={currentUser} logout={logout}>
        <GalleryContent />
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <Link to="/" className="flex items-center gap-2">
          <PenMark className="h-6 w-6 text-indigo" />
          <span className="font-serif text-xl text-charcoal">Pairagraph</span>
        </Link>
        <GalleryContent />
      </div>
    </div>
  );
}
