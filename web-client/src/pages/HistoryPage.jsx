import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { 
  ShieldAlert, 
  History as HistoryIcon, 
  Shield, 
  LogOut, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles,   
  ArrowRight,
  Calendar,
  Layers,
  Radio,
  RefreshCw
} from 'lucide-react';
import { SUBCATEGORY_CONFIG } from '../constants/subcategories';

export default function HistoryPage() {
  const navigate = useNavigate();

  // Role detection for Nav bar (Admin link only visible if stored role is ADMIN)
  const storedRole = localStorage.getItem('role') || (() => {
    try {
      return JSON.parse(localStorage.getItem('user'))?.role;
    } catch {
      return null;
    }
  })();
  const isAdmin = storedRole === 'ADMIN';

  // Logout handler
  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const [fetches, setFetches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track expanded/collapsed state per fetch entry
  const [expandedFetches, setExpandedFetches] = useState({});

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await client.get('/api/feed/history');
      const data = res.data || [];
      setFetches(data);
      if (data.length > 0) {
        setExpandedFetches({ [data[0].id]: true });
      }
    } catch (err) {
      console.error('Failed to load feed history from database:', err);
      setError(err.response?.data?.error || 'Failed to load feed history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const toggleExpand = (id) => {
    setExpandedFetches((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
              to="/home"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Classifier</span>
            </Link>

            <Link
              to="/history"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30 transition-all shadow-sm"
            >
              <HistoryIcon className="w-4 h-4" />
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
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold mb-2.5 backdrop-blur-sm">
              <HistoryIcon className="w-3.5 h-3.5" />
              <span>Historical Inferences</span>
            </div>
            <h1 className="display-title text-4xl sm:text-6xl text-white">
              Feed Fetch Audit History
            </h1>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Chronological log of past Twitter feed extractions and multi-label toxicity assessments.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={loadHistory}
              disabled={loading}
              className="btn-outline text-sm py-2 px-4 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Refresh history from database"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              to="/home"
              className="btn-primary text-sm py-2 px-5 inline-flex items-center gap-2 shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              <span>Fetch New Feed</span>
            </Link>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="glass-card p-14 text-center shadow-xl relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mx-auto mb-3 text-purple-700 shadow-inner">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Loading Feed History</h3>
            <p className="text-xs text-slate-600">Querying your past inferences from PostgreSQL...</p>
          </div>
        ) : error ? (
          <div className="glass-card !bg-red-50/90 !border-red-200 p-6 text-center text-red-700 text-sm relative z-10 mb-6">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-red-600" />
            <span>{error}</span>
          </div>
        ) : (!fetches || fetches.length === 0) ? (
          <div className="glass-card p-10 sm:p-14 text-center shadow-xl relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mx-auto mb-4 text-purple-700 shadow-inner">
              <Radio className="w-7 h-7 text-purple-700" />
            </div>
            <h2 className="display-title text-2xl sm:text-3xl !text-slate-800 mb-2">No fetches yet</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto mb-7 leading-relaxed font-sans">
              No past extractions found in database for this account. Fetch a feed on the Homepage to generate your first audit log!
            </p>
            <Link
              to="/home"
              className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm shadow-lg"
            >
              <span>Go to Homepage</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* CHRONOLOGICAL LIST OF PAST FEED FETCHES */
          <div className="space-y-6 relative z-10">
            {fetches.map((fetchEntry) => {
              const isExpanded = !!expandedFetches[fetchEntry.id];
              const dateObj = new Date(fetchEntry.timestamp);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={fetchEntry.id}
                  className="glass-card overflow-hidden shadow-xl transition-all"
                >
                  {/* Expandable/Collapsible Header Banner */}
                  <div
                    onClick={() => toggleExpand(fetchEntry.id)}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/40 transition-colors select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 text-purple-700">
                        <Layers className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-base text-slate-800">
                            {fetchEntry.summary}
                          </h3>
                          {fetchEntry.toxicCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              <span>{fetchEntry.toxicCount} Flagged</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formattedDate}</span>
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formattedTime}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-semibold text-indigo-600">
                        {isExpanded ? 'Hide comments' : 'View comments'}
                      </span>
                      <div className="p-1 rounded-lg bg-slate-100 text-slate-600">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content: Reused Comment Cards from HomePage */}
                  {isExpanded && (
                    <div className="p-5 sm:p-6 border-t border-slate-200 bg-white/40 space-y-4 animate-in fade-in duration-200">
                      <div className="text-xs text-slate-600 font-semibold uppercase tracking-wider mb-2">
                        Evaluated Comments ({fetchEntry.comments.length})
                      </div>

                      {fetchEntry.comments.map((item, idx) => {
                        const isToxic = item.label === 'toxic';

                        return (
                          <article
                            key={idx}
                            className={`glass-card p-5 transition-all shadow-md ${
                              isToxic
                                ? 'border-l-4 !border-l-red-500'
                                : 'border-l-4 !border-l-green-500'
                            }`}
                          >
                            {/* Top Bar: Verdict Badge & Confidence */}
                            <div className="flex items-center justify-between gap-3 mb-3">
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

                            {/* Comment Text */}
                            <div className="bg-white/70 rounded-xl p-3.5 border border-slate-200/80 mb-3.5">
                              <p className="text-sm text-slate-800 leading-relaxed font-sans">
                                "{item.text}"
                              </p>
                            </div>

                            {/* Bottom: Subcategory Tag Chips & Timestamp */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
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
                                    General toxicity
                                  </span>
                                )}
                              </div>

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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
