import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'cs_token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* abaikan */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ }
  },
};

export const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) onUnauthorized();
    return Promise.reject(err);
  },
);

/** Pesan error yang ramah untuk ditampilkan ke pengguna */
export function errorMessage(err, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!err) return fallback;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === 'ECONNABORTED') return 'Server terlalu lama merespons. Periksa koneksi internet lalu coba lagi.';
  if (!err.response) return 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.';
  return fallback;
}

export const fieldErrors = (err) => err?.response?.data?.errors || {};

/** true bila error karena jaringan/server down (layak dicoba ulang) */
export const isRetryable = (err) => !err.response || err.response.status >= 500 || err.response.status === 429;

/** Unduh file (xlsx/csv) dari endpoint yang butuh token */
export async function downloadFile(path, params, fallbackName) {
  const res = await api.get(path, { params, responseType: 'blob', timeout: 60000 });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const name = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

/** Axios blob error -> baca JSON pesan error */
export async function blobErrorMessage(err) {
  try {
    if (err.response?.data instanceof Blob) {
      const text = await err.response.data.text();
      return JSON.parse(text).message || errorMessage(err);
    }
  } catch { /* abaikan */ }
  return errorMessage(err);
}
