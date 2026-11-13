import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { rupiah } from '../lib/format';
import { ConfirmDialog } from './ui';

const REASONS = ['Salah input', 'Pelanggan batal', 'Pesanan dobel'];

export default function VoidDialog({ trx, onClose }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.patch(`/transactions/${trx.id}/void`, { reason }),
    onSuccess: () => {
      toast.success(`Transaksi ${trx.code} dibatalkan.`);
      qc.invalidateQueries();
      setReason('');
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const confirm = () => {
    if (reason.trim().length < 3) return setError('Tulis alasan pembatalan (minimal 3 karakter).');
    setError('');
    mutation.mutate();
  };

  return (
    <ConfirmDialog
      open={Boolean(trx)}
      onClose={() => { setError(''); onClose(); }}
      onConfirm={confirm}
      loading={mutation.isPending}
      title="Batalkan transaksi?"
      confirmLabel="Batalkan transaksi"
    >
      {trx && (
        <div className="space-y-3">
          <p className="text-[15px] text-stone-600">
            Transaksi <b>{trx.code}</b> senilai <b>{rupiah(trx.total)}</b> tidak akan dihitung lagi di rekap. Riwayatnya tetap tersimpan.
          </p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" className={`chip py-1 text-xs ${reason === r ? 'chip-active' : ''}`} onClick={() => setReason(r)}>{r}</button>
            ))}
          </div>
          <input className="input" placeholder="Alasan pembatalan" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}
