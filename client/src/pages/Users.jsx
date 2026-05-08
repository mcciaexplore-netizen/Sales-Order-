import { useEffect, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDate } from '../utils/format';

const blank = { name: '', email: '', password: '', role: 'Staff' };

const ROLE_DESCRIPTIONS = {
  Owner: 'Full access including user management',
  Manager: 'Manage products, customers, orders, and payments',
  Staff: 'Create orders and view products and customers',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { user: currentUser } = useAuth();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) return setFormError('Full name is required');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setFormError('Please enter a valid email address');
    if (!form.password || form.password.length < 8) return setFormError('Password must be at least 8 characters');

    setSaving(true);
    try {
      await api.post('/users', form);
      toast.push('User added', 'success');
      setOpen(false);
      setForm(blank);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    const ok = await confirm({
      title: 'Remove team member',
      message: `Remove ${u.name} from your business?`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.push('User removed', 'success');
      load();
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Team Members</h2>
          <p className="text-sm text-slate-500">Add managers and staff to your business</p>
        </div>
        <button
          onClick={() => { setForm(blank); setFormError(''); setOpen(true); }}
          className="btn-primary"
        >
          + Add User
        </button>
      </div>

      <div className="card !p-4 bg-blue-50 border-blue-200 text-sm text-slate-700">
        <strong>Roles:</strong>
        <ul className="mt-2 space-y-1 text-slate-600">
          <li><span className="font-medium text-slate-900">Owner</span> — {ROLE_DESCRIPTIONS.Owner}</li>
          <li><span className="font-medium text-slate-900">Manager</span> — {ROLE_DESCRIPTIONS.Manager}</li>
          <li><span className="font-medium text-slate-900">Staff</span> — {ROLE_DESCRIPTIONS.Staff}</li>
        </ul>
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6"><Loading label="Loading team..." /></div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No team members yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {u.name}
                        {u.id === currentUser.id && (
                          <span className="ml-2 text-xs text-slate-500">(you)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.role !== 'Owner' && u.id !== currentUser.id && (
                        <button onClick={() => remove(u)} className="btn-danger !py-1 !px-3 text-xs">
                          Remove
                        </button>
                      )}
                    </td>
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
        title="Add Team Member"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" form="user-form" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Add User'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
          {formError && (
            <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="label">Full name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              placeholder="Share this with the user"
            />
            <p className="text-xs text-slate-500 mt-1">At least 8 characters. They can log in with this password.</p>
          </div>
          <div>
            <label className="label">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input"
            >
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">{ROLE_DESCRIPTIONS[form.role]}</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = {
    Owner: 'bg-purple-100 text-purple-800',
    Manager: 'bg-blue-100 text-blue-800',
    Staff: 'bg-slate-100 text-slate-800',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${colors[role]}`}>
      {role}
    </span>
  );
}
