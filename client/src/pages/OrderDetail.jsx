import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useProducts } from '../contexts/ProductsContext.jsx';
import { formatINR, formatDate } from '../utils/format';

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  Delivered: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const PAYMENT_COLORS = {
  Unpaid: 'bg-red-100 text-red-800',
  Partial: 'bg-amber-100 text-amber-800',
  Paid: 'bg-green-100 text-green-800',
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const { applyStockChange, checkStockAvailable } = useProducts();
  const canManage = can('Owner', 'Manager');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const stockWasApplied = (status) => status === 'Confirmed' || status === 'Delivered';

  const changeStatus = async (next) => {
    if (!order) return;
    const goingToApplied = stockWasApplied(next) && !stockWasApplied(order.status);

    if (goingToApplied) {
      const stockError = checkStockAvailable(order.items);
      if (stockError) {
        toast.push(stockError, 'error');
        return;
      }
    }

    setUpdating(true);
    try {
      const { data } = await api.patch(`/orders/${order._id}/status`, { status: next });
      const becameApplied = stockWasApplied(next) && !stockWasApplied(order.status);
      const becameUnapplied = !stockWasApplied(next) && stockWasApplied(order.status);
      if (becameApplied) applyStockChange(order.items, -1);
      if (becameUnapplied) applyStockChange(order.items, +1);
      setOrder(data);
      toast.push(`Order ${next.toLowerCase()}`, 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const updatePayment = async (paymentStatus) => {
    setUpdating(true);
    try {
      const { data } = await api.patch(`/orders/${order._id}/payment`, { paymentStatus });
      setOrder(data);
      toast.push('Payment status updated', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const generateInvoice = async () => {
    setUpdating(true);
    try {
      const { data } = await api.post(`/orders/${order._id}/invoice`);
      setOrder(data);
      toast.push(`Invoice ${data.invoice.number} generated`, 'success');
      navigate(`/orders/${order._id}/invoice`);
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete order',
      message: `Delete order ${order.orderNumber}? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setUpdating(true);
    try {
      if (stockWasApplied(order.status)) {
        applyStockChange(order.items, +1);
      }
      await api.delete(`/orders/${order._id}`);
      toast.push('Order deleted', 'success');
      navigate('/orders');
    } catch (err) {
      toast.push(err.message, 'error');
      setUpdating(false);
    }
  };

  if (loading) return <Loading label="Loading order..." />;
  if (error) {
    return (
      <div className="card border-red-200 bg-red-50 text-red-800 text-sm">
        {error} — <Link to="/orders" className="underline">back to orders</Link>
      </div>
    );
  }
  if (!order) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/orders" className="text-sm text-brand-600 hover:text-brand-700">← Back to orders</Link>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">{order.orderNumber}</h2>
          <p className="text-sm text-slate-500">
            Created {formatDate(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
            {order.status}
          </span>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.paymentStatus]}`}>
            Payment: {order.paymentStatus}
          </span>
          {order.invoice?.number && (
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              Invoice: {order.invoice.number}
            </span>
          )}
        </div>
      </div>

      {(order.invoice?.number || (order.status === 'Confirmed' || order.status === 'Delivered')) && (
        <div className="card flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            {order.invoice?.number ? (
              <>
                <strong>Invoice {order.invoice.number}</strong> generated on {formatDate(order.invoice.date)}
              </>
            ) : (
              <>This order is ready to be invoiced.</>
            )}
          </div>
          <div className="flex gap-2">
            {order.invoice?.number ? (
              <Link to={`/orders/${order._id}/invoice`} className="btn-primary">
                View / Download Invoice
              </Link>
            ) : (
              canManage && (
                <button onClick={generateInvoice} disabled={updating} className="btn-primary">
                  Generate Invoice
                </button>
              )
            )}
          </div>
        </div>
      )}

      {canManage && (
        <div className="card flex flex-wrap gap-2">
          {order.status === 'Draft' && (
            <button onClick={() => changeStatus('Confirmed')} disabled={updating} className="btn-primary">
              Confirm Order
            </button>
          )}
          {order.status === 'Confirmed' && (
            <button onClick={() => changeStatus('Delivered')} disabled={updating} className="btn-primary">
              Mark Delivered
            </button>
          )}
          {(order.status === 'Confirmed' || order.status === 'Delivered' || order.status === 'Draft') && (
            <button onClick={() => changeStatus('Cancelled')} disabled={updating} className="btn-secondary">
              Cancel Order
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-600">Payment:</label>
            <select
              value={order.paymentStatus}
              onChange={(e) => updatePayment(e.target.value)}
              disabled={updating || order.status === 'Cancelled'}
              className="input !py-1 !w-auto !text-sm"
            >
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
            <button
              onClick={remove}
              disabled={updating}
              className="btn-danger !py-1 !px-3 text-xs"
              title="Delete order"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Customer</h3>
          <div className="text-sm space-y-1">
            <div className="font-medium text-slate-900">{order.customerName}</div>
            {order.customerState && <div className="text-slate-600">State: {order.customerState}</div>}
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">GST treatment</h3>
          <div className="text-sm">
            {order.isInterState ? (
              <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Inter-state — IGST charged
              </span>
            ) : (
              <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Intra-state — CGST + SGST
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium text-right">Price</th>
                <th className="px-6 py-3 font-medium text-right">Qty</th>
                <th className="px-6 py-3 font-medium text-right">Line Total</th>
                <th className="px-6 py-3 font-medium text-right">GST</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-900">{it.name}</div>
                    {it.sku && <div className="text-xs text-slate-500 font-mono">SKU: {it.sku}</div>}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-900">{formatINR(it.price)}</td>
                  <td className="px-6 py-3 text-right text-slate-900">{it.quantity}</td>
                  <td className="px-6 py-3 text-right text-slate-900">{formatINR(it.lineTotal)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">
                    {formatINR(it.gstAmount)}
                    <div className="text-xs text-slate-500">@ {it.gstRate}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card max-w-md ml-auto space-y-2 text-sm">
        <Row label="Subtotal" value={formatINR(order.subtotal)} />
        {order.isInterState ? (
          <Row label="IGST" value={formatINR(order.igst)} />
        ) : (
          <>
            <Row label="CGST" value={formatINR(order.cgst)} />
            <Row label="SGST" value={formatINR(order.sgst)} />
          </>
        )}
        <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-100">
          <span className="text-slate-900">Grand Total</span>
          <span className="text-brand-600">{formatINR(order.total)}</span>
        </div>
      </div>

      {order.notes && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}
