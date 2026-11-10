import animexin from './scraper';
import anichin from './anichinScraper';
import sanka from './sankaScraper';
import samehadaku from './samehadakuScraper';
import manga from './mangaScraper';
import webtoons from './webtoonsScraper';
import dubbindo from './dubbindoScraper';
import wtrlab from './wtrlabScraper';
import { diagnoseMeio } from './meioNovelScraper';

// Hitung array terpanjang di dalam hasil (maks kedalaman 4). Kalau 0 = kemungkinan
// selector/struktur sumber berubah (request sukses tapi datanya kosong).
function countItems(value, depth = 0) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object' || depth > 4) return 0;
  let max = 0;
  for (const v of Object.values(value)) max = Math.max(max, countItems(v, depth + 1));
  return max;
}

// [grup, nama, fungsi]. Satu panggilan ringan per sumber.
export const CHECKS = [
  ['Donghua', 'AnimeXin (animexin.dev)', () => animexin.home(1)],
  ['Donghua', 'Anichin (via Sanka API)', () => anichin.home(1)],
  ['Anime', 'Otakudesu (via Sanka API)', () => sanka.home()],
  ['Anime', 'Samehadaku (via Sanka API)', () => samehadaku.home()],
  ['Komik', 'Komiku (komiku.org)', () => manga.home(1)],
  ['Komik', 'Webtoons', () => webtoons.trending('daily')],
  ['Novel', 'MeioNovels', async () => {
      const d = await diagnoseMeio();
      if (d.cardCount > 0) return d.cards;
      if (d.cloudflare) throw new Error(`HTTP ${d.status} — kemungkinan diblok Cloudflare/anti-bot (IP Vercel ditolak)`);
      if (d.status !== 200) throw new Error(`HTTP ${d.status} dari meionovels.com (domain pindah/mati?)`);
      throw new Error(`HTTP 200 tapi 0 kartu — selector berubah. Judul halaman: "${d.title}". Buka /api/novel/meio-debug?mode=diagnose`);
    }],
  ['Novel', 'WTR-LAB (wtr-lab.com)', () => wtrlab.list(1)],
  ['Dubbing', 'Dubbindo (dubbindo.site)', () => dubbindo.latest(1)]
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout > ${ms / 1000}s`)), ms))
  ]);
}

export async function runHealthChecks(timeoutMs = 20000) {
  return Promise.all(
    CHECKS.map(async ([group, name, fn]) => {
      const t = Date.now();
      try {
        const data = await withTimeout(Promise.resolve().then(fn), timeoutMs);
        const items = countItems(data);
        return {
          group, name, ms: Date.now() - t, items,
          status: items > 0 ? 'ok' : 'kosong',
          note: items > 0 ? null : 'Request sukses tapi data kosong — kemungkinan struktur HTML/API berubah'
        };
      } catch (e) {
        return {
          group, name, ms: Date.now() - t, items: 0, status: 'error',
          note: e?.response?.status ? `HTTP ${e.response.status}: ${e.message}` : e?.message || String(e)
        };
      }
    })
  );
}
