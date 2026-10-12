import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import client from '../api/client';
import { 
  ShieldAlert, 
  Shield, 
  Activity, 
  Users, 
  Search, 
  Calendar, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Sparkles, 
  History as HistoryIcon,
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  Lock,
  RefreshCw
} from 'lucide-react';

// Helper to extract actor display name (email or shortened actor_id)
function getActorDisplay(log) {
  const email =
    log.details_json?.requestBody?.email ||
    log.details_json?.responseBody?.user?.email;

  if (email && email !== '[REDACTED]') {
    return email;
  }

  const actorId = log.actor_id || 'anonymous';
  if (actorId.length > 16) {
    return `${actorId.slice(0, 8)}...${actorId.slice(-4)}`;
  }
  return actorId;
}

// Helper to format action_type in a human-readable form
function formatActionType(action) {
  if (!action) return 'Unknown Action';
  const mapping = {
    'POST_API_AUTH_LOGIN': 'Login',
    'POST_API_ADMIN_LOGIN': 'Admin Login',
    'POST_API_AUTH_REGISTER': 'Register',
    'POST_API_AUTH_2FA_VERIFY': '2FA Verification',
    'POST_API_AUTH_RESET_PASSWORD': 'Password Reset',
    'POST_API_FEED_CLASSIFY': 'Classify Comment',
    'POST_API_FEED_FETCH': 'Fetch Feed',
    'GET_API_FEED_HISTORY': 'Feed History',
    'GET_API_LOGS': 'Retrieve Logs',
    'GET_API_ADMIN_USERS': 'Retrieve Users',
    'PATCH_API_ADMIN_USERS_STATUS': 'Update User Status',
    'PATCH_API_ADMIN_USERS_ID_STATUS': 'Update User Status',
    'PATCH_API_ADMIN_USERS_ID': 'Update User',
  };
  if (mapping[action]) {
    return mapping[action];
  }
  return action
    .replace(/^([A-Z]+)_API_/, '$1 ')
    .replace(/_/g, ' ');
}

