import { runHealthChecks } from '../../lib/healthChecks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STYLE = {
  ok: 'bg-green-100 text-green-700',
  kosong: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700'
};

export default async function HealthPage() {
  const results = await runHealthChecks();
  const bad = results.filter((r) => r.status !== 'ok').length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-extrabold text-ink">Cek Sumber Data</h1>
      <p className="mb-5 text-sm text-ink-soft">
        {bad === 0 ? 'Semua sumber normal.' : `${bad} dari ${results.length} sumber bermasalah.`} Refresh halaman buat cek ulang.
      </p>
      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.name} className="rounded-xl border border-line bg-paper-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{r.group}</p>
                <p className="text-sm font-bold text-ink">{r.name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${STYLE[r.status]}`}>
                {r.status === 'ok' ? `OK · ${r.items} item` : r.status.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">{r.ms} ms</p>
            {r.note && <p className="mt-2 break-words text-xs text-ink-soft">{r.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
