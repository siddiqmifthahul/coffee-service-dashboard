import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { API_URL, api, errorMessage, isRetryable } from '../lib/api';
import { readOutbox, writeOutbox } from '../lib/outbox';
import { useAuth } from './AuthContext';

const SyncContext = createContext(null);

const ENDPOINT = { transaction: '/transactions', cash: '/cash-entries' };
const RETRY_MS = 8000;

export function SyncProvider({ children }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(() => readOutbox().length);
  const [syncing, setSyncing] = useState(false);
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const flushing = useRef(false);
  const waiters = useRef(new Map()); // clientId -> resolve

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  /** Kirim semua isi outbox secara berurutan */
  const flush = useCallback(async () => {
    if (flushing.current || !token) return;
    flushing.current = true;
    setSyncing(true);
    let changed = false;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const queue = readOutbox();
        if (!queue.length) break;
        const item = queue[0];
        try {
          const res = await api.post(ENDPOINT[item.kind], item.payload);
          writeOutbox(readOutbox().filter((q) => q.id !== item.id));
          changed = true;
          const resolve = waiters.current.get(item.id);
          if (resolve) {
            resolve({ status: 'saved', data: res.data.data });
            waiters.current.delete(item.id);
          } else if (!res.data.data?.duplicate) {
            toast.success(item.kind === 'transaction' ? 'Transaksi tertunda berhasil tersimpan.' : 'Entri kas tertunda berhasil tersimpan.');
          }
        } catch (err) {
          if (isRetryable(err) || err.response?.status === 401) {
            const resolve = waiters.current.get(item.id);
            if (resolve) {
              resolve({ status: 'queued' });
              waiters.current.delete(item.id);
            }
            break; // coba lagi nanti
          }
          // Ditolak server (mis. data tidak valid) -> keluarkan dari antrean
          writeOutbox(readOutbox().filter((q) => q.id !== item.id));
          const resolve = waiters.current.get(item.id);
          if (resolve) {
            resolve({ status: 'rejected', error: err });
            waiters.current.delete(item.id);
          } else {
            toast.error(`Data tertunda ditolak server: ${errorMessage(err)}`);
          }
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      setPending(readOutbox().length);
      if (changed) refreshAll();
    }
  }, [token, refreshAll]);

  /**
   * Simpan data lewat outbox. Resolve: {status:'saved'|'queued'|'rejected', data?, error?}
   */
  const save = useCallback(
    (kind, payload) => {
      const id = payload.clientId;
      writeOutbox([...readOutbox(), { id, kind, payload, createdAt: new Date().toISOString() }]);
      setPending(readOutbox().length);
      const p = new Promise((resolve) => waiters.current.set(id, resolve));
      if (flushing.current) {
        // sedang mengirim antrean lain; item ini akan ikut terkirim
        setTimeout(flush, 300);
      } else {
        flush();
      }
      return p;
    },
    [flush],
  );

  // coba kirim ulang berkala & saat online kembali
  useEffect(() => {
    if (!token) return undefined;
    flush();
    const timer = setInterval(() => readOutbox().length && flush(), RETRY_MS);
    const goOnline = () => { setOnline(true); flush(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [token, flush]);

  // Realtime: dengarkan perubahan data dari server
  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      setLive(true);
      flush();
    });
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => setLive(false));
    socket.on('data:changed', (evt) => {
      if (evt.kind === 'product') queryClient.invalidateQueries({ queryKey: ['products'] });
      else refreshAll();
    });
    return () => socket.disconnect();
  }, [token, flush, refreshAll, queryClient]);

  const value = useMemo(() => ({ pending, syncing, live, online, save, flush }), [pending, syncing, live, online, save, flush]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export const useSync = () => useContext(SyncContext);
