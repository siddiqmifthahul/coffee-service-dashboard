import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors } from '../lib/api';
import { Button, Field, cx } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!form.username.trim()) local.username = 'Username wajib diisi';
    if (!form.password) local.password = 'Password wajib diisi';
    setErrors(local);
    if (Object.keys(local).length) return;
    setLoading(true);
    setError('');
    try {
      await login(form.username.trim(), form.password);
      navigate('/', { replace: true }); // diarahkan ke halaman utama sesuai peran
    } catch (err) {
      setError(errorMessage(err));
      setErrors(fieldErrors(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-100 via-brand-50 to-[#f7f5f2] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-brand-700 text-white shadow-lg shadow-brand-700/20">
            <Coffee className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-stone-900">Coffee Service</h1>
          <p className="mt-1 text-sm text-stone-500">Kasir & rekap keuangan harian</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
          {error && <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700" role="alert">{error}</div>}
          <Field label="Username" error={errors.username} htmlFor="username">
            <input
              id="username"
              className={cx('input', errors.username && 'input-error')}
              autoComplete="username"
              autoCapitalize="none"
              value={form.username}
              onChange={(e) => { setForm((f) => ({ ...f, username: e.target.value })); setErrors((er) => ({ ...er, username: undefined })); }}
              placeholder="mis. kasir"
            />
          </Field>
          <Field label="Password" error={errors.password} htmlFor="password">
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                className={cx('input pr-11', errors.password && 'input-error')}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setErrors((er) => ({ ...er, password: undefined })); }}
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-400 hover:text-stone-700" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>{loading ? 'Masuk…' : 'Masuk'}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-stone-500">Akun demo: <b>owner</b> / owner123 · <b>kasir</b> / kasir123</p>
      </div>
    </div>
  );
}
