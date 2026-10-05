import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ErrorBanner from '../components/ErrorBanner';
import mockAuth from '../api/mockAuth';
import { Lock, Mail, ArrowRight, ShieldCheck, Shield, User, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-rose-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
                <Sparkles className="w-3 h-3" />
                <span>Secure Authentication</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                  Toxisense
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Enter your credentials to initiate 2FA verification
              </p>
            </div>

            {/* Role Tabs */}
            <div className="p-1 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-2 gap-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('user');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
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
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={activeTab === 'admin' ? 'admin@toxisense.com' : 'you@example.com'}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-2 py-3 rounded-xl text-white font-semibold text-sm shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-purple-600/30'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/30'
                }`}
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

            <p className="text-center text-xs text-slate-400 mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
