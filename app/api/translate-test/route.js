import { NextResponse } from 'next/server';
import { translateText } from '../../../lib/geminiTranslate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Tes cepat apakah GEMINI_API_KEY jalan. DIKUNCI: hanya aktif kalau env
// DEBUG_TOKEN di-set dan dikirim cocok, supaya orang lain gak bisa
// memakai kuota Gemini lewat URL ini.
//   /api/translate-test?token=XXXX&q=Hello world
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const expected = process.env.DEBUG_TOKEN;
  if (!expected || sp.get('token') !== expected) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 });
  }
  const q = sp.get('q') || 'The old dragon slowly opened its eyes.';
  try {
    const r = await translateText(q.slice(0, 1000));
    return NextResponse.json({ ok: true, model: r.model, input: q, output: r.text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
