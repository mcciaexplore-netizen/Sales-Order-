import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Customers from './pages/Customers.jsx';
import Orders from './pages/Orders.jsx';
import NewOrder from './pages/NewOrder.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Invoice from './pages/Invoice.jsx';
import Reports from './pages/Reports.jsx';
import Payments from './pages/Payments.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Loading from './components/Loading.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { useProducts } from './contexts/ProductsContext.jsx';

function NavItem({ to, children, badge, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `w-full px-3 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center justify-between gap-2 ${
          isActive
            ? 'bg-brand-500 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="truncate">{children}</span>
          {badge > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${
                isActive ? 'bg-white text-brand-600' : 'bg-amber-500 text-white'
              }`}
              title={`${badge} low-stock ${badge === 1 ? 'item' : 'items'}`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }) {
  const { user, logout, can } = useAuth();
  const { lowStockCount } = useProducts();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-200">
        {user.business?.logo ? (
          <img src={user.business.logo} alt="" className="h-9 w-9 rounded-md object-contain border border-slate-200" />
        ) : (
          <div className="w-9 h-9 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold">
            S
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">
            {user.business?.name || 'Sales Manager'}
          </h1>
          <p className="text-xs text-slate-500 truncate">{user.name} · {user.role}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavItem to="/" onClick={onNavigate}>Dashboard</NavItem>
        <NavItem to="/customers" onClick={onNavigate}>Customers</NavItem>
        <NavItem to="/products" badge={lowStockCount} onClick={onNavigate}>Products</NavItem>
        <NavItem to="/orders" onClick={onNavigate}>Orders</NavItem>
        <NavItem to="/payments" onClick={onNavigate}>Payments</NavItem>
        <NavItem to="/reports" onClick={onNavigate}>Reports</NavItem>
        {can('Owner') && <NavItem to="/settings" onClick={onNavigate}>Settings</NavItem>}
        {can('Owner') && <NavItem to="/users" onClick={onNavigate}>Team</NavItem>}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-md text-sm text-left text-slate-700 hover:bg-slate-100"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function AppShell({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return children;

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-slate-200 md:bg-white no-print">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 no-print">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Menu
            </button>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {user.business?.name || 'Sales Manager'}
            </div>
            <div className="w-14" />
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-50 md:hidden no-print">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-72 max-w-[85vw] bg-white shadow-xl">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 w-full">{children}</main>
      </div>
    </div>
  );
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading..." />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AppShell>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
          <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PageShell><Dashboard /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <PageShell><Products /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <PageShell><Customers /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <PageShell><Orders /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/new"
            element={
              <ProtectedRoute>
                <PageShell><NewOrder /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <PageShell><OrderDetail /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id/invoice"
            element={
              <ProtectedRoute>
                <Invoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <PageShell><Payments /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <PageShell><Reports /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={['Owner']}>
                <PageShell><Settings /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['Owner']}>
                <PageShell><Users /></PageShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </AppShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
  );
}
