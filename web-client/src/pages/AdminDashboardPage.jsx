import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
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
  RefreshCw,
  Clock,
  Lock
} from 'lucide-react';

// Hardcoded placeholder activity logs
const PLACEHOLDER_LOGS = [
  {
    id: 'log-101',
    actor: 'admin@toxisense.com',
    action_type: 'LOGIN',
    timestamp: '2026-10-03T19:25:10.000Z',
    outcome: 'SUCCESS',
    details: 'Admin authentication completed with 2FA'
  },
  {
    id: 'log-102',
    actor: 'sarah.jenkins@company.org',
    action_type: 'FEED_FETCH',
    timestamp: '2026-10-03T18:42:00.000Z',
    outcome: 'SUCCESS',
    details: 'Extracted 5 tweets, 2 flagged toxic'
  },
  {
    id: 'log-103',
    actor: 'david.kim@university.edu',
    action_type: '2FA_VERIFY',
    timestamp: '2026-10-03T17:10:45.000Z',
    outcome: 'FAILURE',
    details: 'Invalid TOTP code attempted (drift exceeded)'
  },
  {
    id: 'log-104',
    actor: 'admin@toxisense.com',
    action_type: 'USER_UPDATE',
    timestamp: '2026-10-03T15:30:20.000Z',
    outcome: 'SUCCESS',
    details: 'Updated status for user david.kim@university.edu to inactive'
  },
  {
    id: 'log-105',
    actor: 'alex.morris@gmail.com',
    action_type: 'CLASSIFY',
    timestamp: '2026-10-03T14:12:00.000Z',
    outcome: 'SUCCESS',
    details: 'Single comment classified (insult flagged)'
  },
  {
    id: 'log-106',
    actor: 'elena.rostova@techcorp.io',
    action_type: 'LOGIN',
    timestamp: '2026-10-03T12:05:30.000Z',
    outcome: 'SUCCESS',
    details: 'User session initialized'
  },
  {
    id: 'log-107',
    actor: 'unknown_client',
    action_type: 'ACCESS_ATTEMPT',
    timestamp: '2026-10-03T10:40:15.000Z',
    outcome: 'DENIED',
    details: 'Unauthorized API request to /api/logs without valid JWT'
  }
];

