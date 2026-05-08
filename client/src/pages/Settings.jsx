import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import Loading from '../components/Loading.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useProducts } from '../contexts/ProductsContext.jsx';
import { INDIAN_STATES } from '../utils/indianStates';

const blankBusiness = {
  name: '',
  gstNumber: '',
  address: '',
  phone: '',
  email: '',
  state: '',
  logo: '',
};

const sampleProducts = [
  {
    name: 'Basmati Rice 5kg',
    sku: 'RICE-5KG',
    category: 'Groceries',
    hsnCode: '1006',
    unit: 'Pieces',
    purchasePrice: 420,
    sellingPrice: 560,
    gstRate: 5,
    stock: 40,
    lowStockAlert: 8,
    description: 'Premium long grain rice',
  },
  {
    name: 'Organic Turmeric 250g',
    sku: 'TURMERIC-250',
    category: 'Spices',
    hsnCode: '0910',
    unit: 'Pieces',
    purchasePrice: 90,
    sellingPrice: 140,
    gstRate: 5,
    stock: 65,
    lowStockAlert: 10,
    description: 'Ground turmeric powder',
  },
  {
    name: 'Cotton Tote Bag',
    sku: 'TOTE-COTTON',
    category: 'Accessories',
    hsnCode: '4202',
    unit: 'Pieces',
    purchasePrice: 85,
    sellingPrice: 180,
    gstRate: 12,
    stock: 30,
    lowStockAlert: 6,
    description: 'Reusable shopping bag',
  },
];

const sampleCustomers = [
  {
    name: 'Ananya Stores',
    phone: '9876543210',
    email: 'orders@ananyastores.example',
    address: '12 Market Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    gstin: '27AAAPL1234C1Z5',
  },
  {
    name: 'Kaveri Traders',
    phone: '9123456780',
    email: 'billing@kaveritraders.example',
    address: '44 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    gstin: '29AAACK9999B1Z2',
  },
  {
    name: 'Local Walk-in Customer',
    phone: '9000000000',
    email: '',
    address: '',
    city: 'Pune',
    state: 'Maharashtra',
    gstin: '',
  },
];

const round2 = (n) => Math.round(n * 100) / 100;

const normalizeProduct = (row) => ({
  id: row.ID || row.id || '',
  name: row.Name || row.name || '',
  sku: row.SKU || row.sku || '',
  category: row.Category || row.category || '',
  hsnCode: row.HSN || row.hsnCode || '',
  unit: row.Unit || row.unit || 'Pieces',
  purchasePrice: Number(row['Purchase Price'] ?? row.purchasePrice ?? 0),
  sellingPrice: Number(row['Selling Price'] ?? row.sellingPrice ?? 0),
  gstRate: Number(row['GST Rate'] ?? row.gstRate ?? 0),
  stock: Number(row.Stock ?? row.stock ?? 0),
  lowStockAlert: Number(row['Low Stock Alert'] ?? row.lowStockAlert ?? 0),
  description: row.Description || row.description || '',
});

const orderItemsFromProducts = (products, rows) => rows.map(({ sku, quantity }) => {
  const product = products.find((p) => p.sku === sku);
  if (!product) return null;
  return {
    productId: product.id,
    sku: product.sku,
    hsnCode: product.hsnCode || '',
    unit: product.unit || '',
    name: product.name,
    price: product.sellingPrice,
    gstRate: product.gstRate,
    quantity,
  };
}).filter(Boolean);

