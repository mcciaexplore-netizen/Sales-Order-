import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) return setError('This reset link is missing its token. Please request a new one.');
    if (!password) return setError('Please choose a new password');
    if (password.length < 8) return setError('Password must be at least 8 characters long');
    if (password !== confirmPassword) return setError("Passwords don't match");

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-lg bg-brand-500 items-center justify-center text-white text-xl font-bold mb-3">
            S
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pick something at least 8 characters long
          </p>
        </div>

        <div className="card">
          {done ? (
            <div className="space-y-4 text-sm">
              <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900">
                Your password has been updated. Redirecting you to the login page…
              </div>
              <Link to="/login" className="btn-primary w-full">
                Log in now
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                  {error}
                </div>
              )}
              {!token && !error && (
                <div className="mb-4 px-4 py-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                  This page expects a reset token in the URL. Please use the link from your email.
                </div>
              )}
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label className="label">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Updating...' : 'Update password'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                  Back to log in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
