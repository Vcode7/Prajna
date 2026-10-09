import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import {
  Sparkles, Sun, Moon, ArrowRight, User, LogOut, Menu, X,
  Shield, Layers, BrainCircuit, BarChart3, ChevronDown, CheckCircle2
} from 'lucide-react';

export default function LandingNavbar() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, openAuthModal } = useAuthStore();
  const { theme, setTheme } = useChatStore();
  
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navLinks = [
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'PRAJNA Core', href: '#philosophy' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Enterprise Security', href: '#security' },
    { label: 'Pricing', href: '#pricing' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 dark:bg-[#090d16]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* ── Brand Logo ────────────────────────────────────────── */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative flex items-center justify-center px-2.5 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs group-hover:border-violet-500/50 transition-all">
              <img
                src="/logo.png"
                alt="PRAJNA Logo"
                className="h-7 w-auto object-contain max-w-[170px]"
                onError={(e) => {
                  const fallbacks = ['/main.png', '/logo.jpg', '/main.jpg', '/logo-numentrix.png'];
                  const current = e.currentTarget.getAttribute('data-err-idx') || 0;
                  const nextIdx = Number(current);
                  if (nextIdx < fallbacks.length) {
                    e.currentTarget.setAttribute('data-err-idx', nextIdx + 1);
                    e.currentTarget.src = fallbacks[nextIdx];
                  }
                }}
              />
            </div>
            
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white leading-none">
                  PRAJNA
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/40">
                  AI
                </span>
              </div>
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                Predictive Research &amp; Analytics
              </span>
            </div>
          </Link>

          {/* ── Desktop Navigation Links ───────────────────────────── */}
          <nav className="hidden lg:flex items-center space-x-1 px-4 py-1.5 rounded-full bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-sm text-xs font-semibold text-slate-600 dark:text-slate-300">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3.5 py-1.5 rounded-full hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* ── Actions (Theme, Auth, CTA) ─────────────────────────── */}
          <div className="hidden sm:flex items-center space-x-3">
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* If Authenticated: User menu + Go to Workspace */}
            {isAuthenticated && user ? (
              <div className="relative">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 transition-all text-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-prajna text-white font-bold text-[10px] flex items-center justify-center">
                      {user.initials || 'P'}
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[110px]">
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <Link
                    to="/app"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-prajna hover:opacity-95 shadow-md shadow-violet-500/20 transition-all"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                        {user.role}
                      </span>
                    </div>

                    <Link
                      to="/app"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Layers className="w-4 h-4 text-violet-500" />
                      <span>Enterprise Workspace</span>
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* If Not Authenticated */
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
                >
                  Sign In
                </button>

                <button
                  onClick={() => openAuthModal('signup')}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-prajna hover:opacity-95 shadow-md shadow-violet-500/25 transition-all transform active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Launch Platform</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Mobile Hamburger ──────────────────────────────────── */}
          <div className="flex items-center space-x-2 lg:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Dropdown Menu ───────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 p-4 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3">
            <div className="flex flex-col space-y-1 text-sm font-semibold">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {isAuthenticated && user ? (
                <>
                  <Link
                    to="/app"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-prajna"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    Sign Out ({user.name.split(' ')[0]})
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal('login');
                    }}
                    className="py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal('signup');
                    }}
                    className="py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-prajna"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
