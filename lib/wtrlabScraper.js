/**
 * WTR-LAB Scraper (wtr-lab.com) — novel terjemahan mesin (MTL) bahasa Inggris
 *
 * STATUS per fungsi:
 *  - list()    : struktur dicek dari halaman asli (/en/novel-list?page=N)
 *  - detail()  : struktur dicek dari halaman asli (/en/novel/{id}/{slug})
 *  - search()  : parameter query BELUM terverifikasi (lihat catatan di fungsi)
 *  - chapter() : teks chapter di WTR-LAB kemungkinan di-load lewat API POST
 *                (konten terenkripsi) — BELUM terverifikasi. Fungsi ini coba
 *                baca dari HTML; kalau kosong, ngebalikin diagnosis (bukan nebak).
 *
 * Chapter yang masih "locked" (butuh tiket/gems) sengaja tidak coba ditembus.
 */
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://wtr-lab.com';
const LANG = 'en';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  Referer: `${BASE_URL}/`
};

// ---------- util ----------
function abs(href) {
  if (!href) return '';
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('http')) return href;
  return BASE_URL + (href.startsWith('/') ? '' : '/') + href;
}

// "2.24M" -> 2240000, "751K" -> 751000, "1,234" -> 1234
function parseCount(str) {
  if (str == null) return null;
  const m = String(str).trim().match(/^([\d.,]+)\s*([KMB])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(n * mult);
}

function novelRef(href) {
  const m = String(href || '').match(/\/novel\/(\d+)\/([^/?#]+)/);
  return m ? { id: m[1], slug: m[2] } : null;
}

function novelUrl(id, slug) {
  return `${BASE_URL}/${LANG}/novel/${id}/${slug}`;
}

function squash(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isCloudflare(status, html) {
  return (
    [403, 503].includes(status) ||
    /Just a moment|cf-browser-verification|cf-challenge|cdn-cgi\/challenge/i.test(html || '')
  );
}

async function getHtml(url, params) {
  const res = await axios.get(url, {
    headers: HEADERS,
    params,
    timeout: 20000,
    validateStatus: () => true
  });
  const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  if (res.status !== 200) {
    const err = new Error(
      isCloudflare(res.status, html)
        ? `HTTP ${res.status} — kemungkinan diblok Cloudflare/anti-bot`
        : `HTTP ${res.status} dari wtr-lab.com`
    );
    err.status = res.status;
    throw err;
  }
  if (isCloudflare(200, html) && html.length < 20000 && /Just a moment/i.test(html)) {
    throw new Error('Kena halaman tantangan Cloudflare');
  }
  return html;
}

// Naik dari <h3> sampai ancestor terbesar yang HANYA berisi satu <h3>:
// itu "kartu"-nya. Cara ini gak bergantung pada nama class (yang gak diketahui).
function cardOf($, h3) {
  let node = $(h3);
  for (let i = 0; i < 8; i++) {
    const p = node.parent();
    if (!p.length || /^(body|html|main)$/i.test(p.get(0).tagName) || p.find('h3').length !== 1) break;
    node = p;
  }
  return node;
}

function statsFromText(text) {
  const t = squash(text);
  const pick = (re) => (t.match(re) || [])[1] || null;
  return {
    status: pick(/Status\s*(Ongoing|Completed|Hiatus|Dropped)/i),
    views: parseCount(pick(/Views\s*([\d.,]+\s*[KMB]?)/i)),
    chapters: parseCount(pick(/Chapters\s*([\d.,]+)/i)),
    readers: parseCount(pick(/Readers\s*([\d.,]+\s*[KMB]?)/i)),
    chars: parseCount(pick(/Chars\s*([\d.,]+\s*[KMB]?)/i)),
    rating: pick(/★\s*([\d.]+)/) ? parseFloat(pick(/★\s*([\d.]+)/)) : null,
    aiPercent: pick(/AI\s*([\d.]+)\s*%/) ? parseFloat(pick(/AI\s*([\d.]+)\s*%/)) : null
  };
}

function parseCards(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  $('h3').each((_, h3) => {
    const a = $(h3).find('a[href*="/novel/"]').first();
    const ref = novelRef(a.attr('href'));
    if (!ref || seen.has(ref.id)) return;
    seen.add(ref.id);

    const card = cardOf($, h3);
    const text = card.text();
    const img = card.find('img').first();
    const cover = abs(img.attr('data-src') || img.attr('src') || '');
    const tags = card
      .find('a[href*="genre="], a[href*="ti="]')
      .map((__, el) => squash($(el).text()))
      .get()
      .filter(Boolean);
    const paragraphs = card
      .find('p')
      .map((__, el) => squash($(el).text()))
      .get()
      .filter((p) => p && !/^Show more$/i.test(p));

    results.push({
      id: ref.id,
      slug: ref.slug,
      title: squash(a.attr('title') || a.text() || $(h3).text()),
      url: novelUrl(ref.id, ref.slug),
      cover: cover || null,
      ...statsFromText(text),
      tags,
      description: paragraphs.join('\n\n') || null
    });
  });

  return results;
}

function totalPages(html) {
  const $ = cheerio.load(html);
  const nums = $('a[href*="page="]')
    .map((_, el) => parseInt((($(el).attr('href') || '').match(/page=(\d+)/) || [])[1], 10))
    .get()
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : null;
}

// ---------- public API ----------

// params tambahan (order, status, genre, dst.) diteruskan apa adanya sebagai
// query string. Nama parameternya belum diverifikasi — satu-satunya yang
// terkonfirmasi ?page=N. Genre di situs pakai id angka (mis. genre=1 = action).
async function list(page = 1, params = {}) {
  const html = await getHtml(`${BASE_URL}/${LANG}/novel-list`, { page, ...params });
  const results = parseCards(html);
  return { status: true, page: Number(page), totalPages: totalPages(html), total: results.length, results };
}

// CATATAN: /en/novel-finder dikonfirmasi ada (dan pakai ?page=N), tapi nama
// parameter teks pencariannya BELUM terverifikasi — "text" adalah tebakan.
// Hasilnya difilter di sisi kita supaya kalau parameter salah, yang keluar
// tetap hanya yang judulnya cocok (bukan seluruh katalog).
async function search(query, page = 1) {
  const html = await getHtml(`${BASE_URL}/${LANG}/novel-finder`, { text: query, page });
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const all = parseCards(html);
  const results = all.filter((n) => words.every((w) => n.title.toLowerCase().includes(w)));
  return {
    status: true,
    query,
    page: Number(page),
    total: results.length,
    filteredFrom: all.length,
    paramVerified: false,
    results
  };
}

async function detail(idOrUrl, slug) {
  let url = String(idOrUrl);
  if (!url.startsWith('http')) url = slug ? novelUrl(url, slug) : `${BASE_URL}/${LANG}/novel/${url}`;
  const ref = novelRef(url);

  const html = await getHtml(url);
  const $ = cheerio.load(html);
  const finalRef = novelRef($('link[rel="canonical"]').attr('href') || '') || ref;
  const bodyText = squash($('body').text());

  const title = squash($('h1').first().text()) || squash($('title').text()).replace(/^Read\s+|\s+RAW English Translation.*$/g, '');
  const cover =
    $('meta[property="og:image"]').attr('content') ||
    abs($('h1').first().closest('div').find('img').first().attr('src') || '') ||
    null;

  // Ringkasan: ambil <p> di sekitar heading "Novel Summary".
  let summary = null;
  const heading = $('*')
    .filter((_, el) => $(el).children().length === 0 && squash($(el).text()) === 'Novel Summary')
    .first();
  if (heading.length) {
    const box = heading.parent().find('p').length ? heading.parent() : heading.parent().parent();
    const ps = box
      .find('p')
      .map((_, el) => squash($(el).text()))
      .get()
      .filter((p) => p && !/^Show more$/i.test(p));
    if (ps.length) summary = ps.join('\n\n');
  }
  if (!summary) {
    const m = bodyText.match(/Novel Summary\s*(.*?)\s*(?:Show more|Details Edit History)/i);
    summary = m ? m[1] : null;
  }

  const links = (sel, re) =>
    $(sel)
      .map((_, el) => ({
        id: (($(el).attr('href') || '').match(re) || [])[1] || null,
        name: squash($(el).text())
      }))
      .get()
      .filter((x) => x.name);
  const uniqBy = (arr, key) => arr.filter((x, i) => arr.findIndex((y) => y[key] === x[key]) === i);

  const genres = uniqBy(links('a[href*="novel-list?genre="]', /genre=(\d+)/), 'name');
  const tags = uniqBy(links('a[href*="novel-finder?ti="]', /ti=(\d+)/), 'name');
  const authors = uniqBy(
    links('a[href*="/author/"]', /\/author\/([^/?#]+)/).map((a) => ({ ...a, id: decodeURIComponent(a.id || '') })),
    'name'
  );

  const stats = statsFromText(bodyText);
  const unlockM = bodyText.match(/AI-Unlock Progress\s*(\d+)\s*\/\s*(\d+)/i);
  const lockedM = bodyText.match(/(\d+)\s*chapters? locked/i);
  const dateAdded = (bodyText.match(/Date Added\s*([A-Z][a-z]+ \d{1,2}, \d{4})/) || [])[1] || null;

  const total = stats.chapters || (unlockM ? parseInt(unlockM[2], 10) : 0);
  const unlocked = unlockM ? parseInt(unlockM[1], 10) : null;

  // Daftar chapter asli (judul per chapter) dimuat dinamis di tab "Table of
  // Contents", jadi di sini cuma dibangun dari pola URL yang sudah terkonfirmasi.
  const chapters = [];
  if (finalRef && total) {
    for (let n = 1; n <= total; n++) {
      chapters.push({
        no: n,
        title: `Chapter ${n}`,
        url: `${novelUrl(finalRef.id, finalRef.slug)}/chapter-${n}`,
        locked: unlocked != null ? n > unlocked : null
      });
    }
  }

  return {
    status: true,
    id: finalRef?.id || null,
    slug: finalRef?.slug || null,
    url: finalRef ? novelUrl(finalRef.id, finalRef.slug) : url,
    title,
    cover,
    ...stats,
    unlockedChapters: unlocked,
    lockedChapters: lockedM ? parseInt(lockedM[1], 10) : unlocked != null ? Math.max(0, total - unlocked) : null,
    dateAdded,
    authors,
    genres,
    tags,
    summary,
    chapters
  };
}

// Baca satu chapter. Lihat catatan di header file: dua jalur dicoba, dan kalau
// teks gak ketemu, hasilnya berisi diagnosis supaya bisa dicocokkan dengan
// struktur asli, bukan ditebak lagi.
async function chapter(idOrUrl, slugOrNo, maybeNo) {
  let url;
  if (String(idOrUrl).startsWith('http')) {
    url = String(idOrUrl);
  } else {
    url = `${novelUrl(idOrUrl, slugOrNo)}/chapter-${maybeNo}`;
  }
  const html = await getHtml(url);
  const $ = cheerio.load(html);

  const title = squash($('h1').first().text()) || squash($('title').text());

  // Jalur 1: paragraf di container reader (nama class belum diketahui, jadi
  // coba beberapa kandidat + pilih yang teksnya paling banyak).
  const candidates = [
    '#chapter-body', '.chapter-body', '.chapter-content', '[class*="chapter-body"]',
    '[class*="chapter"] ', '[class*="reader"]', 'article', 'main'
  ];
  let best = [];
  for (const sel of candidates) {
    $(sel).each((_, el) => {
      const ps = $(el)
        .find('p')
        .map((__, p) => squash($(p).text()))
        .get()
        .filter(Boolean);
      const len = ps.join('').length;
      if (len > best.join('').length) best = ps;
    });
  }

  // Jalur 2: blob JSON di <script> (Next/Nuxt data).
  const jsonBlobs = [];
  $('script').each((_, el) => {
    const id = $(el).attr('id') || null;
    const type = $(el).attr('type') || null;
    const body = $(el).html() || '';
    if (id === '__NEXT_DATA__' || type === 'application/json' || /^window\.__NUXT__|^self\.__next_f/.test(body.trim())) {
      jsonBlobs.push({ id, type, length: body.length });
    }
  });

  const nav = (re) =>
    $('a[href*="/chapter-"]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter((h) => re.test($(`a[href="${h}"]`).text()))
      .map(abs)[0] || null;

  if (best.join('').length >= 200) {
    return {
      status: true,
      ok: true,
      url,
      title,
      paragraphs: best,
      prevUrl: nav(/prev/i),
      nextUrl: nav(/next/i)
    };
  }

  return {
    status: true,
    ok: false,
    url,
    title,
    paragraphs: [],
    reason:
      'Teks chapter gak ada di HTML awal. Kemungkinan dimuat lewat API POST (konten terenkripsi) — struktur ini belum terverifikasi, jadi belum ditebak.',
    diagnosis: {
      htmlLength: html.length,
      jsonBlobs,
      scriptSrcs: $('script[src]').map((_, el) => $(el).attr('src')).get().slice(0, 25),
      locked: /locked|unlock|login|sign in/i.test(squash($('body').text()).slice(0, 4000))
    }
  };
}

module.exports = { list, search, detail, chapter, parseCards, parseCount, BASE_URL };
