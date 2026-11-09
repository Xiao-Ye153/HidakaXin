import Link from 'next/link';

export function dubbindoId(item) {
  // id pendek dipakai sebagai route internal: /dubbindo/watch/<slug>_<id>
  try {
    const u = new URL(item.url);
    return u.pathname.replace(/^\/watch\//, '').replace(/\.html$/, '');
  } catch {
    return (item.url || '').replace(/^\/?(watch\/)?/, '').replace(/\.html$/, '');
  }
}

export default function DubbindoCard({ item }) {
  return (
    <Link href={`/dubbindo/watch/${dubbindoId(item)}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-paper-soft shadow-card">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-ink-faint">?</div>
        )}
        {item.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {item.duration}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow">
          Dub Indo
        </span>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">{item.title}</p>
        <p className="mt-1 text-[11px] font-medium text-ink-soft">
          {item.views != null && `${item.views.toLocaleString('id-ID')} views`}
          {item.views != null && item.uploaded && ' · '}
          {item.uploaded}
        </p>
      </div>
    </Link>
  );
}
