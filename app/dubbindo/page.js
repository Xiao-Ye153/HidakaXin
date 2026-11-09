import Link from 'next/link';
import dubbindo from '../../lib/dubbindoScraper';
import DubbindoCard from '../../components/DubbindoCard';
import SearchBar from '../../components/SearchBar';

export const revalidate = 180;

const TABS = [
  { value: 'latest', label: 'Terbaru' },
  { value: 'trending', label: 'Trending' },
  { value: 'top', label: 'Top' }
];

async function load(tab, q, page) {
  try {
    if (q) return await dubbindo.search(q, page);
    return await dubbindo[tab](page);
  } catch {
    return null;
  }
}

export default async function DubbindoPage({ searchParams }) {
  const q = (searchParams?.q || '').trim();
  const tab = TABS.some((t) => t.value === searchParams?.tab) ? searchParams.tab : 'latest';
  const page = Math.max(1, parseInt(searchParams?.page || '1', 10));
  const data = await load(tab, q, page);

  const qs = (p) => `?${q ? `q=${encodeURIComponent(q)}` : `tab=${tab}`}&page=${p}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-extrabold text-ink">Dubbing Indo</h1>
      <p className="mb-4 text-sm text-ink-soft">Film, anime &amp; drama dubbing Indonesia dari Dubbindo.</p>

      <SearchBar action="/dubbindo" defaultValue={q} placeholder="Cari judul dubbing.." />

      {!q && (
        <div className="my-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/dubbindo?tab=${t.value}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                tab === t.value
                  ? 'border-accent bg-accent-50 text-accent'
                  : 'border-line bg-paper-card text-ink-soft hover:border-accent hover:text-accent'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
      {q && <p className="my-4 text-sm text-ink-soft">Hasil untuk &quot;{q}&quot;</p>}

      {!data && (
        <p className="rounded-xl border border-line bg-paper-card p-6 text-center text-ink-soft shadow-card">
          Gagal memuat data. Coba lagi sebentar.
        </p>
      )}
      {data && data.results.length === 0 && (
        <p className="rounded-xl border border-line bg-paper-card p-6 text-center text-ink-soft shadow-card">
          Tidak ada hasil.
        </p>
      )}

      {data?.results?.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {data.results.map((item, i) => (
              <DubbindoCard key={item.url + i} item={item} />
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm">
            <Link
              href={`/dubbindo${qs(Math.max(1, page - 1))}`}
              className={`rounded-full border border-line bg-paper-card px-3 py-1.5 ${page === 1 ? 'pointer-events-none opacity-30' : 'hover:border-accent hover:text-accent'}`}
            >
              ← Prev
            </Link>
            <span className="rounded-full border border-accent bg-accent-50 px-3 py-1.5 font-semibold text-accent">{page}</span>
            <Link
              href={`/dubbindo${qs(page + 1)}`}
              className="rounded-full border border-line bg-paper-card px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              Next →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
