import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
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

// Subcategory tag chip configurations matching exact classifier labels
const SUBCATEGORY_CONFIG = {
  threat: {
    label: 'Threat',
    icon: ShieldAlert,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  insult: {
    label: 'Insult',
    icon: UserX,
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  identity_attack: {
    label: 'Identity Attack',
    icon: Zap,
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
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

  // Single comment classification states
  const [customText, setCustomText] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customResult, setCustomResult] = useState(null);
  const [customError, setCustomError] = useState('');

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
      const res = await client.post('/api/feed/fetch');
      const results = res.data;
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
      console.error('Feed retrieval/classifier error:', err);
      const backendError = err.response?.data?.error;
      setErrorMessage(
        backendError ||
        (err.code === 'ECONNABORTED'
          ? 'Connection to backend timed out. Please check if http://localhost:5000 is active.'
          : 'Unable to fetch comments from backend feed service. Please ensure backend and classifier are running.')
      );
      setFeedState('error');
    }
  };

  /**
   * Single Comment Classify Handler
   * Dispatches POST /api/feed/classify { text } to backend
   */
  const handleClassifyCustom = async () => {
    const trimmed = customText.trim();
    if (!trimmed || customLoading) return;

    setCustomLoading(true);
    setCustomError('');

    try {
      const res = await client.post('/api/feed/classify', { text: trimmed });
      setCustomResult(res.data);

      // Persist to local history as well
      try {
        const existing = JSON.parse(localStorage.getItem('classification_history') || '[]');
        const updated = [{ id: `${Date.now()}-custom`, ...res.data }, ...existing].slice(0, 50);
        localStorage.setItem('classification_history', JSON.stringify(updated));
      } catch {
        // Ignore quota errors
      }
    } catch (err) {
      console.error('Single comment classification error:', err);
      const serverErr = err.response?.data?.error;
      const message = serverErr || (err.code === 'ECONNABORTED'
        ? 'Connection timed out. Please verify that http://localhost:5000 is reachable.'
        : 'Unable to classify comment. Please verify that the backend and classifier are running.');
      setCustomError(message);
    } finally {
      setCustomLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-transparent border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-rose-400 p-0.5 shadow-lg shadow-purple-900/20 group-hover:shadow-purple-900/40 transition-all">
              <div className="w-full h-full bg-white/20 backdrop-blur-sm rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg text-white">
                Toxisense
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/25">
                Feed Monitor
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/history"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </Link>

            {/* Admin link only visible if stored role is ADMIN */}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium text-white/90 hover:text-white hover:bg-white/15 border border-white/20 transition-all"
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            )}

            <div className="h-5 w-px bg-white/20 mx-1.5" />

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 border border-transparent hover:border-white/20 transition-all cursor-pointer"
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
        {/* Classify a Comment Section */}
        <section className="glass-card p-6 sm:p-8 mb-10 shadow-xl relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="display-title text-2xl sm:text-3xl !text-slate-800">
                Classify a Comment
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-4 font-sans">
            Type or paste any custom comment to run instant neural toxicity detection and subcategory analysis.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleClassifyCustom();
            }}
            className="space-y-3"
          >
            <div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value.slice(0, 1000))}
                placeholder="Enter a comment or tweet to analyze for toxicity..."
                rows={3}
                maxLength={1000}
                className="w-full p-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-y min-h-[90px]"
              />
              <div className="flex items-center justify-between mt-1 text-xs px-1">
                <span className="text-slate-500">Maximum 1000 characters</span>
                <span
                  className={`font-mono text-xs ${
                    customText.length >= 950 ? 'text-amber-600 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {customText.length}/1000
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              {customResult && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomText('');
                    setCustomResult(null);
                    setCustomError('');
                  }}
                  className="btn-outline text-xs py-2 px-4 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={!customText.trim() || customLoading}
                className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {customLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Classifying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Classify</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Plain-Language Error with Retry Button */}
          {customError && (
            <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{customError}</span>
              </div>
              <button
                type="button"
                onClick={handleClassifyCustom}
                disabled={customLoading}
                className="rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-4 py-1.5 shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-end sm:self-auto disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${customLoading ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Result Area under Input */}
          {customResult && (
            <div className="mt-6 pt-5 border-t border-slate-200/80">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600 mb-3 px-0.5">
                <span>Classification Result</span>
                <span className="text-[11px] font-normal text-slate-500 normal-case">
                  Single Comment Analysis
                </span>
              </div>

              {(() => {
                const isToxic = customResult.label === 'toxic';

                return (
                  <article
                    className={`glass-card p-5 sm:p-6 transition-all shadow-md hover:shadow-lg ${
                      isToxic
                        ? 'border-l-4 !border-l-red-500'
                        : 'border-l-4 !border-l-green-500'
                    }`}
                  >
                    {/* Top Bar: Verdict Badge & Confidence */}
                    <div className="flex items-center justify-between gap-3 mb-3.5">
                      {isToxic ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <span>Toxic</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          <span>Normal</span>
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Confidence:</span>
                        <span className="text-sm font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {(customResult.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Comment Text Body */}
                    <div className="bg-white/70 rounded-xl p-4 border border-slate-200/80 mb-4">
                      <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-sans">
                        "{customResult.text}"
                      </p>
                    </div>

                    {/* Bottom: Subcategory Tag Chips & Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                      <div className="flex flex-wrap items-center gap-2">
                        {isToxic && customResult.subcategories && customResult.subcategories.length > 0 ? (
                          <>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                              Subcategories:
                            </span>
                            {customResult.subcategories.map((sub) => {
                              const config = SUBCATEGORY_CONFIG[sub] || {
                                label: sub.replace('_', ' '),
                                icon: AlertTriangle,
                                bg: 'bg-amber-50',
                                text: 'text-amber-700',
                                border: 'border-amber-200',
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
                          <span className="text-xs text-green-700 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            <span>No toxic subcategories detected</span>
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 font-medium">
                            General toxicity (no specific subcategory)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono ml-auto">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(customResult.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </article>
                );
              })()}
            </div>
          )}
        </section>

        {/* Hero & Feed Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold mb-2.5 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Model Inference</span>
            </div>
            <h1 className="display-title text-4xl sm:text-6xl text-white">
              Twitter Comment Stream
            </h1>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Inspect tweets live through the DistilBERT neural classification pipeline with multi-label detection.
            </p>
          </div>

          <div>
            <button
              onClick={handleFetchFeed}
              disabled={feedState === 'loading'}
              className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3 text-sm shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Rss className={`w-4 h-4 ${feedState === 'loading' ? 'animate-pulse' : ''}`} />
              <span>{feedState === 'loading' ? 'Analyzing Comments...' : 'Fetch Feed'}</span>
            </button>
          </div>
        </div>

        {/* 1. EMPTY STATE (Before first fetch) */}
        {feedState === 'idle' && (
          <div className="glass-card p-10 sm:p-14 text-center shadow-xl relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mx-auto mb-4 text-purple-700 shadow-inner">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <h2 className="display-title text-2xl sm:text-3xl !text-slate-800 mb-2">No Feed Loaded Yet</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto mb-7 leading-relaxed font-sans">
              Click the <strong className="text-slate-800 font-semibold">"Fetch Feed"</strong> button above to load sample Twitter comments and evaluate them live with the classification engine.
            </p>
            <button
              onClick={handleFetchFeed}
              className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm shadow-lg cursor-pointer"
            >
              <Rss className="w-4 h-4" />
              <span>Fetch Feed Now</span>
            </button>
          </div>
        )}

        {/* 2. LOADING STATE (Skeleton Cards) */}
        {feedState === 'loading' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/90 mb-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Running DistilBERT sequence classification...</span>
            </div>

            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="glass-card p-5 sm:p-6 animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="h-6 w-24 bg-slate-200/80 rounded-full" />
                  <div className="h-4 w-28 bg-slate-200/80 rounded" />
                </div>
                <div className="space-y-2 mb-2">
                  <div className="h-4 bg-slate-200/80 rounded w-full" />
                  <div className="h-4 bg-slate-200/80 rounded w-4/5" />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                  <div className="h-5 w-20 bg-slate-200/80 rounded-md" />
                  <div className="h-5 w-16 bg-slate-200/80 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. ERROR STATE (Classifier Unreachable with Retry Button) */}
        {feedState === 'error' && (
          <div className="glass-card !bg-red-50/90 !border-red-200 p-8 sm:p-10 text-center shadow-xl relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="display-title text-xl sm:text-2xl !text-red-900 mb-2">Classifier Service Unreachable</h2>
            <p className="text-sm text-red-700 max-w-lg mx-auto mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={handleFetchFeed}
              className="rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-6 py-2.5 shadow-lg shadow-red-600/30 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Fetch</span>
            </button>
          </div>
        )}

        {/* 4. SUCCESS STATE (Rendered Result Cards) */}
        {feedState === 'success' && feedResults.length > 0 && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between text-xs text-white/90 mb-2 px-1 font-medium">
              <span>Showing <strong>{feedResults.length}</strong> classified tweets</span>
              <button
                onClick={handleFetchFeed}
                className="btn-outline text-xs py-1 px-3.5 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-fetch Stream</span>
              </button>
            </div>

            {feedResults.map((item, index) => {
              const isToxic = item.label === 'toxic';

              return (
                <article
                  key={index}
                  className={`glass-card p-5 sm:p-6 transition-all shadow-lg hover:shadow-2xl ${
                    isToxic
                      ? 'border-l-4 !border-l-red-500'
                      : 'border-l-4 !border-l-green-500'
                  }`}
                >
                  {/* Top Bar: Verdict Badge & Confidence */}
                  <div className="flex items-center justify-between gap-3 mb-3.5">
                    {/* Light Tint Verdict Badges */}
                    {isToxic ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span>Toxic</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        <span>Normal</span>
                      </span>
                    )}

                    {/* Confidence percentage */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Confidence:</span>
                      <span className="text-sm font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {(item.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Comment Text Body */}
                  <div className="bg-white/70 rounded-xl p-4 border border-slate-200/80 mb-4">
                    <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-sans">
                      "{item.text}"
                    </p>
                  </div>

                  {/* Bottom: Subcategory Tag Chips & Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                    {/* Subcategories (if toxic) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isToxic && item.subcategories && item.subcategories.length > 0 ? (
                        <>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                            Subcategories:
                          </span>
                          {item.subcategories.map((sub) => {
                            const config = SUBCATEGORY_CONFIG[sub] || {
                              label: sub.replace('_', ' '),
                              icon: AlertTriangle,
                              bg: 'bg-amber-50',
                              text: 'text-amber-700',
                              border: 'border-amber-200',
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
                        <span className="text-xs text-green-700 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          <span>No toxic subcategories detected</span>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">
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
