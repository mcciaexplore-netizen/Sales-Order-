import { useEffect, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { INDIAN_STATES } from '../utils/indianStates';

const blank = { name: '', phone: '', email: '', address: '', city: '', state: '', gstin: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const canEdit = can('Owner', 'Manager');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(blank);
    setEditingId(null);
    setFormError('');
    setOpen(true);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name, phone: c.phone, email: c.email || '',
      address: c.address || '', city: c.city || '', state: c.state || '', gstin: c.gstin || '',
    });
    setEditingId(c._id);
    setFormError('');
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Customer name is required');
    if (!form.phone.trim()) return setFormError('Phone number is required');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setFormError('Please enter a valid email address');
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        toast.push('Customer updated', 'success');
      } else {
        await api.post('/customers', form);
        toast.push('Customer added', 'success');
      }
      setOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Delete customer',
      message: `Delete "${c.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/customers/${c._id}`);
      toast.push('Customer deleted', 'success');
      load();
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
          <p className="text-sm text-slate-500">Manage your customer list</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary">+ Add Customer</button>
        )}
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6"><Loading label="Loading customers..." /></div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No customers yet. Add your first customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">City</th>
                  <th className="px-6 py-3 font-medium">GSTIN</th>
                  {canEdit && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      {c.email && <div className="text-xs text-slate-500">{c.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.phone}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.gstin || '—'}</td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => openEdit(c)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                        <button onClick={() => remove(c)} className="btn-danger !py-1 !px-3 text-xs">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Edit Customer' : 'Add Customer'}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" form="customer-form" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={submit} className="space-y-4" noValidate>
          {formError && (
            <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" rows="2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">State</label>
              <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input">
                <option value="">Select state...</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="input" placeholder="e.g. 27AAAPL1234C1Z5" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
