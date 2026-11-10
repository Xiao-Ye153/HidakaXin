import axios from 'axios';
import anichin from '../../../lib/anichinScraper';

export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function probe(url, referer) {
  try {
    const r = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 3 * 1024 * 1024,
      validateStatus: () => true,
      headers: { 'User-Agent': UA, ...(referer ? { Referer: referer } : {}) }
    });
    return { status: r.status, type: r.headers['content-type'] || null, bytes: r.data?.byteLength ?? 0 };
  } catch (e) {
    return { error: e.message };
  }
}

// /api/anichin-debug — tampilkan URL gambar mentah dari Anichin dan hasil
// fetch server-side (tanpa Referer vs pakai Referer) buat 4 item pertama.
export async function GET() {
  try {
    const { items } = await anichin.home(1);
    const sample = items.slice(0, 4);
    const out = [];
    for (const it of sample) {
      const origin = it.image ? new URL(it.image).origin + '/' : null;
      out.push({
        title: it.title,
        image: it.image,
        tanpaReferer: it.image ? await probe(it.image, null) : null,
        denganReferer: it.image ? await probe(it.image, origin) : null
      });
    }
    return Response.json({ total: items.length, sample: out });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
