import { NextResponse } from 'next/server';
import dubbindo from '../../../lib/dubbindoScraper';

export const dynamic = 'force-dynamic';

// /api/dubbindo?type=latest|trending|top|search|category|detail
//   &q=...      (search)   &cat=...  (category)   &url=...  (detail)   &page=1
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'latest';
  const page = parseInt(searchParams.get('page') || '1', 10);

  try {
    let data;
    if (type === 'search') {
      const q = searchParams.get('q');
      if (!q) return NextResponse.json({ error: 'Parameter q wajib diisi' }, { status: 400 });
      data = await dubbindo.search(q, page);
    } else if (type === 'category') {
      const cat = searchParams.get('cat');
      if (!cat) return NextResponse.json({ error: 'Parameter cat wajib diisi' }, { status: 400 });
      data = await dubbindo.category(cat, page);
    } else if (type === 'detail') {
      const url = searchParams.get('url');
      if (!url) return NextResponse.json({ error: 'Parameter url wajib diisi' }, { status: 400 });
      data = await dubbindo.detail(url);
    } else if (['latest', 'trending', 'top'].includes(type)) {
      data = await dubbindo[type](page);
    } else {
      return NextResponse.json({ error: 'type tidak valid' }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ status: false, error: 'Gagal ambil data Dubbindo', detail: e.message }, { status: 502 });
  }
}
