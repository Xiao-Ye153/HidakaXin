/**
 * WTR-LAB Novel Scraper
 * Creator: IzzXd
 * Base: https://wtr-lab.com
 * Saluran: https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325
 * Note: pliss guys jangan di klaim 100% buatan lu, lu boleh kok modifikasi trs share lagi tapi tolong jangan ilangin header creator sama ch-nya
 */

const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

const _p = ["fJMupwGtP5IrlSHzB608x3nEdfsErTvFeMd081GnP5Ap", "w3XyVqs9w32RI6cD+GrEeJYnpgT4PsEolCOiAao8xw=="];
const _k = [0x4d, 0xa1, 0x17, 0xc3, 0x62, 0x9e, 0x0b, 0xf4];

function _ld() {
    const raw = Buffer.from(_p.join(''), 'base64');
    const out = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw[i] ^ _k[i % _k.length];
    return out.toString('utf8');
}

// [HidakaXin] Cek header membaca file sumbernya sendiri. Setelah di-bundle
// (Next.js/Vercel) file asli tidak ada lagi, jadi pembacaan gagal. Di kasus itu
// pengecekan dilewati (null) alih-alih melempar error; kalau file BISA dibaca
// tapi header-nya diubah/dihapus, tetap ditolak seperti aslinya.
function _hd() {
    try {
        const src = fs.readFileSync(__filename, 'utf8');
        const m = src.match(/^\s*\/\*\*[\s\S]*?\*\//);
        if (!m) return '';
        const keys = ['Creator:', 'Saluran:', 'Note:'];
        const lines = m[0].split('\n').map(l => l.replace(/^\s*\*?\s*/, '').replace(/\s+/g, ''));
        const pick = keys.map(k => lines.find(l => l.startsWith(k)));
        if (pick.some(x => !x)) return '';
        return crypto.createHash('sha256').update(pick.join('')).digest('hex');
    } catch (_) {
        return null;
    }
}

function _ck() {
    const h = _hd();
    if (h === null) return;
    if (!h || h !== _ld()) throw new Error('ctx invalid');
}

const CREATOR = 'IzzXd';
const SALURAN = 'https://whatsapp.com/channel/0029VbDyL6d9RZAh3JjEM325';
const BASE_URL = 'https://wtr-lab.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HTTP_RE = /^https?:\x2f\x2f/i;

function fmtSuccess(t0, payload) {
    return {
        Creator: CREATOR,
        Saluran: SALURAN,
        time: `${Date.now() - t0}ms`,
        ...payload,
        status: true
    };
}

function fmtError(t0, err) {
    return {
        Creator: CREATOR,
        Saluran: SALURAN,
        time: `${Date.now() - t0}ms`,
        status: false,
        error: err?.message || String(err)
    };
}

function cleanMarkup(text) {
    if (!text) return '';
    return String(text)
        .replace(/%\{([^|}]+)\|[^}]+\}/g, '$1')
        .replace(/\r/g, '')
        .trim();
}

function buildNovelUrl(rawId, slug) {
    if (!rawId) return null;
    return `${BASE_URL}/en/novel/${rawId}/${slug || 'novel'}`;
}

function formatNovelStatus(code) {
    if (code === 0) return 'Ongoing';
    if (code === 1) return 'Completed';
    if (code === 2) return 'Hiatus';
    return code ?? null;
}

function normalizeNovelCard(item) {
    const rawId = item.raw_id || item.id;
    const data = item.data || {};
    return {
        id: item.id || null,
        rawId: rawId || null,
        slug: item.slug || null,
        title: cleanMarkup(data.title || item.title || ''),
        author: cleanMarkup(data.author || item.author || '') || null,
        chapterCount: item.chapter_count ?? item.raw_chapter_count ?? 0,
        rating: item.rating ?? null,
        views: item.view_count ?? item.view ?? null,
        novelStatus: formatNovelStatus(item.status),
        cover: data.image || null,
        description: cleanMarkup(data.description || ''),
        url: buildNovelUrl(rawId, item.slug)
    };
}

async function apiRequest(url, options = {}) {
    _ck();
    const res = await axios({
        url: HTTP_RE.test(url) ? url : `${BASE_URL}${url}`,
        method: options.method || 'GET',
        data: options.data,
        timeout: options.timeout || 25000,
        headers: {
            'User-Agent': UA,
            'Accept': options.accept || 'application/json, text/html;q=0.9, */*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': BASE_URL,
            'Referer': options.referer || `${BASE_URL}/en`,
            ...(options.headers || {})
        }
    });
    return res.data;
}

