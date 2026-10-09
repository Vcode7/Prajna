import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Sparkles, Lock, Mail, User, Building, ArrowRight, ShieldCheck,
  AlertCircle, Eye, EyeOff, Loader2, Database, BrainCircuit, BarChart3,
  ArrowLeft, KeyRound
} from 'lucide-react';

export default function AuthPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState(modeParam || initialMode);

  const {
    login, signup, isLoading, error, isAuthenticated, user
  } = useAuthStore();

  // If already authenticated, redirect to /app
  if (isAuthenticated && user) {
    return <Navigate to="/app" replace />;
  }

  const [formData, setFormData] = useState({
    name: '',
    emailOrUsername: '',
    password: '',
    company: '',
    role: 'Senior Analytics Architect',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      if (mode === 'login') {
        await login(formData.emailOrUsername, formData.password);
      } else {
        const email = formData.emailOrUsername.trim();
        const username = email.includes('@') ? email.split('@')[0] : email;
        await signup({
          name: formData.name || username,
          username,
          email,
          password: formData.password,
          company: formData.company,
          role: formData.role,
        });
      }
      navigate('/app');
    } catch (err) {
      setLocalError(err.message || 'Authentication failed');
    }
  };

  const fillMasterAccount = () => {
    setFormData(prev => ({
      ...prev,
      emailOrUsername: 'v@g.com',
      password: '123456'
    }));
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 font-sans">
      
      {/* ── Left Visual Enterprise Showcase (Desktop) ─────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0c101a] via-[#111626] to-[#1e1435] p-12 text-white flex-col justify-between overflow-hidden border-r border-slate-200/20 dark:border-slate-800">
        
        {/* Background glow effects */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-grid-dots opacity-20 pointer-events-none" />

        {/* Top Brand & Back to Home */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <img
                src="/logo.png"
                alt="PRAJNA Logo"
                className="h-7 w-auto object-contain max-w-[160px]"
              />
            </div>
          </Link>

          <Link
            to="/"
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/25 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Middle Value Proposition Card */}
        <div className="relative z-10 max-w-lg my-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Decision Intelligence</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-tight">
            Turn Complex Data Into <span className="text-prajna-gradient">Decisive Action.</span>
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Conversational SQL generation, automated ML model training, and executive BI dashboards built for teams requiring maximum velocity and strict per-account data isolation.
          </p>

          {/* Interactive Feature Pills */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <Database className="w-5 h-5 text-violet-400 mb-2" />
              <h4 className="text-xs font-bold text-white">Text-to-SQL Synthesis</h4>
              <p className="text-[11px] text-slate-400 mt-1">Automatic schema introspection &amp; ultra-fast querying.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <BrainCircuit className="w-5 h-5 text-violet-400 mb-2" />
              <h4 className="text-xs font-bold text-white">Zero-Code AutoML Studio</h4>
              <p className="text-[11px] text-slate-400 mt-1">Train &amp; deploy predictive models in seconds.</p>
            </div>
          </div>
        </div>

        {/* Bottom Trust Marks */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SOC2 Type II Certified • Private Air-Gapped Ready</span>
          </div>
          <span>© 2026 PRAJNA AI Corp</span>
        </div>
      </div>

      {/* ── Right Auth Form Area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        
        {/* Mobile top logo */}
        <div className="lg:hidden flex items-center justify-between w-full max-w-md mb-8">
          <Link to="/" className="flex items-center space-x-2.5">
            <img src="/logo.png" alt="PRAJNA Logo" className="h-7 w-auto object-contain max-w-[150px]" />
          </Link>
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            ← Back to Home
          </Link>
        </div>

        <div className="w-full max-w-md space-y-6">
          
          {/* Header Title & Mode Toggle */}
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {mode === 'login' ? 'Sign In to PRAJNA' : 'Create Enterprise Account'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {mode === 'login'
                ? 'Enter your credentials to access your projects, database workspaces, and trained models.'
                : 'Register an account. Every created account has its own isolated workspace and datasets.'}
            </p>
          </div>

          {/* Master Account Credential Hint */}
          {mode === 'login' && (
            <div className="p-3.5 rounded-2xl bg-violet-50/70 dark:bg-[#111726] border border-violet-200/90 dark:border-violet-950/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-violet-950 dark:text-violet-200">
                <KeyRound className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <span>Default Admin: <strong>v@g.com</strong> (or <strong>v</strong>) / <strong>123456</strong></span>
              </div>
              <button
                type="button"
                onClick={fillMasterAccount}
                className="text-xs font-bold text-violet-700 dark:text-violet-300 hover:underline px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-violet-200 dark:border-slate-700 shadow-2xs"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Error Message */}
          {(localError || error) && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || error}</span>
            </div>
          )}

          {/* Clean Focused Email / Username & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Mercer"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Organization
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    >
                      <option value="Enterprise Administrator">Enterprise Administrator</option>
                      <option value="Senior Data Scientist">Senior Data Scientist</option>
                      <option value="VP of Operations">VP of Operations</option>
                      <option value="BI & Analytics Lead">BI & Analytics Lead</option>
                      <option value="Data Analyst">Data Analyst</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder={mode === 'login' ? "v@g.com or v" : "you@company.com"}
                  value={formData.emailOrUsername}
                  onChange={(e) => setFormData({ ...formData, emailOrUsername: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-prajna hover:opacity-95 shadow-lg shadow-violet-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Platform' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Login / Signup */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
            {mode === 'login' ? (
              <span>
                Don't have an enterprise account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Sign Up Free
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
