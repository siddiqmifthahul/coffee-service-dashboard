import { useEffect } from 'react';
import { AlertCircle, Inbox, Loader2, RotateCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { pct } from '../lib/format';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-stone-600 hover:bg-stone-100 disabled:text-stone-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
};
const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-14 px-6 text-base gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, icon: Icon, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return <div className={cx('card', className)} {...props}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-stone-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="label">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-red-600"><AlertCircle className="size-4" />{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-stone-200/70', className)} />;
}

export function Spinner({ label = 'Memuat…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 rounded-2xl bg-brand-50 p-3 text-brand-600"><Icon className="size-6" /></div>
      <p className="font-semibold text-stone-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 rounded-2xl bg-red-50 p-3 text-red-600"><AlertCircle className="size-6" /></div>
      <p className="font-semibold text-stone-800">Gagal memuat data</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={RotateCw} onClick={onRetry}>Coba lagi</Button>
      )}
    </div>
  );
}

export function Badge({ tone = 'stone', children, className }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    brand: 'bg-brand-100 text-brand-800',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
    blue: 'bg-blue-50 text-blue-700',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

/** Perubahan vs periode sebelumnya. inverse=true untuk metrik yang lebih baik jika turun (pengeluaran) */
export function Delta({ value, inverse = false }) {
  if (value === null || value === undefined) return <span className="text-xs text-stone-400">— vs periode lalu</span>;
  const up = value > 0;
  const good = value === 0 ? null : inverse ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-semibold', good === null ? 'text-stone-500' : good ? 'text-emerald-700' : 'text-red-600')}>
      {value !== 0 && <Icon className="size-3.5" />}
      {pct(value)} <span className="font-normal text-stone-400">vs periode lalu</span>
    </span>
  );
}

export function StatCard({ label, value, delta, inverse, hint, icon: Icon, accent, loading }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
        {Icon && <Icon className={cx('size-4', accent || 'text-stone-400')} />}
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <div className="tabular mt-1.5 text-[22px] font-extrabold tracking-tight text-stone-900 sm:text-2xl">{value}</div>
      )}
      <div className="mt-1 min-h-4">
        {delta !== undefined ? <Delta value={delta} inverse={inverse} /> : hint ? <span className="text-xs text-stone-500">{hint}</span> : null}
      </div>
    </Card>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl', widths[size])}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
          <h3 className="text-lg font-bold text-stone-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-stone-100 bg-white px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Ya, lanjutkan', variant = 'danger', loading, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      {message && <p className="text-[15px] text-stone-600">{message}</p>}
      {children}
    </Modal>
  );
}

export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-stone-100 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition whitespace-nowrap',
            value === o.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
