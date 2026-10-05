import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  UserX, 
  Zap, 
  ArrowRight,
  Calendar,
  Layers,
  Flame,
  Radio
} from 'lucide-react';

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

// Hardcoded placeholder data: chronological past feed fetches
const PLACEHOLDER_FETCH_HISTORY = [
  {
    id: 'fetch-001',
    timestamp: '2026-10-03T18:42:00.000Z',
    summary: '5 comments fetched, 2 flagged toxic',
    totalComments: 5,
    toxicCount: 2,
    normalCount: 3,
    comments: [
      {
        text: "Shut up you stupid idiot, nobody asked for your trash opinion. Go delete your account.",
        label: "toxic",
        subcategories: ["insult"],
        confidence: 0.942,
        timestamp: "2026-10-03T18:42:01.000Z"
      },
      {
        text: "Just finished reading the new AI research paper, incredible advancements being made this year!",
        label: "normal",
        subcategories: [],
        confidence: 0.968,
        timestamp: "2026-10-03T18:42:02.000Z"
      },
      {
        text: "I know exactly where you live and I will find you and make you regret ever posting this.",
        label: "toxic",
        subcategories: ["threat"],
        confidence: 0.985,
        timestamp: "2026-10-03T18:42:03.000Z"
      },
      {
        text: "Loved the live concert tonight, the acoustic performance was absolutely wonderful and inspiring!",
        label: "normal",
        subcategories: [],
        confidence: 0.975,
        timestamp: "2026-10-03T18:42:04.000Z"
      },
      {
        text: "Excited to collaborate with our new open source contributors across the globe.",
        label: "normal",
        subcategories: [],
        confidence: 0.991,
        timestamp: "2026-10-03T18:42:05.000Z"
      }
    ]
  },
  {
    id: 'fetch-002',
    timestamp: '2026-10-02T14:15:30.000Z',
    summary: '12 comments fetched, 3 flagged toxic',
    totalComments: 12,
    toxicCount: 3,
    normalCount: 9,
    comments: [
      {
        text: "I hate people from that community, they are disgusting and should all be eliminated immediately.",
        label: "toxic",
        subcategories: ["identity_attack", "insult"],
        confidence: 0.961,
        timestamp: "2026-10-02T14:15:31.000Z"
      },
      {
        text: "Watch your back after work today, you won't make it to your car.",
        label: "toxic",
        subcategories: ["threat"],
        confidence: 0.978,
        timestamp: "2026-10-02T14:15:32.000Z"
      },
      {
        text: "You are the most pathetic clown on this whole platform, absolute joke of a human.",
        label: "toxic",
        subcategories: ["insult"],
        confidence: 0.934,
        timestamp: "2026-10-02T14:15:33.000Z"
      },
      {
        text: "What time does the conference live stream kick off tomorrow morning?",
        label: "normal",
        subcategories: [],
        confidence: 0.982,
        timestamp: "2026-10-02T14:15:34.000Z"
      },
      {
        text: "Thank you for the constructive code review feedback, updated the PR accordingly.",
        label: "normal",
        subcategories: [],
        confidence: 0.994,
        timestamp: "2026-10-02T14:15:35.000Z"
      }
    ]
  },
  {
    id: 'fetch-003',
    timestamp: '2026-10-01T09:30:15.000Z',
    summary: '8 comments fetched, 1 flagged toxic',
    totalComments: 8,
    toxicCount: 1,
    normalCount: 7,
    comments: [
      {
        text: "Get lost you brainless fraud, nobody wants your unsolicited advice here.",
        label: "toxic",
        subcategories: ["insult"],
        confidence: 0.912,
        timestamp: "2026-10-01T09:30:16.000Z"
      },
      {
        text: "Congratulations on the successful product launch team! Huge milestone achieved.",
        label: "normal",
        subcategories: [],
        confidence: 0.989,
        timestamp: "2026-10-01T09:30:17.000Z"
      },
      {
        text: "Looking forward to checking out the upcoming documentation release.",
        label: "normal",
        subcategories: [],
        confidence: 0.995,
        timestamp: "2026-10-01T09:30:18.000Z"
      }
    ]
  }
];

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

  // =========================================================================
  // TODO: Wire in GET /api/feed/history here to replace the hardcoded placeholder data.
  //
  // Example future implementation:
  // useEffect(() => {
  //   async function fetchHistory() {
  //     try {
  //       const res = await client.get('/api/feed/history');
  //       setFetches(res.data);
  //     } catch (err) {
  //       console.error("Failed to load feed history:", err);
  //     }
  //   }
  //   fetchHistory();
  // }, []);
  //
  // The state `fetches` will populate this chronological list directly.
  // =========================================================================
  const [fetches, setFetches] = useState(PLACEHOLDER_FETCH_HISTORY);

  // Track expanded/collapsed state per fetch entry
  const [expandedFetches, setExpandedFetches] = useState({
    'fetch-001': true, // First one open by default for immediate preview
  });

  const toggleExpand = (id) => {
    setExpandedFetches((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navigation Bar (reused from HomePage) */}
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
              to="/home"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Classifier</span>
            </Link>

            <Link
              to="/history"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 transition-all"
            >
              <HistoryIcon className="w-4 h-4" />
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

        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-2.5">
              <HistoryIcon className="w-3.5 h-3.5" />
              <span>Historical Inferences</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Feed Fetch{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                Audit History
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Chronological log of past Twitter feed extractions and multi-label toxicity assessments.
            </p>
          </div>

          <Link
            to="/home"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Fetch New Feed</span>
          </Link>
        </div>

        {/* EMPTY STATE */}
        {(!fetches || fetches.length === 0) ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-10 sm:p-14 text-center shadow-xl relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-inner">
              <Radio className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No fetches yet</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-7 leading-relaxed">
              No fetches yet — go to Homepage to fetch your first feed.
            </p>
            <Link
              to="/home"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
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
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl overflow-hidden shadow-xl transition-all"
                >
                  {/* Expandable/Collapsible Header Banner */}
                  <div
                    onClick={() => toggleExpand(fetchEntry.id)}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400">
                        <Layers className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-base text-white">
                            {fetchEntry.summary}
                          </h3>
                          {fetchEntry.toxicCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>{fetchEntry.toxicCount} Flagged</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formattedDate}</span>
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formattedTime}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-semibold text-indigo-400">
                        {isExpanded ? 'Hide comments' : 'View comments'}
                      </span>
                      <div className="p-1 rounded-lg bg-slate-800 text-slate-300">
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
                    <div className="p-5 sm:p-6 border-t border-slate-800/80 bg-slate-950/40 space-y-4 animate-in fade-in duration-200">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                        Evaluated Comments ({fetchEntry.comments.length})
                      </div>

                      {fetchEntry.comments.map((item, idx) => {
                        const isToxic = item.label === 'toxic';

                        return (
                          <article
                            key={idx}
                            className={`rounded-2xl bg-slate-900/80 border backdrop-blur-xl p-5 transition-all shadow-md ${
                              isToxic
                                ? 'border-rose-500/40 border-l-4 border-l-rose-500 shadow-rose-500/5'
                                : 'border-slate-800 border-l-4 border-l-emerald-500 shadow-emerald-500/5'
                            }`}
                          >
                            {/* Top Bar: Verdict Badge & Confidence */}
                            <div className="flex items-center justify-between gap-3 mb-3">
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

                            {/* Comment Text */}
                            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 mb-3.5">
                              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                                "{item.text}"
                              </p>
                            </div>

                            {/* Bottom: Subcategory Tag Chips & Timestamp */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
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
