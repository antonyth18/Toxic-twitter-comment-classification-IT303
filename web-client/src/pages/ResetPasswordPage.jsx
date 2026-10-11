import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WaveBackground from '../components/WaveBackground';
import ErrorBanner from '../components/ErrorBanner';
import client from '../api/client';
import { 
  KeyRound, 
  Mail, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck 
} from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isCodeValid = /^\d{6}$/.test(code);
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isPasswordStrong = hasMinLength && hasLetter && hasNumber;
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, code: true, newPassword: true, confirmPassword: true });

    if (!isEmailValid) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!isCodeValid) {
      setError('Please enter a valid 6-digit authenticator code.');
      return;
    }

    if (!isPasswordStrong) {
      setError('Password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }

    if (!doPasswordsMatch) {
      setError('Passwords do not match. Please verify your password entry.');
      return;
    }

    setLoading(true);

    try {
      const res = await client.post('/api/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });

      setSuccessMessage(res.data?.message || 'Password reset successful.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      <WaveBackground />
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-md relative z-10">
          <div className="glass-card p-6 sm:p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold mb-3">
                <KeyRound className="w-3 h-3" />
                <span>Account Recovery</span>
              </div>
              <h1 className="display-title text-3xl sm:text-4xl !text-slate-800">
                Reset Password
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Verify your 2FA authenticator code to set a new password
              </p>
            </div>

            {/* Success Message Banner */}
            {successMessage && (
              <div
                role="status"
                className="flex items-center gap-2.5 p-3.5 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm animate-in fade-in duration-200 shadow-sm"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="font-medium">Password reset successful. Redirecting to login...</span>
              </div>
            )}

            {/* Error Banner */}
            <div className="mb-4">
              <ErrorBanner error={error} onClose={() => setError(null)} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                      touched.email && !isEmailValid && email.length > 0
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
                {touched.email && email.length > 0 && !isEmailValid && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <XCircle className="w-3 h-3" />
                    <span>Please enter a valid email address</span>
                  </p>
                )}
              </div>

              {/* 6-Digit Authenticator Code */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  6-Digit Authenticator Code
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onBlur={() => handleBlur('code')}
                    placeholder="123456"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                      touched.code && !isCodeValid && code.length > 0
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Use the current code from your authenticator app.
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onBlur={() => handleBlur('newPassword')}
                    placeholder="Min. 8 characters"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                      touched.newPassword && !isPasswordStrong && newPassword.length > 0
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>

                {/* Inline criteria checklist matching RegisterPage */}
                {newPassword.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                      {hasMinLength ? <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                      {hasLetter ? <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />}
                      <span>Contains at least one letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                      {hasNumber ? <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />}
                      <span>Contains at least one number</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder="Re-enter new password"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                      touched.confirmPassword && !doPasswordsMatch && confirmPassword.length > 0
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
                {touched.confirmPassword && confirmPassword.length > 0 && !doPasswordsMatch && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <XCircle className="w-3 h-3" />
                    <span>Passwords do not match</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !!successMessage}
                className="btn-primary w-full mt-2 py-3 text-sm shadow-lg gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-slate-600 mt-6">
              Remembered your password?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
