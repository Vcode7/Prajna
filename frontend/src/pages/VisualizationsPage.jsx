import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import ChartTab from '../components/ChartTab';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  BarChart3, PieChart, LineChart, ScatterChart, Layers, Sparkles,
  Plus, Edit3, Trash2, Copy, BrainCircuit, Lightbulb, RefreshCw,
  Send, Check, X, Filter, Sliders, ChevronDown, Eye, ArrowRight,
  Terminal, Table
} from 'lucide-react';

const CHART_TYPES = [
  'Bar', 'Horizontal Bar', 'Line', 'Area', 'Pie', 'Donut',
  'Scatter', 'Stacked Bar', 'Stacked Area', 'Treemap', 'Metric'
];

export default function VisualizationsPage() {
  const {
    activeDataset, setSelectedVisForML, setActiveTab, settings
  } = useChatStore();

  const [activeCategory, setActiveCategory] = useState('single_variable'); // single_variable, bi_variable, multi_variable, all
  const [visualizations, setVisualizations] = useState([]);
  const [loadingVis, setLoadingVis] = useState(false);
  const [visDataMap, setVisDataMap] = useState({}); // visId -> { columns, rows }
  const [loadingDataMap, setLoadingDataMap] = useState({});
  const [loadingInsightsMap, setLoadingInsightsMap] = useState({});

  // Editor Modal State
  const [editingVis, setEditingVis] = useState(null);
  const [editorForm, setEditorForm] = useState({});
  const [editorPreviewData, setEditorPreviewData] = useState(null);
  const [editorPreviewLoading, setEditorPreviewLoading] = useState(false);

  // Chat with Data State
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatSpecPreview, setChatSpecPreview] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (activeDataset?.id) {
      loadVisualizations(activeDataset.id);
    }
  }, [activeDataset?.id]);

  const loadVisualizations = async (datasetId) => {
    setLoadingVis(true);
    try {
      const list = await api.listVisualizations(datasetId);
      setVisualizations(list);
      // Fetch chart datasets for all visualizations
      list.forEach(v => fetchChartData(v));
    } catch (err) {
      console.error('Failed to list visualizations', err);
    } finally {
      setLoadingVis(false);
    }
  };

  const fetchChartData = async (vis) => {
    if (!activeDataset?.id) return;
    setLoadingDataMap(prev => ({ ...prev, [vis.id]: true }));
    try {
      const data = await api.queryVisualizationData({
        dataset_id: activeDataset.id,
        chart_type: vis.chart_type,
        x_variable: vis.x_variable,
        y_variable: vis.y_variable,
        group_variable: vis.group_variable,
        size_variable: vis.size_variable,
        aggregation: vis.aggregation || 'none',
        filters: vis.filters || []
      });
      setVisDataMap(prev => ({ ...prev, [vis.id]: data }));
    } catch (err) {
      console.error(`Failed to fetch data for vis ${vis.id}`, err);
    } finally {
      setLoadingDataMap(prev => ({ ...prev, [vis.id]: false }));
    }
  };

  // Generate On-Demand AI Insights
  const handleGenerateInsights = async (vis) => {
    const data = visDataMap[vis.id] || { columns: [], rows: [] };
    setLoadingInsightsMap(prev => ({ ...prev, [vis.id]: true }));
    try {
      const res = await api.generateVisualizationInsights({
        visualization_id: vis.id,
        dataset_id: activeDataset?.id,
        title: vis.title,
        chart_type: vis.chart_type,
        x_variable: vis.x_variable,
        y_variable: vis.y_variable,
        aggregated_data: data.rows || [],
        columns: data.columns || [],
        model: settings?.model
      });
      
      // Update local state
      setVisualizations(prev => prev.map(item => item.id === vis.id ? { ...item, insights: res.insights } : item));
    } catch (err) {
      alert(`Insights generation failed: ${err.message}`);
    } finally {
      setLoadingInsightsMap(prev => ({ ...prev, [vis.id]: false }));
    }
  };

  // Open Full Editor
  const openEditor = (vis) => {
    setEditingVis(vis);
    const initialForm = {
      title: vis?.title || 'Custom Visualization',
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
    if (!activeDataset?.id) return;
    setEditorPreviewLoading(true);
    try {
      const data = await api.queryVisualizationData({
        dataset_id: activeDataset.id,
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
    if (!activeDataset?.id) return;
    try {
      if (editingVis?.id) {
        const updated = await api.updateVisualization(editingVis.id, editorForm);
        setVisualizations(prev => prev.map(v => v.id === editingVis.id ? updated : v));
        fetchChartData(updated);
      } else {
        const created = await api.createVisualization({
          dataset_id: activeDataset.id,
          ...editorForm
        });
        setVisualizations(prev => [...prev, created]);
        fetchChartData(created);
      }
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
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDuplicateVis = async (vis) => {
    try {
      const duplicate = await api.createVisualization({
        dataset_id: activeDataset.id,
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
    } catch (err) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  // Chat to Visualization Spec
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt.trim() || !activeDataset?.id) return;

    setChatLoading(true);
    setChatSpecPreview(null);
    try {
      const spec = await api.chatToVisualizationSpec({
        dataset_id: activeDataset.id,
        user_prompt: chatPrompt,
        model: settings?.model
      });
      setChatSpecPreview(spec);
    } catch (err) {
      alert(`Chat specification error: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptChatSpec = async () => {
    if (!chatSpecPreview || !activeDataset?.id) return;
    try {
      const targetCategory = chatSpecPreview.category || 'bi_variable';
      const created = await api.createVisualization({
        dataset_id: activeDataset.id,
        category: targetCategory,
        chart_type: chatSpecPreview.chart_type || 'Bar',
        x_variable: chatSpecPreview.x_variable,
        y_variable: chatSpecPreview.y_variable,
        group_variable: chatSpecPreview.group_variable,
        size_variable: chatSpecPreview.size_variable,
        aggregation: chatSpecPreview.aggregation || 'none',
        filters: chatSpecPreview.sql ? [{ sql_query: chatSpecPreview.sql }] : (chatSpecPreview.filters || []),
        title: chatSpecPreview.title,
        description: chatSpecPreview.description,
        configuration: {
          sql: chatSpecPreview.sql,
          calculations: chatSpecPreview.calculations,
          color: '#8b5cf6'
        }
      });

      // Populate preview data immediately
      if (chatSpecPreview.rows && chatSpecPreview.rows.length > 0) {
        setVisDataMap(prev => ({
          ...prev,
          [created.id]: {
            columns: chatSpecPreview.columns,
            rows: chatSpecPreview.rows,
            row_count: chatSpecPreview.row_count,
            chart_type: created.chart_type
          }
        }));
      } else {
        fetchChartData(created);
      }

      setVisualizations(prev => [created, ...prev]);
      setActiveCategory(targetCategory);
      setChatSpecPreview(null);
      setChatPrompt('');
    } catch (err) {
      alert(`Failed to add chart: ${err.message}`);
    }
  };

  const colMeta = activeDataset?.column_metadata || {};
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

  if (!activeDataset) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <BarChart3 className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold">No Active Dataset Selected</h3>
        <p className="text-xs text-slate-400">Please upload or select a CSV dataset in Step 1 to explore visualizations.</p>
        <button
          onClick={() => setActiveTab('datasets')}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl"
        >
          Go to Datasets
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header & Actions ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-sky-500" />
            <h1 className="text-xl font-bold">Visualization Workspace</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dataset: <span className="font-semibold text-violet-600 dark:text-violet-400">{activeDataset.name}</span> ({activeDataset.row_count} rows, {activeDataset.column_count} cols)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => openEditor({})}
            className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Chart</span>
          </button>
        </div>
      </div>

      {/* ── Natural Language Chart Generator (Chat with Data) ─────────── */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-purple-500/10 dark:from-violet-950/40 dark:via-indigo-950/20 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800/60 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Chat with Data (Natural Language Chart Generator)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Describe the insight you want in plain English. AI formulates the SQL, calculates transformations, selects the chart type, and renders an interactive preview.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-violet-100/80 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[11px] font-bold">
            <Terminal className="w-3.5 h-3.5" />
            <span>AI SQL + Dynamic Analytics</span>
          </div>
        </div>

        <form onSubmit={handleChatSubmit} className="flex gap-2 pt-1">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Describe a chart to create (e.g. 'Compare sales and profit across regions', 'Units manufactured by plant location')..."
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              className="w-full text-xs pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-sm"
            />
            {chatPrompt && (
              <button
                type="button"
                onClick={() => setChatPrompt('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={chatLoading || !chatPrompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all shrink-0 active:scale-95"
          >
            {chatLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Preview...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Generate Chart</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Suggestions:</span>
          {[
            'Total units manufactured by product',
            'Average efficiency by plant location',
            'Machine downtime vs defect count',
            'Monthly manufacturing cost trend'
          ].map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setChatPrompt(promptText);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-800/90 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/80 transition-all"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category Tabs ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
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
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeCategory === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Visualizations Grid ─────────────────────────────────── */}
      {loadingVis ? (
        <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-violet-500" />
          <span>Loading visualizations...</span>
        </div>
      ) : filteredVisualizations.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
          <BarChart3 className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold">No charts in this category</h4>
          <p className="text-xs text-slate-400">Click below to create a custom visualization or use the AI Chat assistant.</p>
          <button
            onClick={() => openEditor({ category: activeCategory })}
            className="px-4 py-2 bg-violet-600 text-white text-xs font-semibold rounded-xl"
          >
            Create Chart
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredVisualizations.map((vis) => {
            const chartData = visDataMap[vis.id] || { columns: [], rows: [] };
            const isLoadingData = loadingDataMap[vis.id];
            const isGeneratingInsights = loadingInsightsMap[vis.id];

            return (
              <div
                key={vis.id}
                className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-2">
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
                    {vis.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">{vis.description}</p>
                    )}
                  </div>

                  {/* Actions Dropdown / Buttons */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => openEditor(vis)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Chart"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicateVis(vis)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVis(vis.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Chart Body */}
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

                  {/* AI Insights Display */}
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

                {/* Card Footer Actions */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleGenerateInsights(vis)}
                    disabled={isGeneratingInsights}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 transition-all disabled:opacity-50"
                  >
                    {isGeneratingInsights ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                    ) : (
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>{vis.insights ? 'Regenerate Insights' : 'Generate Insights'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedVisForML(vis);
                      setActiveTab('ml-training');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>Use for ML →</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Visualization Preview Modal ───────────────────────── */}
      {chatSpecPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {chatSpecPreview.title || 'Generated Visualization Preview'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                      {chatSpecPreview.chart_type || 'Bar'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {chatSpecPreview.category || 'bi_variable'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {chatSpecPreview.description || chatSpecPreview.reasoning || `Visualizing query responding to "${chatPrompt}"`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChatSpecPreview(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close without saving"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* 1. Interactive Live Chart */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-violet-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Live Rendered Chart ({chatSpecPreview.rows?.length || 0} rows)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    X-Axis: <strong className="text-slate-700 dark:text-slate-200">{chatSpecPreview.x_variable}</strong> • Y-Axis: <strong className="text-slate-700 dark:text-slate-200">{chatSpecPreview.y_variable || 'count'}</strong>
                  </span>
                </div>

                <div className="h-80 w-full">
                  {chatSpecPreview.rows && chatSpecPreview.rows.length > 0 ? (
                    <ChartTab
                      chartConfig={{
                        chart_type: chatSpecPreview.chart_type || 'Bar',
                        title: chatSpecPreview.title,
                        x_axis: chatSpecPreview.x_variable || chatSpecPreview.columns?.[0],
                        y_axis: (chatSpecPreview.y_variable && chatSpecPreview.y_variable !== chatSpecPreview.x_variable)
                          ? chatSpecPreview.y_variable
                          : (chatSpecPreview.columns?.find(c => c !== (chatSpecPreview.x_variable || chatSpecPreview.columns?.[0])) || 'count')
                      }}
                      columns={chatSpecPreview.columns || []}
                      rows={chatSpecPreview.rows}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No data rows returned for chart rendering.
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Calculation Steps & Transformations Explanation */}
              {chatSpecPreview.calculations && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span>Calculation & Transformation Steps</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 pl-6 leading-relaxed">
                    {chatSpecPreview.calculations}
                  </p>
                  {chatSpecPreview.reasoning && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 italic">
                      Design Note: {chatSpecPreview.reasoning}
                    </p>
                  )}
                </div>
              )}

              {/* 3. Generated SQL Query */}
              {chatSpecPreview.sql && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/90 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Terminal className="w-4 h-4 text-violet-500" />
                      <span>Generated Executed SQL Query</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(chatSpecPreview.sql);
                        alert('SQL copied to clipboard!');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[11px] font-semibold text-slate-600 dark:text-slate-200 transition-colors flex items-center space-x-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono bg-slate-900 text-violet-300 overflow-x-auto leading-relaxed">
                    <code>{chatSpecPreview.sql}</code>
                  </pre>
                </div>
              )}

              {/* 4. Query Result Table Preview */}
              {chatSpecPreview.rows && chatSpecPreview.rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                      <Table className="w-4 h-4 text-violet-500" />
                      <span>Result Data Table ({chatSpecPreview.rows.length} rows)</span>
                    </span>
                  </div>
                  <div className="max-h-48 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                          {(chatSpecPreview.columns || Object.keys(chatSpecPreview.rows[0] || {})).map((col) => (
                            <th key={col} className="py-2 px-3">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {chatSpecPreview.rows.slice(0, 10).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            {(chatSpecPreview.columns || Object.keys(row)).map((col) => (
                              <td key={col} className="py-2 px-3 font-mono text-[11px]">
                                {String(row[col] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
              <div className="text-xs text-slate-500">
                Review the chart and SQL above. Click <strong>Accept</strong> to add it to your visualizations.
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setChatSpecPreview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={handleAcceptChatSpec}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center space-x-2 shadow-md shadow-violet-500/20 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept & Add to Workspace</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Full Visualization Editor Modal ──────────────────────── */}
      {editingVis && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-bold">Visualization Editor</h3>
              </div>
              <button
                onClick={() => setEditingVis(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Controls & Live Preview */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Controls Form */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Chart Title</label>
                  <input
                    type="text"
                    value={editorForm.title || ''}
                    onChange={(e) => {
                      const updated = { ...editorForm, title: e.target.value };
                      setEditorForm(updated);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Chart Type</label>
                    <select
                      value={editorForm.chart_type}
                      onChange={(e) => {
                        const updated = { ...editorForm, chart_type: e.target.value };
                        setEditorForm(updated);
                        fetchEditorPreview(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      {CHART_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Aggregation</label>
                    <select
                      value={editorForm.aggregation}
                      onChange={(e) => {
                        const updated = { ...editorForm, aggregation: e.target.value };
                        setEditorForm(updated);
                        fetchEditorPreview(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      {['none', 'count', 'sum', 'avg', 'median', 'min', 'max'].map(a => (
                        <option key={a} value={a}>{a.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">X Variable (Axis)</label>
                    <select
                      value={editorForm.x_variable || ''}
                      onChange={(e) => {
                        const updated = { ...editorForm, x_variable: e.target.value };
                        setEditorForm(updated);
                        fetchEditorPreview(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      {availableColumns.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Y Variable (Metric)</label>
                    <select
                      value={editorForm.y_variable || ''}
                      onChange={(e) => {
                        const updated = { ...editorForm, y_variable: e.target.value };
                        setEditorForm(updated);
                        fetchEditorPreview(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">None / Auto</option>
                      {availableColumns.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Group-By Variable</label>
                    <select
                      value={editorForm.group_variable || ''}
                      onChange={(e) => {
                        const updated = { ...editorForm, group_variable: e.target.value };
                        setEditorForm(updated);
                        fetchEditorPreview(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="">None (No Grouping)</option>
                      {availableColumns.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Category</label>
                    <select
                      value={editorForm.category}
                      onChange={(e) => setEditorForm({ ...editorForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    >
                      <option value="single_variable">Single Variable</option>
                      <option value="bi_variable">Bi-Variable</option>
                      <option value="multi_variable">Multi-Variable</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Chart Preview Inside Modal */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between min-h-[300px]">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-2">Live Preview</span>
                <div className="h-64 w-full flex-1">
                  {editorPreviewLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span>Updating preview...</span>
                    </div>
                  ) : editorPreviewData && editorPreviewData.rows?.length > 0 ? (
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
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No preview data available for these parameters.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
              <button
                onClick={() => setEditingVis(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditor}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-md"
              >
                Save Visualization
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