export default function Settings() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const { products, importMany } = useProducts();
  const fileRef = useRef(null);

  const [form, setForm] = useState(blankBusiness);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const loadBusiness = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/business');
      setForm({ ...blankBusiness, ...data });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBusiness(); }, []);

  const validate = () => {
    if (!form.name.trim()) return 'Business name is required';
    if (!form.phone.trim()) return 'Phone number is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return 'Please enter a valid email address';
    if (!form.state.trim()) return 'Business home state is required';
    if (!form.address.trim()) return 'Business address is required';
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.push(validationError, 'error');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put('/business', form);
      setForm({ ...blankBusiness, ...data });
      await refreshUser();
      toast.push('Settings saved', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.push('Please choose an image file', 'error');
      return;
    }
    if (file.size > 500 * 1024) {
      toast.push('Please choose an image under 500 KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, logo: reader.result || '' }));
    reader.onerror = () => toast.push('Could not read the logo file', 'error');
    reader.readAsDataURL(file);
  };

  const loadSampleData = async () => {
    setWorking(true);
    try {
      const importedProducts = importMany(sampleProducts);
      const { data: existingCustomers } = await api.get('/customers');
      const customers = [];
      for (const sample of sampleCustomers) {
        const existing = existingCustomers.find((c) => c.phone === sample.phone || c.name === sample.name);
        if (existing) {
          customers.push(existing);
        } else {
          const { data } = await api.post('/customers', sample);
          customers.push(data);
        }
      }

      const productList = importedProducts.length ? importedProducts : products;
      const firstOrderItems = orderItemsFromProducts(productList, [
        { sku: 'RICE-5KG', quantity: 2 },
        { sku: 'TURMERIC-250', quantity: 4 },
      ]);
      const secondOrderItems = orderItemsFromProducts(productList, [
        { sku: 'TOTE-COTTON', quantity: 8 },
        { sku: 'RICE-5KG', quantity: 1 },
      ]);

      for (const payload of [
        { customerId: customers[0]?._id, status: 'Confirmed', notes: 'Sample wholesale order', items: firstOrderItems },
        { customerId: customers[1]?._id, status: 'Draft', notes: 'Sample draft order', items: secondOrderItems },
      ]) {
        if (!payload.customerId || payload.items.length === 0) continue;
        await api.post('/orders', payload);
      }

      toast.push('Sample data loaded', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setWorking(false);
    }
  };

  const exportAllData = async () => {
    setWorking(true);
    try {
      const [{ data: customers }, { data: orders }] = await Promise.all([
        api.get('/customers'),
        api.get('/orders'),
      ]);

      const productRows = products.map((p) => ({
        ID: p.id,
        Name: p.name,
        SKU: p.sku,
        Category: p.category,
        HSN: p.hsnCode || '',
        Unit: p.unit,
        'Purchase Price': p.purchasePrice,
        'Selling Price': p.sellingPrice,
        'GST Rate': p.gstRate,
        Stock: p.stock,
        'Low Stock Alert': p.lowStockAlert,
        Description: p.description || '',
      }));

      const orderRows = orders.map((o) => ({
        'Order Number': o.orderNumber,
        Customer: o.customerName,
        'Customer State': o.customerState || '',
        Status: o.status,
        'Payment Status': o.paymentStatus,
        Subtotal: o.subtotal,
        CGST: o.cgst,
        SGST: o.sgst,
        IGST: o.igst,
        'Grand Total': o.total,
        Notes: o.notes || '',
        Items: JSON.stringify(o.items || []),
        'Created At': o.createdAt,
      }));

      const paymentRows = orders.map((o) => ({
        'Order Number': o.orderNumber,
        Customer: o.customerName,
        'Payment Status': o.paymentStatus,
        'Order Total': o.total,
        Outstanding: o.paymentStatus === 'Paid' ? 0 : o.total,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers), 'Customers');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), 'Orders');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), 'Payments');
      XLSX.writeFile(wb, `sales-order-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.push('Data exported', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setWorking(false);
    }
  };

  const importData = async (file) => {
    if (!file) return;
    setWorking(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const sheetRows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name] || []);
      const customerRows = sheetRows('Customers');
      const productRows = sheetRows('Products').map(normalizeProduct);
      const orderRows = sheetRows('Orders');

      const importedProducts = importMany(productRows);
      const productLookup = importedProducts.length ? importedProducts : products;
      const { data: existingCustomers } = await api.get('/customers');
      const customerMap = new Map(existingCustomers.map((c) => [`${c.name}|${c.phone}`, c]));

      for (const row of customerRows) {
        const payload = {
          name: row.Name || row.name || '',
          phone: String(row.Phone || row.phone || ''),
          email: row.Email || row.email || '',
          address: row.Address || row.address || '',
          city: row.City || row.city || '',
          state: row.State || row.state || '',
          gstin: row.GSTIN || row.gstin || '',
        };
        if (!payload.name || !payload.phone) continue;
        const key = `${payload.name}|${payload.phone}`;
        if (!customerMap.has(key)) {
          const { data } = await api.post('/customers', payload);
          customerMap.set(key, data);
        }
      }

      for (const row of orderRows) {
        const customerName = row.Customer || row.customerName || '';
        const customer = Array.from(customerMap.values()).find((c) => c.name === customerName);
        if (!customer) continue;
        let parsedItems = [];
        try {
          parsedItems = JSON.parse(row.Items || '[]');
        } catch {
          parsedItems = [];
        }
        const items = parsedItems.map((item) => {
          const product = productLookup.find((p) => p.sku === item.sku || p.name === item.name);
          return {
            productId: product?.id || item.productId || '',
            sku: item.sku || product?.sku || '',
            hsnCode: item.hsnCode || product?.hsnCode || '',
            unit: item.unit || product?.unit || '',
            name: item.name || product?.name || '',
            price: Number(item.price || product?.sellingPrice || 0),
            gstRate: Number(item.gstRate || product?.gstRate || 0),
            quantity: Number(item.quantity || 1),
          };
        }).filter((item) => item.name && item.quantity > 0);
        if (items.length === 0) continue;
        const status = row.Status === 'Confirmed' ? 'Confirmed' : 'Draft';
        await api.post('/orders', {
          customerId: customer._id,
          status,
          notes: row.Notes || '',
          items,
        });
      }

      toast.push('Data imported', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return <Loading label="Loading settings..." />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Business profile, sample data, and Excel backups</p>
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      <form onSubmit={save} className="card space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Business name" required>
            <input value={form.name} onChange={update('name')} className="input" />
          </Field>
          <Field label="GSTIN">
            <input value={form.gstNumber} onChange={update('gstNumber')} className="input" />
          </Field>
          <Field label="Phone" required>
            <input value={form.phone} onChange={update('phone')} className="input" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={update('email')} className="input" />
          </Field>
          <Field label="Home state" required>
            <select value={form.state} onChange={update('state')} className="input">
              <option value="">Select state...</option>
              {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </Field>
          <Field label="Business logo">
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} className="input" />
          </Field>
        </div>

        <Field label="Address" required>
          <textarea value={form.address} onChange={update('address')} rows="3" className="input" />
        </Field>

        {form.logo && (
          <div className="flex items-center gap-4 rounded-md border border-slate-200 p-4">
            <img src={form.logo} alt="Business logo preview" className="h-16 w-16 object-contain" />
            <button type="button" onClick={() => setForm({ ...form, logo: '' })} className="btn-secondary">
              Remove Logo
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving || working} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Sample Data</h3>
          <p className="text-sm text-slate-600">Load example customers, products, and orders to explore the app.</p>
          <button type="button" disabled={working} onClick={loadSampleData} className="btn-primary">
            {working ? 'Working...' : 'Load Sample Data'}
          </button>
        </div>

        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Backup and Restore</h3>
          <p className="text-sm text-slate-600">Export or import customers, products, orders, and payments using Excel.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={working} onClick={exportAllData} className="btn-secondary">
              Export All Data
            </button>
            <label className={`btn-secondary cursor-pointer ${working ? 'opacity-60 pointer-events-none' : ''}`}>
              Import Data
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => importData(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

