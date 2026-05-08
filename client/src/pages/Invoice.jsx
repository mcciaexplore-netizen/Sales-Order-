import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { formatINR } from '../utils/format';
import { numberToIndianWords } from '../utils/numberToWords';

const formatInvoiceDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Invoice() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get(`/orders/${id}`)
      .then((res) => mounted && setOrder(res.data))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="p-8 text-slate-500">Loading invoice...</div>;
  if (error) {
    return (
      <div className="p-8">
        <div className="card border-red-200 bg-red-50 text-red-800 text-sm max-w-xl">
          {error} — <Link to="/orders" className="underline">back to orders</Link>
        </div>
      </div>
    );
  }
  if (!order) return null;

  if (!order.invoice || !order.invoice.number) {
    return (
      <div className="p-8 max-w-xl">
        <div className="card border-amber-200 bg-amber-50 text-amber-900">
          No invoice has been generated for this order yet.
          <div className="mt-3">
            <Link to={`/orders/${order._id}`} className="btn-primary">
              Go to order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inv = order.invoice;
  const isInterState = order.isInterState;

  return (
    <div className="bg-slate-100 min-h-screen py-6">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-4">
        <Link to={`/orders/${order._id}`} className="text-sm text-brand-600 hover:text-brand-700">
          ← Back to order
        </Link>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-primary">
            Download PDF
          </button>
        </div>
      </div>

      <div
        className="invoice-paper bg-white mx-auto shadow-lg"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm',
          color: '#111827',
          fontSize: '12px',
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div className="flex items-start gap-4">
            {inv.business.logo && (
              <img
                src={inv.business.logo}
                alt={`${inv.business.name} logo`}
                className="w-16 h-16 object-contain border border-slate-200 rounded-md"
              />
            )}
            <div>
              <div className="text-2xl font-bold text-slate-900">{inv.business.name}</div>
              {inv.business.address && (
                <div className="text-slate-700 mt-1 whitespace-pre-line max-w-md">{inv.business.address}</div>
              )}
              <div className="text-slate-700 mt-1 space-x-3">
                {inv.business.phone && <span>Phone: {inv.business.phone}</span>}
                {inv.business.email && <span>Email: {inv.business.email}</span>}
                {inv.business.state && <span>State: {inv.business.state}</span>}
              </div>
              {inv.business.gstNumber && (
                <div className="text-slate-700 mt-1">
                  <strong>GSTIN:</strong> {inv.business.gstNumber}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide text-slate-900">TAX INVOICE</div>
            <div className="text-xs text-slate-500 mt-1">Original for Recipient</div>
          </div>
        </div>

        {/* Invoice meta */}
        <div className="grid grid-cols-3 gap-4 mt-4 text-xs">
          <Cell label="Invoice No.">{inv.number}</Cell>
          <Cell label="Invoice Date">{formatInvoiceDate(inv.date)}</Cell>
          <Cell label="Place of Supply">{inv.placeOfSupply || '—'}</Cell>
          <Cell label="Order No.">{order.orderNumber}</Cell>
          <Cell label="Order Status">{order.status}</Cell>
          <Cell label="Payment Status">{order.paymentStatus}</Cell>
        </div>

        {/* Bill To */}
        <div className="mt-4 border border-slate-300 rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Bill To</div>
          <div className="font-semibold text-slate-900">{inv.customer.name}</div>
          {inv.customer.address && (
            <div className="text-slate-700 whitespace-pre-line">{inv.customer.address}</div>
          )}
          <div className="text-slate-700">
            {[inv.customer.city, inv.customer.state].filter(Boolean).join(', ')}
          </div>
          <div className="text-slate-700 mt-1 space-x-3">
            {inv.customer.phone && <span>Phone: {inv.customer.phone}</span>}
            {inv.customer.email && <span>Email: {inv.customer.email}</span>}
          </div>
          {inv.customer.gstin && (
            <div className="text-slate-700 mt-1">
              <strong>GSTIN:</strong> {inv.customer.gstin}
            </div>
          )}
        </div>

        {/* Items */}
        <table className="w-full mt-4 border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border border-slate-300">
              <Th className="w-8 text-center">#</Th>
              <Th>Description</Th>
              <Th className="w-16">HSN</Th>
              <Th className="w-16 text-right">Qty</Th>
              <Th className="w-20 text-right">Rate</Th>
              <Th className="w-24 text-right">Taxable</Th>
              {isInterState ? (
                <Th className="w-24 text-right" colSpan={2}>IGST</Th>
              ) : (
                <>
                  <Th className="w-20 text-right" colSpan={2}>CGST</Th>
                  <Th className="w-20 text-right" colSpan={2}>SGST</Th>
                </>
              )}
              <Th className="w-24 text-right">Total</Th>
            </tr>
            <tr className="bg-slate-50 border border-slate-300 text-[10px] text-slate-600">
              <Th></Th>
              <Th></Th>
              <Th></Th>
              <Th></Th>
              <Th></Th>
              <Th></Th>
              {isInterState ? (
                <>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Amount</Th>
                </>
              ) : (
                <>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Amount</Th>
                </>
              )}
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, idx) => {
              const halfRate = it.gstRate / 2;
              const halfAmount = it.gstAmount / 2;
              const lineTotalWithGst = it.lineTotal + it.gstAmount;
              return (
                <tr key={idx} className="border border-slate-300">
                  <Td className="text-center">{idx + 1}</Td>
                  <Td>
                    <div className="font-medium">{it.name}</div>
                    {it.sku && <div className="text-[10px] text-slate-500">SKU: {it.sku}</div>}
                  </Td>
                  <Td>{it.hsnCode || '—'}</Td>
                  <Td className="text-right">{it.quantity}{it.unit ? ` ${it.unit.toLowerCase().slice(0, 3)}` : ''}</Td>
                  <Td className="text-right">{formatINR(it.price)}</Td>
                  <Td className="text-right">{formatINR(it.lineTotal)}</Td>
                  {isInterState ? (
                    <>
                      <Td className="text-right">{it.gstRate}%</Td>
                      <Td className="text-right">{formatINR(it.gstAmount)}</Td>
                    </>
                  ) : (
                    <>
                      <Td className="text-right">{halfRate}%</Td>
                      <Td className="text-right">{formatINR(halfAmount)}</Td>
                      <Td className="text-right">{halfRate}%</Td>
                      <Td className="text-right">{formatINR(halfAmount)}</Td>
                    </>
                  )}
                  <Td className="text-right font-medium">{formatINR(lineTotalWithGst)}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border border-slate-300 bg-slate-50 font-semibold">
              <Td colSpan={5} className="text-right">Total</Td>
              <Td className="text-right">{formatINR(order.subtotal)}</Td>
              {isInterState ? (
                <>
                  <Td></Td>
                  <Td className="text-right">{formatINR(order.igst)}</Td>
                </>
              ) : (
                <>
                  <Td></Td>
                  <Td className="text-right">{formatINR(order.cgst)}</Td>
                  <Td></Td>
                  <Td className="text-right">{formatINR(order.sgst)}</Td>
                </>
              )}
              <Td className="text-right">{formatINR(order.total)}</Td>
            </tr>
          </tfoot>
        </table>

        {/* Totals summary */}
        <div className="flex justify-end mt-4">
          <div className="w-72 text-xs border border-slate-300">
            <Row label="Total Taxable Value" value={formatINR(order.subtotal)} />
            {isInterState ? (
              <Row label="IGST" value={formatINR(order.igst)} />
            ) : (
              <>
                <Row label="CGST" value={formatINR(order.cgst)} />
                <Row label="SGST" value={formatINR(order.sgst)} />
              </>
            )}
            <Row label="Total Tax" value={formatINR(order.totalGst)} />
            <Row label="Grand Total" value={formatINR(order.total)} bold />
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-4 border border-slate-300 rounded p-3 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Amount in Words</div>
          <div className="font-medium">{numberToIndianWords(order.total)}</div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-3 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Notes</div>
            <div className="whitespace-pre-wrap">{order.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Declaration</div>
            <p className="text-slate-700">
              We declare that this invoice shows the actual price of the goods described and that all
              particulars are true and correct.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">For {inv.business.name}</div>
            <div className="h-16" />
            <div className="border-t border-slate-400 inline-block px-6 pt-1">
              Authorised Signature
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-500">
          This is a computer-generated invoice.
        </div>
      </div>
    </div>
  );
}

function Cell({ label, children }) {
  return (
    <div className="border border-slate-300 rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-medium text-slate-900">{children}</div>
    </div>
  );
}

function Th({ children, className = '', colSpan }) {
  return (
    <th colSpan={colSpan} className={`border border-slate-300 px-2 py-1.5 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '', colSpan }) {
  return (
    <td colSpan={colSpan} className={`border border-slate-300 px-2 py-1.5 align-top ${className}`}>
      {children}
    </td>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between px-3 py-1.5 border-b border-slate-200 last:border-0 ${bold ? 'font-bold bg-slate-50' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
