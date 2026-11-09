import Link from 'next/link';
import dubbindo from '../../../../lib/dubbindoScraper';
import DubbindoPlayer from '../../../../components/DubbindoPlayer';
import DubbindoCard from '../../../../components/DubbindoCard';
import HistoryRecorder from '../../../../components/HistoryRecorder';

export const revalidate = 120;

async function getDetail(id) {
  try {
    return await dubbindo.detail(decodeURIComponent(id));
  } catch {
    return null;
  }
}

export default async function DubbindoWatchPage({ params }) {
  const d = await getDetail(params.id);

  if (!d || !d.title) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-ink-soft">Video tidak ditemukan atau gagal dimuat.</p>
        <Link href="/dubbindo" className="mt-4 inline-block font-semibold text-accent">← Kembali ke Dubbing Indo</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <HistoryRecorder item={{ url: `https://dubbindo.local/${params.id}`, title: d.title, image: d.related?.[0]?.thumbnail || null, source: 'dubbindo' }} />

      <Link href="/dubbindo" className="mb-3 inline-block text-sm text-ink-faint hover:text-accent">← Dubbing Indo</Link>
      <h1 className="mb-4 font-display text-xl font-extrabold text-ink sm:text-2xl">{d.title}</h1>

      <DubbindoPlayer streams={d.streams} embedUrl={d.embedUrl} />

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-ink-soft">
        {d.views != null && <span>{d.views.toLocaleString('id-ID')} views</span>}
        <span>👍 {d.likes}</span>
        <span>👎 {d.dislikes}</span>
        {d.category?.name && <span className="rounded-full border border-line px-2 py-0.5">{d.category.name}</span>}
        {d.uploader?.name && <span>oleh {d.uploader.name}</span>}
      </div>

      {d.description && <p className="mt-4 whitespace-pre-line text-sm text-ink-soft">{d.description}</p>}

      {d.downloads?.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 font-display text-lg font-extrabold text-ink">Unduh</p>
          <div className="flex flex-wrap gap-2">
            {d.downloads.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-accent hover:text-accent"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {d.related?.length > 0 && (
        <div className="mt-10">
          <p className="mb-3 font-display text-lg font-extrabold text-ink">Video Terkait</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {d.related.map((item, i) => (
              <DubbindoCard key={item.url + i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