// Helper to format details snippet
function formatDetailsSnippet(details) {
  if (!details) return '-';
  if (typeof details === 'string') return details;
  if (details.responseBody?.error) {
    return `Error: ${details.responseBody.error}`;
  }
  if (details.responseBody?.message) {
    return details.responseBody.message;
  }
  if (details.path) {
    return `${details.method || ''} ${details.path} (${details.statusCode || 200})`.trim();
  }
  return JSON.stringify(details);
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  // Route Gating: Check the stored role in localStorage
  // If it's not "ADMIN", redirect to /home immediately!
  const storedRole = localStorage.getItem('role') || (() => {
    try {
      return JSON.parse(localStorage.getItem('user'))?.role;
    } catch {
      return null;
    }
  })();

  if (storedRole !== 'ADMIN') {
    return <Navigate to="/home" replace />;
  }

  // Active tab state: 'logs' | 'users'
  const [activeTab, setActiveTab] = useState('logs');

  // Activity Logs filtering, pagination & live data state
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [userQuery, setUserQuery] = useState('');
  const [debouncedUser, setDebouncedUser] = useState('');
  const [actionTypeQuery, setActionTypeQuery] = useState('ALL');
  const [dateRangeQuery, setDateRangeQuery] = useState('');
  const [logPage, setLogPage] = useState(1);

  // Debounce the user filter by ~400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUser(userQuery.trim());
      setLogPage(1);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [userQuery]);

  // Load logs in a useEffect that re-runs when filters or page change
  useEffect(() => {
    let isCancelled = false;

    const fetchLogs = async () => {
      setLoadingLogs(true);
      setLogsError(null);

      try {
        const params = {
          page: logPage,
          limit: 10
        };

        if (debouncedUser) {
          params.user = debouncedUser;
        }

        if (actionTypeQuery && actionTypeQuery !== 'ALL') {
          params.action = actionTypeQuery;
        }

        if (dateRangeQuery) {
          params.date = dateRangeQuery;
        }

        const res = await client.get('/api/logs', { params });
        if (!isCancelled) {
          setLogs(res.data?.logs || []);
          setPagination(res.data?.pagination || { page: logPage, limit: 10, total: 0, pages: 1 });
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error fetching activity logs:', err);
          const serverErr = err.response?.data?.error;
          setLogsError(serverErr || (err.code === 'ECONNABORTED'
            ? 'Request timed out while connecting to the server.'
            : 'Unable to load activity logs from server. Please verify backend connection.'));
        }
      } finally {
        if (!isCancelled) {
          setLoadingLogs(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isCancelled = true;
    };
  }, [debouncedUser, actionTypeQuery, dateRangeQuery, logPage, refreshKey]);

  // User Management state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [userActionError, setUserActionError] = useState(null);

  // Current logged in admin info (to prevent self-deactivation)
  const currentAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch {
      return {};
    }
  })();

  // Fetch real users from backend API
  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const res = await client.get('/api/admin/users');
      setUsers(res.data?.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      const serverErr = err.response?.data?.error;
      setUsersError(
        serverErr ||
          (err.code === 'ECONNABORTED'
            ? 'Request timed out while connecting to the server.'
            : 'Unable to load user accounts from database.')
      );
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshKey]);

  // Confirmation modal state before deactivating
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState(null);

  const handleToggleStatus = (user) => {
    setUserActionError(null);
    if (user.status === 'active') {
      // Require confirmation step before deactivating
      setConfirmDeactivateUser(user);
    } else {
      executeStatusUpdate(user.id, 'active');
    }
  };

  const executeStatusUpdate = async (userId, newStatus) => {
    setUpdatingUserId(userId);
    setUserActionError(null);
    try {
      await client.patch(`/api/admin/users/${userId}/status`, { status: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      // Refresh audit logs so this administrative action appears immediately
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(`Error updating user status to ${newStatus}:`, err);
      setUserActionError(err.response?.data?.error || `Failed to update status to ${newStatus}.`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const confirmDeactivation = async () => {
    if (confirmDeactivateUser) {
      const targetId = confirmDeactivateUser.id;
      setConfirmDeactivateUser(null);
      await executeStatusUpdate(targetId, 'inactive');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navigation Bar with transparent backdrop and white text */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-transparent border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo with "ADMIN CONSOLE" badge visual cue */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-rose-400 p-0.5 shadow-lg shadow-purple-900/20 group-hover:shadow-purple-900/40 transition-all">
              <div className="w-full h-full bg-white/20 backdrop-blur-sm rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white">
                Toxisense
              </span>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/25">
                ADMIN CONSOLE
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all"
            >
              <HistoryIcon className="w-4 h-4" />
              <span>History</span>
            </Link>

            <Link
              to="/admin"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30 transition-all shadow-sm"
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Link>

            <div className="h-5 w-px bg-white/20 mx-1.5" />

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

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
        {/* Page Title & Admin Mode Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold mb-2.5 backdrop-blur-sm">
              <Lock className="w-3.5 h-3.5" />
              <span>Authorized System Administrator</span>
            </div>
            <h1 className="display-title text-4xl sm:text-6xl text-white">
              Administrative Command Center
            </h1>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Inspect system audit trails, filter activity events, and manage user authorization statuses.
            </p>
          </div>

          {/* Section Tabs */}
          <div className="flex p-1 rounded-full glass-card shadow-lg self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Activity Logs</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Management</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ACTIVITY LOGS */}
        {/* ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-6 relative z-10 animate-in fade-in duration-200">
            {/* Filter Controls Bar */}
            <div className="glass-card p-5 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3.5">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Activity Logs</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* User / Actor Search */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Actor / User
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => {
                        setUserQuery(e.target.value);
                        setLogPage(1);
                      }}
                      placeholder="Search email or actor..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Action Type Filter */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Action Type
                  </label>
                  <select
                    value={actionTypeQuery}
                    onChange={(e) => {
                      setActionTypeQuery(e.target.value);
                      setLogPage(1);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="ALL">ALL</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="REGISTER">REGISTER</option>
                    <option value="2FA">2FA</option>
                    <option value="FEED">FEED</option>
                    <option value="CLASSIFY">CLASSIFY</option>
                    <option value="RESET">RESET</option>
                  </select>
                </div>

                {/* Date Range / Specific Date Filter */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                    Date Filter
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={dateRangeQuery}
                      onChange={(e) => {
                        setDateRangeQuery(e.target.value);
                        setLogPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {logsError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-medium">{logsError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  className="px-3.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Logs Table */}
            <div className="glass-card overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-700" />
                  <span>Activity Log Entries ({pagination.total})</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Page {pagination.page} of {pagination.pages || 1}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Actor</th>
                      <th className="py-3.5 px-6">Action</th>
                      <th className="py-3.5 px-6">Timestamp</th>
                      <th className="py-3.5 px-6">Outcome</th>
                      <th className="py-3.5 px-6">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-sans">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
                            <span className="inline-block w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                            <span>Loading activity logs...</span>
                          </div>
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500 text-xs font-medium">
                          No log entries match these filters.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const actorDisplay = getActorDisplay(log);
                        const actionReadable = formatActionType(log.action_type);
                        const outcome = (log.details_json?.outcome || log.outcome || '').toLowerCase();
                        const isSuccess = outcome === 'success';

                        return (
                          <tr key={log.id} className="hover:bg-purple-50/40 transition-colors">
                            {/* Actor with actor_type badge */}
                            <td className="py-3.5 px-6">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="text-slate-800 font-mono font-medium text-xs">
                                  {actorDisplay}
                                </span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                                  log.actor_type === 'ADMIN'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : log.actor_type === 'USER'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {log.actor_type || 'GUEST'}
                                </span>
                              </div>
                            </td>

                            {/* Action in readable form */}
                            <td className="py-3.5 px-6">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-slate-800 text-xs">
                                  {actionReadable}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {log.action_type}
                                </span>
                              </div>
                            </td>

                            {/* Timestamp */}
                            <td className="py-3.5 px-6 text-slate-600 font-mono whitespace-nowrap text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>

                            {/* Outcome: Green or Red badge */}
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              {isSuccess ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                                  <span>SUCCESS</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                  <XCircle className="w-3 h-3 text-red-600" />
                                  <span>FAILURE</span>
                                </span>
                              )}
                            </td>

                            {/* Details */}
                            <td className="py-3.5 px-6 text-slate-600 max-w-xs truncate text-xs" title={typeof log.details_json === 'object' ? JSON.stringify(log.details_json) : log.details}>
                              {formatDetailsSnippet(log.details_json || log.details)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls driven by pagination.pages */}
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage <= 1 || loadingLogs}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition-colors shadow-sm cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-xs text-slate-600 font-medium">
                  Showing page <span className="font-semibold text-slate-800">{pagination.page || logPage}</span> of {pagination.pages || 1}
                </span>

                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.min(pagination.pages || 1, p + 1))}
                  disabled={logPage >= (pagination.pages || 1) || loadingLogs}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition-colors shadow-sm cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: USER MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-6 relative z-10 animate-in fade-in duration-200">
            {userActionError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
                <span>{userActionError}</span>
                <button
                  onClick={() => setUserActionError(null)}
                  className="font-bold underline ml-2 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="glass-card overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-700" />
                    <span>User Accounts Directory ({users.length})</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Manage authentication permissions and active account statuses
                  </p>
                </div>

                <button
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh users"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {usersError ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">Failed to Load Users</p>
                  <p className="text-xs text-slate-500 mb-4">{usersError}</p>
                  <button
                    onClick={fetchUsers}
                    className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : loadingUsers && users.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                  <span>Loading user accounts from database...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No user accounts found in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-6">User Email</th>
                        <th className="py-3.5 px-6">Role</th>
                        <th className="py-3.5 px-6">Account Status</th>
                        <th className="py-3.5 px-6">Registered</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 font-sans">
                      {users.map((user) => {
                        const isActive = user.status === 'active';
                        const isCurrentAdmin =
                          user.id === currentAdmin.id || user.email === currentAdmin.email;
                        const isUpdating = updatingUserId === user.id;

                        return (
                          <tr key={user.id} className="hover:bg-purple-50/40 transition-colors">
                            <td className="py-3.5 px-6 text-slate-800 font-mono font-medium">
                              <div className="flex items-center gap-2">
                                <span>{user.email}</span>
                                {isCurrentAdmin && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                                    You
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                  user.role === 'ADMIN'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-6">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                  <span>Inactive</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-slate-600 font-mono">
                              {user.createdAt}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              {isCurrentAdmin ? (
                                <span className="text-[11px] text-slate-400 italic font-sans pr-2">
                                  Protected
                                </span>
                              ) : isActive ? (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                                >
                                  {isUpdating ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <UserX className="w-3.5 h-3.5" />
                                  )}
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                                >
                                  {isUpdating ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                  <span>Activate</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL BEFORE DEACTIVATION */}
        {confirmDeactivateUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass-card w-full max-w-md p-6 shadow-2xl relative z-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="display-title text-xl sm:text-2xl !text-slate-800 mb-2">
                Confirm User Deactivation
              </h3>

              <p className="text-sm text-slate-600 mb-2">
                Are you sure you want to deactivate <strong className="text-red-700 font-mono">{confirmDeactivateUser.email}</strong>?
              </p>

              <p className="text-xs text-slate-500 mb-6">
                This user will immediately be blocked from logging into Toxisense and cannot fetch or evaluate comment feeds.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeactivateUser(null)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDeactivation}
                  className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                >
                  Confirm Deactivation
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
