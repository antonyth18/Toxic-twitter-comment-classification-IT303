import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ShieldAlert, 
  History, 
  Shield, 
  LogOut, 
  Rss, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  UserX, 
  Zap, 
  Radio
} from 'lucide-react';

const CLASSIFIER_URL = 'http://localhost:8000';

// Sample Twitter comment feed for testing classifier
const SAMPLE_TWEETS = [
  "Just finished reading the new AI research paper, incredible advancements being made this year!",
  "Shut up you stupid idiot, nobody asked for your trash opinion. Go delete your account.",
  "I know exactly where you live and I will find you and make you regret ever posting this.",
  "I hate people from that community, they are disgusting and should all be eliminated.",
  "Loved the live concert tonight, the acoustic performance was absolutely wonderful and inspiring!"
];

// Subcategory tag chip configurations matching exact classifier labels
const SUBCATEGORY_CONFIG = {
  threat: {
    label: 'Threat',
    icon: ShieldAlert,
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-500/30',
  },
  insult: {
    label: 'Insult',
    icon: UserX,
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
  },
  identity_attack: {
    label: 'Identity Attack',
    icon: Zap,
    bg: 'bg-pink-500/15',
    text: 'text-pink-300',
    border: 'border-pink-500/30',
  },
};

export default function HomePage() {
  const navigate = useNavigate();

  // Determine current user and role from localStorage
  const storedRole = localStorage.getItem('role') || (() => {
    try {
      return JSON.parse(localStorage.getItem('user'))?.role;
    } catch {
      return null;
    }
  })();
  const isAdmin = storedRole === 'ADMIN';

  // Component states: 'idle' | 'loading' | 'error' | 'success'
  const [feedState, setFeedState] = useState('idle');
  const [feedResults, setFeedResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Logout handler: clears all localStorage data and redirects to /login
  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  /**
   * Fetch Feed Handler
   * ------------------
   * Current Implementation:
   * Dispatches concurrent POST requests to http://localhost:8000/classify
   * for each of the ~5 sample comment strings.
   *
   * Response shape for each comment:
   * {
   *   label: "toxic" | "normal",
   *   subcategories: ["threat" | "insult" | "identity_attack", ...],
   *   confidence: number (0.0 to 1.0),
   *   timestamp: ISOString
   * }
   */
  const handleFetchFeed = async () => {
    setFeedState('loading');
    setErrorMessage('');

    try {
      // =========================================================================
      // TODO: Replace this multiple-classifier call with a single API call once
      // Person B's backend route is live:
      //
      // const res = await client.post('/api/feed/fetch');
      // const results = res.data; // Array of { text, label, subcategories, confidence, timestamp }
      //
      // Note: The card-rendering logic below will not need to change, only the data source!
      // =========================================================================
      const requests = SAMPLE_TWEETS.map(async (text) => {
        const response = await axios.post(`${CLASSIFIER_URL}/classify`, { text }, { timeout: 7000 });
        return {
          text,
          label: response.data.label, // "toxic" or "normal"
          subcategories: response.data.subcategories || [], // e.g. ["threat", "insult", "identity_attack"]
          confidence: response.data.confidence,
          timestamp: response.data.timestamp || new Date().toISOString(),
        };
      });

      const results = await Promise.all(requests);
      setFeedResults(results);
      setFeedState('success');

      // Persist to local history so /history page reflects the latest feed classifications
      try {
        const existing = JSON.parse(localStorage.getItem('classification_history') || '[]');
        const updated = [...results.map((r, i) => ({ id: `${Date.now()}-${i}`, ...r })), ...existing].slice(0, 50);
        localStorage.setItem('classification_history', JSON.stringify(updated));
      } catch {
        // Ignore local storage quota errors
      }
    } catch (err) {
      console.error('Classifier connection error:', err);
      setErrorMessage(
        err.code === 'ECONNABORTED'
          ? 'Connection to classifier service timed out. Please check if http://localhost:8000 is active.'
          : 'Unable to reach the Python classifier service at http://localhost:8000. Please ensure the service is running.'
      );
      setFeedState('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b0f19]/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
              <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Toxisense
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Feed Monitor
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/history"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </Link>

            {/* Admin link only visible if stored role is ADMIN */}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 border border-purple-500/30 transition-all"
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            )}

            <div className="h-5 w-px bg-slate-800 mx-1.5" />

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
              title="Clear session and log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-indigo-600/10 via-purple-600/10 to-rose-600/10 blur-[130px] rounded-full pointer-events-none" />

        {/* Hero & Feed Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Model Inference</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Twitter{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                Comment Stream
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Inspect tweets live through the DistilBERT neural classification pipeline with multi-label detection.
            </p>
          </div>

          <div>
            <button
              onClick={handleFetchFeed}
              disabled={feedState === 'loading'}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Rss className={`w-4 h-4 ${feedState === 'loading' ? 'animate-pulse' : ''}`} />
              <span>{feedState === 'loading' ? 'Analyzing Comments...' : 'Fetch Feed'}</span>
            </button>
          </div>
        </div>

        {/* 1. EMPTY STATE (Before first fetch) */}
        {feedState === 'idle' && (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-10 sm:p-14 text-center shadow-xl relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-inner">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Feed Loaded Yet</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-7 leading-relaxed">
              Click the <strong className="text-slate-200">"Fetch Feed"</strong> button above to load sample Twitter comments and evaluate them live with the classification engine.
            </p>
            <button
              onClick={handleFetchFeed}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <Rss className="w-4 h-4" />
              <span>Fetch Feed Now</span>
            </button>
          </div>
        )}

        {/* 2. LOADING STATE (Skeleton Cards) */}
        {feedState === 'loading' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Running DistilBERT sequence classification...</span>
            </div>

            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 sm:p-6 backdrop-blur-xl animate-pulse"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 w-24 bg-slate-800 rounded-full" />
                  <div className="h-4 w-28 bg-slate-800 rounded" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-slate-800 rounded w-full" />
                  <div className="h-4 bg-slate-800 rounded w-4/5" />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                  <div className="h-5 w-20 bg-slate-800 rounded-md" />
                  <div className="h-5 w-16 bg-slate-800 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. ERROR STATE (Classifier Unreachable with Retry Button) */}
        {feedState === 'error' && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-8 sm:p-10 text-center shadow-xl backdrop-blur-xl relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Classifier Service Unreachable</h2>
            <p className="text-sm text-rose-200/90 max-w-lg mx-auto mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={handleFetchFeed}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Fetch</span>
            </button>
          </div>
        )}

        {/* 4. SUCCESS STATE (Rendered Result Cards) */}
        {feedState === 'success' && feedResults.length > 0 && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
              <span>Showing <strong>{feedResults.length}</strong> classified tweets</span>
              <button
                onClick={handleFetchFeed}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-fetch Stream</span>
              </button>
            </div>

            {feedResults.map((item, index) => {
              const isToxic = item.label === 'toxic';

              return (
                <article
                  key={index}
                  className={`rounded-2xl bg-slate-900/80 border backdrop-blur-xl p-5 sm:p-6 transition-all shadow-lg hover:shadow-2xl ${
                    isToxic
                      ? 'border-rose-500/40 border-l-4 border-l-rose-500 shadow-rose-500/5'
                      : 'border-slate-800 border-l-4 border-l-emerald-500 shadow-emerald-500/5'
                  }`}
                >
                  {/* Top Bar: Verdict Badge & Confidence */}
                  <div className="flex items-center justify-between gap-3 mb-3.5">
                    {/* Strong Visual Distinction Badge */}
                    {isToxic ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Toxic</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Normal</span>
                      </span>
                    )}

                    {/* Confidence percentage */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Confidence:</span>
                      <span className="text-sm font-bold font-mono text-slate-200 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                        {(item.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Comment Text Body */}
                  <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 mb-4">
                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
                      "{item.text}"
                    </p>
                  </div>

                  {/* Bottom: Subcategory Tag Chips & Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                    {/* Subcategories (if toxic) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isToxic && item.subcategories && item.subcategories.length > 0 ? (
                        <>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Subcategories:
                          </span>
                          {item.subcategories.map((sub) => {
                            const config = SUBCATEGORY_CONFIG[sub] || {
                              label: sub.replace('_', ' '),
                              icon: AlertTriangle,
                              bg: 'bg-amber-500/15',
                              text: 'text-amber-300',
                              border: 'border-amber-500/30',
                            };
                            const IconComponent = config.icon;

                            return (
                              <span
                                key={sub}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
                              >
                                <IconComponent className="w-3.5 h-3.5" />
                                <span>{config.label}</span>
                              </span>
                            );
                          })}
                        </>
                      ) : !isToxic ? (
                        <span className="text-xs text-emerald-400/90 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>No toxic subcategories detected</span>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400/80">
                          General toxicity (no specific subcategory)
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono ml-auto">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
