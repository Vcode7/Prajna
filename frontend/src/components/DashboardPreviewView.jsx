import React, { useState, useEffect, useRef } from 'react';
import {
  Layers, Edit3, Share2, Maximize2, Minimize2, Check, RefreshCw,
  Palette, Database, ChevronLeft, ChevronRight, Menu,
  Compass, Sun, Moon, Box, Sliders, X, Sparkles, RotateCcw,
  Shield, Activity, TrendingUp, ArrowLeft, AlertCircle, Lightbulb
} from 'lucide-react';
import ChartTab, { calculateChartHeight } from './ChartTab';
import KPICard from './KPICard';
import ChartForecastModal from './ChartForecastModal';
import MarkdownRenderer from './MarkdownRenderer';
import { api } from '../api/client';
import {
  THEME_TEMPLATES,
  CARD_STYLES,
  DEFAULT_CUSTOM_PALETTE,
  resolveThemeTemplate,
  getCardStyleMeta,
  getChartShadowStyle
} from '../constants/dashboardThemes';

export default function DashboardPreviewView({
  dashboard,
  activeTabId,
  setActiveTabId,
  cardDataMap = {},
  loadingCardsMap = {},
  onBackToEditor = null,
  onThemeChange = null,
  projectName = '',
  onRefreshData = null,
  theme: propTheme = null,
  cardStyle: propCardStyle = null,
  defaultColorMode: propColorMode = null,
  customColor: propCustomColor = null,
  chartShadow: propChartShadow = null,
  shadowIntensity: propShadowIntensity = null,
  chartAnimation: propChartAnimation = null,
  customTheme: propCustomTheme = null,
  cardInsightsMap: propCardInsightsMap = null,
  onUpdateCardInsights = null
}) {
  const defaultTheme = propTheme || dashboard?.settings?.theme || 'royal_indigo';
  const defaultCardStyle = propCardStyle || dashboard?.settings?.card_style || 'glass';
  const defaultColorMode = propColorMode || dashboard?.settings?.color_mode || 'dark';
  const defaultCustomColor = propCustomColor || dashboard?.settings?.custom_accent || '#6366f1';
  const defaultChartShadow = propChartShadow !== null && propChartShadow !== undefined
    ? propChartShadow
    : (dashboard?.settings?.chart_shadow !== undefined ? dashboard.settings.chart_shadow : true);
  const defaultShadowIntensity = propShadowIntensity || dashboard?.settings?.shadow_intensity || 'medium';
  const defaultChartAnimation = propChartAnimation !== null && propChartAnimation !== undefined
    ? propChartAnimation
    : (dashboard?.settings?.chart_animation !== undefined ? dashboard.settings.chart_animation : true);
  const defaultCustomTheme = propCustomTheme || dashboard?.settings?.custom_theme || DEFAULT_CUSTOM_PALETTE;

  const [theme, setTheme] = useState(defaultTheme);
  const [cardStyle, setCardStyle] = useState(defaultCardStyle);
  const [colorMode, setColorMode] = useState(defaultColorMode);
  const [customColor, setCustomColor] = useState(defaultCustomColor);
  const [chartShadow, setChartShadow] = useState(defaultChartShadow);
  const [shadowIntensity, setShadowIntensity] = useState(defaultShadowIntensity);
  const [chartAnimation, setChartAnimation] = useState(defaultChartAnimation);
  const [customTheme, setCustomTheme] = useState(defaultCustomTheme);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerTab, setCustomizerTab] = useState('palette'); // 'palette' | 'custom' | 'cards' | 'effects'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Chart-Based Forecasting Modal State
  const [selectedForecastCard, setSelectedForecastCard] = useState(null);
  const [localForecastMap, setLocalForecastMap] = useState({});

  // Chart Insights State (Toggle view between chart and insight inside the same card)
  const [cardViewModes, setCardViewModes] = useState({}); // cardId -> 'chart' | 'insight'
  const [cardInsights, setCardInsights] = useState(propCardInsightsMap || {}); // cardId -> insight markdown
  const [loadingInsights, setLoadingInsights] = useState({}); // cardId -> boolean
  const [insightErrors, setInsightErrors] = useState({}); // cardId -> string error

  useEffect(() => {
    if (propCardInsightsMap) {
      setCardInsights(prev => ({ ...prev, ...propCardInsightsMap }));
    }
  }, [propCardInsightsMap]);

  const handleGenerateInsight = async (card, forceRegenerate = false) => {
    const cardId = card.id;
    // Set view to insight mode immediately so the card transitions seamlessly
    setCardViewModes(prev => ({ ...prev, [cardId]: 'insight' }));

    const existingInsight = cardInsights[cardId] || card.insights;
    if (existingInsight && !forceRegenerate) {
      return;
    }

    setLoadingInsights(prev => ({ ...prev, [cardId]: true }));
    setInsightErrors(prev => ({ ...prev, [cardId]: null }));

    const cardData = cardDataMap[cardId] || { columns: [], rows: [] };

    try {
      const res = await api.generateVisualizationInsights({
        visualization_id: card.visualization_id || undefined,
        dataset_id: dashboard?.project_id || card.dataset_id,
        title: card.title,
        chart_type: card.chart_type,
        x_variable: card.x_variable || cardData.columns[0] || '',
        y_variable: card.y_variable || cardData.columns[1] || '',
        aggregated_data: cardData.rows || [],
        columns: cardData.columns || []
      });

      const insightContent = res?.insights || 'No insights returned.';
      setCardInsights(prev => ({ ...prev, [cardId]: insightContent }));
      if (onUpdateCardInsights) {
        onUpdateCardInsights(cardId, insightContent);
      }
    } catch (err) {
      console.error(`Failed to generate insights for card ${cardId}:`, err);
      setInsightErrors(prev => ({ ...prev, [cardId]: err.message || 'Failed to generate insights' }));
    } finally {
      setLoadingInsights(prev => ({ ...prev, [cardId]: false }));
    }
  };

  const handleRestoreChart = (cardId) => {
    setCardViewModes(prev => ({ ...prev, [cardId]: 'chart' }));
  };

  const panelRef = useRef(null);
  const customizeBtnRef = useRef(null);

  // Close panel on outside click or Escape
  useEffect(() => {
    if (!customizerOpen) return;
    const handlePointerDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        customizeBtnRef.current && !customizeBtnRef.current.contains(e.target)
      ) {
        setCustomizerOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCustomizerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [customizerOpen]);

  // Sync settings if dashboard updates from outside or props change
  useEffect(() => {
    if (propTheme) setTheme(propTheme);
    else if (dashboard?.settings?.theme) setTheme(dashboard.settings.theme);

    if (propCardStyle) setCardStyle(propCardStyle);
    else if (dashboard?.settings?.card_style) setCardStyle(dashboard.settings.card_style);

    if (propColorMode) setColorMode(propColorMode);
    else if (dashboard?.settings?.color_mode) setColorMode(dashboard.settings.color_mode);

    if (propCustomColor) setCustomColor(propCustomColor);
    else if (dashboard?.settings?.custom_accent) setCustomColor(dashboard.settings.custom_accent);

    if (propChartShadow !== null && propChartShadow !== undefined) setChartShadow(propChartShadow);
    else if (dashboard?.settings?.chart_shadow !== undefined) setChartShadow(dashboard.settings.chart_shadow);

    if (propShadowIntensity) setShadowIntensity(propShadowIntensity);
    else if (dashboard?.settings?.shadow_intensity) setShadowIntensity(dashboard.settings.shadow_intensity);

    if (propChartAnimation !== null && propChartAnimation !== undefined) setChartAnimation(propChartAnimation);
    else if (dashboard?.settings?.chart_animation !== undefined) setChartAnimation(dashboard.settings.chart_animation);

    if (propCustomTheme) setCustomTheme(propCustomTheme);
    else if (dashboard?.settings?.custom_theme) setCustomTheme(dashboard.settings.custom_theme);
  }, [
    propTheme, propCardStyle, propColorMode, propCustomColor,
    propChartShadow, propShadowIntensity, propChartAnimation, propCustomTheme,
    dashboard?.settings?.theme, dashboard?.settings?.card_style, dashboard?.settings?.color_mode,
    dashboard?.settings?.custom_accent, dashboard?.settings?.chart_shadow,
    dashboard?.settings?.shadow_intensity, dashboard?.settings?.chart_animation,
    dashboard?.settings?.custom_theme
  ]);

  // Retrigger animation when activeTabId changes
  useEffect(() => {
    setAnimKey(prev => prev + 1);
  }, [activeTabId]);

  const notifySettingsChange = (updates = {}) => {
    const nextTheme = updates.theme !== undefined ? updates.theme : theme;
    const nextAccent = updates.customColor !== undefined ? updates.customColor : customColor;
    const nextStyle = updates.cardStyle !== undefined ? updates.cardStyle : cardStyle;
    const nextMode = updates.colorMode !== undefined ? updates.colorMode : colorMode;
    const nextShadow = updates.chartShadow !== undefined ? updates.chartShadow : chartShadow;
    const nextIntensity = updates.shadowIntensity !== undefined ? updates.shadowIntensity : shadowIntensity;
    const nextAnim = updates.chartAnimation !== undefined ? updates.chartAnimation : chartAnimation;
    const nextCustomTheme = updates.customTheme !== undefined ? updates.customTheme : customTheme;

    if (onThemeChange) {
      onThemeChange(nextTheme, nextAccent, nextStyle, nextMode, {
        chart_shadow: nextShadow,
        shadow_intensity: nextIntensity,
        chart_animation: nextAnim,
        custom_theme: nextCustomTheme
      });
    }
  };

  const handleSelectTheme = (themeId) => {
    setTheme(themeId);
    notifySettingsChange({ theme: themeId });
  };

  const handleSelectCardStyle = (styleId) => {
    setCardStyle(styleId);
    notifySettingsChange({ cardStyle: styleId });
  };

  const handleToggleColorMode = () => {
    const nextMode = colorMode === 'dark' ? 'light' : 'dark';
    setColorMode(nextMode);
    notifySettingsChange({ colorMode: nextMode });
  };

  const handleUpdateCustomColor = (field, val) => {
    const modeKey = colorMode === 'dark' ? 'dark' : 'light';
    const currentModePalette = customTheme[modeKey] || DEFAULT_CUSTOM_PALETTE[modeKey];
    const updatedCustom = {
      ...customTheme,
      [modeKey]: {
        ...currentModePalette,
        [field]: val
      }
    };
    setCustomTheme(updatedCustom);
    setTheme('custom');
    const newAccent = (field === 'accent' || field === 'primary') ? val : customColor;
    if (field === 'accent' || field === 'primary') {
      setCustomColor(val);
    }
    notifySettingsChange({
      theme: 'custom',
      customColor: newAccent,
      customTheme: updatedCustom
    });
  };

  const handleUpdateCustomChartColor = (index, val) => {
    const modeKey = colorMode === 'dark' ? 'dark' : 'light';
    const currentModePalette = customTheme[modeKey] || DEFAULT_CUSTOM_PALETTE[modeKey];
    const newColors = [...(currentModePalette.chartColors || DEFAULT_CUSTOM_PALETTE[modeKey].chartColors)];
    newColors[index] = val;
    const updatedCustom = {
      ...customTheme,
      [modeKey]: {
        ...currentModePalette,
        chartColors: newColors
      }
    };
    setCustomTheme(updatedCustom);
    setTheme('custom');
    notifySettingsChange({
      theme: 'custom',
      customTheme: updatedCustom
    });
  };

  const handleSeedCustomFromTemplate = (templateId = theme) => {
    const tmpl = THEME_TEMPLATES.find(t => t.id === templateId) || THEME_TEMPLATES[0];
    const seeded = {
      light: {
        background: tmpl.light.canvasBg || '#f8faff',
        surface: tmpl.light.surface || '#ffffff',
        primary: tmpl.light.primary,
        secondary: tmpl.light.secondary,
        accent: tmpl.light.accent,
        text: tmpl.light.text.primary,
        border: tmpl.light.border,
        chartColors: [...tmpl.light.chartColors]
      },
      dark: {
        background: tmpl.dark.canvasBg || '#090b14',
        surface: tmpl.dark.surface || '#101426',
        primary: tmpl.dark.primary,
        secondary: tmpl.dark.secondary,
        accent: tmpl.dark.accent,
        text: tmpl.dark.text.primary,
        border: tmpl.dark.border,
        chartColors: [...tmpl.dark.chartColors]
      }
    };
    setCustomTheme(seeded);
    setTheme('custom');
    notifySettingsChange({
      theme: 'custom',
      customTheme: seeded
    });
  };

  const handleToggleShadow = () => {
    const nextVal = !chartShadow;
    setChartShadow(nextVal);
    notifySettingsChange({ chartShadow: nextVal });
  };

  const handleSelectIntensity = (intensity) => {
    setShadowIntensity(intensity);
    if (!chartShadow && intensity !== 'none') {
      setChartShadow(true);
      notifySettingsChange({ chartShadow: true, shadowIntensity: intensity });
    } else {
      notifySettingsChange({ shadowIntensity: intensity });
    }
  };

  const handleToggleAnimation = () => {
    const nextVal = !chartAnimation;
    setChartAnimation(nextVal);
    notifySettingsChange({ chartAnimation: nextVal });
  };

  const handleCopyShareLink = () => {
    const url = window.location.origin + `/dashboard/${dashboard.id}?preview=true`;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const activeTab = (dashboard?.tabs || []).find(t => t.id === activeTabId) || dashboard?.tabs?.[0];
  const layout = activeTab?.layout || [];

  // Theme-specific UI tokens and card style configuration
  const isDark = colorMode === 'dark';
  const activeTemplate = resolveThemeTemplate(
    theme,
    customColor,
    theme === 'custom' ? customTheme : null
  );
  const tokens = isDark ? activeTemplate.dark : activeTemplate.light;
  const cardMeta = getCardStyleMeta(cardStyle, isDark);
  const activeShadow = getChartShadowStyle(chartShadow, shadowIntensity, isDark);

  const currentModeKey = isDark ? 'dark' : 'light';
  const activeCustomPalette = (customTheme && customTheme[currentModeKey])
    ? customTheme[currentModeKey]
    : DEFAULT_CUSTOM_PALETTE[currentModeKey];

  const getSidebarItemClass = (isActive) => {
    if (!isActive) {
      return isDark
        ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900';
    }
    return `bg-gradient-to-r ${tokens.primaryGradient || 'from-indigo-600 to-violet-600'} text-white shadow-md shadow-indigo-500/20 font-bold`;
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col md:flex-row font-sans transition-colors duration-300 ${
        isDark ? 'dark ' + activeTemplate.dark.background : activeTemplate.light.background
      } ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
      style={{ backgroundColor: tokens.canvasBg }}
    >
      {/* ── CSS Keyframe for Preview Animations ── */}
      <style>{`
        @keyframes previewCardEnter {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-card-enter {
          animation: previewCardEnter 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .card-hover-interactive {
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease !important;
        }
        .card-hover-interactive:hover {
          transform: translateY(-4px) scale(1.012);
          box-shadow: 0 18px 36px -4px var(--card-hover-glow), ${activeShadow === 'none' ? '0 10px 24px -2px rgba(0,0,0,0.2)' : activeShadow} !important;
        }
      `}</style>

      {/* ── 1. Left Sidebar Navigation (Sections & Session Info) ─ */}
      <aside
        className={`shrink-0 z-30 transition-all duration-300 ${
          sidebarOpen ? 'w-full md:w-64 lg:w-72' : 'w-0 hidden md:block md:w-16'
        } ${
          isDark
            ? 'bg-[#0b0f1a]/90 border-slate-800/80'
            : 'bg-white/90 border-slate-200/80'
        } backdrop-blur-xl border-r flex flex-col shadow-lg`}
      >
        {/* Sidebar Brand Header */}
        <div className={`p-4 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200/80'} flex items-center justify-between`}>
          <div className="flex items-center space-x-2.5 min-w-0">
            <img
              src="/logo-mark.png"
              alt="Prajna Logo"
              className="w-8 h-8 object-contain shrink-0 drop-shadow-xs"
            />
            {sidebarOpen && (
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">PRAJNA Analytics</span>
                <h2 className="text-xs font-extrabold truncate text-slate-900 dark:text-white" title={dashboard?.title}>
                  {dashboard?.title || 'Executive Dashboard'}
                </h2>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hidden md:block"
            title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Tab Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarOpen && (
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Sections ({dashboard?.tabs?.length || 0})
              </span>
              <span className="text-[10px] text-slate-400">
                {layout.length} widgets
              </span>
            </div>
          )}

          {(dashboard?.tabs || []).map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all select-none ${getSidebarItemClass(isActive)}`}
                title={tab.name}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Layers className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {sidebarOpen && (
                    <span className="truncate">{tab.name}</span>
                  )}
                </div>

                {sidebarOpen && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.layout?.length || 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer: Session Info & Return to Editor */}
        <div className={`p-3 border-t ${isDark ? 'border-slate-800/80 bg-slate-900/50' : 'border-slate-200/80 bg-slate-50/60'} space-y-2 text-[11px]`}>
          {sidebarOpen && (
            <div className="flex items-center space-x-2 text-slate-400 min-w-0">
              <Database className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate" title={projectName || 'Data Source'}>
                Source: <strong>{projectName || 'Live Session'}</strong>
              </span>
            </div>
          )}

          {/* Return to Editor Button */}
          {onBackToEditor && (
            <button
              onClick={onBackToEditor}
              className={`w-full py-2 px-3 rounded-xl border ${
                isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              } text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-xs`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {sidebarOpen && <span>Return to Editor</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ── 2. Main Dashboard Canvas ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        
        {/* Top Header Bar */}
        <header
          className={`sticky top-0 z-20 backdrop-blur-md border-b px-6 py-3.5 flex items-center justify-between shadow-xs ${
            isDark
              ? 'bg-[#0a0e19]/85 border-slate-800/80 text-white'
              : 'bg-white/85 border-slate-200/80 text-slate-900'
          }`}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black truncate tracking-tight" title={dashboard?.title}>
                {dashboard?.title || 'Executive Dashboard'}
              </h1>
              {dashboard?.description && (
                <p className="text-xs text-slate-400 truncate hidden sm:block">
                  {dashboard.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-2">

            {/* Instant Light/Dark Mode Switcher */}
            <button
              onClick={handleToggleColorMode}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs ${
                isDark
                  ? 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Floating Customization Trigger Button */}
            <button
              ref={customizeBtnRef}
              onClick={() => setCustomizerOpen(!customizerOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs ${
                customizerOpen
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/30 ring-2 ring-violet-500/40'
                  : isDark
                  ? 'border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:border-slate-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
              }`}
              title="Theme & Customization Panel"
            >
              <Palette className="w-3.5 h-3.5 text-violet-400" />
              <span>Theme / Customize</span>
              <Sliders className="w-3 h-3 opacity-60" />
            </button>

            {/* Active Theme & Style Pill */}
            <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Theme:</span>
              <span className="font-bold text-violet-600 dark:text-violet-400 capitalize">{activeTemplate.name}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-[10px] font-black uppercase text-slate-400">Style:</span>
              <span className="font-bold capitalize text-slate-600 dark:text-slate-300">{cardStyle}</span>
            </div>

            {/* Refresh Data Button */}
            {onRefreshData && (
              <button
                onClick={onRefreshData}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                title="Refresh All Visualizations"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Share Link Button */}
            <button
              onClick={handleCopyShareLink}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              title="Copy Standalone Link"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>

        {/* ── 3. Floating Customization Panel in Top-Right Corner ── */}
        {customizerOpen && (
          <div
            ref={panelRef}
            className="fixed top-16 right-4 sm:right-6 w-[360px] sm:w-[420px] max-h-[calc(100vh-5rem)] z-50 rounded-3xl shadow-2xl border flex flex-col overflow-hidden animate-scaleUp"
            style={{
              backgroundColor: isDark ? 'rgba(15, 20, 34, 0.96)' : 'rgba(255, 255, 255, 0.97)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderColor: tokens.border || (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'),
              boxShadow: isDark
                ? '0 25px 60px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)'
                : '0 25px 60px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)'
            }}
          >
            {/* Panel Top Header Bar */}
            <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: tokens.border }}>
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: tokens.text.primary }}>
                    Dashboard Customize
                  </h3>
                  <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                    Real-time appearance &amp; effects
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCustomizerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close Customizer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Sub-Tabs */}
            <div className="p-2 border-b flex items-center space-x-1 shrink-0 bg-slate-500/5" style={{ borderColor: tokens.border }}>
              {[
                { id: 'palette', label: 'Themes', icon: Palette },
                { id: 'custom', label: 'Custom Colors', icon: Sparkles },
                { id: 'cards', label: 'Card Style', icon: Box },
                { id: 'effects', label: 'Shadow & Motion', icon: Activity }
              ].map(tab => {
                const isActive = customizerTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCustomizerTab(tab.id)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 transition-all ${
                      isActive
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <TabIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Panel Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">

              {/* ── TAB 1: THEMES & PALETTES ────────────────────── */}
              {customizerTab === 'palette' && (
                <div className="space-y-4">
                  {/* Mode Switcher */}
                  <div className="p-3 rounded-2xl border space-y-2" style={{ borderColor: tokens.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Color Mode</span>
                      <span className="text-[10px] font-bold capitalize text-violet-500">{colorMode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => colorMode !== 'light' && handleToggleColorMode()}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          !isDark
                            ? 'bg-white text-slate-900 border-amber-300 shadow-sm ring-2 ring-amber-400/20'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Light Mode</span>
                      </button>
                      <button
                        onClick={() => colorMode !== 'dark' && handleToggleColorMode()}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          isDark
                            ? 'bg-[#131929] text-white border-indigo-500/80 shadow-sm ring-2 ring-indigo-500/30'
                            : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Dark Mode</span>
                      </button>
                    </div>
                  </div>

                  {/* Predefined Templates Grid */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Theme Templates ({THEME_TEMPLATES.length})
                      </span>
                      <button
                        onClick={() => setCustomizerTab('custom')}
                        className="text-[10px] font-bold text-violet-500 hover:underline flex items-center space-x-1"
                      >
                        <span>Fine-tune in Custom →</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* User Custom Theme Option */}
                      <button
                        onClick={() => {
                          setTheme('custom');
                          notifySettingsChange({ theme: 'custom' });
                        }}
                        className={`p-2.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                          theme === 'custom'
                            ? 'border-violet-500 ring-2 ring-violet-500/40 shadow-xs'
                            : 'hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                        style={{
                          backgroundColor: theme === 'custom'
                            ? (isDark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(99, 102, 241, 0.08)')
                            : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                          borderColor: theme === 'custom' ? tokens.primary : tokens.border
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-1 min-w-0 pr-1">
                            <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                            <span className="text-[11px] font-bold truncate" style={{ color: tokens.text.primary }}>
                              Custom Theme
                            </span>
                          </div>
                          {theme === 'custom' && (
                            <Check className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {(activeCustomPalette.chartColors || []).slice(0, 4).map((color, cIdx) => (
                            <span
                              key={cIdx}
                              style={{ backgroundColor: color }}
                              className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-black/10 dark:border-white/10"
                            />
                          ))}
                        </div>
                      </button>

                      {THEME_TEMPLATES.map(tmpl => {
                        const isSelected = theme === tmpl.id;
                        return (
                          <button
                            key={tmpl.id}
                            onClick={() => handleSelectTheme(tmpl.id)}
                            className={`p-2.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                              isSelected
                                ? 'border-violet-500 ring-2 ring-violet-500/40 shadow-xs'
                                : 'hover:border-slate-400 dark:hover:border-slate-600'
                            }`}
                            style={{
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(99, 102, 241, 0.08)')
                                : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                              borderColor: isSelected ? tokens.primary : tokens.border
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold truncate pr-1" style={{ color: tokens.text.primary }}>
                                {tmpl.name}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              {tmpl.previewSwatches.map((color, cIdx) => (
                                <span
                                  key={cIdx}
                                  style={{ backgroundColor: color }}
                                  className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-black/10 dark:border-white/10"
                                />
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 2: EXPANDED CUSTOM THEME (INDIVIDUAL COLORS) ── */}
              {customizerTab === 'custom' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                        Custom Palette Colors
                      </span>
                      <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                        Editing for: <strong className="capitalize text-violet-500">{colorMode} Mode</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => handleSeedCustomFromTemplate(theme === 'custom' ? 'royal_indigo' : theme)}
                      className="px-2.5 py-1 rounded-xl border border-violet-500/30 text-[10px] font-bold text-violet-500 hover:bg-violet-500/10 flex items-center space-x-1 transition-all"
                      title="Reset / Seed custom colors from the currently selected template"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Seed Template</span>
                    </button>
                  </div>

                  {/* Individual Color Fields */}
                  <div className="space-y-2">
                    {[
                      { key: 'background', label: 'Canvas Background', desc: 'Main backdrop behind all dashboard widgets' },
                      { key: 'surface', label: 'Card / Surface', desc: 'Card body background color' },
                      { key: 'primary', label: 'Primary Brand', desc: 'Key metrics, dominant bars, active elements' },
                      { key: 'secondary', label: 'Secondary Brand', desc: 'Supporting series, icons, and gradients' },
                      { key: 'accent', label: 'Accent Highlight', desc: 'Forecast predictions, badges, tags' },
                      { key: 'text', label: 'Typography Text', desc: 'Headings, data labels, and axis markers' },
                      { key: 'border', label: 'Border & Gridlines', desc: 'Card frames and chart Cartesian grid' }
                    ].map(item => {
                      const colorVal = activeCustomPalette[item.key] || '#6366f1';
                      return (
                        <div
                          key={item.key}
                          className="p-2.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors"
                          style={{ borderColor: tokens.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold block" style={{ color: tokens.text.primary }}>
                              {item.label}
                            </span>
                            <span className="text-[9px] block truncate" style={{ color: tokens.text.muted }}>
                              {item.desc}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {/* Native Color Picker Swatch */}
                            <label className="relative cursor-pointer group">
                              <input
                                type="color"
                                value={colorVal}
                                onChange={(e) => handleUpdateCustomColor(item.key, e.target.value)}
                                className="sr-only"
                              />
                              <div
                                style={{ backgroundColor: colorVal }}
                                className="w-7 h-7 rounded-xl border border-black/20 dark:border-white/20 shadow-xs group-hover:scale-105 transition-transform"
                              />
                            </label>

                            {/* Hex Input */}
                            <input
                              type="text"
                              maxLength={7}
                              value={colorVal}
                              onChange={(e) => handleUpdateCustomColor(item.key, e.target.value)}
                              className="w-16 px-1.5 py-1 text-center font-mono text-[10px] font-bold rounded-lg border focus:outline-hidden"
                              style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                borderColor: tokens.border,
                                color: tokens.text.primary
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart Colors (Series Palette) */}
                  <div className="p-3 rounded-2xl border space-y-2.5" style={{ borderColor: tokens.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Chart Colors (6 Series)
                      </span>
                      <span className="text-[9px]" style={{ color: tokens.text.muted }}>Applied sequentially to charts</span>
                    </div>

                    <div className="grid grid-cols-6 gap-2 pt-1">
                      {(activeCustomPalette.chartColors || DEFAULT_CUSTOM_PALETTE[currentModeKey].chartColors).slice(0, 6).map((cVal, cIdx) => (
                        <div key={cIdx} className="flex flex-col items-center space-y-1">
                          <label className="cursor-pointer group relative">
                            <input
                              type="color"
                              value={cVal}
                              onChange={(e) => handleUpdateCustomChartColor(cIdx, e.target.value)}
                              className="sr-only"
                            />
                            <div
                              style={{ backgroundColor: cVal }}
                              className="w-7 h-7 rounded-xl border border-black/20 dark:border-white/20 shadow-xs group-hover:scale-110 transition-transform"
                            />
                          </label>
                          <span className="text-[8px] font-mono" style={{ color: tokens.text.muted }}>
                            #{cIdx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 3: CARD STYLES ──────────────────────────── */}
              {customizerTab === 'cards' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Card Aesthetic Preset
                    </span>
                    <span className="text-[10px] font-bold capitalize text-violet-500">{cardStyle}</span>
                  </div>

                  <div className="space-y-2">
                    {CARD_STYLES.map(cs => {
                      const isSelected = cardStyle === cs.id;
                      return (
                        <button
                          key={cs.id}
                          onClick={() => handleSelectCardStyle(cs.id)}
                          className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-violet-500 ring-2 ring-violet-500/40 shadow-xs'
                              : 'hover:border-slate-400 dark:hover:border-slate-600'
                          }`}
                          style={{
                            backgroundColor: isSelected
                              ? (isDark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(99, 102, 241, 0.08)')
                              : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'),
                            borderColor: isSelected ? tokens.primary : tokens.border
                          }}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold" style={{ color: tokens.text.primary }}>
                                {cs.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold text-slate-400 border border-slate-200 dark:border-slate-800">
                                {cs.subtitle}
                              </span>
                            </div>
                            <span className="text-[10px] block mt-0.5 line-clamp-1" style={{ color: tokens.text.muted }}>
                              {cs.description}
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-violet-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TAB 4: SHADOW & HOVER MOTION ────────────────── */}
              {customizerTab === 'effects' && (
                <div className="space-y-4">
                  {/* Chart Shadow Control */}
                  <div className="p-3.5 rounded-2xl border space-y-3" style={{ borderColor: tokens.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-violet-400" />
                        <div>
                          <span className="text-[11px] font-bold block" style={{ color: tokens.text.primary }}>
                            Chart Shadow
                          </span>
                          <span className="text-[9px]" style={{ color: tokens.text.muted }}>
                            Elevation depth across all cards
                          </span>
                        </div>
                      </div>

                      {/* On/Off Switch */}
                      <button
                        onClick={handleToggleShadow}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          chartShadow ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                            chartShadow ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Shadow Intensity Selector */}
                    {chartShadow && (
                      <div className="pt-2 border-t space-y-1.5" style={{ borderColor: tokens.border }}>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-slate-400">Intensity:</span>
                          <span className="font-bold capitalize text-violet-500">{shadowIntensity}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['none', 'light', 'medium', 'strong'].map(tier => (
                            <button
                              key={tier}
                              onClick={() => handleSelectIntensity(tier)}
                              className={`py-1.5 px-1 rounded-xl text-[10px] font-bold capitalize transition-all border text-center ${
                                shadowIntensity === tier
                                  ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chart Hover Animation Control */}
                  <div className="p-3.5 rounded-2xl border space-y-3" style={{ borderColor: tokens.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="text-[11px] font-bold block" style={{ color: tokens.text.primary }}>
                            Hover Animation
                          </span>
                          <span className="text-[9px]" style={{ color: tokens.text.muted }}>
                            Subtle scale, lift &amp; dynamic glow
                          </span>
                        </div>
                      </div>

                      {/* On/Off Switch */}
                      <button
                        onClick={handleToggleAnimation}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          chartAnimation ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                            chartAnimation ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Interactive Test Card */}
                    <div
                      className={`p-3 rounded-2xl border text-center select-none cursor-pointer transition-all ${
                        chartAnimation ? 'card-hover-interactive' : ''
                      }`}
                      style={{
                        backgroundColor: tokens.surface,
                        borderColor: tokens.border,
                        boxShadow: activeShadow,
                        '--card-hover-glow': `${tokens.primary}40`
                      }}
                    >
                      <span className="text-[11px] font-bold block" style={{ color: tokens.text.primary }}>
                        Hover me to preview! ✨
                      </span>
                      <span className="text-[9px]" style={{ color: tokens.text.muted }}>
                        {chartAnimation ? 'Slight scale-up (+1.2%), elevation lift & glow' : 'Static (Animations Disabled)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Bottom Footer */}
            <div className="p-3 border-t flex items-center justify-between text-[11px] shrink-0 bg-slate-500/5" style={{ borderColor: tokens.border }}>
              <span className="text-slate-400">Settings auto-save</span>
              <button
                onClick={() => setCustomizerOpen(false)}
                className="px-3.5 py-1 rounded-xl bg-violet-600 text-white font-bold text-xs hover:bg-violet-500 transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Components Grid */}
        <main className="flex-1 p-5 sm:p-6 max-w-[1700px] w-full mx-auto" key={animKey}>
          {layout.length === 0 ? (
            <div className="py-24 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-8 space-y-3 animate-card-enter">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Compass className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold">This section is currently empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Switch to the Editor to add charts, metrics, and machine learning model overlays to this section.
              </p>
              {onBackToEditor && (
                <button
                  onClick={onBackToEditor}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold inline-flex items-center space-x-1.5 shadow-md shadow-violet-500/20"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open Editor</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
              {layout.map((card, idx) => {
                const rawCol = card.col_span || card.width;
                const colSpan = Math.min(
                  12,
                  Math.max(
                    1,
                    rawCol
                      ? (rawCol <= 12 ? rawCol : Math.round(rawCol / 100))
                      : (card.chart_type === 'Metric' ? 3 : 6)
                  )
                );
                const cardData = cardDataMap[card.id] || { columns: [], rows: [] };
                const isMetric = card.chart_type === 'Metric';
                const defaultH = isMetric
                  ? 140
                  : Math.max(360, calculateChartHeight(card, cardData.rows, cardData.columns) + 40);
                const cardHeight = card.height || defaultH;
                const isLoadingData = !!loadingCardsMap[card.id];
                const isViewingInsight = cardViewModes[card.id] === 'insight';

                // Responsive grid style
                const gridStyle = {
                  gridColumn: `span ${colSpan} / span ${colSpan}`,
                  minHeight: `${cardHeight}px`,
                  height: `${cardHeight}px`,
                  animationDelay: `${idx * 45}ms`,
                  boxShadow: activeShadow,
                  '--card-hover-glow': `${tokens.primary}33`,
                  ...(theme === 'custom' ? {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border
                  } : {})
                };

                return (
                  <div
                    key={card.id}
                    style={gridStyle}
                    className={`animate-card-enter rounded-3xl ${cardMeta.containerClass} ${
                      chartAnimation ? 'card-hover-interactive' : ''
                    } transition-all duration-300 flex flex-col overflow-hidden group`}
                  >
                    {isMetric ? (
                      /* ── Dedicated Compact KPI Card ───────────────── */
                      <KPICard
                        title={card.title}
                        value={
                          cardData.rows && cardData.rows.length > 0
                            ? (cardData.rows[0].value ?? cardData.rows[0].total ?? cardData.rows[0].count ?? cardData.rows[0][cardData.columns[1]] ?? cardData.rows[0][cardData.columns[0]] ?? 0)
                            : 0
                        }
                        aggregation={card.aggregation}
                        field={card.x_variable || card.y_variable}
                        theme={theme}
                        themeTemplate={activeTemplate}
                        cardStyle={cardStyle}
                        colorMode={colorMode}
                        customAccent={customColor}
                        mode="preview"
                        isLoading={isLoadingData}
                      />
                    ) : (
                      /* ── Standard Chart Card ─────────────────────── */
                      <>
                        {/* Clean Card Header */}
                        <div className={`px-4 py-3 ${cardMeta.headerClass} flex items-center justify-between gap-2 shrink-0`}>
                          <div className="min-w-0">
                            <h4
                              className="text-xs font-extrabold truncate"
                              style={{ color: tokens.text.primary }}
                              title={card.title}
                            >
                              {card.title}
                            </h4>
                            <div className="flex items-center space-x-1.5 text-[10px]" style={{ color: tokens.text.muted }}>
                              <span
                                className="font-semibold uppercase tracking-wider"
                                style={{ color: tokens.primary }}
                              >
                                {card.chart_type}
                              </span>
                              {card.x_variable && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{card.x_variable} {card.y_variable ? `→ ${card.y_variable}` : ''}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {/* Generate Insight / Back Toggle Button */}
                            {isViewingInsight ? (
                              <button
                                onClick={() => handleRestoreChart(card.id)}
                                className="px-2.5 py-0.5 rounded-lg border text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                  borderColor: tokens.border,
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                  color: tokens.text.primary
                                }}
                                title="Restore Original Chart"
                              >
                                <ArrowLeft className="w-3 h-3" />
                                <span>Back to Chart</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGenerateInsight(card)}
                                disabled={loadingInsights[card.id]}
                                className="px-2.5 py-0.5 rounded-lg border text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                  borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.3)',
                                  backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.08)',
                                  color: tokens.primary
                                }}
                                title="Generate AI insights from this chart's data"
                              >
                                {loadingInsights[card.id] ? (
                                  <RefreshCw className="w-3 h-3 text-violet-500 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                )}
                                <span>Generate Insight</span>
                              </button>
                            )}

                            {(localForecastMap[card.id] || card.ml_forecast) ? (
                              <button
                                onClick={() => setSelectedForecastCard(card)}
                                className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 text-[9px] font-extrabold border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900 transition-colors flex items-center space-x-1 cursor-pointer"
                                title="View Forecast Accuracy & History"
                              >
                                <TrendingUp className="w-3 h-3 text-orange-500" />
                                <span>
                                  ML Forecast (+{(localForecastMap[card.id]?.forecast_horizon || localForecastMap[card.id]?.horizon || card.ml_forecast?.forecast_horizon || card.ml_forecast?.horizon || 3)})
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedForecastCard(card)}
                                className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-orange-400 bg-white/60 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Train ML Model for this Chart"
                              >
                                <TrendingUp className="w-3 h-3 text-orange-500" />
                                <span>Train ML</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Chart Body */}
                        <div className="p-3 flex-1 w-full relative min-h-0 overflow-hidden">
                          {isViewingInsight ? (
                            /* ── Dedicated Insight View replacing Chart inside the same Card ── */
                            <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
                              {/* Insight Toolbar Header with Back Button */}
                              <div
                                className="flex items-center justify-between pb-2 mb-2 border-b shrink-0"
                                style={{ borderColor: tokens.border }}
                              >
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleRestoreChart(card.id)}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 hover:opacity-80"
                                    style={{
                                      borderColor: tokens.border,
                                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                      color: tokens.text.primary
                                    }}
                                    title="Return to original chart view"
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Back</span>
                                  </button>
                                  <div
                                    className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold"
                                    style={{
                                      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                                      color: tokens.primary
                                    }}
                                  >
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    <span>AI Insights</span>
                                  </div>
                                </div>

                                {!loadingInsights[card.id] && (cardInsights[card.id] || card.insights) && (
                                  <button
                                    onClick={() => handleGenerateInsight(card, true)}
                                    className="text-[10px] flex items-center space-x-1 transition-colors px-2 py-0.5 rounded cursor-pointer hover:opacity-80"
                                    style={{ color: tokens.text.muted }}
                                    title="Regenerate insights with fresh AI analysis"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Regenerate</span>
                                  </button>
                                )}
                              </div>

                              {/* Scrollable Insight Content Fitting Exactly within Card */}
                              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 text-xs custom-scrollbar">
                                {loadingInsights[card.id] ? (
                                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center p-4 text-center space-y-3">
                                    <div
                                      className="p-3 rounded-2xl animate-pulse"
                                      style={{ backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)' }}
                                    >
                                      <RefreshCw className="w-6 h-6 animate-spin text-violet-500" />
                                    </div>
                                    <div className="space-y-1 max-w-xs">
                                      <p className="text-xs font-bold" style={{ color: tokens.text.primary }}>
                                        Generating AI Insights...
                                      </p>
                                      <p className="text-[11px] leading-snug" style={{ color: tokens.text.muted }}>
                                        Analyzing patterns, trends, and key findings from {card.title} data.
                                      </p>
                                    </div>
                                  </div>
                                ) : insightErrors[card.id] ? (
                                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center p-4 text-center space-y-3">
                                    <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                                      <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 max-w-xs">
                                      {insightErrors[card.id]}
                                    </p>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => handleGenerateInsight(card, true)}
                                        className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-xs cursor-pointer"
                                      >
                                        Retry
                                      </button>
                                      <button
                                        onClick={() => handleRestoreChart(card.id)}
                                        className="px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer"
                                        style={{ borderColor: tokens.border, color: tokens.text.primary }}
                                      >
                                        Back to Chart
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-1">
                                    <MarkdownRenderer content={cardInsights[card.id] || card.insights} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : isLoadingData ? (
                            <div className="h-full flex items-center justify-center text-xs" style={{ color: tokens.text.muted }}>
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" style={{ color: tokens.primary }} />
                              <span>Loading visualization...</span>
                            </div>
                          ) : cardData.rows && cardData.rows.length > 0 ? (
                            <div className="w-full h-full">
                              <ChartTab
                                chartConfig={{
                                  chart_type: card.chart_type,
                                  title: '',
                                  x_axis: card.x_variable || cardData.columns[0],
                                  y_variable: card.y_variable || cardData.columns[1],
                                  ml_forecast: localForecastMap[card.id] || card.ml_forecast
                                }}
                                columns={cardData.columns}
                                rows={cardData.rows}
                                dashboardTheme={theme}
                                themeTemplate={activeTemplate}
                                colorMode={colorMode}
                                customAccent={customColor}
                              />
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-xs p-4 text-center" style={{ color: tokens.text.muted }}>
                              <p>No rows returned for this view.</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Chart-Based Forecasting Modal ── */}
      {selectedForecastCard && (
        <ChartForecastModal
          isOpen={!!selectedForecastCard}
          onClose={() => setSelectedForecastCard(null)}
          chart={selectedForecastCard}
          datasetId={dashboard?.project_id}
          activeForecast={localForecastMap[selectedForecastCard.id] || selectedForecastCard.ml_forecast}
          onApplyForecastToCard={(forecastModel) => {
            setLocalForecastMap(prev => ({
              ...prev,
              [selectedForecastCard.id]: forecastModel
            }));
          }}
        />
      )}
    </div>
  );
}
