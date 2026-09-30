import { create } from 'zustand';
import { api } from '../api/client';

const initialSettings = {
  model: 'qwen/qwen3.8-27b',
  temperature: 0.0,
  maxTokens: 4096,
  chartEngine: 'Apache ECharts',
  chatMaxTokens: 1500,
};

const rawSettings = JSON.parse(localStorage.getItem('settings') || 'null');
if (rawSettings && (!rawSettings.model || rawSettings.model === 'llama-3.3-70b-versatile')) {
  rawSettings.model = 'qwen/qwen3.8-27b';
  try { localStorage.setItem('settings', JSON.stringify(rawSettings)); } catch (e) {}
}

const savedTheme = localStorage.getItem('theme') || 'dark';
if (typeof document !== 'undefined') {
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
}

export const useChatStore = create((set, get) => ({
  // ── UI Theme & Sidebar ─────────────────────────────────────
  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    set({ theme });
  },

  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  // ── Settings ───────────────────────────────────────────────
  settings: JSON.parse(localStorage.getItem('settings')) || initialSettings,
  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    localStorage.setItem('settings', JSON.stringify(updated));
    set({ settings: updated });
    api.updateSettings({
      default_model: updated.model,
      temperature: updated.temperature,
      max_tokens: updated.maxTokens,
    }).catch(() => {});
  },

  // ── Project Tree & Sessions ─────────────────────────────────
  projects: [],
  setProjects: (projects) => set({ projects }),
  
  activeProjectId: localStorage.getItem('activeProjectId') || null,
  activeProject: null,
  
  // Views: 'database' | 'visualizations' | 'ml_training' | 'model_detail' | 'deployments'
  activeView: localStorage.getItem('activeView') || 'database',
  setActiveView: (view) => {
    localStorage.setItem('activeView', view);
    set({ activeView: view });
  },

  // Collapsible Tree State
  expandedProjects: JSON.parse(localStorage.getItem('expandedProjects')) || {},
  toggleProjectExpand: (projectId) => {
    const prev = get().expandedProjects;
    const updated = { ...prev, [projectId]: !prev[projectId] };
    localStorage.setItem('expandedProjects', JSON.stringify(updated));
    set({ expandedProjects: updated });
  },
  expandProject: (projectId) => {
    const updated = { ...get().expandedProjects, [projectId]: true };
    localStorage.setItem('expandedProjects', JSON.stringify(updated));
    set({ expandedProjects: updated });
  },

  // Sub-navigation states
  databaseSubTab: 'data_view', // 'data_view' | 'schema' | 'transform' | 'query' | 'ai_chat'
  setDatabaseSubTab: (tab) => set({ databaseSubTab: tab }),

  modelSubTab: 'overview', // 'overview' | 'results' | 'testing' | 'deployment'
  setModelSubTab: (tab) => set({ modelSubTab: tab }),

  // Active Model Detail Selection
  activeModelId: localStorage.getItem('activeModelId') || null,
  activeModel: null,
  selectModel: (model) => {
    if (model) {
      localStorage.setItem('activeModelId', model.id);
      localStorage.setItem('activeView', 'model_detail');
      set({
        activeModel: model,
        activeModelId: model.id,
        activeView: 'model_detail',
        modelSubTab: 'overview'
      });
    } else {
      localStorage.removeItem('activeModelId');
      set({ activeModel: null, activeModelId: null });
    }
  },

  // Select Project & View
  selectProjectView: (projectId, view = 'database') => {
    const project = get().projects.find(p => p.id === projectId);
    localStorage.setItem('activeProjectId', projectId);
    localStorage.setItem('activeView', view);
    
    // Auto-expand project in tree
    const updatedExpanded = { ...get().expandedProjects, [projectId]: true };
    localStorage.setItem('expandedProjects', JSON.stringify(updatedExpanded));

    set({
      activeProjectId: projectId,
      activeProject: project || null,
      activeView: view,
      expandedProjects: updatedExpanded
    });

    if (projectId) {
      api.getDataset(projectId).then(fullData => {
        if (fullData && get().activeProjectId === projectId) {
          set(prev => ({ activeProject: { ...prev.activeProject, ...fullData } }));
        }
      }).catch(() => {});
    }
  },

  // Refresh Project Tree from backend
  refreshProjectTree: async (selectFirstIfNone = false) => {
    try {
      const tree = await api.getProjectTree();
      set({ projects: tree });

      const currentActiveId = get().activeProjectId;
      if (currentActiveId) {
        const found = tree.find(p => p.id === currentActiveId);
        if (found) {
          set({ activeProject: found });
          api.getDataset(currentActiveId).then(fullData => {
            if (fullData && get().activeProjectId === currentActiveId) {
              set(prev => ({ activeProject: { ...prev.activeProject, ...fullData } }));
            }
          }).catch(() => {});
        }
      } else if (selectFirstIfNone && tree.length > 0) {
        get().selectProjectView(tree[0].id, 'database');
      }

      // If active model is set, refresh model object
      const currentModelId = get().activeModelId;
      if (currentModelId) {
        for (const p of tree) {
          const m = (p.models || []).find(item => item.id === currentModelId);
          if (m) {
            // fetch full experiment detail
            api.getExperiment(currentModelId).then(exp => {
              set({ activeModel: exp });
            }).catch(() => {});
            break;
          }
        }
      }
    } catch (err) {
      console.error('Failed to refresh project tree', err);
    }
  },

  // ── Single-Chart Selection for Chart-Based Forecasting ML ───────
  // Note: Only ONE chart can be selected at a time for forecasting.
  // When no chart is selected, ML training uses the General ML pipeline.
  selectedVisualizationIds: [],
  toggleVisualizationSelection: (visId) => {
    const current = get().selectedVisualizationIds;
    if (current.includes(visId)) {
      set({ selectedVisualizationIds: [] });
    } else {
      // Exactly ONE chart at a time
      set({ selectedVisualizationIds: [visId] });
    }
  },
  selectSingleVisualization: (visId) => {
    set({ selectedVisualizationIds: visId ? [visId] : [] });
  },
  clearSelectedVisualizations: () => {
    set({ selectedVisualizationIds: [] });
  },

  // Navigate to ML training carrying selected chart for forecasting
  trainWithChart: (chartId) => {
    localStorage.setItem('activeView', 'ml_training');
    set({ selectedVisualizationIds: chartId ? [chartId] : [], activeView: 'ml_training' });
  },
  trainWithSelectedVisualizations: () => {
    localStorage.setItem('activeView', 'ml_training');
    set({ activeView: 'ml_training' });
  },

  // Global Deployments Selection
  activeDeploymentId: null,
  activeDeployment: null,
  setActiveDeployment: (dep) => set({ activeDeployment: dep, activeDeploymentId: dep ? dep.id : null }),

  // ── Dashboards & Builder ─────────────────────────────────────
  dashboards: [],
  activeDashboardId: localStorage.getItem('activeDashboardId') || null,
  activeDashboard: null,
  setDashboards: (dashboards) => set({ dashboards }),
  setActiveDashboard: (dash) => set({ 
    activeDashboard: dash, 
    activeDashboardId: dash ? dash.id : null 
  }),
  refreshDashboards: async (projectId) => {
    try {
      const list = await api.listDashboards(projectId || get().activeProjectId);
      set({ dashboards: list });
      return list;
    } catch (err) {
      console.error('Failed to list dashboards', err);
      return [];
    }
  },
  selectDashboard: async (dashboardId) => {
    if (!dashboardId) {
      localStorage.removeItem('activeDashboardId');
      set({ activeDashboardId: null, activeDashboard: null });
      return;
    }
    localStorage.setItem('activeDashboardId', dashboardId);
    set({ activeDashboardId: dashboardId });
    try {
      const data = await api.getDashboard(dashboardId);
      set({ activeDashboard: data });
    } catch (err) {
      console.error(`Failed to fetch dashboard ${dashboardId}`, err);
    }
  },

  // Loading States
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading })
}));
