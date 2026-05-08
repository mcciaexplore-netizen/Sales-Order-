import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Combobox from '../components/Combobox.jsx';
import Loading from '../components/Loading.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useProducts } from '../contexts/ProductsContext.jsx';
import { formatINR } from '../utils/format';

const round2 = (n) => Math.round(n * 100) / 100;

export default function NewOrder() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { products, applyStockChange, checkStockAvailable } = useProducts();
  const businessState = user?.business?.state || '';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.get('/customers')
      .then((res) => mounted && setCustomers(res.data))
      .catch((err) => mounted && toast.push(err.message, 'error'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const customer = customers.find((c) => c._id === customerId);
  const isInterState = useMemo(() => {
    if (!customer || !customer.state || !businessState) return false;
    return customer.state.trim().toLowerCase() !== businessState.trim().toLowerCase();
  }, [customer, businessState]);

  const enrichedItems = useMemo(() =>
    items.map((it) => {
      const product = products.find((p) => p.id === it.productId);
      const quantity = Number(it.quantity) || 0;
      if (!product) {
        return { ...it, product: null, lineTotal: 0, gstAmount: 0 };
      }
      const lineTotal = round2(product.sellingPrice * quantity);
      const gstAmount = round2(lineTotal * (product.gstRate / 100));
      return { ...it, product, lineTotal, gstAmount };
    }),
    [items, products]
  );

  const totals = useMemo(() => {
    const subtotal = round2(enrichedItems.reduce((s, it) => s + it.lineTotal, 0));
    const totalGst = round2(enrichedItems.reduce((s, it) => s + it.gstAmount, 0));
    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = totalGst;
    } else {
      cgst = round2(totalGst / 2);
      sgst = round2(totalGst - cgst);
    }
    const total = round2(subtotal + totalGst);
    return { subtotal, cgst, sgst, igst, totalGst, total };
  }, [enrichedItems, isInterState]);

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems([...items, { productId: '', quantity: 1 }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const buildPayload = () => {
    if (!customerId) {
      toast.push('Please select a customer', 'error');
      return null;
    }
    const valid = enrichedItems.filter((it) => it.product && Number(it.quantity) > 0);
    if (valid.length === 0) {
      toast.push('Please add at least one item with a product and quantity', 'error');
      return null;
    }
    return {
      customerId,
      notes,
      items: valid.map((it) => ({
        productId: it.product.id,
        sku: it.product.sku,
        hsnCode: it.product.hsnCode || '',
        unit: it.product.unit || '',
        name: it.product.name,
        price: it.product.sellingPrice,
        gstRate: it.product.gstRate,
        quantity: Number(it.quantity),
      })),
    };
  };

  const submit = async (status) => {
    const payload = buildPayload();
    if (!payload) return;

    if (status === 'Confirmed') {
      const stockError = checkStockAvailable(payload.items);
      if (stockError) {
        toast.push(stockError, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: order } = await api.post('/orders', { ...payload, status });
      if (status === 'Confirmed') {
        applyStockChange(payload.items, -1);
      }
      toast.push(
        status === 'Confirmed'
          ? `Order ${order.orderNumber} confirmed`
          : `Draft ${order.orderNumber} saved`,
        'success'
      );
      navigate(`/orders/${order._id}`);
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading order setup..." />;

  if (products.length === 0 || customers.length === 0) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Setup needed</h3>
        <p className="text-slate-600 mb-4">
          You need at least one {products.length === 0 ? 'product' : 'customer'} before creating an order.
        </p>
        <div className="flex gap-2 justify-center">
          {products.length === 0 && <Link to="/products" className="btn-primary">Add Products</Link>}
          {customers.length === 0 && <Link to="/customers" className="btn-primary">Add Customers</Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">New Order</h2>
        <p className="text-sm text-slate-500">Create a new sales order</p>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-900">Customer</h3>
        <div>
          <label className="label">Search and select a customer</label>
          <Combobox
            options={customers}
            value={customerId}
            onChange={setCustomerId}
            getValue={(c) => c._id}
            getLabel={(c) => `${c.name} — ${c.phone}${c.state ? ` (${c.state})` : ''}`}
            getSearchText={(c) => `${c.name} ${c.phone} ${c.email || ''} ${c.state || ''}`}
            placeholder="Type a name, phone, or state..."
            emptyText="No customers match"
          />
        </div>
        {customer && (
          <div className="text-sm text-slate-600 px-3 py-2 bg-slate-50 rounded-md">
            <div><strong>{customer.name}</strong> — {customer.phone}</div>
            {customer.email && <div className="text-xs">{customer.email}</div>}
            {customer.address && <div className="text-xs">{customer.address}</div>}
            {customer.state && (
              <div className="text-xs mt-1">
                State: {customer.state}
                {businessState && (
                  <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    isInterState ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isInterState ? 'Inter-state — IGST' : 'Intra-state — CGST + SGST'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Items</h3>
          <button type="button" onClick={addItem} className="btn-secondary !py-1 !px-3 text-xs">+ Add Item</button>
        </div>

        <div className="space-y-3">
          {enrichedItems.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-start pb-3 border-b border-slate-100 last:border-0">
              <div className="col-span-12 sm:col-span-5">
                <label className="label">Product</label>
                <Combobox
                  options={products}
                  value={it.productId}
                  onChange={(val) => updateItem(idx, { productId: val })}
                  getValue={(p) => p.id}
                  getLabel={(p) => `${p.name} — ${formatINR(p.sellingPrice)} • ${p.gstRate}% GST • stock: ${p.stock}`}
                  getSearchText={(p) => `${p.name} ${p.sku} ${p.category}`}
                  placeholder="Type a product name, SKU, or category..."
                  emptyText="No products match"
                  isDisabled={(p) => p.stock === 0}
                />
                {it.product && (
                  <div className="text-xs text-slate-500 mt-1">
                    SKU: {it.product.sku} · Stock: {it.product.stock} {it.product.unit.toLowerCase()}
                    {it.product.stock < Number(it.quantity || 0) && (
                      <span className="ml-2 text-red-600 font-medium">⚠ Exceeds available stock</span>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="label">Price</label>
                <div className="input bg-slate-50 text-slate-700">
                  {it.product ? formatINR(it.product.sellingPrice) : '—'}
                </div>
              </div>
              <div className="col-span-3 sm:col-span-1">
                <label className="label">GST</label>
                <div className="input bg-slate-50 text-slate-700">
                  {it.product ? `${it.product.gstRate}%` : '—'}
                </div>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <label className="label">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  className="input"
                />
              </div>
              <div className="col-span-1 sm:col-span-1 text-right">
                <label className="label">&nbsp;</label>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="btn-danger !py-1 !px-2 text-xs w-full"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="col-span-12 sm:col-span-1 text-right text-sm">
                <label className="label hidden sm:block">Subtotal</label>
                <div className="text-slate-900 font-medium pt-2">{formatINR(it.lineTotal)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-900">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input"
          rows="2"
          placeholder="Optional notes for this order"
        />
      </div>

      <div className="card space-y-2 text-sm">
        <h3 className="font-semibold text-slate-900 mb-2">Totals</h3>
        <Row label="Subtotal" value={formatINR(totals.subtotal)} />
        {isInterState ? (
          <Row label="IGST" value={formatINR(totals.igst)} />
        ) : (
          <>
            <Row label="CGST" value={formatINR(totals.cgst)} />
            <Row label="SGST" value={formatINR(totals.sgst)} />
          </>
        )}
        <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-100">
          <span className="text-slate-900">Grand Total</span>
          <span className="text-brand-600">{formatINR(totals.total)}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => navigate('/orders')} className="btn-secondary">Cancel</button>
        <button
          type="button"
          onClick={() => submit('Draft')}
          disabled={submitting}
          className="btn-secondary"
        >
          {submitting ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          type="button"
          onClick={() => submit('Confirmed')}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? 'Saving...' : 'Save & Confirm'}
        </button>
      </div>
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
