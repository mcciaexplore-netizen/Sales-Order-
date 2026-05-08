import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading.jsx';
import { useProducts } from '../contexts/ProductsContext.jsx';
import { formatINR, formatDate } from '../utils/format';

function StatCard({ label, value, accent }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent || 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

function SalesLineChart({ data }) {
  const points = useMemo(() => {
    const width = 720;
    const height = 220;
    const padX = 28;
    const padY = 24;
    const max = Math.max(...data.map((d) => d.totalSales), 0);
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    return data.map((d, index) => {
      const x = data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * usableW;
      const y = max === 0 ? height - padY : padY + usableH - (d.totalSales / max) * usableH;
      return { ...d, x, y };
    });
  }, [data]);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} 196 L ${points[0].x} 196 Z`
    : '';
  const maxValue = Math.max(...data.map((d) => d.totalSales), 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Sales - Last 30 Days</h3>
          <p className="text-sm text-slate-500">Confirmed and delivered orders only</p>
        </div>
        <div className="text-sm font-medium text-slate-700">Peak: {formatINR(maxValue)}</div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 720 220" className="min-w-[640px] w-full h-64" role="img" aria-label="Sales line chart">
          <defs>
            <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((n) => {
            const y = 24 + n * 48;
            return <line key={n} x1="28" x2="692" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
          })}
          {areaPath && <path d={areaPath} fill="url(#salesArea)" />}
          {linePath && <path d={linePath} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((p, index) => (
            <circle key={p.date} cx={p.x} cy={p.y} r={index === points.length - 1 ? 4 : 3} fill="#0f766e">
              <title>{`${p.date}: ${formatINR(p.totalSales)}`}</title>
            </circle>
          ))}
          {points[0] && (
            <text x="28" y="216" fill="#64748b" fontSize="12">{formatDate(points[0].date)}</text>
          )}
          {points[points.length - 1] && (
            <text x="692" y="216" fill="#64748b" fontSize="12" textAnchor="end">{formatDate(points[points.length - 1].date)}</text>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { lowStockCount } = useProducts();
  const [summary, setSummary] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get('/orders/summary'), api.get('/orders')])
      .then(([s, o]) => {
        if (!mounted) return;
        setSummary(s.data);
        setRecentOrders(o.data.slice(0, 5));
      })
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">Performance overview for the business owner</p>
        </div>
        <Link to="/orders/new" className="btn-primary shrink-0">+ New Order</Link>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <Loading label="Loading dashboard..." />
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Today's Sales" value={formatINR(summary.todaySales)} accent="text-teal-700" />
            <StatCard label="This Month's Sales" value={formatINR(summary.monthSales)} accent="text-brand-600" />
            <StatCard label="Total Outstanding" value={formatINR(summary.unpaidAmount || 0)} accent="text-red-600" />
            <StatCard
              label="Low-Stock Products"
              value={lowStockCount}
              accent={lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}
            />
          </div>

          <SalesLineChart data={summary.salesLast30Days || []} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopCustomersTable customers={summary.topCustomersLast30Days || []} />
            <TopProductsTable products={summary.topProductsLast30Days || []} />
          </div>

          <RecentOrdersTable orders={recentOrders} />
        </>
      ) : null}
    </div>
  );
}

function TopCustomersTable({ customers }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Customers - Last 30 Days</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4 font-medium">Customer</th>
              <th className="py-2 pr-4 font-medium text-right">Orders</th>
              <th className="py-2 font-medium text-right">Purchase Value</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? <EmptyRow colSpan={3}>No sales in this period.</EmptyRow> : customers.map((c) => (
              <tr key={c.customerId} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-4 font-medium text-slate-900">{c.customerName}</td>
                <td className="py-3 pr-4 text-right text-slate-600">{c.orderCount}</td>
                <td className="py-3 text-right font-medium text-slate-900">{formatINR(c.totalPurchase)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopProductsTable({ products }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Best-Selling Products - Last 30 Days</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4 font-medium">Product</th>
              <th className="py-2 pr-4 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? <EmptyRow colSpan={3}>No products sold in this period.</EmptyRow> : products.map((p) => (
              <tr key={p.productId} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-4">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  {p.sku && <div className="text-xs text-slate-500">{p.sku}</div>}
                </td>
                <td className="py-3 pr-4 text-right text-slate-600">{p.quantity}</td>
                <td className="py-3 text-right font-medium text-slate-900">{formatINR(p.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentOrdersTable({ orders }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Recent Orders</h3>
        <Link to="/orders" className="text-sm text-brand-600 hover:text-brand-700">View all</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4 font-medium">Order</th>
              <th className="py-2 pr-4 font-medium">Customer</th>
              <th className="py-2 pr-4 font-medium text-right">Total</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? <EmptyRow colSpan={5}>No orders yet.</EmptyRow> : orders.map((o) => (
              <tr key={o._id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-4 font-medium text-brand-700">
                  <Link to={`/orders/${o._id}`}>{o.orderNumber}</Link>
                </td>
                <td className="py-3 pr-4 text-slate-900">{o.customerName}</td>
                <td className="py-3 pr-4 text-right font-medium text-slate-900">{formatINR(o.total)}</td>
                <td className="py-3 pr-4"><StatusBadge status={o.status} /></td>
                <td className="py-3 text-slate-500">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Draft: 'bg-slate-100 text-slate-800',
    Confirmed: 'bg-blue-100 text-blue-800',
    Delivered: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}
