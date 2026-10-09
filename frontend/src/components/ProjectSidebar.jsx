import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import {
  Sparkles, Plus, ChevronRight, ChevronDown, Database, BarChart3,
  BrainCircuit, Rocket, Settings2, Moon, Sun, Trash2, Edit2, Check,
  X, CheckCircle2, ChevronLeft, Folder, FolderOpen, LayoutDashboard, Loader2
} from 'lucide-react';
import CreateDashboardModal from './CreateDashboardModal';

export default function ProjectSidebar({ onOpenSettings }) {
  const navigate = useNavigate();
  const {
    projects, activeProjectId, activeProject, activeView, activeModelId,
    expandedProjects, toggleProjectExpand, selectProjectView,
    selectModel, refreshProjectTree, setActiveView, theme, setTheme,
    sidebarOpen, setSidebarOpen, dashboards, refreshDashboards
  } = useChatStore();

  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [createDashboardModalOpen, setCreateDashboardModalOpen] = useState(false);
  const [dashboardModalMode, setDashboardModalMode] = useState('blank');

  useEffect(() => {
    refreshProjectTree(true);
    refreshDashboards();
  }, []);

  useEffect(() => {
    refreshDashboards(activeProjectId);
  }, [activeProjectId]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    const name = newProjectName.trim() || `Session ${projects.length + 1}`;
    try {
      const created = await api.createProject(name);
      await refreshProjectTree();
      selectProjectView(created.id, 'database');
      setNewProjectName('');
      setCreatingProject(false);
    } catch (err) {
      alert(`Failed to create project: ${err.message}`);
    }
  };

  const handleRenameProject = async (projectId, e) => {
    e.preventDefault();
    if (!editProjectName.trim()) return;
    try {
      await api.updateProject(projectId, editProjectName.trim());
      await refreshProjectTree();
      setEditingProjectId(null);
    } catch (err) {
      alert(`Rename failed: ${err.message}`);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project and all its data, visualizations, and models?')) return;
    try {
      await api.deleteDataset(projectId);
      await refreshProjectTree(true);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div
      className={`shrink-0 flex flex-col h-full bg-white dark:bg-[#0f1420] border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300 z-30 ${
        sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0'
      }`}
    >
      {/* ── 1. Top Logo Header ───────────────────────────────────── */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 shrink-0 bg-slate-50/60 dark:bg-[#0c101a]/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5 pl-0.5">
            <img
              src="/logo.png"
              alt="Company Logo"
              className="h-7 w-auto object-contain max-w-[170px] rounded"
              onError={(e) => {
                const fallbacks = ['/main.png', '/logo.jpg', '/main.jpg', '/logo-numentrix.png', '/logo-datanex.png'];
                const current = e.currentTarget.getAttribute('data-err-idx') || 0;
                const nextIdx = Number(current);
                if (nextIdx < fallbacks.length) {
                  e.currentTarget.setAttribute('data-err-idx', nextIdx + 1);
                  e.currentTarget.src = fallbacks[nextIdx];
                }
              }}
            />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* PRAJNA Brand Header */}
        <Link
          to="/"
          className="block bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-violet-500/60 hover:shadow-md transition-all group"
          title="Return to PRAJNA Home"
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-prajna flex items-center justify-center font-black text-white text-xs shadow-xs">
              P
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h1 className="font-extrabold text-sm tracking-wider text-slate-900 dark:text-white leading-none">
                  PRAJNA
                </h1>
                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                  2.0
                </span>
              </div>
              <span className="text-[9px] font-semibold text-violet-600 dark:text-violet-400 tracking-wider uppercase">
                Predictive AI
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-tight font-medium">
            Predictive Research &amp; Analytics for Judgement, Navigation &amp; Action
          </p>
        </Link>
      </div>

      {/* ── 2. New Session Action Button ─────────────────────────── */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
        {creatingProject ? (
          <form onSubmit={handleCreateProject} className="space-y-2 animate-fadeIn">
            <input
              type="text"
              placeholder="Enter Project Name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
              className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-violet-400 dark:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-200 font-semibold"
            />
            <div className="flex items-center space-x-1.5 justify-end">
              <button
                type="button"
                onClick={() => setCreatingProject(false)}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-[11px] font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-sm"
              >
                Create
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreatingProject(true)}
            className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Session</span>
          </button>
        )}
      </div>

      {/* ── 3. Projects Tree (History) ───────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            History ({projects.length})
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <p>No project sessions yet.</p>
            <p className="text-[11px]">Click <strong>+ New Session</strong> to start.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {projects.map((proj) => {
              const isExpanded = !!expandedProjects[proj.id];
              const isProjectActive = activeProjectId === proj.id;
              const isEditing = editingProjectId === proj.id;

              return (
                <div key={proj.id} className="rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800/80 transition-all">
                  
                  {/* Project Header Row */}
                  <div
                    onClick={() => {
                      toggleProjectExpand(proj.id);
                      if (!isProjectActive) selectProjectView(proj.id, 'database');
                    }}
                    className={`group px-2.5 py-2 rounded-xl flex items-center justify-between cursor-pointer select-none transition-all ${
                      isProjectActive
                        ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProjectExpand(proj.id);
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-violet-500 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                      )}

                      {isEditing ? (
                        <form onSubmit={(e) => handleRenameProject(proj.id, e)} onClick={(e) => e.stopPropagation()} className="flex items-center space-x-1 flex-1">
                          <input
                            type="text"
                            value={editProjectName}
                            onChange={(e) => setEditProjectName(e.target.value)}
                            className="text-xs px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-violet-500 w-full"
                            autoFocus
                          />
                          <button type="submit" className="p-0.5 text-emerald-500"><Check className="w-3 h-3" /></button>
                          <button type="button" onClick={() => setEditingProjectId(null)} className="p-0.5 text-slate-400"><X className="w-3 h-3" /></button>
                        </form>
                      ) : (
                        <span className="text-xs truncate font-bold" title={proj.name}>
                          {proj.name}
                        </span>
                      )}
                    </div>

                    {/* Session Actions (Always visible for active, visible with subtle opacity for others) */}
                    {!isEditing && (
                      <div className="flex items-center space-x-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProjectId(proj.id);
                            setEditProjectName(proj.name);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isProjectActive
                              ? 'text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-violet-100/50 dark:hover:bg-violet-900/40'
                              : 'opacity-40 group-hover:opacity-100 text-slate-400 hover:text-violet-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                          }`}
                          title="Rename Session"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          className={`p-1 rounded transition-colors ${
                            isProjectActive
                              ? 'text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-950/40'
                              : 'opacity-40 group-hover:opacity-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                          }`}
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Project Expanded Sub-Tree */}
                  {isExpanded && (
                    <div className="pl-6 pr-1 pt-1 pb-2 space-y-1 border-l-2 border-slate-200 dark:border-slate-800 ml-4 mt-0.5">
                      
                      {/* 1. Database Node */}
                      <button
                        onClick={() => selectProjectView(proj.id, 'database')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isProjectActive && activeView === 'database'
                            ? 'bg-violet-600 text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Database className="w-3.5 h-3.5 shrink-0" />
                          <span>Database</span>
                        </div>
                        {proj.has_data && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isProjectActive && activeView === 'database' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {proj.row_count}r
                          </span>
                        )}
                      </button>

                      {/* 2. Visualizations Node */}
                      <button
                        onClick={() => selectProjectView(proj.id, 'visualizations')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isProjectActive && activeView === 'visualizations'
                            ? 'bg-violet-600 text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                          <span>Visualizations</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isProjectActive && activeView === 'visualizations' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {proj.visualizations?.length || 0}
                        </span>
                      </button>

                      {/* 3. ML Models Node & Nested Models */}
                      <div className="pt-1">
                        <button
                          onClick={() => selectProjectView(proj.id, 'ml_training')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isProjectActive && activeView === 'ml_training'
                              ? 'bg-violet-600 text-white shadow-sm font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
                            <span>ML Models</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isProjectActive && activeView === 'ml_training' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {proj.models?.length || 0}
                          </span>
                        </button>

                        {/* Nested Trained Models List */}
                        {proj.models && proj.models.length > 0 && (
                          <div className="pl-4 pt-1 space-y-1">
                            {proj.models.map((model) => {
                              const isModelActive = activeModelId === model.id && activeView === 'model_detail';

                              return (
                                <button
                                  key={model.id}
                                  onClick={() => selectModel(model)}
                                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-all text-left truncate ${
                                    isModelActive
                                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-800 dark:hover:text-slate-200'
                                  }`}
                                  title={`${model.model_name} (${model.algorithm})`}
                                >
                                  <div className="flex items-center space-x-1.5 truncate">
                                    {model.is_deployed ? (
                                      <Rocket className={`w-3 h-3 shrink-0 ${isModelActive ? 'text-white' : 'text-amber-500'}`} />
                                    ) : (
                                      <CheckCircle2 className={`w-3 h-3 shrink-0 ${isModelActive ? 'text-white' : 'text-emerald-500'}`} />
                                    )}
                                    <span className="truncate">{model.model_name}</span>
                                  </div>

                                  {model.accuracy && (
                                    <span className={`text-[9px] font-mono shrink-0 ml-1 ${isModelActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {(model.accuracy * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3.5 Dashboards Area (Above Deployments) ───────────────── */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0 bg-slate-50/30 dark:bg-[#0b0f19]/30">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-1.5">
            <LayoutDashboard className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dashboards ({dashboards.length})
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {/* Generate Dashboard using AI */}
            <button
              onClick={() => {
                if (generatingAI) return;
                setDashboardModalMode('ai');
                setCreateDashboardModalOpen(true);
              }}
              disabled={generatingAI}
              className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Generate dashboard using AI (choose session/data source)"
            >
              {generatingAI
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                : <Sparkles className="w-3.5 h-3.5" />}
            </button>
            {/* Create Blank Dashboard */}
            <button
              onClick={() => {
                setDashboardModalMode('blank');
                setCreateDashboardModalOpen(true);
              }}
              className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Create New Dashboard (choose session/data source)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* AI Generation Status Banner */}
        {generatingAI && (
          <div className="flex items-center space-x-2 px-2 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/70 dark:border-violet-800/60 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
            <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 truncate">
              AI is designing your dashboard…
            </span>
          </div>
        )}

        {dashboards.length === 0 ? (
          <p className="text-[11px] text-slate-400 px-1 italic">
            No dashboards yet. Click + to create.
          </p>
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {dashboards.map((dash) => (
              <div
                key={dash.id}
                onClick={() => navigate(`/dashboard/${dash.id}`)}
                className="group px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer select-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {dash.settings?.ai_generated
                    ? <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    : <LayoutDashboard className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  }
                  <span className="truncate" title={dash.title}>{dash.title}</span>
                </div>

                <div className="flex items-center space-x-1">
                  {dash.settings?.ai_generated && (
                    <span className="text-[9px] px-1 py-0.2 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 font-bold hidden group-hover:hidden">AI</span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500">
                    {dash.tabs?.length || 1}t
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete dashboard "${dash.title}"?`)) return;
                      try {
                        await api.deleteDashboard(dash.id);
                        await refreshDashboards(activeProjectId);
                      } catch (err) {
                        alert(`Delete failed: ${err.message}`);
                      }
                    }}
                    className="hidden group-hover:block p-0.5 text-slate-400 hover:text-rose-500 rounded"
                    title="Delete Dashboard"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Bottom Global Section (Deployments & Settings) ─────── */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1 shrink-0 bg-slate-50/50 dark:bg-[#0a0f18]/50">
        <button
          onClick={() => setActiveView('deployments')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeView === 'deployments'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Rocket className="w-4 h-4 text-amber-500" />
          <span>Deployments</span>
        </button>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Settings2 className="w-4 h-4" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Dark / Light Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Create Dashboard Modal with Session Selection */}
      <CreateDashboardModal
        isOpen={createDashboardModalOpen}
        onClose={() => setCreateDashboardModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        initialMode={dashboardModalMode}
        onSubmit={async ({ project_id, title, type }) => {
          const targetProjId = project_id || activeProjectId;
          if (type === 'ai') {
            setGeneratingAI(true);
            try {
              const created = await api.generateAIDashboard({
                project_id: targetProjId,
                dashboard_title: title
              });
              await refreshDashboards(targetProjId);
              navigate(`/dashboard/${created.id}`);
            } finally {
              setGeneratingAI(false);
            }
          } else {
            const created = await api.createDashboard({
              project_id: targetProjId,
              title: title
            });
            await refreshDashboards(targetProjId);
            navigate(`/dashboard/${created.id}`);
          }
        }}
      />

    </div>
  );
}
