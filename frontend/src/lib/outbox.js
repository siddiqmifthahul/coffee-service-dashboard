// Antrean simpan (outbox) di localStorage.
// Setiap transaksi / entri kas selalu ditulis ke sini DULU, baru dikirim ke server.
// Jika internet/server putus, data tetap aman di perangkat dan dikirim ulang otomatis.

const KEY = 'cs_outbox_v1';

export function readOutbox() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeOutbox(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* penyimpanan penuh / diblokir: tetap lanjut kirim langsung */
  }
}

export function newClientId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
