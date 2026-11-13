import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Plus, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage, fieldErrors } from '../lib/api';
import {
  Badge, Button, Card, ErrorState, Field, Modal, PageHeader, Segmented, Skeleton, cx,
} from '../components/ui';

export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then((r) => r.data.data.users) });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'KASIR' });
  const [newPassword, setNewPassword] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      toast.success('Akun berhasil dibuat.');
      qc.invalidateQueries({ queryKey: ['users'] });
      setCreating(false);
      setForm({ name: '', username: '', password: '', role: 'KASIR' });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/users/${id}`, body),
    onSuccess: (res) => {
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['users'] });
      setResetting(null);
      setNewPassword('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const fe = fieldErrors(createMut.error);

  return (
    <div>
      <PageHeader title="Pengguna" subtitle="Kelola akun kasir. Kasir hanya bisa input penjualan, kas, dan melihat rekap harian.">
        <Button icon={Plus} onClick={() => { createMut.reset(); setCreating(true); }}>Tambah akun</Button>
      </PageHeader>

      <Card>
        {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} /> : q.isLoading ? (
          <div className="space-y-2 p-5">{[1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {q.data.map((u) => (
              <li key={u.id} className={cx('flex flex-wrap items-center gap-3 px-5 py-3', !u.active && 'opacity-60')}>
                <div className="grid size-10 place-items-center rounded-full bg-brand-100 font-bold text-brand-800">{u.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1 basis-40">
                  <div className="font-semibold">{u.name} {u.id === me.id && <span className="text-sm font-normal text-stone-400">(Anda)</span>}</div>
                  <div className="text-sm text-stone-500">@{u.username}</div>
                </div>
                <Badge tone={u.role === 'OWNER' ? 'brand' : 'stone'}>{u.role === 'OWNER' ? 'Pemilik' : 'Kasir'}</Badge>
                {!u.active && <Badge tone="red">Nonaktif</Badge>}
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" icon={KeyRound} onClick={() => setResetting(u)}>Reset password</Button>
                  {u.id !== me.id && (
                    <Button variant="ghost" size="sm" icon={UserCog} loading={patchMut.isPending && patchMut.variables?.id === u.id} onClick={() => patchMut.mutate({ id: u.id, body: { active: !u.active } })}>
                      {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Tambah akun"
        footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Batal</Button><Button loading={createMut.isPending} onClick={() => createMut.mutate()}>Simpan</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nama" error={fe.name}><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="mis. Kasir Sore" /></Field>
          <Field label="Username" error={fe.username} hint="Huruf kecil/angka, 3–30 karakter, tanpa spasi.">
            <input className="input" autoCapitalize="none" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} />
          </Field>
          <Field label="Password" error={fe.password} hint="Minimal 6 karakter."><input className="input" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></Field>
          <Field label="Peran">
            <Segmented value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} options={[{ value: 'KASIR', label: 'Kasir' }, { value: 'OWNER', label: 'Pemilik' }]} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetting)}
        onClose={() => setResetting(null)}
        title={`Reset password ${resetting?.name || ''}`}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setResetting(null)}>Batal</Button><Button loading={patchMut.isPending} onClick={() => patchMut.mutate({ id: resetting.id, body: { password: newPassword } })}>Simpan</Button></>}
      >
        <Field label="Password baru" hint="Minimal 6 karakter. Sampaikan ke pengguna secara langsung." error={fieldErrors(patchMut.error).password}>
          <input className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
