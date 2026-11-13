import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';
import CashPage from './pages/CashPage';
import DailyPage from './pages/DailyPage';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RecapPage = lazy(() => import('./pages/RecapPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));

function OwnerOnly({ children }) {
  const { isOwner } = useAuth();
  return isOwner ? children : <Navigate to="/kasir" replace />;
}

export default function App() {
  const { user, loading, isOwner } = useAuth();

  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner label="Membuka aplikasi…" /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const home = isOwner ? '/dashboard' : '/kasir';
  return (
    <SyncProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/kasir" element={<PosPage />} />
          <Route path="/kas" element={<CashPage />} />
          <Route path="/harian" element={<DailyPage />} />
          <Route path="/dashboard" element={<OwnerOnly><DashboardPage /></OwnerOnly>} />
          <Route path="/rekap" element={<OwnerOnly><RecapPage /></OwnerOnly>} />
          <Route path="/transaksi" element={<OwnerOnly><TransactionsPage /></OwnerOnly>} />
          <Route path="/export" element={<OwnerOnly><ExportPage /></OwnerOnly>} />
          <Route path="/produk" element={<OwnerOnly><ProductsPage /></OwnerOnly>} />
          <Route path="/pengguna" element={<OwnerOnly><UsersPage /></OwnerOnly>} />
          <Route path="/asisten" element={<OwnerOnly><AssistantPage /></OwnerOnly>} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Route>
      </Routes>
    </SyncProvider>
  );
}