function extractNextProps(html) {
    const m = String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('Data Next.js tidak ditemukan pada halaman WTR-LAB');
    const parsed = JSON.parse(m[1]);
    return parsed?.props?.pageProps || {};
}

function parseTargetInput(input) {
    const raw = String(input || '').trim();
    if (!raw) throw new Error('Slug, ID, atau URL novel diperlukan');
    const fullMatch = raw.match(/\/novel\/(\d+)(?:\/([^/?#]+))?(?:\/chapter-(\d+))?/i);
    if (fullMatch) {
        return {
            rawId: Number(fullMatch[1]),
            slug: fullMatch[2] || null,
            chapterNo: fullMatch[3] ? Number(fullMatch[3]) : null
        };
    }
    if (/^\d+$/.test(raw)) {
        return { rawId: Number(raw), slug: null, chapterNo: null };
    }
    const pathMatch = raw.match(/^(\d+)\/([^/?#]+)(?:\/chapter-(\d+))?$/i);
    if (pathMatch) {
        return {
            rawId: Number(pathMatch[1]),
            slug: pathMatch[2],
            chapterNo: pathMatch[3] ? Number(pathMatch[3]) : null
        };
    }
    return { rawId: null, slug: raw.replace(/^\/+|\/+$/g, ''), chapterNo: null };
}

async function resolveNovelTarget(input) {
    const parsed = parseTargetInput(input);
    if (parsed.rawId) return parsed;
    const queryText = parsed.slug.replace(/-/g, ' ');
    const res = await apiRequest('/api/search', {
        method: 'POST',
        data: { text: queryText },
        headers: { 'Content-Type': 'application/json' }
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    const exact = list.find(x => x.slug === parsed.slug) || list[0];
    if (!exact || !exact.raw_id) throw new Error(`Novel "${input}" tidak ditemukan di WTR-LAB`);
    return {
        rawId: Number(exact.raw_id),
        slug: exact.slug,
        chapterNo: parsed.chapterNo
    };
}

function applyGlossaryTerms(line, terms) {
    if (!Array.isArray(terms) || terms.length === 0) return line;
    return line.replace(/※(\d+)[⛬〓]/g, (full, idx) => {
        const entry = terms[Number(idx)];
        if (entry && entry[0]) return String(entry[0]).replace(/_/g, '');
        return full;
    });
}

function formatChapterParagraphs(body, terms) {
    if (!Array.isArray(body)) return [];
    const out = [];
    for (const rawLine of body) {
        if (typeof rawLine !== 'string') continue;
        if (/^\s*\[(?:part:[^\]]+|image)\]\s*$/i.test(rawLine)) continue;
        const cleaned = applyGlossaryTerms(rawLine, terms).replace(/\s+/g, ' ').trim();
        if (cleaned) out.push(cleaned);
    }
    return out;
}

async function latest(page = 1, orderBy = 'update') {
    const t0 = Date.now();
    try {
        _ck();
        const p = Math.max(1, parseInt(page, 10) || 1);
        const sort = String(orderBy || 'update').trim();
        const html = await apiRequest(`/en/novel-list?orderBy=${encodeURIComponent(sort)}&page=${p}`);
        const props = extractNextProps(html);
        const results = (props.series || []).map(normalizeNovelCard);
        return fmtSuccess(t0, {
            page: p,
            orderBy: sort,
            total: results.length,
            totalCatalog: props.count ?? null,
            results
        });
    } catch (err) {
        return fmtError(t0, err);
    }
}

async function ranking(type = 'daily', page = 1) {
    const t0 = Date.now();
    try {
        _ck();
        const allowed = ['daily', 'weekly', 'monthly', 'all'];
        const kind = allowed.includes(String(type || '').toLowerCase()) ? String(type).toLowerCase() : 'daily';
        const p = Math.max(1, parseInt(page, 10) || 1);
        const html = await apiRequest(`/en/ranking/${kind}?page=${p}`);
        const props = extractNextProps(html);
        const list = Array.isArray(props.list) ? props.list : [];
        const results = list.map((item, idx) => ({
            rank: (p - 1) * 10 + idx + 1,
            ...normalizeNovelCard(item)
        }));
        return fmtSuccess(t0, {
            type: kind,
            page: p,
            total: results.length,
            totalCatalog: props.count ?? null,
            results
        });
    } catch (err) {
        return fmtError(t0, err);
    }
}

async function search(query, limit = 20) {
    const t0 = Date.now();
    try {
        _ck();
        const q = String(query || '').trim();
        if (!q) throw new Error('Query pencarian wajib diisi');
        const cap = Math.max(1, parseInt(limit, 10) || 20);
        const res = await apiRequest('/api/search', {
            method: 'POST',
            data: { text: q },
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res || res.success === false) {
            throw new Error(res?.message || 'Pencarian WTR-LAB gagal');
        }
        const results = (Array.isArray(res.data) ? res.data : []).slice(0, cap).map(normalizeNovelCard);
        return fmtSuccess(t0, {
            query: q,
            total: results.length,
            results
        });
    } catch (err) {
        return fmtError(t0, err);
    }
}

async function fetchAllChapters(rawId, totalExpected) {
    const batchSize = 500;
    const total = Math.max(1, Number(totalExpected) || 500);
    const chapters = [];
    for (let start = 1; start <= total; start += batchSize) {
        const end = Math.min(total, start + batchSize - 1);
        const res = await apiRequest(`/api/chapters/${rawId}?start=${start}&end=${end}`);
        const batch = Array.isArray(res?.chapters) ? res.chapters : [];
        if (batch.length === 0) break;
        chapters.push(...batch);
        if (batch.length < (end - start + 1)) break;
    }
    return chapters;
}

async function detail(target) {
    const t0 = Date.now();
    try {
        _ck();
        const resolved = await resolveNovelTarget(target);
        const reqUrl = buildNovelUrl(resolved.rawId, resolved.slug || 'x');
        const html = await apiRequest(reqUrl);
        const $ = cheerio.load(html);
        const genres = [];
        $('a[href*="genre="]').each((_, el) => {
            const g = $(el).text().replace(/\s+/g, ' ').trim();
            if (g && !genres.includes(g)) genres.push(g);
        });

        const props = extractNextProps(html);
        const serie = props.serie || {};
        const sdata = serie.serie_data || {};
        const meta = sdata.data || {};
        const slug = sdata.slug || resolved.slug;
        const rawId = sdata.raw_id || resolved.rawId;
        const rawChapters = await fetchAllChapters(rawId, sdata.chapter_count || 500);
        const chapters = rawChapters.map(ch => ({
            order: ch.order,
            id: ch.id,
            title: cleanMarkup(ch.title || `Chapter ${ch.order}`),
            rawName: ch.name || null,
            locked: Boolean(ch.locked),
            updatedAt: ch.updated_at || null,
            url: `${BASE_URL}/en/novel/${rawId}/${slug}/chapter-${ch.order}`
        }));

        const tags = Array.isArray(props.tags) ? props.tags.map(t => t.title).filter(Boolean) : [];
        return fmtSuccess(t0, {
            id: sdata.id || null,
            rawId,
            slug,
            title: cleanMarkup(meta.title || ''),
            author: cleanMarkup(meta.author || '') || null,
            novelStatus: formatNovelStatus(sdata.status),
            rating: sdata.rating ?? null,
            cover: meta.image || null,
            url: buildNovelUrl(rawId, slug),
            genres,
            tags,
            ranks: serie.ranks || null,
            synopsis: cleanMarkup(meta.description || ''),
            totalChapters: sdata.chapter_count || chapters.length,
            chapters
        });
    } catch (err) {
        return fmtError(t0, err);
    }
}

async function fetchChapterPayload(rawId, slug, chapterNo, service = 'ai') {
    const referer = `${BASE_URL}/en/novel/${rawId}/${slug || 'x'}/chapter-${chapterNo}`;
    const rg = await apiRequest('/api/reader/get', {
        method: 'POST',
        referer,
        headers: { 'Content-Type': 'application/json' },
        data: {
            translate: service,
            language: 'en',
            raw_id: Number(rawId),
            chapter_no: Number(chapterNo)
        }
    });
    if (!rg || !rg.success) {
        if (rg?.requireTurnstile) {
            throw new Error('Chapter diblokir Cloudflare Turnstile oleh situs target');
        }
        if (rg?.code === 'CHAPTER_LOCKED') {
            throw new Error(`Chapter ${chapterNo} terkunci (memerlukan unlock akun)`);
        }
        throw new Error(rg?.error || rg?.message || `Gagal memuat chapter ${chapterNo}`);
    }
    if (!rg.content_url) {
        throw new Error(`Konten chapter ${chapterNo} belum tersedia`);
    }
    const contentJson = await apiRequest(rg.content_url, { referer });
    const inner = contentJson?.data?.data || {};
    const terms = inner.glossary_data?.terms || [];
    const paragraphs = formatChapterParagraphs(inner.body || [], terms);
    return {
        rawId: Number(rawId),
        chapterId: rg.chapter?.id || null,
        chapterNo: rg.chapter?.order || Number(chapterNo),
        title: cleanMarkup(rg.chapter?.title || inner.title || `Chapter ${chapterNo}`),
        url: referer,
        navigation: {
            prev: chapterNo > 1 ? `${BASE_URL}/en/novel/${rawId}/${slug || 'x'}/chapter-${chapterNo - 1}` : null,
            next: `${BASE_URL}/en/novel/${rawId}/${slug || 'x'}/chapter-${chapterNo + 1}`
        },
        totalParagraphs: paragraphs.length,
        content: paragraphs.join('\n\n')
    };
}

// [HidakaXin] parameter ke-3 (service) ditambahkan: 'ai' (default) atau 'google'.
async function read(target, chapterNo = null, service = 'ai') {
    const t0 = Date.now();
    try {
        _ck();
        const resolved = await resolveNovelTarget(target);
        const chNum = parseInt(chapterNo ?? resolved.chapterNo ?? 1, 10) || 1;
        let slug = resolved.slug;
        if (!slug) {
            const det = await detail(resolved.rawId);
            if (det.status && det.slug) slug = det.slug;
        }
        const chapterData = await fetchChapterPayload(resolved.rawId, slug || 'novel', chNum, service);
        return fmtSuccess(t0, chapterData);
    } catch (err) {
        return fmtError(t0, err);
    }
}

async function bulkDownload(target, limitChapters = 0) {
    const t0 = Date.now();
    try {
        _ck();
        const det = await detail(target);
        if (!det.status) throw new Error(det.error || 'Gagal memuat detail novel');
        const unlocked = (det.chapters || []).filter(c => !c.locked);
        const cap = parseInt(limitChapters, 10) || 0;
        const selected = cap > 0 ? unlocked.slice(0, cap) : unlocked;

        const episodes = new Array(selected.length);
        const concurrency = 3;
        let idx = 0;
        async function worker() {
            while (idx < selected.length) {
                const i = idx++;
                const ch = selected[i];
                try {
                    const data = await fetchChapterPayload(det.rawId, det.slug, ch.order);
                    episodes[i] = {
                        order: data.chapterNo,
                        title: data.title,
                        url: data.url,
                        totalParagraphs: data.totalParagraphs,
                        content: data.content
                    };
                } catch (err) {
                    episodes[i] = {
                        order: ch.order,
                        title: ch.title,
                        url: ch.url,
                        totalParagraphs: 0,
                        error: err.message
                    };
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, selected.length || 1) }, worker));

        return fmtSuccess(t0, {
            rawId: det.rawId,
            title: det.title,
            slug: det.slug,
            cover: det.cover,
            totalChapters: episodes.length,
            episodes
        });
    } catch (err) {
        return fmtError(t0, err);
    }
}

const downloadAll = bulkDownload;
const dl = bulkDownload;

function printUsage() {
    console.log(
        'Usage:\n' +
        ' node wtr-lab.js latest [page] [orderBy]\n' +
        ' node wtr-lab.js ranking [daily|weekly|monthly|all] [page]\n' +
        ' node wtr-lab.js search <query> [limit]\n' +
        ' node wtr-lab.js detail <rawId|slug|url>\n' +
        ' node wtr-lab.js read <chapterUrl|rawId|slug> [chapterNumber]\n' +
        ' node wtr-lab.js dl <rawId|slug|url> [limitChapters]'
    );
}

async function main() {
    const args = process.argv.slice(2);
    if (!args.length || args[0] === '-h' || args[0] === '--help') {
        printUsage();
        return;
    }

    const cmd = args[0].toLowerCase();
    let res = null;
    if (cmd === 'latest') {
        res = await latest(args[1] || 1, args[2] || 'update');
    } else if (cmd === 'ranking') {
        res = await ranking(args[1] || 'daily', args[2] || 1);
    } else if (cmd === 'search') {
        if (!args[1]) {
            printUsage();
            return;
        }
        res = await search(args[1], args[2] || 20);
    } else if (cmd === 'detail') {
        if (!args[1]) {
            printUsage();
            return;
        }
        res = await detail(args[1]);
    } else if (cmd === 'read') {
        if (!args[1]) {
            printUsage();
            return;
        }
        res = await read(args[1], args[2] ?? null);
    } else if (cmd === 'dl' || cmd === 'bulkdownload' || cmd === 'downloadall') {
        if (!args[1]) {
            printUsage();
            return;
        }
        res = await bulkDownload(args[1], args[2] || 0);
    } else {
        printUsage();
        return;
    }

    console.log(JSON.stringify(res, null, 2));
}

module.exports = {
    latest,
    ranking,
    search,
    detail,
    read,
    bulkDownload,
    downloadAll,
    dl,
    apiRequest
};

if (require.main === module) {
    main();
}
