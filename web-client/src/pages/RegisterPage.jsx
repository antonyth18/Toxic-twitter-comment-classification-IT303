import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WaveBackground from '../components/WaveBackground';
import ErrorBanner from '../components/ErrorBanner';
import mockAuth from '../api/mockAuth';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  ArrowRight, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Success 2FA QR state
  const [registrationResult, setRegistrationResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Inline validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isPasswordStrong = hasMinLength && hasLetter && hasNumber;
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true, confirmPassword: true });

    if (!isEmailValid) {
      setError('Please provide a valid email address.');
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
      const data = await mockAuth.register(email.trim(), password);
      setRegistrationResult(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (registrationResult?.totp_secret) {
      navigator.clipboard.writeText(registrationResult.totp_secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      <WaveBackground />
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-md relative z-10">
          <div className="glass-card p-6 sm:p-8 shadow-2xl">
            {!registrationResult ? (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold mb-3">
                    <Sparkles className="w-3 h-3" />
                    <span>Create Your Account</span>
                  </div>
                  <h1 className="display-title text-3xl sm:text-4xl !text-slate-800">
                    Join Toxisense
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Set up your credentials with two-factor authentication
                  </p>
                </div>

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

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => handleBlur('password')}
                        placeholder="Min. 8 characters"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                          touched.password && !isPasswordStrong && password.length > 0
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                            : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                        }`}
                      />
                    </div>

                    {/* Inline password criteria checklist */}
                    {password.length > 0 && (
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

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => handleBlur('confirmPassword')}
                        placeholder="Re-enter password"
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
                    disabled={loading}
                    className="btn-primary w-full mt-2 py-3 text-sm shadow-lg gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Continue to 2FA Setup</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-xs text-slate-600 mt-6">
                  Already have an account?{' '}
                  <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
                    Sign in
                  </Link>
                </p>
              </>
            ) : (
              /* Success screen rendering returned qr_code as <img src={qr_code} /> */
              <div className="text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-700">
                  <QrCode className="w-6 h-6" />
                </div>
                <h2 className="display-title text-2xl sm:text-3xl !text-slate-800 mb-1">
                  Configure Two-Factor Auth
                </h2>
                <p className="text-xs text-slate-600 mb-5 max-w-xs mx-auto">
                  Scan the QR code below with Google Authenticator, Authy, or any TOTP authenticator.
                </p>

                {/* Base64 QR Code image render */}
                {registrationResult.qr_code && (
                  <div className="p-3.5 bg-white rounded-2xl inline-block shadow-md mb-5 border border-slate-200">
                    <img
                      src={registrationResult.qr_code}
                      alt="2FA TOTP QR Code"
                      className="w-48 h-48 mx-auto object-contain rounded-lg"
                    />
                  </div>
                )}

                {/* Manual entry secret */}
                {registrationResult.totp_secret && (
                  <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 mb-6">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Manual Secret Key (Base32)
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs text-indigo-700 font-mono tracking-wider break-all select-all font-semibold">
                        {registrationResult.totp_secret}
                      </code>
                      <button
                        onClick={handleCopySecret}
                        type="button"
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shrink-0 cursor-pointer"
                        title="Copy key"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full py-3 text-sm shadow-lg gap-2 cursor-pointer"
                >
                  <span>Key Saved — Proceed to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
