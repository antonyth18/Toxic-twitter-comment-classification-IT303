import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WaveBackground from '../components/WaveBackground';
import ErrorBanner from '../components/ErrorBanner';
import mockAuth from '../api/mockAuth';
import { Lock, Mail, ArrowRight, Shield, User, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const authFn = activeTab === 'admin' ? mockAuth.adminLogin : mockAuth.login;
      const res = await authFn(email.trim(), password);

      if (res.tempToken) {
        // Backup in localStorage in case of direct browser refresh
        localStorage.setItem('tempToken', res.tempToken);
        localStorage.setItem('loginEmail', email.trim());

        // Pass tempToken to next route's state and navigate to /verify-2fa
        navigate('/verify-2fa', {
          state: {
            tempToken: res.tempToken,
            email: email.trim(),
            role: activeTab === 'admin' ? 'ADMIN' : 'USER',
          },
        });
      } else {
        setError('Login failed to produce a verification session. Please try again.');
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold mb-3">
                <Sparkles className="w-3 h-3" />
                <span>Secure Authentication</span>
              </div>
              <h1 className="display-title text-3xl sm:text-4xl !text-slate-800">
                Welcome to Toxisense
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Enter your credentials to initiate 2FA verification
              </p>
            </div>

            {/* Role Tabs */}
            <div className="p-1 rounded-xl bg-slate-100/90 border border-slate-200 grid grid-cols-2 gap-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('user');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'user'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>User Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-white text-purple-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Portal</span>
              </button>
            </div>

            <div className="mb-4">
              <ErrorBanner error={error} onClose={() => setError(null)} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder={activeTab === 'admin' ? 'admin@toxisense.com' : 'you@example.com'}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div className="flex justify-end mt-1.5">
                  <Link
                    to="/reset-password"
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
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
                    <span>Continue to 2FA Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-slate-600 mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
