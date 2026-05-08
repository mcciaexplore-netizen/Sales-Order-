import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useProducts, UNITS, GST_RATES } from '../contexts/ProductsContext.jsx';
import { formatINR } from '../utils/format';

const blank = {
  name: '',
  sku: '',
  category: '',
  hsnCode: '',
  description: '',
  unit: 'Pieces',
  purchasePrice: '',
  sellingPrice: '',
  gstRate: 18,
  stock: '',
  lowStockAlert: '5',
};

export default function Products() {
  const { products, categories, create, update, remove, lowStockCount } = useProducts();
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const canEdit = can('Owner', 'Manager');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');

  const update_ = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openCreate = () => {
    setForm(blank);
    setEditingId(null);
    setFormError('');
    setOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      hsnCode: p.hsnCode || '',
      description: p.description || '',
      unit: p.unit,
      purchasePrice: String(p.purchasePrice ?? ''),
      sellingPrice: String(p.sellingPrice ?? ''),
      gstRate: p.gstRate,
      stock: String(p.stock ?? ''),
      lowStockAlert: String(p.lowStockAlert ?? '0'),
    });
    setEditingId(p.id);
    setFormError('');
    setOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editingId) {
        update(editingId, form);
        toast.push('Product updated', 'success');
      } else {
        create(form);
        toast.push('Product added', 'success');
      }
      setOpen(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const onDelete = async (p) => {
    const ok = await confirm({
      title: 'Delete product',
      message: `Delete "${p.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    remove(p.id);
    toast.push('Product deleted', 'success');
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (term) {
        const haystack = `${p.name} ${p.sku}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [products, searchTerm, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-sm text-slate-500">Manage your product catalog and inventory</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary">+ Add Product</button>
        )}
      </div>

      {lowStockCount > 0 && (
        <div className="card !p-4 bg-amber-50 border-amber-200 text-sm text-amber-900 flex items-start gap-3">
          <div className="font-bold">⚠</div>
          <div>
            <strong>{lowStockCount}</strong> {lowStockCount === 1 ? 'product is' : 'products are'} at or below the
            low-stock alert level. Restock soon to avoid running out.
          </div>
        </div>
      )}

      <div className="card !p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="input"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input"
            >
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No products yet. Add your first product to get started.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No products match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">SKU</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Stock</th>
                  <th className="px-6 py-3 font-medium">Selling Price</th>
                  <th className="px-6 py-3 font-medium">GST</th>
                  {canEdit && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isLow = p.stock <= p.lowStockAlert;
                  const outOfStock = p.stock === 0;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 last:border-0 ${
                        isLow ? 'bg-amber-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        {p.hsnCode && (
                          <div className="text-xs text-slate-500 mt-0.5">HSN: {p.hsnCode}</div>
                        )}
                        {p.description && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{p.sku}</td>
                      <td className="px-6 py-4 text-slate-600">{p.category}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              outOfStock ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-slate-900'
                            }`}
                          >
                            {p.stock} {p.unit.toLowerCase()}
                          </span>
                          {isLow && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-medium">
                              {outOfStock ? 'Out of stock' : 'Low'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Alert at: {p.lowStockAlert}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-900">{formatINR(p.sellingPrice)}</td>
                      <td className="px-6 py-4 text-slate-600">{p.gstRate}%</td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => openEdit(p)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                          <button onClick={() => onDelete(p)} className="btn-danger !py-1 !px-3 text-xs">Delete</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Edit Product' : 'Add Product'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" form="product-form" className="btn-primary">Save</button>
          </>
        }
      >
        <form id="product-form" onSubmit={submit} className="space-y-5" noValidate>
          {formError && (
            <div className="px-4 py-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {formError}
            </div>
          )}

          <Section title="Basic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Product name" required>
                <input value={form.name} onChange={update_('name')} className="input" placeholder="e.g. Basmati Rice 5kg" />
              </Field>
              <Field label="SKU code" required>
                <input value={form.sku} onChange={update_('sku')} className="input" placeholder="e.g. RICE-5KG-001" />
              </Field>
              <Field label="Category" required>
                <input value={form.category} onChange={update_('category')} className="input" placeholder="e.g. Groceries" list="category-options" />
                <datalist id="category-options">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="HSN code" hint="Optional, used for GST">
                <input value={form.hsnCode} onChange={update_('hsnCode')} className="input" placeholder="e.g. 1006" />
              </Field>
            </div>
          </Section>

          <Section title="Pricing & Tax">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Purchase price (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={update_('purchasePrice')}
                  className="input"
                />
              </Field>
              <Field label="Selling price (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={update_('sellingPrice')}
                  className="input"
                />
              </Field>
              <Field label="GST rate" required>
                <select value={form.gstRate} onChange={update_('gstRate')} className="input">
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Inventory">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Unit of measurement" required>
                <select value={form.unit} onChange={update_('unit')} className="input">
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Current stock" required>
                <input type="number" min="0" step="1" value={form.stock} onChange={update_('stock')} className="input" />
              </Field>
              <Field label="Low-stock alert" required hint="Highlight when stock is at or below this number">
                <input type="number" min="0" step="1" value={form.lowStockAlert} onChange={update_('lowStockAlert')} className="input" />
              </Field>
            </div>
          </Section>

          <Section title="Description">
            <textarea
              value={form.description}
              onChange={update_('description')}
              className="input"
              rows="2"
              placeholder="Optional notes about this product"
            />
          </Section>
        </form>
      </Modal>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
