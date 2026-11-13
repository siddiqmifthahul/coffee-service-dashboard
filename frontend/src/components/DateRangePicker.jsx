import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { daysBetween, fmtRange, presetRange, todayKey } from '../lib/dates';
import { Button, Modal, cx } from './ui';

export const DEFAULT_PRESETS = [
  { id: 'today', label: 'Hari ini' },
  { id: '5d', label: '5 Hari' },
  { id: '7d', label: '7 Hari' },
  { id: 'month', label: 'Bulan ini' },
];

/**
 * value: { preset, from, to }
 * Pilihan cepat (chip) + "Pilih tanggal" untuk rentang bebas.
 */
export default function DateRangePicker({ value, onChange, presets = DEFAULT_PRESETS, maxDays = 400 }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const [error, setError] = useState('');
  const today = todayKey();

  const openCustom = () => {
    setDraft({ from: value.from, to: value.to });
    setError('');
    setOpen(true);
  };

  const apply = () => {
    if (!draft.from || !draft.to) return setError('Isi tanggal awal dan akhir.');
    if (draft.from > draft.to) return setError('Tanggal awal tidak boleh setelah tanggal akhir.');
    if (daysBetween(draft.from, draft.to) > maxDays) return setError(`Rentang maksimal ${maxDays} hari.`);
    onChange({ preset: 'custom', ...draft });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={cx('chip py-1.5', value.preset === p.id && 'chip-active')}
          onClick={() => onChange({ preset: p.id, ...presetRange(p.id) })}
        >
          {p.label}
        </button>
      ))}
      <button type="button" className={cx('chip py-1.5', value.preset === 'custom' && 'chip-active')} onClick={openCustom}>
        <CalendarDays className="size-4" />
        {value.preset === 'custom' ? fmtRange(value.from, value.to) : 'Pilih tanggal'}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pilih rentang tanggal"
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={apply}>Terapkan</Button>
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="dr-from">Dari</label>
            <input id="dr-from" type="date" className="input" max={today} value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="dr-to">Sampai</label>
            <input id="dr-to" type="date" className="input" max={today} value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[['yesterday', 'Kemarin'], ['30d', '30 hari'], ['lastMonth', 'Bulan lalu'], ['3m', '3 bulan']].map(([id, label]) => (
            <button key={id} type="button" className="chip py-1 text-xs" onClick={() => setDraft(presetRange(id))}>{label}</button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        {!error && draft.from && draft.to && draft.from <= draft.to && (
          <p className="mt-3 text-sm text-stone-500">{fmtRange(draft.from, draft.to)} · {daysBetween(draft.from, draft.to)} hari</p>
        )}
      </Modal>
    </div>
  );
}
