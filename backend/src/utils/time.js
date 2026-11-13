// Utilitas tanggal untuk zona waktu WIB (Asia/Jakarta, UTC+7, tanpa DST).
// "Date key" = string 'YYYY-MM-DD' menurut kalender WIB.

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_ID_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Date -> 'YYYY-MM-DD' (WIB) */
export function toDateKey(date) {
  return new Date(new Date(date).getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> Date di jam 00:00 WIB */
export function startOfDateKey(key) {
  return new Date(`${key}T00:00:00+07:00`);
}

export function todayKey(now = new Date()) {
  return toDateKey(now);
}

export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

/** Rentang inklusif [from, to] -> { start, end } (end eksklusif) untuk query DB */
export function rangeToDates(fromKey, toKey) {
  return { start: startOfDateKey(fromKey), end: startOfDateKey(addDays(toKey, 1)) };
}

export function eachDay(fromKey, toKey) {
  const days = [];
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) days.push(k);
  return days;
}

export function daysInMonth(year, month1) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Senin = 0 ... Minggu = 6 */
export function weekdayIndex(key) {
  const d = new Date(`${key}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

export function isValidDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

export function formatDateId(key, { withYear = true } = {}) {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS_ID[m - 1]}${withYear ? ` ${y}` : ''}`;
}

export function formatMonthId(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_ID_LONG[m - 1]} ${y}`;
}

/** Jam WIB 'HH:mm' dari Date */
export function formatTimeWib(date) {
  return new Date(new Date(date).getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16);
}
