'use client';

import { useState } from 'react';

// Urutan percobaan: (0) langsung tanpa Referer — ngelewatin hotlink-protection
// yang nge-block Referer dari domain lain, (1) lewat /api/img (server kirim
// Referer asli sumbernya), (2) lewat CDN gambar publik wsrv.nl (IP & header
// beda, kadang tembus kalau IP Vercel yang diblok), (3) placeholder.
export default function CardImage({ src, alt = '', className = '', loading = 'lazy' }) {
  const [stage, setStage] = useState(0);

  if (!src) return <Placeholder className={className} />;
  if (stage >= 3) return <Placeholder className={className} />;

  const finalSrc =
    stage === 0
      ? src
      : stage === 1
      ? `/api/img?url=${encodeURIComponent(src)}`
      : `https://wsrv.nl/?url=${encodeURIComponent(src)}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={stage}
      src={finalSrc}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setStage((s) => s + 1)}
    />
  );
}

function Placeholder({ className }) {
  return (
    <div className={`flex items-center justify-center bg-paper-soft font-display text-ink-faint ${className}`}>?</div>
  );
}
