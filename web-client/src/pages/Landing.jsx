import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  ShieldAlert,
  Sparkles,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle2,
  Flame,
  AlertTriangle,
  EyeOff,
  UserX
} from 'lucide-react';

export default function Landing() {
  const token = localStorage.getItem('jwt');

  const categories = [
    { name: 'Toxic', desc: 'Rude, disrespectful, or unreasonable language', icon: Flame, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10' },
    { name: 'Severe Toxic', desc: 'Extremely aggressive or damaging hostility', icon: AlertTriangle, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10' },
    { name: 'Obscene', desc: 'Vulgarity, explicit profanity, and offensive slang', icon: EyeOff, color: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/10' },
    { name: 'Threat', desc: 'Statements conveying intent to cause harm or violence', icon: ShieldAlert, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/10' },
    { name: 'Insult', desc: 'Disparaging, demeaning, or mocking remarks', icon: UserX, color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/10' },
    { name: 'Identity Hate', desc: 'Attacks targeting race, religion, gender, or orientation', icon: Zap, color: 'text-pink-400', border: 'border-pink-500/20', bg: 'bg-pink-500/10' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-28 px-4 sm:px-6 lg:px-8">
          {/* Subtle background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-indigo-600/15 to-rose-600/15 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              <span>State-of-the-Art DistilBERT Transformer Engine</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none text-white mb-6">
              Detect & Categorize <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                Toxic Social Comments
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10 leading-relaxed">
              Real-time multi-label classification to detect harassment, threats, obscenity, and hate speech. Protected with two-factor authentication and enterprise activity logging.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={token ? '/home' : '/register'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{token ? 'Go to Classifier Dashboard' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={token ? '/history' : '/login'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold border border-slate-700/80 transition-all"
              >
                <span>{token ? 'View Classification History' : 'Sign In with 2FA'}</span>
              </Link>
            </div>

            {/* Quick feature pill list */}
            <div className="mt-14 pt-8 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>6 Simultaneous Toxicity Categories</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>TOTP Two-Factor Authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Audited Administrative Logs</span>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-900/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Granular Multi-Label Toxicity Detection
              </h2>
              <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
                Comments are simultaneously analyzed across six specialized subcategories with high-confidence probability scores.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.name}
                    className={`p-6 rounded-2xl bg-slate-900/60 border ${cat.border} backdrop-blur-sm transition-all hover:translate-y-[-2px] hover:shadow-xl hover:shadow-slate-950/50`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-100 mb-1.5">{cat.name}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{cat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security & Verification Banner */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 text-center relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5 text-indigo-400">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Protected by Strict Two-Factor Security
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto mb-8">
              Every account is secured with standard Time-based One-Time Passwords (TOTP). Compatible with Google Authenticator, Authy, and 1Password.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-950 font-semibold hover:bg-slate-100 transition-colors shadow-lg"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-4 text-center text-xs text-slate-500">
        <p>Toxic Twitter Comment Classification System &bull; IT303 Software Engineering</p>
        <p>Anirudh Trichy, Antony Thaikadavil, KV Akash &bull; Under guidace of Prof. Jaidhar CD</p>
      </footer>
    </div>
  );
}
