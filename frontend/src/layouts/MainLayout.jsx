import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import ProjectSidebar from '../components/ProjectSidebar';
import ProjectDatabaseView from '../components/ProjectDatabaseView';
import ProjectVisualizationsView from '../components/ProjectVisualizationsView';
import ProjectMLView from '../components/ProjectMLView';
import ModelDetailView from '../components/ModelDetailView';
import GlobalDeploymentsView from '../components/GlobalDeploymentsView';
import {
  Menu, Sparkles, Settings2, Moon, Sun, X, Database,
  BarChart3, BrainCircuit, Rocket, ChevronRight, Folder,
  Home, LogOut, User as UserIcon, Shield
} from 'lucide-react';

export default function MainLayout() {
  const {
    activeView, activeProjectId, activeProject, activeModel,
    sidebarOpen, setSidebarOpen, selectProjectView,
    settings, updateSettings
  } = useChatStore();

  const { user, isAuthenticated, logout, openAuthModal } = useAuthStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] dark:bg-[#090d16] overflow-hidden text-slate-700 dark:text-slate-300 font-sans">
      
      {/* ── 1. Project Explorer Sidebar ──────────────────────────── */}
      <ProjectSidebar onOpenSettings={() => setSettingsOpen(true)} />

      {/* ── 2. Central Dynamic Workspace ─────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Top Header Breadcrumb & Status */}
        <header className="h-14 bg-white dark:bg-[#0f1420] border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-3 text-xs">
            {!sidebarOpen && (
              <div className="flex items-center space-x-2.5 mr-2">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Open Sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="w-4 h-4 rounded bg-gradient-prajna flex items-center justify-center text-[10px] font-black text-white">
                    P
                  </div>
                  <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-white hidden sm:inline">
                    PRAJNA
                  </span>
                </div>
              </div>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center space-x-2 font-bold">
              {activeView === 'deployments' ? (
                <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400">
                  <Rocket className="w-4 h-4" />
                  <span>Global Deployments</span>
                </div>
              ) : activeProject ? (
                <>
                  <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
                    <Folder className="w-3.5 h-3.5" />
                    <span>{activeProject.name}</span>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />

                  {activeView === 'database' && (
                    <div className="flex items-center space-x-1.5 text-violet-600 dark:text-violet-400 font-extrabold">
                      <Database className="w-3.5 h-3.5" />
                      <span>Database Workspace</span>
                    </div>
                  )}

                  {activeView === 'visualizations' && (
                    <div className="flex items-center space-x-1.5 text-sky-600 dark:text-sky-400 font-extrabold">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Visualizations</span>
                    </div>
                  )}

                  {activeView === 'ml_training' && (
                    <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>ML Training Studio</span>
                    </div>
                  )}

                  {activeView === 'model_detail' && (
                    <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>Model Hub: {activeModel?.model_name || 'Trained Model'}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-slate-400">Select or create a project to start</span>
              )}
            </div>
          </div>

          {/* Right Header Controls: Stepper, Home Link, User Profile */}
          <div className="flex items-center space-x-2.5">
            {/* Quick Project Workflow Stepper */}
            {activeProject && activeView !== 'deployments' && (
              <div className="hidden sm:flex items-center space-x-1 text-xs">
                {[
                  { key: 'database', label: 'Database', icon: Database },
                  { key: 'visualizations', label: 'Visualizations', icon: BarChart3 },
                  { key: 'ml_training', label: 'ML Training', icon: BrainCircuit },
                ].map((step) => {
                  const Icon = step.icon;
                  const isActive = activeView === step.key;

                  return (
                    <button
                      key={step.key}
                      onClick={() => selectProjectView(activeProject.id, step.key)}
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all ${
                        isActive
                          ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{step.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Workspace Link */}
            <Link
              to="/app"
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Workspace Studio"
            >
              <Home className="w-3.5 h-3.5 text-violet-500" />
              <span className="hidden md:inline">Workspace</span>
            </Link>

            {/* User Profile / Auth State Dropdown */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 pl-2 pr-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs font-bold"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-prajna text-white text-[9px] flex items-center justify-center font-black">
                    {user.initials || 'P'}
                  </div>
                  <span className="text-slate-700 dark:text-slate-200 hidden lg:inline max-w-[100px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 text-xs">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-extrabold text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                        {user.role}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSettingsOpen(true);
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                        navigate('/login');
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Viewport */}
        <main className="flex-1 overflow-y-auto">
          {activeView === 'database' && <ProjectDatabaseView />}
          {activeView === 'visualizations' && <ProjectVisualizationsView />}
          {activeView === 'ml_training' && <ProjectMLView />}
          {activeView === 'model_detail' && <ModelDetailView />}
          {activeView === 'deployments' && <GlobalDeploymentsView />}
        </main>
      </div>

      {/* ── 3. Settings Modal ────────────────────────────────────── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded bg-gradient-prajna flex items-center justify-center text-xs font-black text-white">
                  P
                </div>
                <h3 className="text-sm font-bold">PRAJNA Settings</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-500 block mb-1">LLM Model</label>
                <select
                  value={settings.model}
                  onChange={(e) => updateSettings({ model: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Groq Cloud)</option>
                  <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Groq Cloud)</option>
                  <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fast Groq)</option>
                  <option value="qwen3:4b-instruct">qwen3:4b-instruct (Local Ollama)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">
                  Temperature: {settings.temperature}
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-violet-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Max Completion Tokens</label>
                <input
                  type="number"
                  value={settings.maxTokens}
                  onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value, 10) || 2048 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
