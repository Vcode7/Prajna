import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import ChartTab from '../components/ChartTab';
import DashboardPreviewView from '../components/DashboardPreviewView';
import KPICard from '../components/KPICard';
import AskAIChartModal from '../components/AskAIChartModal';
import ChartForecastModal from '../components/ChartForecastModal';
import {
  THEME_TEMPLATES,
  CARD_STYLES,
  resolveThemeTemplate,
  getCardStyleMeta,
  getChartShadowStyle
} from '../constants/dashboardThemes';
import {
  LayoutDashboard, Eye, Edit3, Plus, Trash2, ArrowLeft,
  Sparkles, BrainCircuit, Move, Check, X, Share2, Layers,
  RefreshCw, TrendingUp, AlertCircle, ChevronDown, Palette, Database
} from 'lucide-react';

export default function DashboardBuilderPage() {
  const { dashboardId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeProjectId, activeProject, theme, projects, refreshProjectTree } = useChatStore();

  const isDirectPreview = searchParams.get('preview') === 'true' || searchParams.get('share') === 'true';

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(isDirectPreview ? 'preview' : 'edit');
  const [activeTabId, setActiveTabId] = useState(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  
  // Tab renaming
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');

  // Dashboard Title / Description editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');

  // Add Visualization Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectVisualizations, setProjectVisualizations] = useState([]);
  const [loadingProjectVis, setLoadingProjectVis] = useState(false);

  // ML Model Forecasting Modal
  const [mlModalCard, setMlModalCard] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState(3);
  const [forecastingLoading, setForecastingLoading] = useState(false);

  // Drag and Drop reordering
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragOverCardId, setDragOverCardId] = useState(null);

  // Cached chart data map: cardId -> { rows, columns }
  const [cardDataMap, setCardDataMap] = useState({});
  const [loadingCardsMap, setLoadingCardsMap] = useState({});

  // Share Notification
  const [showShareToast, setShowShareToast] = useState(false);

  // Card Selection & Ask AI Copilot Modal
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [askAiModalCard, setAskAiModalCard] = useState(null);
  const [cardConversations, setCardConversations] = useState({}); // cardId -> array of message turns

  useEffect(() => {
    if (dashboardId) {
      loadDashboard(dashboardId);
    }
  }, [dashboardId]);

  const loadDashboard = async (id) => {
    setLoading(true);
    try {
      const data = await api.getDashboard(id);
      setDashboard(data);
      setTitleInput(data.title || 'Executive Dashboard');
      setDescInput(data.description || '');
      
      const firstTabId = data.tabs && data.tabs.length > 0 ? data.tabs[0].id : null;
      setActiveTabId(firstTabId);

      // Fetch data for all cards in all tabs
      (data.tabs || []).forEach(tab => {
        (tab.layout || []).forEach(card => {
          fetchCardData(card, data.project_id || activeProjectId);
        });
      });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCardData = async (card, projId) => {
    const targetProjId = projId || card.dataset_id || activeProjectId;
    if (!targetProjId) return;

    setLoadingCardsMap(prev => ({ ...prev, [card.id]: true }));
    try {
      let data;
      if (card.sql_query) {
        data = await api.queryVisualizationData({
          dataset_id: targetProjId,
          chart_type: card.chart_type,
          x_variable: card.x_variable,
          y_variable: card.y_variable,
          filters: [{ sql_query: card.sql_query }]
        });
      } else {
        data = await api.queryVisualizationData({
          dataset_id: targetProjId,
          chart_type: card.chart_type,
          x_variable: card.x_variable,
          y_variable: card.y_variable,
          aggregation: card.aggregation || 'none',
          filters: card.filters || []
        });
      }
      setCardDataMap(prev => ({ ...prev, [card.id]: data }));

      // If card has ML forecast attached, compute or refresh forecast
      if (card.ml_model_config && card.ml_model_config.model_id) {
        generateCardForecast(card, card.ml_model_config, data.rows || []);
      }
    } catch (err) {
      console.error(`Failed to fetch card data for ${card.id}`, err);
    } finally {
      setLoadingCardsMap(prev => ({ ...prev, [card.id]: false }));
    }
  };

  // ── Auto & Manual Persistence ──────────────────────────────────
  const saveDashboardChanges = async (updatedDash) => {
    const dashToSave = updatedDash || dashboard;
    if (!dashToSave || !dashboardId) return;
    setSaving(true);
    try {
      const saved = await api.updateDashboard(dashboardId, {
        title: dashToSave.title,
        description: dashToSave.description,
        tabs: dashToSave.tabs,
        settings: dashToSave.settings
      });
      setDashboard(saved);
    } catch (err) {
      console.error('Failed to save dashboard', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Tab / Section Management ────────────────────────────────────
  const handleAddTab = () => {
    if (!dashboard) return;
    const newTab = {
      id: `tab-${Date.now()}`,
      name: `Section ${(dashboard.tabs || []).length + 1}`,
      layout: []
    };
    const updatedTabs = [...(dashboard.tabs || []), newTab];
    const updated = { ...dashboard, tabs: updatedTabs };
    setDashboard(updated);
    setActiveTabId(newTab.id);
    saveDashboardChanges(updated);
  };

  const handleRenameTab = (tabId, e) => {
    e.preventDefault();
    if (!editingTabName.trim()) return;
    const updatedTabs = (dashboard.tabs || []).map(t => 
      t.id === tabId ? { ...t, name: editingTabName.trim() } : t
    );
    const updated = { ...dashboard, tabs: updatedTabs };
    setDashboard(updated);
    setEditingTabId(null);
    saveDashboardChanges(updated);
  };

  const handleDeleteTab = (tabId, e) => {
    e.stopPropagation();
    if ((dashboard.tabs || []).length <= 1) {
      alert('A dashboard must have at least one section.');
      return;
    }
    if (!confirm('Are you sure you want to delete this section and its visualizations?')) return;
    const updatedTabs = (dashboard.tabs || []).filter(t => t.id !== tabId);
    const updated = { ...dashboard, tabs: updatedTabs };
    setDashboard(updated);
    if (activeTabId === tabId) {
      setActiveTabId(updatedTabs[0]?.id);
    }
    saveDashboardChanges(updated);
  };

  // ── Card Dimensions & Relocation ────────────────────────────────
  const handleUpdateCard = (cardId, updates) => {
    const updatedTabs = (dashboard.tabs || []).map(tab => {
      if (tab.id !== activeTabId) return tab;
      const updatedLayout = (tab.layout || []).map(card => {
        if (card.id === cardId) {
          return { ...card, ...updates };
        }
        return card;
      });
      return { ...tab, layout: updatedLayout };
    });
    const updated = { ...dashboard, tabs: updatedTabs };
    setDashboard(updated);
    saveDashboardChanges(updated);
  };

  const handleRemoveCard = (cardId) => {
    const updatedTabs = (dashboard.tabs || []).map(tab => {
      if (tab.id !== activeTabId) return tab;
      const updatedLayout = (tab.layout || []).filter(c => c.id !== cardId);
      return { ...tab, layout: updatedLayout };
    });
    const updated = { ...dashboard, tabs: updatedTabs };
    setDashboard(updated);
    saveDashboardChanges(updated);
  };

  const handleMoveCardToTab = (cardId, targetTabId) => {
    if (targetTabId === activeTabId) return;
    let cardToMove = null;

    const tabsWithoutCard = (dashboard.tabs || []).map(tab => {
      if (tab.id === activeTabId) {
        cardToMove = (tab.layout || []).find(c => c.id === cardId);
        return { ...tab, layout: (tab.layout || []).filter(c => c.id !== cardId) };
      }
      return tab;
    });

    if (!cardToMove) return;

    const finalTabs = tabsWithoutCard.map(tab => {
      if (tab.id === targetTabId) {
        return { ...tab, layout: [...(tab.layout || []), cardToMove] };
      }
      return tab;
    });

    const updated = { ...dashboard, tabs: finalTabs };
    setDashboard(updated);
    saveDashboardChanges(updated);
  };

  // ── Ask AI Card Copilot Handlers ────────────────────────────────
  const handleSelectCard = (cardId) => {
    if (mode === 'edit') {
      setSelectedCardId(prev => prev === cardId ? null : cardId);
    }
  };

  const openAskAiModal = (card) => {
    setSelectedCardId(card.id);
    setAskAiModalCard(card);
  };

  const handleApplyAiCardModification = (updatedCard, newData, explanation) => {
    if (!updatedCard || !updatedCard.id) return;
    handleUpdateCard(updatedCard.id, updatedCard);
    if (newData) {
      setCardDataMap(prev => ({ ...prev, [updatedCard.id]: newData }));
    }
    setAskAiModalCard(updatedCard);
  };

  const handleUpdateCardConversation = (cardId, newHistory) => {
    setCardConversations(prev => ({
      ...prev,
      [cardId]: newHistory
    }));
  };

  // ── Drag and Drop Reordering ────────────────────────────────────
  const handleDragStart = (e, cardId) => {
    if (mode === 'preview') return;
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, cardId) => {
    if (mode === 'preview') return;
    e.preventDefault();
    if (cardId !== dragOverCardId) {
      setDragOverCardId(cardId);
    }
  };

  const handleDrop = (e, targetCardId) => {
    if (mode === 'preview' || !draggedCardId || draggedCardId === targetCardId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }
    e.preventDefault();

    const currentTab = (dashboard.tabs || []).find(t => t.id === activeTabId);
    if (!currentTab) return;

    const layout = [...(currentTab.layout || [])];
    const draggedIdx = layout.findIndex(c => c.id === draggedCardId);
    const targetIdx = layout.findIndex(c => c.id === targetCardId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [movedCard] = layout.splice(draggedIdx, 1);
      layout.splice(targetIdx, 0, movedCard);

      // Reassign order
      const reorderedLayout = layout.map((card, idx) => ({ ...card, order: idx }));
      const updatedTabs = (dashboard.tabs || []).map(t => 
        t.id === activeTabId ? { ...t, layout: reorderedLayout } : t
      );
      const updated = { ...dashboard, tabs: updatedTabs };
      setDashboard(updated);
      saveDashboardChanges(updated);
    }

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  // ── Add Existing Visualizations Drawer ──────────────────────────
  const openAddVisualizationsDrawer = async () => {
    setDrawerOpen(true);
    setLoadingProjectVis(true);
    try {
      const targetProjId = dashboard?.project_id || activeProjectId;
      if (targetProjId) {
        const list = await api.listVisualizations(targetProjId);
        setProjectVisualizations(list);
      }
    } catch (err) {
      console.error('Failed to load project visualizations', err);
    } finally {
      setLoadingProjectVis(false);
    }
  };

  const handleAddVisFromDrawer = async (vis) => {
    if (!dashboardId) return;
    try {
      const updated = await api.addVisualizationToDashboard(dashboardId, {
        visualization_id: vis.id,
        tab_id: activeTabId,
        col_span: 6,
        height: 360
      });
      setDashboard(updated);
      // Fetch data for the new card
      const activeTab = (updated.tabs || []).find(t => t.id === activeTabId);
      const newlyAdded = activeTab?.layout[activeTab.layout.length - 1];
      if (newlyAdded) {
        fetchCardData(newlyAdded, updated.project_id || activeProjectId);
      }
    } catch (err) {
      alert(`Failed to add visualization: ${err.message}`);
    }
  };

  // ── ML Model Forecasting Setup ──────────────────────────────────
  const openMlModal = async (card) => {
    setMlModalCard(card);
    const targetProjId = dashboard?.project_id || activeProjectId;
    try {
      const experiments = await api.listExperiments(targetProjId);
      setAvailableModels(experiments.filter(e => e.status === 'completed'));
      if (card.ml_model_config?.model_id) {
        setSelectedModelId(card.ml_model_config.model_id);
        setForecastHorizon(card.ml_model_config.horizon || 3);
      } else if (experiments.length > 0) {
        setSelectedModelId(experiments[0].id);
        setForecastHorizon(3);
      }
    } catch (err) {
      console.error('Failed to load ML experiments', err);
    }
  };

  const handleApplyMlForecast = async () => {
    if (!mlModalCard || !selectedModelId) return;
    setForecastingLoading(true);
    try {
      const cardData = cardDataMap[mlModalCard.id] || { rows: [] };
      const model = availableModels.find(m => m.id === selectedModelId);

      const forecastPayload = {
        model_id: selectedModelId,
        dataset_id: dashboard?.project_id || activeProjectId,
        x_variable: mlModalCard.x_variable,
        y_variable: mlModalCard.y_variable,
        horizon: parseInt(forecastHorizon, 10) || 3,
        historical_data: cardData.rows || []
      };

      const forecastRes = await api.generateDashboardForecast(forecastPayload);

      // Save ML configuration and forecast on the card
      const mlConfig = {
        model_id: selectedModelId,
        model_name: model?.model_name || 'ML Model',
        algorithm: model?.algorithm || 'Predictive Model',
        target_column: forecastRes.target_column,
        horizon: forecastRes.horizon,
        color: forecastRes.color_prediction
      };

      handleUpdateCard(mlModalCard.id, {
        ml_model_config: mlConfig,
        ml_forecast: forecastRes
      });

      setMlModalCard(null);
    } catch (err) {
      alert(`Forecast generation failed: ${err.message}`);
    } finally {
      setForecastingLoading(false);
    }
  };

  const handleRemoveMlForecast = (cardId) => {
    handleUpdateCard(cardId, {
      ml_model_config: null,
      ml_forecast: null
    });
  };

  const generateCardForecast = async (card, mlConfig, rows) => {
    try {
      const forecastRes = await api.generateDashboardForecast({
        model_id: mlConfig.model_id,
        dataset_id: dashboard?.project_id || activeProjectId,
        x_variable: card.x_variable,
        y_variable: card.y_variable,
        horizon: mlConfig.horizon || 3,
        historical_data: rows
      });
      // Store forecast directly in local card representation
      handleUpdateCard(card.id, { ml_forecast: forecastRes });
    } catch (e) {
      console.warn('Silent forecast load failed', e);
    }
  };

  // ── Share Link ──────────────────────────────────────────────────
  const handleCopyShareLink = () => {
    const url = window.location.origin + `/dashboard/${dashboardId}?preview=true`;
    navigator.clipboard.writeText(url);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-[#090d16] text-slate-500">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-sm font-semibold">Loading Dashboard Canvas...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 bg-slate-50 dark:bg-[#090d16] text-slate-700 dark:text-slate-300">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold">Dashboard Not Found</h2>
        <p className="text-xs text-slate-500">The requested dashboard ID does not exist or has been deleted.</p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500"
        >
          Return to Workspace
        </Link>
      </div>
    );
  }

  const isDark = dashboard?.settings?.color_mode ? dashboard.settings.color_mode === 'dark' : (theme === 'dark');

  // ── Standalone Preview Mode (Share Link & Preview View) ─────────
  if (mode === 'preview') {
    const linkedProject = (projects || []).find(p => p.id === dashboard.project_id) || activeProject;
    return (
      <DashboardPreviewView
        dashboard={dashboard}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        cardDataMap={cardDataMap}
        loadingCardsMap={loadingCardsMap}
        theme={dashboard.settings?.theme || 'royal_indigo'}
        cardStyle={dashboard.settings?.card_style || 'glass'}
        defaultColorMode={dashboard.settings?.color_mode || (isDark ? 'dark' : 'light')}
        customColor={dashboard.settings?.custom_accent || null}
        customTheme={dashboard.settings?.custom_theme || null}
        chartShadow={dashboard.settings?.chart_shadow ?? true}
        shadowIntensity={dashboard.settings?.shadow_intensity || 'medium'}
        chartAnimation={dashboard.settings?.chart_animation ?? true}
        onBackToEditor={isDirectPreview ? null : () => setMode('edit')}
        onThemeChange={(newTheme, accent, newCardStyle, newColorMode, extraSettings = {}) => {
          const updatedSettings = {
            ...(dashboard.settings || {}),
            theme: newTheme,
            custom_accent: accent,
            card_style: newCardStyle || dashboard.settings?.card_style || 'glass',
            color_mode: newColorMode || dashboard.settings?.color_mode || 'dark',
            ...extraSettings
          };
          const updated = { ...dashboard, settings: updatedSettings };
          setDashboard(updated);
          saveDashboardChanges(updated);
        }}
        projectName={linkedProject?.name || ''}
        onRefreshData={() => {
          (dashboard.tabs || []).forEach(tab => {
            (tab.layout || []).forEach(card => {
              fetchCardData(card, dashboard.project_id || activeProjectId);
            });
          });
        }}
      />
    );
  }

  const activeTab = (dashboard.tabs || []).find(t => t.id === activeTabId) || dashboard.tabs?.[0];
  const activeLayout = activeTab?.layout || [];
  const selectedCard = activeLayout.find(c => c.id === selectedCardId);

  const activeThemeTemplate = resolveThemeTemplate(
    dashboard?.settings?.theme || 'royal_indigo',
    dashboard?.settings?.custom_accent,
    dashboard?.settings?.custom_theme
  );
  const activeCardStyle = dashboard?.settings?.card_style || 'glass';
  const cardMeta = getCardStyleMeta(activeCardStyle, isDark);

  return (
    <div
      className={`min-h-screen ${isDark ? activeThemeTemplate.dark.background : activeThemeTemplate.light.background} text-slate-800 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200`}
      style={{ backgroundColor: isDark ? activeThemeTemplate.dark.canvasBg : activeThemeTemplate.light.canvasBg }}
    >
      
      {/* ── 1. Top Navbar & Mode Controls ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0e1320]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-4 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Return to Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 border-r border-slate-200 dark:border-slate-800 pr-3 mr-1">
            <img
              src="/logo-mark.png"
              alt="Prajna Logo"
              className="w-7 h-7 object-contain shrink-0 drop-shadow-xs"
            />
            <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-white hidden sm:inline">
              PRAJNA
            </span>
          </div>

          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="Dashboard Heading"
                  className="text-base font-extrabold px-2 py-0.5 rounded-lg border border-violet-500 bg-slate-50 dark:bg-slate-900"
                  autoFocus
                />
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Optional Subtitle"
                  className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 w-44"
                />
                <button
                  onClick={() => {
                    const updated = {
                      ...dashboard,
                      title: titleInput.trim() || 'Executive Dashboard',
                      description: descInput.trim() || null
                    };
                    setDashboard(updated);
                    setEditingTitle(false);
                    saveDashboardChanges(updated);
                  }}
                  className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <h1
                  onClick={() => setEditingTitle(true)}
                  className="text-base font-extrabold truncate cursor-pointer hover:text-violet-600"
                  title="Click to edit heading"
                >
                  {dashboard.title}
                </h1>
                <button onClick={() => setEditingTitle(true)} className="text-slate-400 hover:text-slate-600">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 truncate">
              {dashboard.description || `ID: ${dashboard.id}`}
              {saving && <span className="ml-2 text-violet-500 font-semibold">• Saving...</span>}
            </p>
          </div>
        </div>

        {/* Action Controls & Mode Switch */}
        <div className="flex items-center space-x-2.5">
          
          {/* Linked Session / Data Source Selector */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <Database className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Data:</span>
            <select
              value={dashboard.project_id || ''}
              onChange={async (e) => {
                const newProjId = e.target.value;
                const updated = { ...dashboard, project_id: newProjId };
                setDashboard(updated);
                await api.updateDashboard(dashboardId, { project_id: newProjId });
                (updated.tabs || []).forEach(tab => {
                  (tab.layout || []).forEach(card => {
                    fetchCardData(card, newProjId);
                  });
                });
              }}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-bold text-xs focus:outline-hidden cursor-pointer max-w-[130px] truncate"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Theme & Card Style Configurator Button */}
          <div className="relative">
            <button
              onClick={() => setThemeModalOpen(!themeModalOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shadow-2xs"
              title="Change Theme Template and Card Style"
            >
              <Palette className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span className="hidden sm:inline text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{activeThemeTemplate.name}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-extrabold bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400">
                {activeCardStyle}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Floating Dropdown Modal */}
            {themeModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 z-50 animate-scaleUp space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-4 h-4 text-violet-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Theme Templates &amp; Styles
                    </h3>
                  </div>
                  <button
                    onClick={() => setThemeModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Theme Templates Grid */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Palette Template
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {THEME_TEMPLATES.map(tmpl => {
                      const isSel = (dashboard.settings?.theme || 'royal_indigo') === tmpl.id;
                      return (
                        <button
                          key={tmpl.id}
                          onClick={() => {
                            const updated = {
                              ...dashboard,
                              settings: { ...(dashboard.settings || {}), theme: tmpl.id }
                            };
                            setDashboard(updated);
                            saveDashboardChanges(updated);
                          }}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            isSel
                              ? 'border-violet-500 ring-2 ring-violet-500/40 bg-violet-50/50 dark:bg-violet-950/40'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold truncate pr-1">{tmpl.name}</span>
                            {isSel && <Check className="w-3 h-3 text-violet-500 shrink-0" />}
                          </div>
                          <div className="flex items-center space-x-1">
                            {tmpl.previewSwatches.map((c, idx) => (
                              <span
                                key={idx}
                                style={{ backgroundColor: c }}
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Card Style Options */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Card Style
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {CARD_STYLES.map(cs => {
                      const isSel = (dashboard.settings?.card_style || 'glass') === cs.id;
                      return (
                        <button
                          key={cs.id}
                          onClick={() => {
                            const updated = {
                              ...dashboard,
                              settings: { ...(dashboard.settings || {}), card_style: cs.id }
                            };
                            setDashboard(updated);
                            saveDashboardChanges(updated);
                          }}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all border text-center truncate ${
                            isSel
                              ? 'bg-violet-600 text-white border-violet-500 shadow-xs ring-1 ring-violet-400/50'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          title={`${cs.name} — ${cs.description}`}
                        >
                          {cs.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Share Link Button */}
          <button
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 transition-colors"
            title="Copy Public Standalone Link"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-500" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Add Visualization Button (Edit Mode Only) */}
          <button
            onClick={openAddVisualizationsDrawer}
            className="px-3.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/80 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Visualization</span>
          </button>

          {/* Mode Switcher Toggle */}
          <div className="bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl flex items-center shadow-inner">
            <button
              onClick={() => setMode('edit')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                mode === 'edit'
                  ? 'bg-white dark:bg-[#131929] text-violet-600 dark:text-violet-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>

            <button
              onClick={() => setMode('preview')}
              className="px-3.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs hover:from-emerald-500 hover:to-teal-500"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 3. Tabs / Sections Bar ────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0b101c] border-b border-slate-200 dark:border-slate-800/80 px-6 py-2 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center space-x-1.5">
          {(dashboard.tabs || []).map(tab => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center space-x-2 select-none ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />

                {isEditing && mode === 'edit' ? (
                  <form onSubmit={(e) => handleRenameTab(tab.id, e)} onClick={(e) => e.stopPropagation()} className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={editingTabName}
                      onChange={(e) => setEditingTabName(e.target.value)}
                      className="text-xs px-1.5 py-0.5 rounded bg-white text-slate-900 w-24"
                      autoFocus
                    />
                    <button type="submit" className="text-white"><Check className="w-3 h-3" /></button>
                  </form>
                ) : (
                  <span
                    onDoubleClick={() => {
                      if (mode === 'edit') {
                        setEditingTabId(tab.id);
                        setEditingTabName(tab.name);
                      }
                    }}
                    title={mode === 'edit' ? 'Double click to rename' : ''}
                  >
                    {tab.name}
                  </span>
                )}

                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {tab.layout?.length || 0}
                </span>

                {mode === 'edit' && !isEditing && (
                  <button
                    onClick={(e) => handleDeleteTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-300 p-0.5 rounded transition-opacity"
                    title="Delete Section"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {mode === 'edit' && (
            <button
              onClick={handleAddTab}
              className="p-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-violet-500 hover:border-violet-500 transition-colors text-xs flex items-center space-x-1 px-2.5 font-semibold"
              title="Add New Section / Tab"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Section</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Main Grid Canvas ───────────────────────────────────── */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
        {activeLayout.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto shadow-inner">
              <LayoutDashboard className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">This Section is Empty</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Add visualizations from your project, drag to reposition, and attach trained ML models to display predictions.
              </p>
            </div>
            <button
              onClick={openAddVisualizationsDrawer}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold inline-flex items-center space-x-2 shadow-md shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Visualization</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {activeLayout.map((card) => {
              const colSpan = Math.min(12, Math.max(1, card.col_span || card.width || (card.chart_type === 'Metric' ? 3 : 6)));
              const isMetric = card.chart_type === 'Metric';
              const defaultH = isMetric ? 140 : 360;
              const cardHeight = card.height || defaultH;
              const isDragging = draggedCardId === card.id;
              const isDragOver = dragOverCardId === card.id;
              const cardData = cardDataMap[card.id] || { columns: [], rows: [] };
              const isLoadingData = !!loadingCardsMap[card.id];
              const hasMlForecast = !!card.ml_model_config && !!card.ml_forecast;
              const isSelected = mode === 'edit' && selectedCardId === card.id;

              return (
                <div
                  key={card.id}
                  draggable={mode === 'edit'}
                  onDragStart={(e) => handleDragStart(e, card.id)}
                  onDragOver={(e) => handleDragOver(e, card.id)}
                  onDrop={(e) => handleDrop(e, card.id)}
                  onClick={() => {
                    if (mode === 'edit') handleSelectCard(card.id);
                  }}
                  style={{
                    gridColumn: `span ${colSpan} / span ${colSpan}`,
                    minHeight: `${cardHeight}px`,
                    height: `${cardHeight}px`,
                    boxShadow: getChartShadowStyle(
                      dashboard.settings?.chart_shadow ?? true,
                      dashboard.settings?.shadow_intensity || 'medium',
                      isDark
                    )
                  }}
                  className={`rounded-3xl ${cardMeta.containerClass} transition-all duration-200 flex flex-col overflow-hidden ${
                    isDragging
                      ? 'opacity-40 border-violet-500 scale-95 shadow-xs'
                      : isDragOver
                      ? 'border-violet-500 ring-2 ring-violet-400/40 dark:ring-violet-700/40'
                      : isSelected
                      ? 'border-violet-500 ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/10'
                      : ''
                  } ${mode === 'edit' ? 'cursor-pointer' : ''}`}
                >
                  {/* Card Header Bar */}
                  <div className={`p-3 ${cardMeta.headerClass} flex items-center justify-between gap-2 shrink-0`}>
                    <div className="flex items-center space-x-2 min-w-0">
                      {mode === 'edit' && (
                        <div
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          title="Drag to reposition card"
                        >
                          <Move className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold truncate text-slate-800 dark:text-slate-100" title={card.title}>
                          {card.title}
                        </h4>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                          <span className="font-semibold text-violet-600 dark:text-violet-400 uppercase">
                            {card.chart_type}
                          </span>
                          {card.x_variable && (
                            <>
                              <span>•</span>
                              <span className="truncate">{card.x_variable} → {card.y_variable || 'count'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ML Forecast Badge */}
                    {hasMlForecast && (
                      <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-[10px] font-extrabold shrink-0 shadow-2xs">
                        <TrendingUp className="w-3 h-3 text-orange-500" />
                        <span>ML Forecast (+{card.ml_model_config.horizon || 3})</span>
                      </div>
                    )}

                    {/* Edit Mode Quick Controls */}
                    {mode === 'edit' && (
                      <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Ask AI Copilot Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAskAiModal(card);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xs shadow-violet-500/30 ring-1 ring-violet-400/50'
                              : 'bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/60 dark:hover:bg-violet-900/80 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800'
                          }`}
                          title="Ask AI to modify this chart"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                          <span>Ask AI</span>
                        </button>

                        {/* Arbitrary Width Selector */}
                        <div className="relative group">
                          <button
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center space-x-1"
                            title="Adjust Width (1 to 12 columns)"
                          >
                            <span>W: {colSpan === 12 ? 'Full' : `${colSpan}/12`}</span>
                            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                          </button>
                          <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-30 space-y-1.5 w-36">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block px-1">Column Width:</span>
                            <div className="grid grid-cols-4 gap-1">
                              {[1, 2, 3, 4, 6, 8, 10, 12].map(num => (
                                <button
                                  key={num}
                                  onClick={() => handleUpdateCard(card.id, { col_span: num, width: num })}
                                  className={`py-1 text-center rounded text-[10px] font-bold ${
                                    colSpan === num
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Custom (1-12):</span>
                              <input
                                type="number"
                                min="1"
                                max="12"
                                value={colSpan}
                                onChange={(e) => {
                                  const val = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
                                  handleUpdateCard(card.id, { col_span: val, width: val });
                                }}
                                className="w-12 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Arbitrary Height Selector */}
                        <div className="relative group">
                          <button
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center space-x-1"
                            title="Adjust Height (in pixels)"
                          >
                            <span>H: {cardHeight}px</span>
                            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                          </button>
                          <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-30 space-y-1.5 w-40">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block px-1">Height Presets:</span>
                            <div className="grid grid-cols-2 gap-1">
                              {[
                                { label: '140px (KPI)', val: 140 },
                                { label: '220px', val: 220 },
                                { label: '300px', val: 300 },
                                { label: '360px', val: 360 },
                                { label: '460px', val: 460 },
                                { label: '560px', val: 560 },
                              ].map(item => (
                                <button
                                  key={item.val}
                                  onClick={() => handleUpdateCard(card.id, { height: item.val })}
                                  className={`py-1 px-1.5 text-left rounded text-[9px] font-bold truncate ${
                                    cardHeight === item.val
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Custom (px):</span>
                              <input
                                type="number"
                                min="100"
                                max="1000"
                                step="10"
                                value={cardHeight}
                                onChange={(e) => {
                                  const val = Math.max(100, Math.min(1000, parseInt(e.target.value) || 200));
                                  handleUpdateCard(card.id, { height: val });
                                }}
                                className="w-16 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Train ML Model / Forecasting Button */}
                        <button
                          onClick={() => openMlModal(card)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            hasMlForecast
                              ? 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 hover:bg-orange-200'
                              : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                          }`}
                          title="Train ML Model / Time-Series Forecasting"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move to Section Dropdown */}
                        {(dashboard.tabs || []).length > 1 && (
                          <div className="relative group">
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Move to another section"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                            <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-1 z-30 space-y-0.5 w-32">
                              <span className="text-[9px] uppercase font-bold text-slate-400 px-2 py-0.5 block">Move to tab:</span>
                              {(dashboard.tabs || []).map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handleMoveCardToTab(card.id, t.id)}
                                  disabled={t.id === activeTabId}
                                  className={`w-full text-left px-2 py-1 rounded text-[10px] font-bold ${
                                    t.id === activeTabId
                                      ? 'opacity-40 cursor-default'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Remove Card Button */}
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Remove from Dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-3 flex-1 w-full relative min-h-0 overflow-hidden">
                    {isMetric ? (
                      <KPICard
                        title={card.title}
                        value={
                          cardData.rows && cardData.rows.length > 0
                            ? (cardData.rows[0].value ?? cardData.rows[0].total ?? cardData.rows[0].count ?? cardData.rows[0][cardData.columns[1]] ?? cardData.rows[0][cardData.columns[0]] ?? 0)
                            : 0
                        }
                        aggregation={card.aggregation}
                        field={card.x_variable || card.y_variable}
                        theme={dashboard.settings?.theme || 'royal_indigo'}
                        themeTemplate={activeThemeTemplate}
                        cardStyle={activeCardStyle}
                        colorMode={isDark ? 'dark' : 'light'}
                        customAccent={dashboard.settings?.custom_accent}
                        mode="edit"
                        isLoading={isLoadingData}
                      />
                    ) : isLoadingData ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-violet-500" />
                        <span>Querying chart data...</span>
                      </div>
                    ) : cardData.rows && cardData.rows.length > 0 ? (
                      <div className="w-full h-full min-h-[160px]">
                        <ChartTab
                          chartConfig={{
                            chart_type: card.chart_type,
                            title: '',
                            x_axis: card.x_variable || cardData.columns[0],
                            y_axis: card.y_variable || cardData.columns[1],
                            ml_forecast: card.ml_forecast
                          }}
                          columns={cardData.columns}
                          rows={cardData.rows}
                          dashboardTheme={dashboard.settings?.theme || 'royal_indigo'}
                          themeTemplate={activeThemeTemplate}
                          colorMode={isDark ? 'dark' : 'light'}
                          customAccent={dashboard.settings?.custom_accent}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 p-4 text-center">
                        <p>No rows returned for this query.</p>
                        {card.sql_query && (
                          <code className="text-[10px] font-mono mt-1 text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {card.sql_query}
                          </code>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Forecast Context Footer (if attached) */}
                  {hasMlForecast && (
                    <div className="px-4 py-2 bg-orange-50/70 dark:bg-orange-950/20 border-t border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-1.5 text-orange-800 dark:text-orange-300 font-medium">
                        <TrendingUp className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span>Model: <strong>{card.ml_model_config.algorithm}</strong> predicting next <strong>{card.ml_model_config.horizon || 3} periods</strong></span>
                      </div>
                      {mode === 'edit' && (
                        <button
                          onClick={() => handleRemoveMlForecast(card.id)}
                          className="text-[10px] text-rose-500 hover:underline font-bold"
                        >
                          Remove ML Overlay
                        </button>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Floating Selected Chart Copilot Bar ────────────────────── */}
      {mode === 'edit' && selectedCard && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-violet-500/50 backdrop-blur-md flex items-center space-x-3 text-xs animate-slideUp">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Selected Chart:</span>
            <strong className="text-slate-100 max-w-[180px] truncate">{selectedCard.title}</strong>
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-violet-900/80 text-violet-300">
              {selectedCard.chart_type}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => openAskAiModal(selectedCard)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold flex items-center space-x-1.5 shadow-md shadow-violet-500/25 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Ask AI</span>
          </button>
          <button
            onClick={() => setSelectedCardId(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Deselect Chart"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 5. Add Visualization Side Drawer ──────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="bg-white dark:bg-[#101625] w-full max-w-md h-full flex flex-col border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-slideLeft">
            
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Add to Dashboard</h3>
                  <p className="text-[11px] text-slate-400">Target Section: <strong>{activeTab?.name}</strong></p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {loadingProjectVis ? (
                <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-violet-500" />
                  <span>Loading visualizations...</span>
                </div>
              ) : projectVisualizations.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <p>No saved visualizations found in this project.</p>
                  <p className="text-[11px]">Generate charts in the Visualizations tab first.</p>
                </div>
              ) : (
                projectVisualizations.map((vis) => (
                  <div
                    key={vis.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 bg-white dark:bg-slate-900 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 uppercase">
                          {vis.chart_type}
                        </span>
                        <h4 className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{vis.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        {vis.x_variable} → {vis.y_variable || 'count'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAddVisFromDrawer(vis)}
                      className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center space-x-1 shrink-0 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── 6. ML Model Forecasting Setup Modal ───────────────────── */}
      {mlModalCard && (
        <ChartForecastModal
          isOpen={!!mlModalCard}
          onClose={() => setMlModalCard(null)}
          chart={mlModalCard}
          datasetId={dashboard?.project_id || activeProjectId}
          activeForecast={mlModalCard.ml_forecast}
          onApplyForecastToCard={(forecastModel) => {
            const mlConfig = {
              model_id: forecastModel.id,
              model_name: forecastModel.model_name || `${forecastModel.algorithm} Forecast`,
              algorithm: forecastModel.algorithm,
              target_column: forecastModel.target_column,
              horizon: forecastModel.forecast_horizon,
              metrics: forecastModel.metrics,
              color: '#f97316'
            };
            handleUpdateCard(mlModalCard.id, {
              ml_model_config: mlConfig,
              ml_forecast: forecastModel
            });
            setMlModalCard(null);
          }}
        />
      )}

      {/* ── 7. Share Link Toast ────────────────────────────────────── */}
      {showShareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Dashboard direct link copied to clipboard!</span>
        </div>
      )}

      {/* ── 8. Ask AI Chart Copilot Modal ──────────────────────────── */}
      <AskAIChartModal
        isOpen={!!askAiModalCard}
        onClose={() => setAskAiModalCard(null)}
        card={askAiModalCard}
        dashboardId={dashboardId}
        projectId={dashboard?.project_id || activeProjectId}
        onApply={handleApplyAiCardModification}
        conversationHistory={askAiModalCard ? cardConversations[askAiModalCard.id] || [] : []}
        onUpdateConversation={(newHistory) => {
          if (askAiModalCard) {
            handleUpdateCardConversation(askAiModalCard.id, newHistory);
          }
        }}
      />

    </div>
  );
}

