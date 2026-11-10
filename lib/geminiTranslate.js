/**
 * Terjemahan lewat Gemini API (REST generateContent).
 *
 * Env (set di Vercel → Settings → Environment Variables, JANGAN di-commit):
 *   GEMINI_API_KEY   wajib
 *   GEMINI_MODEL     opsional, default "gemini-3.5-flash-lite" (murah & cepat).
 *                    Mau kualitas lebih bagus: "gemini-3.6-flash".
 *
 * Sengaja HANYA dipanggil dari sisi server (halaman/route yang kita kontrol),
 * jangan dibuka jadi endpoint publik — siapa pun bisa menghabiskan kuota key.
 */
const axios = require('axios');

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const CHUNK_CHARS = 6000; // satu request ≈ beberapa paragraf, aman dari timeout

const SYSTEM = (target) =>
  `Kamu penerjemah novel web profesional. Terjemahkan teks berikut ke bahasa ${target} yang natural dan enak dibaca.
Aturan:
- Pertahankan jumlah paragraf dan urutannya; pisahkan paragraf dengan SATU baris kosong.
- Pertahankan nada, dialog, dan tanda kutip. Jangan meringkas, jangan menambah komentar.
- Nama tokoh/tempat: pakai satu bentuk yang konsisten (transliterasi pinyin untuk nama Mandarin).
- Keluarkan HANYA hasil terjemahan, tanpa pembuka atau penutup.`;

function chunkParagraphs(paragraphs) {
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const p of paragraphs) {
    if (len + p.length > CHUNK_CHARS && cur.length) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(p);
    len += p.length + 2;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function callGemini(text, target) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY belum di-set di environment variable');
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  // Body dibuat minimal (tanpa temperature/thinking dll.) karena parameter
  // generasi bisa beda antar generasi model.
  const res = await axios.post(
    `${ENDPOINT}/${model}:generateContent`,
    {
      systemInstruction: { parts: [{ text: SYSTEM(target) }] },
      contents: [{ role: 'user', parts: [{ text }] }]
    },
    {
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      timeout: 55000,
      validateStatus: () => true
    }
  );

  if (res.status !== 200) {
    const msg = res.data?.error?.message || `HTTP ${res.status}`;
    const err = new Error(`Gemini: ${msg}`);
    err.status = res.status;
    throw err;
  }
  const cand = res.data?.candidates?.[0];
  const out = (cand?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!out) {
    throw new Error(`Gemini balikin kosong (finishReason: ${cand?.finishReason || res.data?.promptFeedback?.blockReason || 'unknown'})`);
  }
  return { text: out, model };
}

// paragraphs: string[] → string[] (terjemahan, jumlah mengikuti hasil model)
async function translateParagraphs(paragraphs, target = 'Indonesia') {
  const clean = (paragraphs || []).map((p) => String(p).trim()).filter(Boolean);
  if (!clean.length) return { paragraphs: [], model: null, chunks: 0 };

  const out = [];
  let model = null;
  const chunks = chunkParagraphs(clean);
  for (const chunk of chunks) {
    const r = await callGemini(chunk.join('\n\n'), target);
    model = r.model;
    out.push(...r.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
  }
  return { paragraphs: out, model, chunks: chunks.length };
}

async function translateText(text, target = 'Indonesia') {
  const r = await translateParagraphs(String(text).split(/\n\s*\n/), target);
  return { text: r.paragraphs.join('\n\n'), model: r.model };
}

module.exports = { translateParagraphs, translateText };
