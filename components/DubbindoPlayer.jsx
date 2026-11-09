'use client';

import { useMemo, useRef, useState } from 'react';

function qualityRank(q) {
  const n = parseInt(String(q).replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

export default function DubbindoPlayer({ streams = [], embedUrl, poster }) {
  const sorted = useMemo(
    () => [...streams].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality)),
    [streams]
  );
  const [idx, setIdx] = useState(0);
  const [useEmbed, setUseEmbed] = useState(sorted.length === 0 && !!embedUrl);
  const videoRef = useRef(null);

  function switchQuality(i) {
    const t = videoRef.current?.currentTime || 0;
    setIdx(i);
    // lanjut dari posisi terakhir setelah source ganti
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = t;
        videoRef.current.play().catch(() => {});
      }
    }, 150);
  }

  if (useEmbed && embedUrl) {
    return (
      <div>
        <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
          <iframe src={embedUrl} allowFullScreen className="h-full w-full" />
        </div>
        {sorted.length > 0 && (
          <button onClick={() => setUseEmbed(false)} className="mt-2 text-xs font-semibold text-accent">
            Pakai player langsung (MP4)
          </button>
        )}
      </div>
    );
  }

  const current = sorted[idx];
  if (!current) {
    return (
      <p className="rounded-xl border border-line bg-paper-card p-6 text-center text-sm text-ink-soft shadow-card">
        Sumber video tidak ditemukan.
      </p>
    );
  }

  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
        <video
          key={current.url}
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={poster || undefined}
          className="h-full w-full"
        >
          <source src={current.url} type={current.type || 'video/mp4'} />
        </video>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sorted.map((s, i) => (
          <button
            key={s.url}
            onClick={() => switchQuality(i)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              i === idx
                ? 'border-accent bg-accent-50 text-accent'
                : 'border-line bg-paper-card text-ink-soft hover:border-accent hover:text-accent'
            }`}
          >
            {s.quality}
          </button>
        ))}
        {embedUrl && (
          <button onClick={() => setUseEmbed(true)} className="ml-auto text-xs font-semibold text-accent">
            Coba player embed
          </button>
        )}
      </div>
    </div>
  );
}
