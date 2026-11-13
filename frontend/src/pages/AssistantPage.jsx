import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Loader2, Send } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Badge, Card, PageHeader, cx } from '../components/ui';

const SUGGESTIONS = [
  'Berapa penjualan hari ini?',
  'Menu apa yang paling laris bulan ini?',
  'Pengeluaran terbesar bulan ini apa?',
  'Beri saran untuk menaikkan penjualan',
];

const INTENT_LABEL = {
  tanya_penjualan: 'Penjualan',
  tanya_produk: 'Produk',
  minta_saran: 'Saran',
  keluhan: 'Keluhan',
  di_luar_konteks: 'Di luar konteks',
};

export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  const history = useQuery({
    queryKey: ['ai-history'],
    queryFn: () => api.get('/ai/history', { params: { type: 'chat', limit: 20 } }).then((r) => r.data.data.logs),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (history.data && !messages.length) {
      setMessages(history.data.flatMap((l) => [
        { role: 'user', text: l.request?.message },
        { role: 'bot', text: l.response?.reply || 'Layanan AI tidak tersedia saat itu.', intent: l.response?.intent, fallback: l.isFallback },
      ]).filter((m) => m.text));
    }
  }, [history.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const mut = useMutation({
    mutationFn: (message) => api.post('/ai/chat', { message }).then((r) => r.data.data),
    onSuccess: (d) => setMessages((m) => [...m, d.available
      ? { role: 'bot', text: d.reply, intent: d.intent, fallback: d.is_fallback, escalate: d.escalate }
      : { role: 'bot', text: d.message, error: true }]),
    onError: (err) => setMessages((m) => [...m, { role: 'bot', text: errorMessage(err), error: true }]),
  });

  const send = (text) => {
    const msg = (text ?? input).trim();
    if (!msg || mut.isPending) return;
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setInput('');
    mut.mutate(msg);
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col lg:h-[calc(100dvh-8rem)]">
      <PageHeader title="Asisten AI" subtitle="Tanya seputar penjualan, menu, dan keuangan Coffee Service." />
      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!messages.length && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 rounded-2xl bg-brand-50 p-3 text-brand-700"><Bot className="size-7" /></div>
              <p className="font-semibold">Halo! Ada yang ingin ditanyakan?</p>
              <p className="mt-1 max-w-sm text-sm text-stone-500">Asisten membaca data penjualan hari ini & bulan ini. Pertanyaan di luar usaha akan ditolak dengan sopan.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cx(
                'max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
                m.role === 'user' ? 'rounded-br-md bg-brand-700 text-white' : m.error ? 'rounded-bl-md bg-amber-50 text-amber-900' : 'rounded-bl-md bg-stone-100 text-stone-800',
              )}>
                {m.text}
                {m.role === 'bot' && (m.intent || m.fallback) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.intent && <Badge tone="stone" className="bg-white">{INTENT_LABEL[m.intent] || m.intent}</Badge>}
                    {m.fallback && <Badge tone="amber">Mode cadangan</Badge>}
                    {m.escalate && <Badge tone="red">Diteruskan ke pemilik</Badge>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {mut.isPending && (
            <div className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="size-4 animate-spin" /> Asisten sedang mengetik…</div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-stone-100 p-3">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip shrink-0 py-1 text-xs" onClick={() => send(s)} disabled={mut.isPending}>{s}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <input className="input" placeholder="Tulis pertanyaan…" value={input} maxLength={500} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" disabled={!input.trim() || mut.isPending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white disabled:bg-brand-300" aria-label="Kirim">
              <Send className="size-5" />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
