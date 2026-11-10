import axios from 'axios';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Cegah SSRF ke jaringan internal.
function isBlockedHost(host) {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) ||
    host === '[::1]'
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('url');
  if (!raw) return new Response('Missing url', { status: 400 });

  let u;
  try {
    u = new URL(raw);
  } catch {
    return new Response('Bad url', { status: 400 });
  }
  if (!['http:', 'https:'].includes(u.protocol) || isBlockedHost(u.hostname)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    // axios (bukan fetch) supaya header Referer beneran terkirim.
    const res = await axios.get(u.toString(), {
      responseType: 'arraybuffer',
      timeout: 12000,
      maxContentLength: MAX_BYTES,
      maxRedirects: 4,
      validateStatus: () => true,
      headers: {
        Referer: u.origin + '/',
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    const type = res.headers['content-type'] || '';
    if (res.status !== 200 || !type.startsWith('image/')) {
      return new Response(`Upstream ${res.status}`, { status: 502 });
    }
    return new Response(res.data, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=604800' }
    });
  } catch {
    return new Response('Proxy error', { status: 502 });
  }
}
