import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  BarChart3, Bot, CalendarDays, CloudOff, Coffee, FileSpreadsheet, LayoutDashboard, LogOut, Menu as MenuIcon,
  Receipt, RefreshCw, ShoppingBag, Users, Wallet, Wifi, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { Spinner, cx } from './ui';

const OWNER_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kasir', label: 'Penjualan', icon: ShoppingBag },
  { to: '/kas', label: 'Pemasukan & Pengeluaran', short: 'Kas', icon: Wallet },
  { to: '/harian', label: 'Rekap Harian', short: 'Harian', icon: CalendarDays },
  { to: '/rekap', label: 'Rekap Periode', short: 'Rekap', icon: BarChart3 },
  { to: '/transaksi', label: 'Riwayat Transaksi', short: 'Transaksi', icon: Receipt },
  { to: '/export', label: 'Export Data', short: 'Export', icon: FileSpreadsheet },
  { to: '/produk', label: 'Menu & Harga', short: 'Menu', icon: Coffee },
  { to: '/pengguna', label: 'Pengguna', icon: Users },
  { to: '/asisten', label: 'Asisten AI', icon: Bot },
];

const KASIR_NAV = [
  { to: '/kasir', label: 'Penjualan', icon: ShoppingBag },
  { to: '/kas', label: 'Pemasukan & Pengeluaran', short: 'Kas', icon: Wallet },
  { to: '/harian', label: 'Rekap Hari Ini', short: 'Rekap', icon: CalendarDays },
];

function SyncStatus({ compact = false }) {
  const { live, online, pending, syncing, flush, mode } = useSync();
  let tone = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let icon = <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>;
  let text = mode === 'polling' ? 'Tersinkron otomatis' : 'Live · tersimpan';

  if (pending > 0) {
    tone = 'bg-amber-50 text-amber-800 border-amber-200';
    icon = syncing ? <RefreshCw className="size-3.5 animate-spin" /> : <CloudOff className="size-3.5" />;
    text = syncing ? `Menyimpan ${pending} data…` : `${pending} data belum terkirim`;
  } else if (syncing) {
    tone = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = <RefreshCw className="size-3.5 animate-spin" />;
    text = 'Menyimpan…';
  } else if (!online || !live) {
    tone = 'bg-stone-100 text-stone-600 border-stone-200';
    icon = online ? <Wifi className="size-3.5" /> : <CloudOff className="size-3.5" />;
    text = online ? 'Menghubungkan…' : 'Offline';
  }

  return (
    <button
      type="button"
      onClick={flush}
      title={pending ? 'Data tersimpan di perangkat ini dan akan dikirim otomatis. Klik untuk coba kirim sekarang.' : mode === 'polling' ? 'Data diperbarui otomatis setiap 15 detik' : 'Terhubung realtime'}
      className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', tone)}
    >
      {icon}
      {!compact || pending ? text : null}
    </button>
  );
}

function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) => cx(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition',
        isActive ? 'bg-brand-700 text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
      )}
    >
      <Icon className="size-5" />
      {item.label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, isOwner } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const nav = isOwner ? OWNER_NAV : KASIR_NAV;
  const bottom = isOwner ? [nav[0], nav[1], nav[2], nav[4]] : nav;
  const current = nav.find((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-white px-3 py-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-700 text-white"><Coffee className="size-5" /></div>
          <div>
            <div className="font-extrabold leading-tight text-stone-900">Coffee Service</div>
            <div className="text-xs text-stone-500">Kasir & Rekap Keuangan</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {nav.map((item) => <NavItem key={item.to} item={item} />)}
        </nav>
        <div className="mt-4 rounded-xl bg-stone-50 p-3">
          <div className="text-sm font-semibold text-stone-800">{user?.name}</div>
          <div className="text-xs text-stone-500">{isOwner ? 'Pemilik' : 'Kasir'} · @{user?.username}</div>
          <button type="button" onClick={logout} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700">
            <LogOut className="size-4" /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-700 text-white"><Coffee className="size-[18px]" /></div>
            <div className="truncate font-bold text-stone-900">{current?.label || 'Coffee Service'}</div>
          </div>
          <div className="hidden text-sm text-stone-500 lg:block">Halo, <span className="font-semibold text-stone-800">{user?.name}</span> 👋</div>
          <div className="flex items-center gap-2">
            <SyncStatus compact />
            <button type="button" onClick={logout} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden" aria-label="Keluar">
              <LogOut className="size-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Bottom nav ponsel */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-safe lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {bottom.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-stone-500')}
              >
                <Icon className="size-[22px]" />
                {item.short || item.label}
              </NavLink>
            );
          })}
          {isOwner && (
            <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold text-stone-500">
              <MenuIcon className="size-[22px]" /> Lainnya
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-safe">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-bold">Menu lainnya</span>
              <button type="button" onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 hover:bg-stone-100" aria-label="Tutup"><X className="size-5" /></button>
            </div>
            <div className="grid gap-1">
              {nav.filter((n) => !bottom.includes(n)).map((item) => <NavItem key={item.to} item={item} onClick={() => setMoreOpen(false)} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
