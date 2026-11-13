// Semua tanggal mengikuti WIB (Asia/Jakarta, UTC+7) agar sama dengan backend.
const WIB = 7 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const toKey = (date) => new Date(new Date(date).getTime() + WIB).toISOString().slice(0, 10);
export const todayKey = () => toKey(new Date());

export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

export function monthStart(key) {
  return `${key.slice(0, 7)}-01`;
}

export function monthEnd(key) {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

export function fmtDate(key, { weekday = false, year = true } = {}) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const wd = weekday ? `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ` : '';
  return `${wd}${d} ${MONTHS[m - 1]}${year ? ` ${y}` : ''}`;
}

export function fmtDateLong(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

export const fmtTime = (date) => new Date(new Date(date).getTime() + WIB).toISOString().slice(11, 16);

export function fmtRange(from, to) {
  if (from === to) return fmtDate(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${fmtDate(to)}`;
  return `${fmtDate(from, { year: from.slice(0, 4) !== to.slice(0, 4) })} – ${fmtDate(to)}`;
}

/** Preset rentang tanggal yang dipakai di Dashboard, Rekap & Export */
export function presetRange(id, today = todayKey()) {
  switch (id) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: addDays(today, -1), to: addDays(today, -1) };
    case '5d': return { from: addDays(today, -4), to: today };
    case '7d': return { from: addDays(today, -6), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case 'month': return { from: monthStart(today), to: today };
    case 'lastMonth': {
      const prev = addDays(monthStart(today), -1);
      return { from: monthStart(prev), to: prev };
    }
    case '3m': return { from: monthStart(addDays(monthStart(addDays(monthStart(today), -1)), -1)), to: today };
    default: return { from: today, to: today };
  }
}
