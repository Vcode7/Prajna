import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import ChartTab from './ChartTab';
import MarkdownRenderer from './MarkdownRenderer';
import {
  BarChart3, Plus, Edit3, Trash2, Copy, BrainCircuit, Lightbulb,
  RefreshCw, Send, Check, X, Sliders, CheckSquare, Square,
  Sparkles, Terminal, Table, LayoutDashboard,
  ChevronDown, ChevronUp, Wand2, TrendingUp, CheckCircle2, Circle, AlertCircle
} from 'lucide-react';

const CHART_TYPES = [
  'Bar', 'Horizontal Bar', 'Line', 'Area', 'Pie', 'Donut',
  'Scatter', 'Stacked Bar', 'Stacked Area', 'Treemap', 'Metric'
];

export default function ProjectVisualizationsView() {
  const navigate = useNavigate();
  const {
    activeProjectId, activeProject, selectedVisualizationIds,
    toggleVisualizationSelection, trainWithChart,
    clearSelectedVisualizations, trainWithSelectedVisualizations,
    refreshProjectTree, settings, refreshDashboards
  } = useChatStore();

  // Main Module Tabs: 'visualizations' | 'ai_chat'
  const [mainVisTab, setMainVisTab] = useState('visualizations');

  // Visualization Tab State
  const [activeCategory, setActiveCategory] = useState('single_variable');
  const [visualizations, setVisualizations] = useState([]);
  const [loadingVis, setLoadingVis] = useState(false);
  const [generatingAiCharts, setGeneratingAiCharts] = useState(false);
  const [visDataMap, setVisDataMap] = useState({});
  const [loadingDataMap, setLoadingDataMap] = useState({});
  const [loadingInsightsMap, setLoadingInsightsMap] = useState({});

  // Two-Stage AI Visualization Generation Progressive State
  const [aiGenerationProgress, setAiGenerationProgress] = useState({
    active: false,
    stage: 'idle', // 'planning' | 'generating' | 'completed' | 'error'
    stage1: {
      single_variable: 'idle',
      bi_variable: 'idle',
      multi_variable: 'idle',
      single_count: 0,
      bi_count: 0,
      multi_count: 0
    },
    total: 0,
    successful: 0,
    failed: 0,
    charts: [],
    summaryMessage: ''
  });
  const [isProgressCollapsed, setIsProgressCollapsed] = useState(false);

  // Editor Modal State
  const [editingVis, setEditingVis] = useState(null);
  const [editorForm, setEditorForm] = useState({});
  const [editorPreviewData, setEditorPreviewData] = useState(null);
  const [editorPreviewLoading, setEditorPreviewLoading] = useState(false);

  // Add to Dashboard Modal State
  const [addToDashModalVis, setAddToDashModalVis] = useState(null);
  const [dashboardsList, setDashboardsList] = useState([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState('');
  const [selectedTabId, setSelectedTabId] = useState('');
  const [isCreatingNewDash, setIsCreatingNewDash] = useState(false);
  const [newDashTitle, setNewDashTitle] = useState('');
  const [addColSpan, setAddColSpan] = useState(6);
  const [addSuccessLink, setAddSuccessLink] = useState(null);
  const [addingToDash, setAddingToDash] = useState(false);

  // AI Chat Tab State
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'data',
      content: `### Welcome to PRAJNA Data & Visualization AI Assistant 👋

I have full visibility into **all sheets and tables** in your dataset. You can ask me questions about your data or request interactive charts on demand.

**Example queries you can try:**
- 📊 *"Generate a chart showing monthly revenue"*
- ⚙️ *"What is the average downtime of each machine?"*
- 🏭 *"Which plant has the highest defect rate?"*
- 📈 *"Show me the relationship between production quantity and downtime"*`
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [currentActiveSpec, setCurrentActiveSpec] = useState(null);
  const [savedChatChartIds, setSavedChatChartIds] = useState({});
  const [showSqlForMsg, setShowSqlForMsg] = useState({});
  const [showTableForMsg, setShowTableForMsg] = useState({});
  const chatBottomRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (mainVisTab === 'ai_chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatMessages, mainVisTab, aiChatLoading]);

  // Load visualizations on project change
  useEffect(() => {
    if (activeProjectId) {
      loadVisualizations(activeProjectId);
    }
  }, [activeProjectId]);

  const loadVisualizations = async (projectId) => {
    setLoadingVis(true);
    try {
      const list = await api.listVisualizations(projectId);
      setVisualizations(list);
      list.forEach(v => fetchChartData(v));
    } catch (err) {
      console.error('Failed to list visualizations', err);
    } finally {
      setLoadingVis(false);
    }
  };

  const fetchChartData = async (vis) => {
    if (!activeProjectId) return;
    setLoadingDataMap(prev => ({ ...prev, [vis.id]: true }));
    try {
      const customSql = vis.sql || vis.configuration?.sql;
      const filters = customSql ? [{ sql_query: customSql }] : (vis.filters || []);
      const data = await api.queryVisualizationData({
        dataset_id: activeProjectId,
        chart_type: vis.chart_type,
        x_variable: vis.x_variable,
        y_variable: vis.y_variable,
        group_variable: vis.group_variable,
        size_variable: vis.size_variable,
        aggregation: vis.aggregation || 'none',
        filters: filters
      });
      setVisDataMap(prev => ({ ...prev, [vis.id]: data }));
    } catch (err) {
      console.error(`Failed to fetch data for vis ${vis.id}`, err);
    } finally {
      setLoadingDataMap(prev => ({ ...prev, [vis.id]: false }));
    }
  };

  // Progressive Two-Stage AI Visualization Generation Handler
  const handleGenerateAiImportantCharts = async () => {
    if (!activeProjectId) return;
    setGeneratingAiCharts(true);
    setVisualizations([]); // Clear old charts to display new ones progressively
    setActiveCategory('all'); // Show all incoming charts live
    setIsProgressCollapsed(false);
    setAiGenerationProgress({
      active: true,
      stage: 'planning',
      stage1: {
        single_variable: 'running',
        bi_variable: 'running',
        multi_variable: 'running',
        single_count: 0,
        bi_count: 0,
        multi_count: 0
      },
      total: 0,
      successful: 0,
      failed: 0,
      charts: [],
      summaryMessage: ''
    });

    try {
      await api.generateAiImportantVisualizationsStream(
        activeProjectId,
        settings?.model,
        (event) => {
          if (!event || !event.type) return;

          if (event.type === 'generation_started') {
            setAiGenerationProgress(prev => ({ ...prev, stage: 'planning' }));
          } else if (event.type === 'stage1_progress') {
            setAiGenerationProgress(prev => {
              const planner = event.planner;
              const key = planner === 'single_variable' ? 'single_count' : planner === 'bi_variable' ? 'bi_count' : 'multi_count';
              return {
                ...prev,
                stage1: {
                  ...prev.stage1,
                  [planner]: 'completed',
                  [key]: event.count || 0
                }
              };
            });
          } else if (event.type === 'stage1_completed') {
            const planList = event.plan || [];
            setAiGenerationProgress(prev => ({
              ...prev,
              stage: 'generating',
              total: planList.length,
              charts: planList.map((p, i) => ({
                index: i,
                title: p.title,
                category: p.category,
                chart_type: p.chart_type,
                status: 'pending',
                error: null
              }))
            }));
          } else if (event.type === 'visualization_started') {
            setAiGenerationProgress(prev => ({
              ...prev,
              charts: prev.charts.map(c =>
                (c.index === event.index || c.title === event.title)
                  ? { ...c, status: 'generating' }
                  : c
              )
            }));
          } else if (event.type === 'visualization_completed') {
            const vis = event.visualization;
            const chartData = event.chart_data;

            // Immediately display the chart in the list
            if (vis) {
              setVisualizations(prev => {
                const existing = prev.filter(v => v.id !== vis.id);
                return [...existing, vis];
              });
              if (chartData) {
                setVisDataMap(prev => ({ ...prev, [vis.id]: chartData }));
              } else {
                fetchChartData(vis);
              }
            }

            setAiGenerationProgress(prev => ({
              ...prev,
              successful: prev.successful + 1,
              charts: prev.charts.map(c =>
                (c.index === event.index || c.title === event.title)
                  ? { ...c, status: 'completed' }
                  : c
              )
            }));
          } else if (event.type === 'visualization_error') {
            setAiGenerationProgress(prev => ({
              ...prev,
              failed: prev.failed + 1,
              charts: prev.charts.map(c =>
                (c.index === event.index || c.title === event.title)
                  ? { ...c, status: 'failed', error: event.error }
                  : c
              )
            }));
          } else if (event.type === 'generation_completed') {
            setAiGenerationProgress(prev => ({
              ...prev,
              stage: 'completed',
              summaryMessage: `${event.successful || 0} of ${event.total || 0} visualizations generated successfully.`
            }));
            refreshProjectTree();
          }
        }
      );
    } catch (err) {
      console.warn('Progressive streaming failed, trying batch fallback:', err);
      try {
        const res = await api.generateAiImportantVisualizations(activeProjectId, settings?.model);
        const list = Array.isArray(res) ? res : (res?.visualizations || []);
        if (list && list.length > 0) {
          setVisualizations(list);
          list.forEach(v => fetchChartData(v));
          setActiveCategory('single_variable');
          await refreshProjectTree();
          setAiGenerationProgress(prev => ({
            ...prev,
            stage: 'completed',
            summaryMessage: `Successfully generated ${list.length} visualizations.`
          }));
        }
      } catch (fallbackErr) {
        alert(`Failed to generate AI charts: ${fallbackErr.message}`);
        setAiGenerationProgress(prev => ({ ...prev, stage: 'error', summaryMessage: fallbackErr.message }));
      }
    } finally {
      setGeneratingAiCharts(false);
    }
  };

  // AI Chat Handler
  const handleSendAiChatMessage = async (promptToSend) => {
    const text = (typeof promptToSend === 'string' ? promptToSend : aiChatInput).trim();
    if (!text || !activeProjectId || aiChatLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text
    };

    setAiChatMessages(prev => [...prev, userMsg]);
    setAiChatInput('');
    setAiChatLoading(true);

    try {
      const history = aiChatMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          sender: m.sender,
          content: m.content || m.answer || ''
        }));

      const res = await api.chatVisualizationAssistant({
        dataset_id: activeProjectId,
        message: text,
        user_prompt: text,
        history: history,
        conversation_history: history,
        current_spec: currentActiveSpec,
        current_chart_spec: currentActiveSpec,
        model: settings?.model
      });

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: res.type,
        content: res.answer,
        insights: res.insights,
        chart: res.chart,
        data_preview: res.data_preview,
        sql: res.sql,
        tables_used: res.tables_used
      };

      if (res.chart) {
        setCurrentActiveSpec(res.chart);
      }

      setAiChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setAiChatMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'data',
          content: `⚠️ Error executing request: ${err.message}. Please check your query or verify database connectivity.`
        }
      ]);
    } finally {
      setAiChatLoading(false);
    }
  };

  // Save Chat Chart to Visualization Tab
  const handleSaveChatChartToVisualizations = async (chartSpec, msgId) => {
    if (!chartSpec || !activeProjectId) return;
    try {
      const targetCategory = chartSpec.category || 'bi_variable';
      const created = await api.createVisualization({
        dataset_id: activeProjectId,
        category: targetCategory,
        chart_type: chartSpec.chart_type || 'Bar',
        x_variable: chartSpec.x_variable,
        y_variable: chartSpec.y_variable,
        group_variable: chartSpec.group_variable,
        size_variable: chartSpec.size_variable,
        aggregation: chartSpec.aggregation || 'none',
        filters: chartSpec.sql ? [{ sql_query: chartSpec.sql }] : (chartSpec.filters || []),
        title: chartSpec.title,
        description: chartSpec.description || chartSpec.explanation,
        configuration: {
          sql: chartSpec.sql,
          calculations: chartSpec.calculations || chartSpec.explanation,
          color: '#8b5cf6'
        }
      });

      if (chartSpec.rows && chartSpec.rows.length > 0) {
        setVisDataMap(prev => ({
          ...prev,
          [created.id]: {
            columns: chartSpec.columns,
            rows: chartSpec.rows,
            row_count: chartSpec.rows.length,
            chart_type: created.chart_type
          }
        }));
      } else {
        fetchChartData(created);
      }

      setVisualizations(prev => [created, ...prev]);
      setSavedChatChartIds(prev => ({ ...prev, [msgId]: created.id }));
      await refreshProjectTree();
    } catch (err) {
      alert(`Failed to save chart: ${err.message}`);
    }
  };

  const handleGenerateInsights = async (vis) => {
    const data = visDataMap[vis.id] || { columns: [], rows: [] };
    setLoadingInsightsMap(prev => ({ ...prev, [vis.id]: true }));
    try {
      const res = await api.generateVisualizationInsights({
        visualization_id: vis.id,
        dataset_id: activeProjectId,
        title: vis.title,
        chart_type: vis.chart_type,
        x_variable: vis.x_variable,
        y_variable: vis.y_variable,
        aggregated_data: data.rows || [],
        columns: data.columns || [],
        model: settings?.model
      });
      setVisualizations(prev => prev.map(item => item.id === vis.id ? { ...item, insights: res.insights } : item));
    } catch (err) {
      alert(`Insights generation failed: ${err.message}`);
    } finally {
      setLoadingInsightsMap(prev => ({ ...prev, [vis.id]: false }));
    }
  };

  const openAddToDashboardModal = async (vis) => {
    setAddToDashModalVis(vis);
    setAddSuccessLink(null);
    setIsCreatingNewDash(false);
    setNewDashTitle('');
    try {
      const list = await api.listDashboards(activeProjectId);
      setDashboardsList(list);
      if (list.length > 0) {
        setSelectedDashboardId(list[0].id);
        const firstTab = list[0].tabs?.[0]?.id;
        setSelectedTabId(firstTab || '');
      } else {
        setIsCreatingNewDash(true);
        setNewDashTitle(`${activeProject?.name || 'Project'} Dashboard`);
      }
    } catch (err) {
      console.error('Failed to load dashboards', err);
    }
  };

  const handleConfirmAddToDashboard = async () => {
    if (!addToDashModalVis) return;
    setAddingToDash(true);
    try {
      let targetDashId = selectedDashboardId;
      let targetTabId = selectedTabId;

      if (isCreatingNewDash || !targetDashId) {
        const created = await api.createDashboard({
          project_id: activeProjectId,
          title: newDashTitle.trim() || 'Executive Dashboard'
        });
        targetDashId = created.id;
        targetTabId = created.tabs?.[0]?.id;
      }

      const visConfig = {
        title: addToDashModalVis.title,
        chart_type: addToDashModalVis.chart_type,
        x_variable: addToDashModalVis.x_variable,
        y_variable: addToDashModalVis.y_variable,
        aggregation: addToDashModalVis.aggregation || 'none',
        filters: addToDashModalVis.filters || [],
        sql_query: addToDashModalVis.sql || (addToDashModalVis.configuration?.sql),
        calculations: addToDashModalVis.calculations || (addToDashModalVis.configuration?.calculations)
      };

      await api.addVisualizationToDashboard(targetDashId, {
        visualization_id: addToDashModalVis.id,
        tab_id: targetTabId || undefined,
        visualization_config: visConfig,
        col_span: addColSpan,
        height: 360
      });

      await refreshDashboards(activeProjectId);
      setAddSuccessLink(`/dashboard/${targetDashId}`);
    } catch (err) {
      alert(`Failed to add visualization: ${err.message}`);
    } finally {
      setAddingToDash(false);
    }
  };

  const handleCreateDashboard = async () => {
    try {
      const title = activeProject ? `${activeProject.name} Dashboard` : 'Executive Dashboard';
      const created = await api.createDashboard({
        project_id: activeProjectId,
        title: title
      });
      await refreshDashboards(activeProjectId);
      navigate(`/dashboard/${created.id}`);
    } catch (err) {
      alert(`Failed to create dashboard: ${err.message}`);
    }
  };

  // Full Editor
  const openEditor = (vis) => {
    setEditingVis(vis);
    const initialForm = {
      title: vis?.title || 'Custom Chart',
      description: vis?.description || '',
      category: vis?.category || 'custom',
      chart_type: vis?.chart_type || 'Bar',
      x_variable: vis?.x_variable || (availableColumns[0] || ''),
      y_variable: vis?.y_variable || (availableColumns[1] || availableColumns[0] || ''),
      group_variable: vis?.group_variable || '',
      size_variable: vis?.size_variable || '',
      aggregation: vis?.aggregation || 'none',
      filters: vis?.filters || []
    };
    setEditorForm(initialForm);
    fetchEditorPreview(initialForm);
  };

  const fetchEditorPreview = async (formState) => {
    if (!activeProjectId) return;
    setEditorPreviewLoading(true);
    try {
      const data = await api.queryVisualizationData({
        dataset_id: activeProjectId,
        chart_type: formState.chart_type,
        x_variable: formState.x_variable,
        y_variable: formState.y_variable,
        group_variable: formState.group_variable || undefined,
        size_variable: formState.size_variable || undefined,
        aggregation: formState.aggregation || 'none',
        filters: formState.filters || []
      });
      setEditorPreviewData(data);
    } catch (err) {
      console.error('Failed to fetch editor preview', err);
    } finally {
      setEditorPreviewLoading(false);
    }
  };

  const handleSaveEditor = async () => {
    if (!activeProjectId) return;
    try {
      if (editingVis?.id) {
        const updated = await api.updateVisualization(editingVis.id, editorForm);
        setVisualizations(prev => prev.map(v => v.id === editingVis.id ? updated : v));
        fetchChartData(updated);
      } else {
        const created = await api.createVisualization({
          dataset_id: activeProjectId,
          ...editorForm
        });
        setVisualizations(prev => [...prev, created]);
        fetchChartData(created);
      }
      await refreshProjectTree();
      setEditingVis(null);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDeleteVis = async (id) => {
    if (!confirm('Are you sure you want to delete this visualization?')) return;
    try {
      await api.deleteVisualization(id);
      setVisualizations(prev => prev.filter(v => v.id !== id));
      await refreshProjectTree();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDuplicateVis = async (vis) => {
    try {
      const duplicate = await api.createVisualization({
        dataset_id: activeProjectId,
        category: vis.category,
        chart_type: vis.chart_type,
        x_variable: vis.x_variable,
        y_variable: vis.y_variable,
        group_variable: vis.group_variable,
        size_variable: vis.size_variable,
        aggregation: vis.aggregation,
        filters: vis.filters,
        title: `${vis.title} (Copy)`,
        description: vis.description
      });
      setVisualizations(prev => [...prev, duplicate]);
      fetchChartData(duplicate);
      await refreshProjectTree();
    } catch (err) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  if (!activeProject) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 shadow-sm border border-sky-200/60 dark:border-sky-900/60">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
          PRAJNA Visualizations &amp; AI Analytics
        </h2>
        <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mt-1 max-w-md uppercase tracking-wider">
          Predictive Research &amp; Analytics for Judgement, Navigation &amp; Action
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          Select a project from the sidebar to explore AI-generated visualizations and conversational data analysis.
        </p>
      </div>
    );
  }

  const colMeta = activeProject?.column_metadata || {};
  const availableColumns = Object.keys(colMeta).filter(c => !c.startsWith('_'));
  const filteredVisualizations = activeCategory === 'all'
    ? visualizations
    : visualizations.filter(v => {
        if (activeCategory === 'bi_variable') {
          return v.category === 'bi_variable' || v.category === 'two_variables' || v.category === 'bivariable';
        }
        if (activeCategory === 'multi_variable') {
          return v.category === 'multi_variable' || v.category === 'multivariable';
        }
        if (activeCategory === 'single_variable') {
          return v.category === 'single_variable' || v.category === 'singlevariable';
        }
        return v.category === activeCategory;
      });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header & Main Tab Switcher ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Visualizations &amp; AI Analytics</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dataset: <strong className="text-violet-600 dark:text-violet-400">{activeProject?.name}</strong> • Multi-sheet SQLite analytics &amp; AI-driven charting.
              </p>
            </div>
          </div>
        </div>

        {/* Main Tab Switcher */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <button
            onClick={() => setMainVisTab('visualizations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              mainVisTab === 'visualizations'
                ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Visualization</span>
            {visualizations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 font-extrabold">
                {visualizations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMainVisTab('ai_chat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              mainVisTab === 'ai_chat'
                ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span>AI Chat</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-extrabold">
              Data + Viz
            </span>
          </button>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-2">
          {mainVisTab === 'visualizations' && (
            <button
              onClick={handleGenerateAiImportantCharts}
              disabled={generatingAiCharts}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-violet-500/20 active:scale-95 transition-all disabled:opacity-50"
              title="LLM analyzes all sheets, types, and statistics to generate curated important charts"
            >
              {generatingAiCharts ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating AI Charts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Important Charts using AI</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleCreateDashboard}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>+ Create Dashboard</span>
          </button>

          {mainVisTab === 'visualizations' && (
            <button
              onClick={() => openEditor({})}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom Chart</span>
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: VISUALIZATION TAB
         ════════════════════════════════════════════════════════════════ */}
      {mainVisTab === 'visualizations' && (
        <div className="space-y-6">
          
          {/* Single-Chart Selection Banner for Time-Series Forecasting ML */}
          {selectedVisualizationIds.length > 0 && (() => {
            const selectedChart = visualizations.find(v => v.id === selectedVisualizationIds[0]);
            return (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white shadow-lg flex flex-wrap items-center justify-between gap-4 animate-scaleUp">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center space-x-2">
                      <span>Chart Selected for Time-Series Forecasting</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] text-white font-extrabold">1 Chart</span>
                    </h4>
                    <p className="text-xs text-white/95 mt-0.5">
                      <strong>{selectedChart?.title || 'Selected Chart'}</strong>: The LLM will automatically detect date/metric and select the optimal forecasting model.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearSelectedVisualizations}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md transition-colors"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={() => trainWithChart(selectedVisualizationIds[0])}
                    className="px-5 py-1.5 rounded-xl bg-white text-orange-800 hover:bg-orange-50 text-xs font-extrabold shadow-md flex items-center space-x-1.5 transition-all active:scale-95"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
                    <span>Train ML Model →</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Empty State: No Charts Yet -> Prominent AI Generator Hero Card */}
          {visualizations.length === 0 && !loadingVis && !generatingAiCharts && (
            <div className="p-10 text-center space-y-5 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto my-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-violet-500/20">
                <Wand2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  No Visualizations Generated Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Charts are not randomly generated. Click below to have AI analyze all sheets, detect cross-table relationships, and generate the most meaningful Single, Bi, and Multi-variable charts.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleGenerateAiImportantCharts}
                  disabled={generatingAiCharts}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-violet-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Important Charts using AI</span>
                </button>
                <button
                  onClick={() => openEditor({})}
                  className="px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Custom Chart</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Visualization Generation Progressive Progress Panel */}
          {aiGenerationProgress.active && (
            <div className="p-6 bg-white/95 dark:bg-[#111827]/95 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-xl space-y-5 animate-fadeIn">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        AI Visualization Generation Engine
                      </h4>
                      {aiGenerationProgress.stage === 'completed' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Generation Complete</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center space-x-1 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>
                            {aiGenerationProgress.stage === 'planning' ? 'Stage 1: Multi-Perspective Planning' : 'Stage 2: Progressive Chart Generation'}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {aiGenerationProgress.stage === 'planning'
                        ? '3 parallel AI planners analyzing schema for Single-Variable, Bi-Variable, and Multi-Variable insights...'
                        : aiGenerationProgress.stage === 'completed'
                          ? aiGenerationProgress.summaryMessage || 'All charts generated, validated, and interactive below.'
                          : `Generating each chart specification, SQL query, and data points independently (${aiGenerationProgress.successful} completed, ${aiGenerationProgress.failed} failed)...`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsProgressCollapsed(prev => !prev)}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors text-xs flex items-center space-x-1 px-2.5"
                  >
                    <span>{isProgressCollapsed ? 'Show Progress' : 'Hide Details'}</span>
                    {isProgressCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                  {aiGenerationProgress.stage === 'completed' && (
                    <button
                      onClick={() => setAiGenerationProgress(prev => ({ ...prev, active: false }))}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      title="Dismiss status panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible Content */}
              {!isProgressCollapsed && (
                <div className="space-y-4">
                  {/* Stage 1: Planners Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center space-x-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-violet-500" />
                        <span>STAGE 1: 3 Independent Planning LLM Calls</span>
                      </span>
                      {aiGenerationProgress.stage !== 'planning' && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>All 3 Planners Finished &amp; Combined ({aiGenerationProgress.total} Ideas)</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Planner 1 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Single-Variable Planner</p>
                          <p className="text-[10px] text-slate-400">KPIs, distributions, counts</p>
                        </div>
                        {aiGenerationProgress.stage1.single_variable === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>{aiGenerationProgress.stage1.single_count} ideas</span>
                          </span>
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                        )}
                      </div>

                      {/* Planner 2 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Bi-Variable Planner</p>
                          <p className="text-[10px] text-slate-400">Trends, comparisons, scatter</p>
                        </div>
                        {aiGenerationProgress.stage1.bi_variable === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>{aiGenerationProgress.stage1.bi_count} ideas</span>
                          </span>
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                        )}
                      </div>

                      {/* Planner 3 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Multi-Variable Planner</p>
                          <p className="text-[10px] text-slate-400">Segments, multi-series, joins</p>
                        </div>
                        {aiGenerationProgress.stage1.multi_variable === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>{aiGenerationProgress.stage1.multi_count} ideas</span>
                          </span>
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stage 2: Independent Chart Generation Pipeline */}
                  {aiGenerationProgress.charts.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center space-x-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                          <span>STAGE 2: Progressive Generation &amp; Live Display ({aiGenerationProgress.successful}/{aiGenerationProgress.total})</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Charts appear in the grid below as soon as they finish
                        </span>
                      </div>

                      {/* Charts Grid Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                        {aiGenerationProgress.charts.map((c, i) => (
                          <div
                            key={i}
                            className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                              c.status === 'completed'
                                ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50'
                                : c.status === 'generating'
                                  ? 'bg-violet-500/10 border-violet-300 dark:border-violet-700 shadow-sm animate-pulse'
                                  : c.status === 'failed'
                                    ? 'bg-rose-500/5 border-rose-200 dark:border-rose-900/50'
                                    : 'bg-white dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate pr-2">
                              {c.status === 'completed' && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              {c.status === 'generating' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500 shrink-0" />}
                              {c.status === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />}
                              {c.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate" title={c.title}>
                                  {c.title}
                                </p>
                                <p className="text-[9px] text-slate-400 capitalize truncate">
                                  {c.category?.replace('_', ' ')} • {c.chart_type}
                                </p>
                              </div>
                            </div>

                            <span className="text-[10px] font-mono shrink-0">
                              {c.status === 'completed' && <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ live</span>}
                              {c.status === 'generating' && <span className="text-violet-600 dark:text-violet-400 font-bold">generating</span>}
                              {c.status === 'pending' && <span className="text-slate-400">waiting</span>}
                              {c.status === 'failed' && <span className="text-rose-600 dark:text-rose-400 font-bold">failed</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Bar when complete */}
                  {aiGenerationProgress.stage === 'completed' && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold">{aiGenerationProgress.summaryMessage}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Interactive charts are ready below in their respective tabs.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Category Tabs & Selection Controls (when visualizations exist) */}
          {visualizations.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'single_variable', label: 'Single Variable', count: visualizations.filter(v => v.category === 'single_variable').length },
                  { key: 'bi_variable', label: 'Bi-Variable', count: visualizations.filter(v => v.category === 'bi_variable').length },
                  { key: 'multi_variable', label: 'Multi-Variable', count: visualizations.filter(v => v.category === 'multi_variable').length },
                  { key: 'all', label: 'All Charts', count: visualizations.length }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCategory(tab.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                      activeCategory === tab.key
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeCategory === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => selectAllVisualizations(visualizations.map(v => v.id))}
                  className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  onClick={clearSelectedVisualizations}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Visualizations Cards Grid */}
          {loadingVis ? (
            <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-violet-500" />
              <span>Loading visualizations...</span>
            </div>
          ) : visualizations.length > 0 && filteredVisualizations.length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
              <BarChart3 className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold">No charts in this category</h4>
              <p className="text-xs text-slate-400">Switch categories or create a custom chart for this category.</p>
            </div>
          ) : visualizations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredVisualizations.map((vis) => {
                const isChecked = selectedVisualizationIds.includes(vis.id);
                const chartData = visDataMap[vis.id] || { columns: [], rows: [] };
                const isLoadingData = loadingDataMap[vis.id];
                const isGeneratingInsights = loadingInsightsMap[vis.id];

                return (
                  <div
                    key={vis.id}
                    className={`rounded-3xl bg-white dark:bg-[#111827] border transition-all flex flex-col justify-between overflow-hidden ${
                      isChecked
                        ? 'border-orange-500 shadow-md ring-2 ring-orange-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:shadow-md'
                    }`}
                  >
                    {/* Header with Selection Checkbox */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-3 min-w-0">
                        <button
                          onClick={() => toggleVisualizationSelection(vis.id)}
                          className={`mt-0.5 p-0.5 rounded-lg transition-colors ${isChecked ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 hover:text-slate-600'}`}
                          title={isChecked ? 'Deselect Chart' : 'Select Chart for Forecasting ML (1 chart at a time)'}
                        >
                          {isChecked ? <CheckCircle2 className="w-5 h-5 text-orange-500 fill-orange-100 dark:fill-orange-950/60" /> : <Circle className="w-5 h-5" />}
                        </button>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                              {vis.chart_type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {vis.category.replace('_', ' ')}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold truncate" title={vis.title}>
                            {vis.title}
                          </h3>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => openAddToDashboardModal(vis)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Add to Dashboard"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-violet-500" />
                        </button>
                        <button
                          onClick={() => openEditor(vis)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Chart"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateVis(vis)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVis(vis.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Chart Body */}
                    <div className="p-4 flex-1 min-h-[260px]">
                      {isLoadingData ? (
                        <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          <span>Aggregating data...</span>
                        </div>
                      ) : chartData.rows && chartData.rows.length > 0 ? (
                        <div className="h-60 w-full">
                          <ChartTab
                            chartConfig={{
                              chart_type: vis.chart_type,
                              title: vis.title,
                              x_axis: vis.x_variable || chartData.columns[0],
                              y_axis: (vis.y_variable && vis.y_variable !== vis.x_variable)
                                ? vis.y_variable
                                : (chartData.columns?.find(c => c !== (vis.x_variable || chartData.columns[0])) || 'count')
                            }}
                            columns={chartData.columns}
                            rows={chartData.rows}
                          />
                        </div>
                      ) : (
                        <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                          No data returned for this chart configuration.
                        </div>
                      )}

                      {vis.insights && (
                        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                          <div className="flex items-center space-x-1.5 font-bold text-violet-600 dark:text-violet-400 mb-2">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Visualization Insights</span>
                          </div>
                          <MarkdownRenderer content={vis.insights} />
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleGenerateInsights(vis)}
                          disabled={isGeneratingInsights}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 transition-all disabled:opacity-50"
                        >
                          {isGeneratingInsights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{vis.insights ? 'Regenerate Insights' : 'Generate Insights'}</span>
                        </button>

                        <button
                          onClick={() => openAddToDashboardModal(vis)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 text-xs font-semibold flex items-center space-x-1.5 transition-all"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-violet-500" />
                          <span>Add to Dashboard</span>
                        </button>
                      </div>

                      <button
                        onClick={() => trainWithChart(vis.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                        title="Train Time-Series Forecasting Model for this chart"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Train ML Model →</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: AI CHAT TAB (Data + Visualization Assistant)
         ════════════════════════════════════════════════════════════════ */}
      {mainVisTab === 'ai_chat' && (
        <div className="flex flex-col h-[calc(100vh-210px)] min-h-[600px] bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn">
          
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    PRAJNA Data &amp; Visualization AI Assistant
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cross-table SQLite querying across all sheets with automated chart generation and natural language reasoning.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setAiChatMessages([
                    {
                      id: 'welcome',
                      sender: 'assistant',
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      type: 'data',
                      content: `### Welcome to PRAJNA Data & Visualization AI Assistant 👋\n\nI have full visibility into **all sheets and tables** in your dataset. You can ask me questions about your data or request interactive charts on demand.`
                    }
                  ]);
                  setCurrentActiveSpec(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {aiChatMessages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              const isChart = msg.type === 'visualization' || (msg.chart && msg.chart.rows);
              const isSaved = msg.chart && savedChatChartIds[msg.id];
              const showSql = showSqlForMsg[msg.id];
              const showTable = showTableForMsg[msg.id];

              return (
                <div
                  key={msg.id || idx}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div className={`max-w-3xl w-full ${isUser ? 'ml-auto' : 'mr-auto'} space-y-2`}>
                    
                    {/* Message Meta Info */}
                    <div className={`flex items-center space-x-2 text-[11px] text-slate-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && (
                        <div className="w-5 h-5 rounded-md bg-violet-600 text-white flex items-center justify-center font-bold text-[10px]">
                          P
                        </div>
                      )}
                      <span className="font-semibold">{isUser ? 'You' : 'PRAJNA AI'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                      {msg.tables_used && msg.tables_used.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-violet-400 font-mono text-[10px]">
                            {msg.tables_used.join(' + ')}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Message Bubble Card */}
                    <div
                      className={`p-5 rounded-3xl text-xs space-y-4 leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md rounded-tr-sm ml-auto max-w-xl'
                          : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-sm rounded-tl-sm'
                      }`}
                    >
                      {/* Markdown Text / Answer */}
                      <div className={isUser ? 'text-white' : 'prose-sm text-slate-800 dark:text-slate-100'}>
                        <MarkdownRenderer content={msg.content || ''} />
                      </div>

                      {/* Additional Insights if present */}
                      {msg.insights && msg.insights !== msg.content && (
                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1">
                          <div className="flex items-center space-x-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            <span>Analytical Insights</span>
                          </div>
                          <div className="text-slate-700 dark:text-slate-300 text-xs">
                            <MarkdownRenderer content={msg.insights} />
                          </div>
                        </div>
                      )}

                      {/* Live Rendered Chart (for Visualization Responses) */}
                      {isChart && msg.chart && (
                        <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                          
                          {/* Chart Top Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center space-x-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                                {msg.chart.chart_type || 'Bar'}
                              </span>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-sm">
                                {msg.chart.title}
                              </h4>
                            </div>

                            {/* Chart Save & Dashboard Actions */}
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveChatChartToVisualizations(msg.chart, msg.id)}
                                disabled={!!isSaved}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs ${
                                  isSaved
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-default'
                                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-500/20 active:scale-95'
                                }`}
                              >
                                {isSaved ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Saved to Visualizations</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add to Visualization</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => openAddToDashboardModal({
                                  title: msg.chart.title,
                                  chart_type: msg.chart.chart_type,
                                  x_variable: msg.chart.x_variable,
                                  y_variable: msg.chart.y_variable,
                                  aggregation: msg.chart.aggregation,
                                  sql: msg.chart.sql,
                                  configuration: { sql: msg.chart.sql }
                                })}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                              >
                                <LayoutDashboard className="w-3.5 h-3.5 text-violet-500" />
                                <span>Add to Dashboard</span>
                              </button>

                              {isSaved && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMainVisTab('visualizations');
                                    setActiveCategory(msg.chart.category || 'all');
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center space-x-1"
                                >
                                  <span>View Tab →</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Live Chart Container */}
                          <div className="h-72 w-full">
                            {msg.chart.rows && msg.chart.rows.length > 0 ? (
                              <ChartTab
                                chartConfig={{
                                  chart_type: msg.chart.chart_type || 'Bar',
                                  title: msg.chart.title,
                                  x_axis: msg.chart.x_variable || msg.chart.columns?.[0],
                                  y_axis: (msg.chart.y_variable && msg.chart.y_variable !== msg.chart.x_variable)
                                    ? msg.chart.y_variable
                                    : (msg.chart.columns?.find(c => c !== (msg.chart.x_variable || msg.chart.columns?.[0])) || 'count')
                                }}
                                columns={msg.chart.columns || []}
                                rows={msg.chart.rows}
                              />
                            ) : (
                              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                No rows returned for chart display.
                              </div>
                            )}
                          </div>

                          {/* Refinement Chips for follow-up */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Refine:</span>
                            {[
                              'Change this to a Bar chart',
                              'Change this to a Line chart',
                              'Change this to a Donut chart',
                              'Group it by plant',
                              'Add a trend line',
                              'Sort descending by value'
                            ].map((refineText, rIdx) => (
                              <button
                                key={rIdx}
                                type="button"
                                onClick={() => handleSendAiChatMessage(refineText)}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                              >
                                {refineText}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Result Data Table Toggle (for data questions) */}
                      {msg.data_preview && msg.data_preview.rows && msg.data_preview.rows.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowTableForMsg(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                          >
                            <Table className="w-3.5 h-3.5 text-violet-500" />
                            <span>{showTable ? 'Hide Query Result Data' : `Preview Result Data (${msg.data_preview.rows.length} rows)`}</span>
                            {showTable ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {showTable && (
                            <div className="max-h-52 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                                    {(msg.data_preview.columns || Object.keys(msg.data_preview.rows[0] || {})).map(col => (
                                      <th key={col} className="py-2 px-3">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {msg.data_preview.rows.slice(0, 15).map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                      {(msg.data_preview.columns || Object.keys(row)).map(col => (
                                        <td key={col} className="py-1.5 px-3 font-mono text-[11px]">
                                          {String(row[col] ?? '—')}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SQL Query Debug Accordion (Hidden by default, can be toggled) */}
                      {msg.sql && !isUser && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowSqlForMsg(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <Terminal className="w-3 h-3 text-violet-500" />
                            <span>{showSql ? 'Hide SQL Query' : 'View Executed SQL Query (Debug)'}</span>
                            {showSql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {showSql && (
                            <div className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/90 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-mono text-slate-500">Cross-Sheet SQLite Query</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.sql);
                                    alert('SQL copied!');
                                  }}
                                  className="text-[10px] text-violet-600 dark:text-violet-400 hover:underline flex items-center space-x-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </button>
                              </div>
                              <pre className="p-3 text-[11px] font-mono bg-slate-900 text-violet-300 overflow-x-auto leading-relaxed">
                                <code>{msg.sql}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {aiChatLoading && (
              <div className="flex justify-start animate-fadeIn">
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center space-x-3 text-slate-500 dark:text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-violet-600" />
                  <span>AI analyzing all sheets, formulating query, and computing insights...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Suggested Prompts & Chat Input Area */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3 shrink-0">
            
            {/* Quick Prompt Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-1">
                <Lightbulb className="w-3 h-3 text-amber-500" />
                <span>Suggested:</span>
              </span>
              {[
                'What is the average downtime of each machine?',
                'Which plant has the highest defect rate?',
                'Generate a chart showing monthly revenue',
                'Show me the relationship between production quantity and downtime'
              ].map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleSendAiChatMessage(sug)}
                  disabled={aiChatLoading}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiChatMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ask a question about your data or request a chart (e.g. 'Show monthly defect rate by plant')..."
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  disabled={aiChatLoading}
                  className="w-full text-xs pl-4 pr-10 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-sm"
                />
                {aiChatInput && (
                  <button
                    type="button"
                    onClick={() => setAiChatInput('')}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={aiChatLoading || !aiChatInput.trim()}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all shrink-0 active:scale-95"
              >
                {aiChatLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-slate-400 text-center">
              PRAJNA AI executes read-only SQL across all tables in this dataset. Raw SQL queries are hidden by default and accessible via debug toggle.
            </p>
          </div>

        </div>
      )}

      {/* ── Full Visualization Editor Modal ──────────────────────── */}
      {editingVis && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-bold">Visualization Editor</h3>
              </div>
              <button onClick={() => setEditingVis(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Title</label>
                  <input
                    type="text"
                    value={editorForm.title || ''}
                    onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Chart Type</label>
                    <select
                      value={editorForm.chart_type}
                      onChange={(e) => {
                        const u = { ...editorForm, chart_type: e.target.value };
                        setEditorForm(u);
                        fetchEditorPreview(u);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      {CHART_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Aggregation</label>
                    <select
                      value={editorForm.aggregation}
                      onChange={(e) => {
                        const u = { ...editorForm, aggregation: e.target.value };
                        setEditorForm(u);
                        fetchEditorPreview(u);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      {['none', 'count', 'sum', 'avg', 'median', 'min', 'max'].map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">X Variable</label>
                    <select
                      value={editorForm.x_variable || ''}
                      onChange={(e) => {
                        const u = { ...editorForm, x_variable: e.target.value };
                        setEditorForm(u);
                        fetchEditorPreview(u);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Y Variable</label>
                    <select
                      value={editorForm.y_variable || ''}
                      onChange={(e) => {
                        const u = { ...editorForm, y_variable: e.target.value };
                        setEditorForm(u);
                        fetchEditorPreview(u);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">None</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[300px]">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Live Preview</span>
                <div className="h-64 w-full">
                  {editorPreviewLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Updating...</div>
                  ) : editorPreviewData?.rows?.length > 0 ? (
                    <ChartTab
                      chartConfig={{
                        chart_type: editorForm.chart_type,
                        title: editorForm.title,
                        x_axis: editorForm.x_variable,
                        y_axis: (editorForm.y_variable && editorForm.y_variable !== editorForm.x_variable)
                          ? editorForm.y_variable
                          : (editorPreviewData.columns?.find(c => c !== editorForm.x_variable) || 'count')
                      }}
                      columns={editorPreviewData.columns}
                      rows={editorPreviewData.rows}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
              <button onClick={() => setEditingVis(null)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800">Cancel</button>
              <button onClick={handleSaveEditor} className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add to Dashboard Modal ───────────────────────────────── */}
      {addToDashModalVis && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scaleUp text-xs">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add to Dashboard</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[260px]">{addToDashModalVis.title}</p>
                </div>
              </div>
              <button onClick={() => setAddToDashModalVis(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addSuccessLink ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Added to Dashboard!</h4>
                  <p className="text-xs text-slate-400">The visualization configuration and queries were saved to your dashboard.</p>
                </div>
                <div className="flex items-center justify-center space-x-2 pt-2">
                  <button
                    onClick={() => setAddToDashModalVis(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setAddToDashModalVis(null);
                      navigate(addSuccessLink);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white flex items-center space-x-1.5 shadow-sm"
                  >
                    <span>Open Dashboard →</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-600 dark:text-slate-400">Target Dashboard:</label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewDash(!isCreatingNewDash)}
                      className="text-violet-600 dark:text-violet-400 font-bold hover:underline"
                    >
                      {isCreatingNewDash ? "Choose Existing" : "+ New Dashboard"}
                    </button>
                  </div>

                  {isCreatingNewDash ? (
                    <input
                      type="text"
                      placeholder="Enter new dashboard name..."
                      value={newDashTitle}
                      onChange={(e) => setNewDashTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold"
                      autoFocus
                    />
                  ) : dashboardsList.length > 0 ? (
                    <select
                      value={selectedDashboardId}
                      onChange={(e) => {
                        setSelectedDashboardId(e.target.value);
                        const dash = dashboardsList.find(d => d.id === e.target.value);
                        setSelectedTabId(dash?.tabs?.[0]?.id || '');
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold"
                    >
                      {dashboardsList.map(d => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-400 italic">No dashboards found. Creating a new one.</p>
                  )}
                </div>

                {!isCreatingNewDash && dashboardsList.length > 0 && (
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Select Section / Tab:</label>
                    <select
                      value={selectedTabId}
                      onChange={(e) => setSelectedTabId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold"
                    >
                      {(dashboardsList.find(d => d.id === selectedDashboardId)?.tabs || []).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Widget Width:</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '1/3', value: 4 },
                      { label: 'Half (1/2)', value: 6 },
                      { label: '2/3', value: 8 },
                      { label: 'Full', value: 12 }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAddColSpan(opt.value)}
                        className={`py-1.5 rounded-xl font-bold border transition-all ${
                          addColSpan === opt.value
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setAddToDashModalVis(null)}
                    className="px-4 py-2 rounded-xl font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAddToDashboard}
                    disabled={addingToDash}
                    className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center space-x-1.5 shadow-md shadow-violet-500/20 disabled:opacity-50"
                  >
                    {addingToDash ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Dashboard</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
