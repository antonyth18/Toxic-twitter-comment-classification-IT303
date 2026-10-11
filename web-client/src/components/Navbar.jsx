import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, History, Shield, LogOut, Sparkles } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('jwt');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    localStorage.removeItem('tempToken');
    navigate('/login');
  };

  const navLinks = [
    { to: '/home', label: 'Classifier', icon: Sparkles },
    { to: '/history', label: 'History', icon: History },
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin Portal', icon: Shield }] : [{ to: '/admin', label: 'Admin', icon: Shield }]),
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-transparent border-b border-white/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
              AI Guard
            </span>
          </div>
        </Link>

        {token ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="h-5 w-px bg-white/20 mx-1 sm:mx-2" />

            <div className="flex items-center gap-2">
              {user?.email && (
                <span className="hidden md:inline-block text-xs text-white/90 font-mono px-2.5 py-1 rounded-full bg-white/15 border border-white/25 truncate max-w-[160px]">
                  {user.email}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 border border-transparent hover:border-white/20 transition-all cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </nav>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-white/90 hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-outline text-sm py-1.5 px-5"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
