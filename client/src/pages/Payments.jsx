import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDate, formatINR } from '../utils/format';

const PAYMENT_COLORS = {
  Unpaid: 'bg-red-100 text-red-800',
  Partial: 'bg-amber-100 text-amber-800',
  Paid: 'bg-green-100 text-green-800',
};

export default function Payments() {
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can('Owner', 'Manager');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.filter((order) => order.status !== 'Draft' && order.status !== 'Cancelled'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (
    filter === 'All' ? orders : orders.filter((order) => order.paymentStatus === filter)
  ), [orders, filter]);

  const totals = useMemo(() => {
    const outstanding = orders
      .filter((order) => order.paymentStatus !== 'Paid')
      .reduce((sum, order) => sum + order.total, 0);
    const paid = orders
      .filter((order) => order.paymentStatus === 'Paid')
      .reduce((sum, order) => sum + order.total, 0);
    return { outstanding, paid };
  }, [orders]);

  const updatePayment = async (order, paymentStatus) => {
    setUpdatingId(order._id);
    try {
      const { data } = await api.patch(`/orders/${order._id}/payment`, { paymentStatus });
      setOrders((current) => current.map((o) => (o._id === order._id ? data : o)));
      toast.push('Payment status updated', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Payments</h2>
          <p className="text-sm text-slate-500">Track payment status for active orders</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input sm:!w-48">
          <option value="All">All payments</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Partial">Partial</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Outstanding</div>
          <div className="mt-2 text-2xl font-bold text-red-600">{formatINR(totals.outstanding)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Paid Orders Value</div>
          <div className="mt-2 text-2xl font-bold text-green-700">{formatINR(totals.paid)}</div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6"><Loading label="Loading payments..." /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No payments match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-6 py-3 font-medium">Order</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4 font-medium text-brand-700">
                      <Link to={`/orders/${order._id}`}>{order.orderNumber}</Link>
                    </td>
                    <td className="px-6 py-4 text-slate-900">{order.customerName}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">{formatINR(order.total)}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      {canManage ? (
                        <select
                          value={order.paymentStatus}
                          disabled={updatingId === order._id}
                          onChange={(e) => updatePayment(order, e.target.value)}
                          className="input !py-1 !w-32"
                        >
                          <option value="Unpaid">Unpaid</option>
                          <option value="Partial">Partial</option>
                          <option value="Paid">Paid</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.paymentStatus]}`}>
                          {order.paymentStatus}
                        </span>
                      )}
                    </td>
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
