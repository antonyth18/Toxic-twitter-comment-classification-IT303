import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WaveBackground from '../components/WaveBackground';
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
    { name: 'Toxic', desc: 'Rude, disrespectful, or unreasonable language', icon: Flame, color: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50' },
    { name: 'Severe Toxic', desc: 'Extremely aggressive or damaging hostility', icon: AlertTriangle, color: 'text-rose-600', border: 'border-rose-200', bg: 'bg-rose-50' },
    { name: 'Obscene', desc: 'Vulgarity, explicit profanity, and offensive slang', icon: EyeOff, color: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-50' },
    { name: 'Threat', desc: 'Statements conveying intent to cause harm or violence', icon: ShieldAlert, color: 'text-red-600', border: 'border-red-200', bg: 'bg-red-50' },
    { name: 'Insult', desc: 'Disparaging, demeaning, or mocking remarks', icon: UserX, color: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' },
    { name: 'Identity Hate', desc: 'Attacks targeting race, religion, gender, or orientation', icon: Zap, color: 'text-pink-600', border: 'border-pink-200', bg: 'bg-pink-50' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      <WaveBackground />
      <Navbar />

      <main className="flex-1 relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold mb-8 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>State-of-the-Art DistilBERT Transformer Engine</span>
            </div>

            <h1 className="display-title text-5xl sm:text-7xl lg:text-8xl mb-6">
              Detect &amp; Categorize <br className="hidden sm:inline" />
              Toxic Social Comments
            </h1>

            <p className="max-w-2xl mx-auto text-lg text-white/90 mb-10 leading-relaxed font-sans">
              <b>Real-time multi-label classification to detect harassment, threats, obscenity, and hate speech.</b>
              <br></br>
              Built by Anirudh Trichy, Antony Thaikadavil, K V Akash under the guidance of Prof. Jaidhar CD.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={token ? '/home' : '/register'}
                className="btn-primary w-full sm:w-auto text-base px-8 py-3.5 shadow-xl gap-2"
              >
                <span>{token ? 'Go to Classifier Dashboard' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={token ? '/history' : '/login'}
                className="btn-outline w-full sm:w-auto text-base px-8 py-3.5 gap-2"
              >
                <span>{token ? 'View Classification History' : 'Sign In with 2FA'}</span>
              </Link>
            </div>

            {/* Quick feature pill list */}
            <div className="mt-14 pt-8 border-t border-white/20 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-white/90 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>6 Simultaneous Toxicity Categories</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>TOTP Two-Factor Authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Audited Administrative Logs</span>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/20 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="display-title text-3xl sm:text-5xl text-white mb-3">
                Granular Multi-Label Toxicity Detection
              </h2>
              <p className="text-white/80 text-sm sm:text-base max-w-xl mx-auto">
                Comments are simultaneously analyzed across six specialized subcategories with high-confidence probability scores.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.name}
                    className={`glass-card p-6 border ${cat.border} transition-all hover:translate-y-[-2px] hover:shadow-2xl`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-1.5">{cat.name}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{cat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security & Verification Banner */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="glass-card max-w-4xl mx-auto p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mx-auto mb-5 text-purple-700">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="display-title text-3xl sm:text-5xl !text-slate-800 mb-3">
              Protected by Strict Two-Factor Security
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-lg mx-auto mb-8">
              Every account is secured with standard Time-based One-Time Passwords (TOTP). Compatible with Google Authenticator, Authy, and 1Password.
            </p>
            <Link
              to="/register"
              className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3.5 shadow-lg"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/20 py-8 px-4 text-center text-xs text-slate-600 font-medium relative z-10">
        <p>Toxic Twitter Comment Classification System &bull; IT303 Software Engineering</p>
        <p className="mt-1">Anirudh Trichy, Antony Thaikadavil, KV Akash &bull; Under guidance of Prof. Jaidhar CD &bull; &copy;</p>
      </footer>
    </div>
  );
}