// Hardcoded placeholder users
const INITIAL_PLACEHOLDER_USERS = [
  {
    id: 'usr-001',
    email: 'admin@toxisense.com',
    role: 'ADMIN',
    status: 'active',
    createdAt: '2026-09-01'
  },
  {
    id: 'usr-002',
    email: 'sarah.jenkins@company.org',
    role: 'USER',
    status: 'active',
    createdAt: '2026-09-14'
  },
  {
    id: 'usr-003',
    email: 'david.kim@university.edu',
    role: 'USER',
    status: 'inactive',
    createdAt: '2026-09-18'
  },
  {
    id: 'usr-004',
    email: 'alex.morris@gmail.com',
    role: 'USER',
    status: 'active',
    createdAt: '2026-09-22'
  },
  {
    id: 'usr-005',
    email: 'elena.rostova@techcorp.io',
    role: 'USER',
    status: 'active',
    createdAt: '2026-09-25'
  }
];

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

  // Activity Logs filtering & pagination state
  const [userQuery, setUserQuery] = useState('');
  const [actionTypeQuery, setActionTypeQuery] = useState('ALL');
  const [dateRangeQuery, setDateRangeQuery] = useState('');
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 5;

  // =========================================================================
  // TODO: Wire in GET /api/logs here to replace the hardcoded activity log rows.
  //
  // Example future implementation:
  // useEffect(() => {
  //   async function loadLogs() {
  //     const res = await client.get('/api/logs', {
  //       params: { user: userQuery, action: actionTypeQuery, date: dateRangeQuery, page: logPage }
  //     });
  //     setLogs(res.data.logs);
  //   }
  //   loadLogs();
  // }, [userQuery, actionTypeQuery, dateRangeQuery, logPage]);
  // =========================================================================
  const [logs, setLogs] = useState(PLACEHOLDER_LOGS);

  // Filter logs locally for placeholder presentation
  const filteredLogs = logs.filter((log) => {
    if (userQuery && !log.actor.toLowerCase().includes(userQuery.toLowerCase())) {
      return false;
    }
    if (actionTypeQuery !== 'ALL' && log.action_type !== actionTypeQuery) {
      return false;
    }
    if (dateRangeQuery && !log.timestamp.startsWith(dateRangeQuery)) {
      return false;
    }
    return true;
  });

  const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage) || 1;
  const currentLogs = filteredLogs.slice((logPage - 1) * logsPerPage, logPage * logsPerPage);

  // User Management state
  // =========================================================================
  // TODO: Wire in GET /api/admin/users and PATCH /api/admin/users/:id here
  // to fetch users and persist active/inactive state changes.
  //
  // Example future implementation:
  // const toggleUserStatus = async (user) => {
  //   const updatedStatus = user.status === 'active' ? 'inactive' : 'active';
  //   await client.patch(`/api/admin/users/${user.id}`, { status: updatedStatus });
  //   setUsers(users.map(u => u.id === user.id ? { ...u, status: updatedStatus } : u));
  // };
  // =========================================================================
  const [users, setUsers] = useState(INITIAL_PLACEHOLDER_USERS);

  // Confirmation modal state before deactivating
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState(null);

  const handleToggleStatus = (user) => {
    if (user.status === 'active') {
      // Require confirmation step before deactivating
      setConfirmDeactivateUser(user);
    } else {
      // Activating can happen directly
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: 'active' } : u))
      );
    }
  };

  const confirmDeactivation = () => {
    if (confirmDeactivateUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirmDeactivateUser.id ? { ...u, status: 'inactive' } : u
        )
      );
      setConfirmDeactivateUser(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {/* Navigation Bar with subtle "Admin Mode" visual cues */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b0f19]/85 border-b border-purple-900/40 shadow-lg shadow-purple-950/20">
        {/* Top ambient Admin mode accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-rose-500" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo with "ADMIN" badge visual cue */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-0.5 shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/45 transition-all">
              <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Toxisense
              </span>
              <span className="text-[10px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20">
                ADMIN CONSOLE
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
            >
              <HistoryIcon className="w-4 h-4" />
              <span>History</span>
            </Link>

            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-600/25 text-purple-300 border border-purple-500/40 transition-all"
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Link>

            <div className="h-5 w-px bg-slate-800 mx-1.5" />

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

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
        {/* Subtle Purple-Indigo Ambient Glow for Admin Mode */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-gradient-to-tr from-purple-600/15 via-indigo-600/10 to-rose-600/10 blur-[130px] rounded-full pointer-events-none" />

        {/* Page Title & Admin Mode Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Authorized System Administrator</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Administrative{' '}
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-rose-400 bg-clip-text text-transparent">
                Command Center
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Inspect system audit trails, filter activity events, and manage user authorization statuses.
            </p>
          </div>

          {/* Section Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Activity Logs</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-5 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300 mb-3.5">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Activity Logs</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* User / Actor Search */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Actor / User
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => {
                        setUserQuery(e.target.value);
                        setLogPage(1);
                      }}
                      placeholder="Search email or actor..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Action Type Filter */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Action Type
                  </label>
                  <select
                    value={actionTypeQuery}
                    onChange={(e) => {
                      setActionTypeQuery(e.target.value);
                      setLogPage(1);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="ALL">All Action Types</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="2FA_VERIFY">2FA_VERIFY</option>
                    <option value="FEED_FETCH">FEED_FETCH</option>
                    <option value="USER_UPDATE">USER_UPDATE</option>
                    <option value="CLASSIFY">CLASSIFY</option>
                    <option value="ACCESS_ATTEMPT">ACCESS_ATTEMPT</option>
                  </select>
                </div>

                {/* Date Range / Specific Date Filter */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Date Filter
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={dateRangeQuery}
                      onChange={(e) => {
                        setDateRangeQuery(e.target.value);
                        setLogPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Logs Table */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span>Activity Log Entries ({filteredLogs.length})</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Page {logPage} of {totalLogPages}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">Actor</th>
                      <th className="py-3.5 px-6">Action Type</th>
                      <th className="py-3.5 px-6">Timestamp</th>
                      <th className="py-3.5 px-6">Outcome</th>
                      <th className="py-3.5 px-6">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {currentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          No log entries match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      currentLogs.map((log) => {
                        const isSuccess = log.outcome === 'SUCCESS';
                        const isDenied = log.outcome === 'DENIED';

                        return (
                          <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-6 text-slate-200 font-mono font-medium">
                              {log.actor}
                            </td>
                            <td className="py-3.5 px-6">
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/25">
                                {log.action_type}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-slate-400 font-mono whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              {isSuccess && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>SUCCESS</span>
                                </span>
                              )}
                              {isDenied && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  <span>DENIED</span>
                                </span>
                              )}
                              {!isSuccess && !isDenied && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>{log.outcome}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-slate-400 max-w-xs truncate">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-300 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-xs text-slate-400">
                  Showing page <span className="font-semibold text-white">{logPage}</span> of {totalLogPages}
                </span>

                <button
                  onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                  disabled={logPage >= totalLogPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-300 transition-colors"
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
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>User Accounts Directory ({users.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage authentication permissions and active account statuses
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-6">User Email</th>
                      <th className="py-3.5 px-6">Role</th>
                      <th className="py-3.5 px-6">Account Status</th>
                      <th className="py-3.5 px-6">Registered</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {users.map((user) => {
                      const isActive = user.status === 'active';

                      return (
                        <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-6 text-slate-200 font-mono font-medium">
                            {user.email}
                          </td>
                          <td className="py-3.5 px-6">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider ${
                                user.role === 'ADMIN'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-6">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                <span>Inactive</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-slate-400 font-mono">
                            {user.createdAt}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            {isActive ? (
                              <button
                                onClick={() => handleToggleStatus(user)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Deactivate</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(user)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
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
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL BEFORE DEACTIVATION */}
        {confirmDeactivateUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative z-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">
                Confirm User Deactivation
              </h3>

              <p className="text-sm text-slate-300 mb-2">
                Are you sure you want to deactivate <strong className="text-rose-400 font-mono">{confirmDeactivateUser.email}</strong>?
              </p>

              <p className="text-xs text-slate-500 mb-6">
                This user will immediately be blocked from logging into Toxisense and cannot fetch or evaluate comment feeds.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeactivateUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDeactivation}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
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
