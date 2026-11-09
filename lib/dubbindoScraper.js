/**
 * Dubbindo Scraper (dubbindo.site)
 * Film, Anime & Drama Dubbing Indonesia
 *
 * Fitur: search, latest, trending, top, category, detail (stream MP4 multi-kualitas + download)
 * Author asli: Vamz Spectre / VamxAPI
 */
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.dubbindo.site';

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id,en-US;q=0.9,en;q=0.8'
  }
});

function parseVideoCard($, el) {
  const card = $(el);
  const anchor = card.find('.video-thumb a').first();
  const titleAnchor = card.find('.video-title a').first();
  const url = anchor.attr('href') || titleAnchor.attr('href') || '';
  const title = (card.find('.video-title h4').attr('title') || card.find('.video-title h4').text() || '').trim();
  const thumbnail = card.find('.video-thumb img').attr('src') || '';
  const previewGif = (card.find('.play_hover_btn').attr('onmouseenter') || '').match(/'([^']+)'/)?.[1] || null;
  const duration = card.find('.video-duration').text().trim() || null;
  const infoText = card.find('.video-info').text().replace(/\s+/g, ' ').trim();

  const viewsMatch = infoText.match(/([\d,]+)\s*Views/i);
  const views = viewsMatch ? viewsMatch[1].replace(/,/g, '') : null;

  const timeMatch = infoText.match(/·\s*([0-9]+\s+[a-zA-Z\s]+ago)/i);
  const uploaded = timeMatch ? timeMatch[1].trim() : null;

  const uploaderEl = card.find('.video-info a').first();
  const uploader = uploaderEl.length
    ? { name: uploaderEl.text().trim(), url: uploaderEl.attr('href') || '' }
    : null;

  const desc = card.find('.descc').text().replace(/\s+/g, ' ').trim() || null;
  const id = card.attr('data-id') || (url.match(/_([a-zA-Z0-9]+)\.html/)?.[1] || null);

  return {
    id,
    title,
    url,
    thumbnail,
    previewGif,
    duration,
    views: views ? parseInt(views, 10) : null,
    uploaded,
    uploader,
    description: desc
  };
}

async function fetchList(path, params, extra = {}) {
  const res = await http.get(path, { params });
  const $ = cheerio.load(res.data);
  const results = [];
  const seen = new Set();

  $('.video-latest-list, .video-wrapper').each((_, el) => {
    const item = parseVideoCard($, el);
    if (item.title && item.url && !seen.has(item.url)) {
      seen.add(item.url);
      results.push(item);
    }
  });

  return { status: true, ...extra, page: Number(params.page_id || 1), total: results.length, results };
}

const search = (query, page = 1) =>
  fetchList('/search', { keyword: query, page_id: page }, { query });
const latest = (page = 1) => fetchList('/videos/latest', { page_id: page });
const trending = (page = 1) => fetchList('/videos/trending', { page_id: page });
const top = (page = 1) => fetchList('/videos/top', { page_id: page });
const category = (catId, page = 1) =>
  fetchList(`/videos/category/${catId}`, { page_id: page }, { category: catId });

async function detail(urlOrSlugOrId) {
  let targetUrl = urlOrSlugOrId;
  if (!targetUrl.startsWith('http')) {
    targetUrl = targetUrl.includes('.html')
      ? `${BASE_URL}/watch/${targetUrl}`
      : `${BASE_URL}/watch/${targetUrl}.html`;
  }

  const res = await http.get(targetUrl);
  const html = res.data;
  const $ = cheerio.load(html);

  const title = ($('h1[itemprop="title"]').text() || $('title').text().replace(/ - UVideo.*$/, '') || '').trim();
  const shortId = targetUrl.match(/_([a-zA-Z0-9]+)\.html/)?.[1] || null;
  const embedUrl = shortId ? `${BASE_URL}/embed/${shortId}` : null;

  const viewsText =
    $('.views-counter').text().replace(/\s+/g, ' ').trim() || (html.match(/([\d,]+)\s+Views/i)?.[1] || '');
  const views = viewsText ? parseInt(viewsText.replace(/[^\d]/g, ''), 10) : null;
  const likes = parseInt($('#likes').text().trim() || '0', 10);
  const dislikes = parseInt($('#dislikes').text().trim() || '0', 10);

  const description = $('.video-description').text().trim() || $('.descc').first().text().trim() || null;

  const catEl = $('a[href*="/videos/category/"]').first();
  const cat = catEl.length
    ? { id: catEl.attr('href').match(/\/videos\/category\/([^"'/]+)/)?.[1] || '', name: catEl.text().trim() }
    : null;

  const uploaderEl = $('.publisher-name a').first();
  const avatarEl = $('.publisher-avatar img').first();
  const uploader = uploaderEl.length
    ? { name: uploaderEl.text().trim(), url: uploaderEl.attr('href') || '', avatar: avatarEl.attr('src') || null }
    : null;

  const streams = [];
  $('source').each((_, el) => {
    const src = $(el).attr('src');
    const type = $(el).attr('type') || 'video/mp4';
    const quality = $(el).attr('data-quality') || $(el).attr('label') || $(el).attr('title') || 'default';
    if (src && !streams.some((s) => s.url === src)) streams.push({ quality, type, url: src });
  });

  const downloads = [];
  const downloadMatches = [
    ...html.matchAll(
      /<a[^>]+href="([^"]+)"[^>]*class="[^"]*(?:clickdownload|click download|btn-share)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    )
  ];
  for (const m of downloadMatches) {
    const url = m[1];
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || 'Download';
    if (url && url !== '#' && !downloads.some((d) => d.url === url)) downloads.push({ label, url });
  }
  const singleDl = $('#link_download').attr('href');
  if (singleDl && singleDl !== '#' && !downloads.some((d) => d.url === singleDl)) {
    downloads.unshift({ label: 'Download', url: singleDl });
  }

  const related = [];
  $('.ra-thumb').each((_, el) => {
    const thumb = $(el);
    const card = thumb.parent();
    const url = thumb.find('a').first().attr('href') || '';
    const rTitle = card.find('.video-title').text().trim();
    const rViews = card.find('.video-views').text().replace(/[^\d]/g, '') || null;
    const rId = url.match(/_([a-zA-Z0-9]+)\.html/)?.[1] || null;
    if (rTitle && url && !related.some((r) => r.url === url)) {
      related.push({
        id: rId,
        title: rTitle,
        url,
        thumbnail: thumb.find('img').attr('src') || '',
        duration: thumb.find('.video-duration').text().trim() || null,
        views: rViews ? parseInt(rViews, 10) : null,
        uploader: card.find('.user-name a').text().trim() || null
      });
    }
  });

  return {
    status: true,
    title,
    id: shortId,
    url: targetUrl,
    embedUrl,
    views,
    likes,
    dislikes,
    category: cat,
    uploader,
    description,
    streams,
    downloads,
    related: related.slice(0, 10)
  };
}

module.exports = { search, latest, trending, top, category, detail };
