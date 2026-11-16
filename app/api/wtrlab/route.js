import { NextResponse } from 'next/server';
import wtrlab from '../../../lib/wtrlabScraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// /api/wtrlab?type=latest&page=1&orderBy=update
// /api/wtrlab?type=ranking&kind=daily|weekly|monthly|all&page=1
// /api/wtrlab?type=search&q=...&limit=20
// /api/wtrlab?type=detail&id=114836            (id = rawId | slug | url; full=1 = semua chapter)
// /api/wtrlab?type=read&id=114836&no=1&translate=ai|google
//
// Sengaja TIDAK membuka bulkDownload (unduh massal) lewat API publik.
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const type = sp.get('type') || 'latest';

  let data;
  if (type === 'latest') {
    data = await wtrlab.latest(sp.get('page') || 1, sp.get('orderBy') || 'update');
  } else if (type === 'ranking') {
    data = await wtrlab.ranking(sp.get('kind') || 'daily', sp.get('page') || 1);
  } else if (type === 'search') {
    const q = sp.get('q');
    if (!q) return NextResponse.json({ error: 'Parameter q wajib diisi' }, { status: 400 });
    data = await wtrlab.search(q, sp.get('limit') || 20);
  } else if (type === 'detail') {
    const id = sp.get('id');
    if (!id) return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
    data = await wtrlab.detail(id);
    if (data.status && sp.get('full') !== '1') {
      data.chaptersShown = Math.min(5, data.chapters.length);
      data.chapters = data.chapters.slice(0, 5);
    }
  } else if (type === 'read') {
    const id = sp.get('id');
    if (!id) return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
    const service = sp.get('translate') === 'google' ? 'google' : 'ai';
    data = await wtrlab.read(id, sp.get('no'), service);
  } else {
    return NextResponse.json({ error: 'type tidak valid' }, { status: 400 });
  }

  return NextResponse.json(data, { status: data.status ? 200 : 502 });
}
