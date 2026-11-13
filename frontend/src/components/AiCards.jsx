import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Lightbulb, RotateCw, Sparkles, TrendingUp } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { num, rupiah } from '../lib/format';
import { fmtDate } from '../lib/dates';
import { Badge, Button, Card, CardHeader, Skeleton } from './ui';
import { BarList, SERIES } from './charts';

function Unavailable({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        {message}
        {onRetry && <button type="button" className="ml-2 font-semibold underline" onClick={onRetry}>Coba lagi</button>}
      </div>
    </div>
  );
}

export function InsightCard({ from, to }) {
  const mut = useMutation({ mutationFn: (vars) => api.post('/ai/insight', vars).then((r) => r.data.data) });
  const run = () => mut.mutate({ from, to });
  const data = mut.data;
  const stale = data && mut.variables && (mut.variables.from !== from || mut.variables.to !== to);

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-brand-600" /> Insight bisnis AI</span>}
        subtitle="Ringkasan & saran otomatis dari data periode yang dipilih."
        action={(
          <Button size="sm" variant={data ? 'secondary' : 'primary'} icon={data ? RotateCw : Sparkles} loading={mut.isPending} onClick={run}>
            {data ? 'Buat ulang' : 'Buat insight'}
          </Button>
        )}
      />
      <div className="px-5 pb-5 pt-3">
        {mut.isPending ? (
          <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-3/4" /></div>
        ) : mut.isError ? (
          <Unavailable message={errorMessage(mut.error)} onRetry={run} />
        ) : !data ? (
          <p className="text-sm text-stone-500">Tekan <b>Buat insight</b> untuk mendapatkan ringkasan performa, menu terlaris, dan saran tindakan.</p>
        ) : !data.available ? (
          <Unavailable message={data.message} onRetry={run} />
        ) : (
          <div className="space-y-3">
            {stale && <p className="text-xs text-amber-700">Periode berubah — tekan “Buat ulang” untuk memperbarui.</p>}
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-stone-800">{data.insight}</p>
            {data.recommendations?.length > 0 && (
              <ul className="space-y-1.5">
                {data.recommendations.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-stone-700"><Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />{r}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone={data.is_fallback ? 'amber' : 'green'}>{data.is_fallback ? 'Mode cadangan (tanpa LLM)' : `Model: ${data.model}`}</Badge>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ForecastCard() {
  const q = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.post('/ai/forecast', { horizon: 7 }).then((r) => r.data.data),
    staleTime: 10 * 60_000,
  });
  const d = q.data;
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><TrendingUp className="size-4 text-brand-600" /> Prediksi penjualan 7 hari</span>}
        subtitle="Perkiraan dari pola 8 minggu terakhir — gunakan untuk menyiapkan stok bahan."
      />
      <div className="px-5 pb-5 pt-3">
        {q.isLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : q.isError ? (
          <Unavailable message={errorMessage(q.error)} onRetry={q.refetch} />
        ) : !d.available ? (
          <Unavailable message={d.message} onRetry={q.refetch} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div><div className="text-xs text-stone-500">Total perkiraan</div><div className="tabular text-lg font-extrabold">{rupiah(d.summary?.total_sales)}</div></div>
              <div><div className="text-xs text-stone-500">Perkiraan cup</div><div className="tabular text-lg font-extrabold">{num(d.summary?.total_cups)}</div></div>
            </div>
            <BarList
              color={SERIES.income}
              items={d.predictions.map((p) => ({ label: fmtDate(p.date, { weekday: true, year: false }), value: p.sales, hint: `${num(p.cups)} cup` }))}
            />
            <div className="flex flex-wrap gap-2">
              <Badge tone="stone">Model: {d.model_name}</Badge>
              {d.metrics?.mae !== undefined && d.metrics?.mae !== null && <Badge tone="stone">MAE ≈ {rupiah(d.metrics.mae)}</Badge>}
              {d.is_fallback && <Badge tone="amber">Data historis sedikit</Badge>}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
