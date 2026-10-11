import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WaveBackground from '../components/WaveBackground';
import ErrorBanner from '../components/ErrorBanner';
import mockAuth from '../api/mockAuth';
import { ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

export default function TwoFactorVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);

  // Retrieve tempToken and context from route state or localStorage
  const tempToken = location.state?.tempToken || localStorage.getItem('tempToken');
  const userEmail = location.state?.email || localStorage.getItem('loginEmail') || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tempToken) {
      setError('No active 2FA verification session found. Please sign in first.');
    } else {
      inputRef.current?.focus();
    }
  }, [tempToken]);

  const handleCodeChange = (e) => {
    // Only accept numeric digits, maximum 6 characters
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!tempToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    if (code.length !== 6) {
      setError('Please enter a complete 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      // Calls mockAuth.verify2fa(tempToken, code)
      const res = await mockAuth.verify2fa(tempToken, code);

      // On success, store the returned `token` (not "jwt") in localStorage under key "jwt"
      if (res?.token) {
        localStorage.setItem('jwt', res.token);

        // Also store user.role
        if (res.user?.role) {
          localStorage.setItem('role', res.user.role);
        }
        if (res.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
        }

        // Clean up temporary session tokens
        localStorage.removeItem('tempToken');
        localStorage.removeItem('loginEmail');

        // Navigate to /home
        navigate('/home');
      } else {
        setError('Verification succeeded but no authentication token was returned.');
      }
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Second Factor Challenge</span>
              </div>
              <h1 className="display-title text-3xl sm:text-4xl !text-slate-800">
                Two-Factor Verification
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                {userEmail ? (
                  <>
                    Enter the 6-digit TOTP code generated for{' '}
                    <span className="text-slate-800 font-semibold">{userEmail}</span>
                  </>
                ) : (
                  'Enter the 6-digit code from your authenticator application'
                )}
              </p>
            </div>

            <div className="mb-4">
              <ErrorBanner error={error} onClose={() => setError(null)} />
            </div>

            {tempToken ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2 text-center">
                    6-Digit Security Code
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={code}
                      onChange={handleCodeChange}
                      placeholder="······"
                      className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    Enter the code shown in Google Authenticator or Authy
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="btn-primary w-full py-3.5 text-sm shadow-lg gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify Code &amp; Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm shadow-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <Link to="/login" className="hover:text-slate-800 flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to login</span>
              </Link>
              <Link to="/register" className="hover:text-indigo-600 transition-colors">
                Need a new 2FA key?
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
