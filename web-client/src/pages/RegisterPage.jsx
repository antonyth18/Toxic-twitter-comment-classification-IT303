import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-rose-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50">
            {!registrationResult ? (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
                    <Sparkles className="w-3 h-3" />
                    <span>Create Your Account</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Join{' '}
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                      Toxisense
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Set up your credentials with two-factor authentication
                  </p>
                </div>

                <div className="mb-4">
                  <ErrorBanner error={error} onClose={() => setError(null)} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleBlur('email')}
                        placeholder="you@example.com"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/70 border text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          touched.email && !isEmailValid && email.length > 0
                            ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    {touched.email && email.length > 0 && !isEmailValid && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>Please enter a valid email address</span>
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => handleBlur('password')}
                        placeholder="Min. 8 characters"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/70 border text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          touched.password && !isPasswordStrong && password.length > 0
                            ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                        }`}
                      />
                    </div>

                    {/* Inline password criteria checklist */}
                    {password.length > 0 && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 space-y-1 text-[11px]">
                        <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {hasMinLength ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-slate-600" />}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {hasLetter ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-slate-600" />}
                          <span>Contains at least one letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {hasNumber ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-slate-600" />}
                          <span>Contains at least one number</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => handleBlur('confirmPassword')}
                        placeholder="Re-enter password"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/70 border text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          touched.confirmPassword && !doPasswordsMatch && confirmPassword.length > 0
                            ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    {touched.confirmPassword && confirmPassword.length > 0 && !doPasswordsMatch && (
                      <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>Passwords do not match</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
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

                <p className="text-center text-xs text-slate-400 mt-6">
                  Already have an account?{' '}
                  <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                    Sign in
                  </Link>
                </p>
              </>
            ) : (
              /* Success screen rendering returned qr_code as <img src={qr_code} /> */
              <div className="text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                  <QrCode className="w-6 h-6" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  Configure Two-Factor Auth
                </h2>
                <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
                  Scan the QR code below with Google Authenticator, Authy, or any TOTP authenticator.
                </p>

                {/* Base64 QR Code image render */}
                {registrationResult.qr_code && (
                  <div className="p-3.5 bg-white rounded-2xl inline-block shadow-2xl shadow-black/70 mb-5 border border-slate-300">
                    <img
                      src={registrationResult.qr_code}
                      alt="2FA TOTP QR Code"
                      className="w-48 h-48 mx-auto object-contain rounded-lg"
                    />
                  </div>
                )}

                {/* Manual entry secret */}
                {registrationResult.totp_secret && (
                  <div className="text-left bg-slate-950/80 p-3 rounded-xl border border-slate-800 mb-6">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Manual Secret Key (Base32)
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs text-indigo-300 font-mono tracking-wider break-all select-all">
                        {registrationResult.totp_secret}
                      </code>
                      <button
                        onClick={handleCopySecret}
                        type="button"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                        title="Copy key"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
