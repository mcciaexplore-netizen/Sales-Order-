import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Please enter your email');

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDevLink(data?.devLink || '');
      setSent(true);
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
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-500 mt-1">
            We'll show you a reset link to choose a new password
          </p>
        </div>

        <div className="card">
          {sent ? (
            <div className="space-y-4 text-sm">
              <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900">
                If an account exists for <strong>{email}</strong>, we've sent password reset
                instructions. The link will expire in 1 hour.
              </div>
              {devLink ? (
                <div className="px-4 py-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div>
                    <strong>Frontend-only mode:</strong> there's no email service to deliver the
                    link, so use the one below directly.
                  </div>
                  <a
                    href={devLink}
                    className="block break-all font-mono text-brand-700 hover:text-brand-900 underline"
                  >
                    {devLink}
                  </a>
                </div>
              ) : (
                <p className="text-slate-600">
                  Don't see it? Check your spam folder, or wait a few minutes and try again.
                </p>
              )}
              <div className="pt-2">
                <Link to="/login" className="btn-secondary w-full">
                  Back to log in
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Remembered it?{' '}
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
