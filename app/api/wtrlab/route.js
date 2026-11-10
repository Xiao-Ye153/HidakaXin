import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import wtrlab from '../../../lib/wtrlabScraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// /api/wtrlab?type=list&page=1
// /api/wtrlab?type=search&q=...&page=1
// /api/wtrlab?type=detail&id=114836&slug=a-wasteland-paradise-i-plant-a-world-tree-instead
// /api/wtrlab?type=chapter&id=...&slug=...&no=1
// /api/wtrlab?type=raw&path=/en/novel-list   <- diagnosis struktur halaman mentah
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const type = sp.get('type') || 'list';
  const page = parseInt(sp.get('page') || '1', 10);

  try {
    if (type === 'list') return NextResponse.json(await wtrlab.list(page));
    if (type === 'search') {
      const q = sp.get('q');
      if (!q) return NextResponse.json({ error: 'Parameter q wajib diisi' }, { status: 400 });
      return NextResponse.json(await wtrlab.search(q, page));
    }
    if (type === 'detail') {
      const id = sp.get('id') || sp.get('url');
      if (!id) return NextResponse.json({ error: 'Parameter id (atau url) wajib diisi' }, { status: 400 });
      const d = await wtrlab.detail(id, sp.get('slug') || undefined);
      // daftar chapter bisa ribuan baris — ringkas kecuali diminta penuh
      if (sp.get('full') !== '1') {
        d.chaptersTotal = d.chapters.length;
        d.chapters = d.chapters.slice(0, 5);
      }
      return NextResponse.json(d);
    }
    if (type === 'chapter') {
      const id = sp.get('id');
      const slug = sp.get('slug');
      const no = sp.get('no');
      if (!id || !slug || !no) return NextResponse.json({ error: 'id, slug, no wajib diisi' }, { status: 400 });
      return NextResponse.json(await wtrlab.chapter(id, slug, no));
    }
    if (type === 'raw') {
      const path = sp.get('path') || '/en/novel-list';
      if (!path.startsWith('/')) return NextResponse.json({ error: 'path harus diawali /' }, { status: 400 });
      const res = await axios.get(wtrlab.BASE_URL + path, {
        timeout: 20000,
        validateStatus: () => true,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' }
      });
      const html = String(res.data || '');
      const $ = cheerio.load(html);
      return NextResponse.json({
        status: res.status,
        htmlLength: html.length,
        title: $('title').text().trim(),
        h3Count: $('h3').length,
        firstH3Html: $.html($('h3').first().parent().parent()).slice(0, 2500),
        scripts: $('script').map((_, el) => ({ id: $(el).attr('id') || null, src: $(el).attr('src') || null, type: $(el).attr('type') || null })).get().slice(0, 30),
        preview: html.slice(0, 1200)
      });
    }
    return NextResponse.json({ error: 'type tidak valid' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ status: false, error: e.message }, { status: 502 });
  }
}
