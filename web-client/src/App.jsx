import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, ShieldAlert, Cpu, Database, LayoutGrid, Terminal, Play, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// In Docker Compose, the browser accesses both services on localhost ports
const CLASSIFIER_URL = 'http://localhost:8000';

export default function App() {
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', details: null });
  const [classifierHealth, setClassifierHealth] = useState({ status: 'checking', details: null });
  const [testText, setTestText] = useState('I hate when stupid people ruin my day!');
  const [classifyResult, setClassifyResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    // Check Backend API
    try {
      setBackendHealth({ status: 'checking', details: null });
      const res = await axios.get(`${API_URL}/api/health`, { timeout: 3000 });
      setBackendHealth({ status: 'online', details: res.data });
    } catch (err) {
      setBackendHealth({ status: 'offline', details: err.message });
    }

    // Check Classifier API
    try {
      setClassifierHealth({ status: 'checking', details: null });
      const res = await axios.get(`${CLASSIFIER_URL}/health`, { timeout: 3000 });
      setClassifierHealth({ status: 'online', details: res.data });
    } catch (err) {
      setClassifierHealth({ status: 'offline', details: err.message });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleTestClassify = async (e) => {
    e.preventDefault();
    if (!testText.trim()) return;
    setLoading(true);
    setClassifyResult(null);
    try {
      const res = await axios.post(`${CLASSIFIER_URL}/classify`, { text: testText });
      setClassifyResult(res.data);
    } catch (err) {
      setClassifyResult({ 
        error: true,
        message: err.response?.data?.detail || "Could not connect to classification service." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-indigo-600/10 rounded-lg text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <ShieldAlert size={24} className="animate-pulse" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Toxic Twitter Comment Classification System</h1>
              <p className="text-xs text-slate-400">Phase 1 Monorepo Scaffolding & Health Dashboard</p>
            </div>
          </div>
          <button 
            onClick={checkHealth}
            className="flex items-center space-x-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold rounded-lg border border-slate-700 transition duration-200"
          >
            <RefreshCw size={14} className={backendHealth.status === 'checking' ? 'animate-spin' : ''} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Services overview & status */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center space-x-2">
              <Activity size={20} className="text-indigo-400" />
              <span>Service Architecture & Health Registry</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card 1: Express Backend */}
              <div className="bg-[#0f172a]/60 rounded-xl border border-slate-800 p-5 flex flex-col justify-between transition-all hover:border-slate-700/80">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
                      <Database size={22} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 ${
                      backendHealth.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      backendHealth.status === 'checking' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        backendHealth.status === 'online' ? 'bg-emerald-400 animate-ping' :
                        backendHealth.status === 'checking' ? 'bg-amber-400' : 'bg-rose-400'
                      }`} />
                      <span>{backendHealth.status.toUpperCase()}</span>
                    </span>
                  </div>
                  <h3 className="text-white font-semibold mt-4 text-base">Backend API Service</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Node.js + Express. Exposes endpoints for authentication, logs, schema querying, and interacts with PostgreSQL.
                  </p>
                </div>
                <div className="border-t border-slate-800/80 mt-5 pt-3 text-[11px] text-slate-500 font-mono flex flex-col space-y-1">
                  <span>Port: 5000</span>
                  <span>DB Status: {backendHealth.details?.database || 'Unknown'}</span>
                  <span>Host: local / docker-compose</span>
                </div>
              </div>

              {/* Card 2: Classifier Service */}
              <div className="bg-[#0f172a]/60 rounded-xl border border-slate-800 p-5 flex flex-col justify-between transition-all hover:border-slate-700/80">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 bg-violet-500/10 rounded-lg text-violet-400 border border-violet-500/20">
                      <Cpu size={22} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 ${
                      classifierHealth.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      classifierHealth.status === 'checking' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        classifierHealth.status === 'online' ? 'bg-emerald-400 animate-ping' :
                        classifierHealth.status === 'checking' ? 'bg-amber-400' : 'bg-rose-400'
                      }`} />
                      <span>{classifierHealth.status.toUpperCase()}</span>
                    </span>
                  </div>
                  <h3 className="text-white font-semibold mt-4 text-base">FastAPI Classifier Service</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Python + FastAPI. Hosts ML classifications, mapping labels (toxic/normal) and categorizing toxic subgroups.
                  </p>
                </div>
                <div className="border-t border-slate-800/80 mt-5 pt-3 text-[11px] text-slate-500 font-mono flex flex-col space-y-1">
                  <span>Port: 8000</span>
                  <span>Model: Mock Jigsaw Rule Engine</span>
                  <span>Host: local / docker-compose</span>
                </div>
              </div>

            </div>
          </section>

          {/* Database & Models overview */}
          <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Database size={20} className="text-indigo-400" />
              <span>Prisma Schema Models (PostgreSQL)</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              The schema syncs automatically upon starting the Docker compose network. Below is the mapped layout of active entities:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0f172a]/40 rounded-lg p-4 border border-slate-800/80">
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">User Model</span>
                <p className="text-xs font-semibold text-slate-300 mt-2">users</p>
                <p className="text-[11px] text-slate-500 mt-1">id, email, password_hash, role (user/admin), status, totp_secret, created_at</p>
              </div>

              <div className="bg-[#0f172a]/40 rounded-lg p-4 border border-slate-800/80">
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">Activity Log Model</span>
                <p className="text-xs font-semibold text-slate-300 mt-2">activity_logs</p>
                <p className="text-[11px] text-slate-500 mt-1">id, actor_id, actor_type, action_type, details_json, timestamp</p>
              </div>

              <div className="bg-[#0f172a]/40 rounded-lg p-4 border border-slate-800/80">
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">Feed Fetch Model</span>
                <p className="text-xs font-semibold text-slate-300 mt-2">feed_fetches</p>
                <p className="text-[11px] text-slate-500 mt-1">id, user_id, fetched_at</p>
              </div>

              <div className="bg-[#0f172a]/40 rounded-lg p-4 border border-slate-800/80">
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">Classification Model</span>
                <p className="text-xs font-semibold text-slate-300 mt-2">classifications</p>
                <p className="text-[11px] text-slate-500 mt-1">id, fetch_id, comment_text, label, subcategories_json, confidence, timestamp</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Classifier API Sandbox */}
        <div>
          <section className="bg-slate-900/40 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur-sm sticky top-24 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center space-x-2 text-white font-bold mb-2">
                <Terminal size={20} className="text-indigo-400" />
                <h2>Classifier Sandbox</h2>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Directly ping the classifier service's active routing to verify correct model output matching the shared API specification.
              </p>

              <form onSubmit={handleTestClassify} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
                    Input Text to Classify
                  </label>
                  <textarea 
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    rows={3}
                    placeholder="Enter sample comment..."
                    className="w-full bg-[#070b13] border border-slate-800 focus:border-indigo-500/50 rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none transition duration-200 resize-none font-mono"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading || classifierHealth.status !== 'online'}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:scale-100 disabled:cursor-not-allowed text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-500/10 transition duration-200"
                >
                  {loading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                  <span>Run Toxicity Inference</span>
                </button>
              </form>

              {/* Classification Result Display */}
              <div className="mt-8">
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                  Inference JSON Response
                </label>
                
                {classifyResult ? (
                  classifyResult.error ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start space-x-2">
                      <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{classifyResult.message}</span>
                    </div>
                  ) : (
                    <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 font-mono text-[11px] overflow-x-auto space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-slate-400">Primary Tag:</span>
                        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] ${
                          classifyResult.label === 'toxic' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {classifyResult.label}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-400">Response Object:</p>
                        <pre className="text-slate-300 text-[10px] leading-tight">
                          {JSON.stringify(classifyResult, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="border border-dashed border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500 font-mono">
                    Awaiting classification request...
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-800 mt-6 pt-4 flex items-center space-x-2 text-[10px] text-slate-500">
              <LayoutGrid size={12} />
              <span>Web Client Listening on Localhost:3000</span>
            </div>
          </section>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#070b13] py-4 text-center text-xs text-slate-500">
        <p>&copy; 2026 Toxic Twitter Comment Classification System. Monorepo Scaffolding Complete.</p>
      </footer>
    </div>
  );
}
