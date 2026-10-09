import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  X, Lock, Mail, User, Building, ArrowRight, Sparkles,
  ShieldCheck, AlertCircle, Eye, EyeOff, Loader2, KeyRound
} from 'lucide-react';

export default function AuthModal() {
  const navigate = useNavigate();
  const {
    isAuthModalOpen, closeAuthModal, authModalMode, setAuthModalMode,
    login, signup, isLoading, error
  } = useAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    emailOrUsername: '',
    password: '',
    company: '',
    role: 'Senior Data Scientist',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      if (authModalMode === 'login') {
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
      closeAuthModal();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-prajna" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-900/60 text-violet-600 dark:text-violet-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise Workspace Access</span>
            </div>

            <div className="flex items-center justify-center mb-2">
              <img
                src="/logo.png"
                alt="PRAJNA Logo"
                className="h-8 w-auto object-contain max-w-[170px]"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {authModalMode === 'login'
                ? 'Sign in to access your predictive models, SQL workspaces, and isolated datasets.'
                : 'Create an isolated workspace. Each account gets its own dedicated datasets and dashboards.'}
            </p>
          </div>

          {/* Quick Master Account Credential Hint */}
          {authModalMode === 'login' && (
            <div className="mb-4 p-2.5 rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/70 dark:border-violet-900/50 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-violet-900 dark:text-violet-200">
                <KeyRound className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <span>Default Admin: <strong>v@g.com</strong> / <strong>123456</strong></span>
              </div>
              <button
                type="button"
                onClick={fillMasterAccount}
                className="text-[11px] font-bold text-violet-700 dark:text-violet-300 hover:underline px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 shadow-2xs"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Error Message */}
          {(localError || error) && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{localError || error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {authModalMode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Mercer"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Organization
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Company Name"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
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
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
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
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder={authModalMode === 'login' ? "v@g.com or v" : "you@company.com"}
                  value={formData.emailOrUsername}
                  onChange={(e) => setFormData({ ...formData, emailOrUsername: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
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
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-prajna hover:opacity-95 shadow-lg shadow-violet-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{authModalMode === 'login' ? 'Sign In to Workspace' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Login / Signup */}
          <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
            {authModalMode === 'login' ? (
              <span>
                Need a new isolated account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthModalMode('signup')}
                  className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Create Account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
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
