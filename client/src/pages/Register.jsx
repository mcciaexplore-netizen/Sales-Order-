import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { INDIAN_STATES } from '../utils/indianStates';

const initial = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  businessName: '',
  gstNumber: '',
  phone: '',
  state: '',
  address: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    if (!form.name.trim()) return 'Please enter your full name';
    if (!form.email.trim()) return 'Please enter your email';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Please enter a valid email address';
    if (!form.password) return 'Please choose a password';
    if (form.password.length < 8) return 'Password must be at least 8 characters long';
    if (form.password !== form.confirmPassword) return "Passwords don't match";
    if (!form.businessName.trim()) return 'Please enter your business name';
    if (!form.phone.trim()) return 'Please enter your phone number';
    if (!form.state.trim()) return 'Please select your business state';
    if (!form.address.trim()) return 'Please enter your business address';
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError('');
    setSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        gstNumber: form.gstNumber,
        phone: form.phone,
        state: form.state,
        address: form.address,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-lg bg-brand-500 items-center justify-center text-white text-xl font-bold mb-3">
            S
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Register your business</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create your owner account to get started
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5" noValidate>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">
                Your details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full name</label>
                  <input
                    value={form.name}
                    onChange={update('name')}
                    className="input"
                    placeholder="Priya Sharma"
                    autoComplete="name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    className="input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={update('password')}
                    className="input"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="label">Confirm password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={update('confirmPassword')}
                    className="input"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">
                Your business
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Business name</label>
                  <input
                    value={form.businessName}
                    onChange={update('businessName')}
                    className="input"
                    placeholder="e.g. Sharma Trading Co."
                  />
                </div>
                <div>
                  <label className="label">Phone number</label>
                  <input
                    value={form.phone}
                    onChange={update('phone')}
                    className="input"
                    placeholder="e.g. 9876543210"
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <select value={form.state} onChange={update('state')} className="input">
                    <option value="">Select state...</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Used for GST (CGST/SGST vs IGST) calculations.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">
                    GST number <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    value={form.gstNumber}
                    onChange={update('gstNumber')}
                    className="input"
                    placeholder="e.g. 27AAAPL1234C1Z5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Business address</label>
                  <textarea
                    value={form.address}
                    onChange={update('address')}
                    className="input"
                    rows="2"
                    placeholder="Street, city, PIN code"
                  />
                  <p className="text-xs text-slate-500 mt-1">Shown on every invoice you generate.</p>
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
