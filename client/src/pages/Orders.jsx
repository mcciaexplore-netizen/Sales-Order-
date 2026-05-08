import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading.jsx';
import { formatINR, formatDate } from '../utils/format';

const STATUSES = ['Draft', 'Confirmed', 'Delivered', 'Cancelled'];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  Delivered: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const PAYMENT_COLORS = {
  Unpaid: 'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
  Paid: 'bg-green-100 text-green-700',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get('/orders'), api.get('/customers')])
      .then(([o, c]) => {
        if (!mounted) return;
        setOrders(o.data);
        setCustomers(c.data);
        setError('');
      })
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;
    return orders.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (customerFilter !== 'All' && String(o.customer) !== customerFilter) return false;
      const created = new Date(o.createdAt);
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;
      return true;
    });
  }, [orders, statusFilter, customerFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setStatusFilter('All');
    setCustomerFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = statusFilter !== 'All' || customerFilter !== 'All' || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Orders</h2>
          <p className="text-sm text-slate-500">View and manage all sales orders</p>
        </div>
        <Link to="/orders/new" className="btn-primary">+ New Order</Link>
      </div>

      <div className="card !p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
              <option value="All">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Customer</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="input">
              <option value="All">All customers</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">To date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
          </div>
        </div>
        {hasFilters && (
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-500">
              Showing {filtered.length} of {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </div>
            <button onClick={clearFilters} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6"><Loading label="Loading orders..." /></div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No orders yet. <Link to="/orders/new" className="text-brand-600">Create your first order</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No orders match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-6 py-3 font-medium">Order #</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Items</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o._id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.assign(`/orders/${o._id}`)}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      <Link
                        to={`/orders/${o._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-600 hover:text-brand-700"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{o.customerName}</div>
                      {o.customerState && <div className="text-xs text-slate-500">{o.customerState}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{o.items.length}</td>
                    <td className="px-6 py-4 text-slate-900 font-medium">{formatINR(o.total)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[o.paymentStatus]}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
