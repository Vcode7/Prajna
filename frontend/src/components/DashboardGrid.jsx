import React, { useState } from 'react';
import DataGrid from './DataGrid';
import ChartTab from './ChartTab';
import SqlEditorTab from './SqlEditorTab';
import MarkdownRenderer from './MarkdownRenderer';
import { api } from '../api/client';
import { useChatStore } from '../store/chatStore';
import {
  BarChart2, Table, Terminal, Lightbulb, RefreshCw, Clock,
  Copy, Trash2, ArrowLeftRight, Maximize2, Minimize2, Check, Download, Layers3, X, Sparkles, ArrowLeft
} from 'lucide-react';

export default function DashboardGrid({ widgets = [], onUpdateWidgets = () => { } }) {
  const settings = useChatStore(state => state.settings);
  const [activeTabs, setActiveTabs] = useState({}); // widgetId -> activeTabKey
  const [fullscreenWidget, setFullscreenWidget] = useState(null);
  const [loadingWidgets, setLoadingWidgets] = useState({});
  const [loadingInsights, setLoadingInsights] = useState({});
  const [copiedStates, setCopiedStates] = useState({});

  const getTab = (wId) => activeTabs[wId] || 'visualize';

  const setTab = (wId, tab) => {
    setActiveTabs(prev => ({ ...prev, [wId]: tab }));
  };

  const handleGenerateInsights = async (widget, idx) => {
    const wId = widget.id;
    setLoadingInsights(prev => ({ ...prev, [wId]: true }));
    try {
      const data = widget.data || { columns: [], rows: [], row_count: 0 };
      const res = await api.generateWidgetInsights(
        widget.id,
        widget.title,
        widget.sql,
        data.columns,
        data.rows,
        data.row_count,
        settings?.model
      );

      const list = [...widgets];
      list[idx] = {
        ...widget,
        insights: res.insights
      };
      onUpdateWidgets(list);
    } catch (err) {
      console.error(err);
      alert(`Failed to generate insights: ${err.message}`);
    } finally {
      setLoadingInsights(prev => ({ ...prev, [wId]: false }));
    }
  };

  // Move layout widgets left / right
  const moveWidget = (idx, direction) => {
    const list = [...widgets];
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;

    // Swap items
    const temp = list[idx];
    list[idx] = list[newIdx];
    list[newIdx] = temp;

    onUpdateWidgets(list);
  };

  const handleDuplicate = (widget, idx) => {
    const list = [...widgets];
    const duplicate = {
      ...widget,
      id: widget.id + '_dup_' + Math.random().toString(36).substring(2, 6),
      title: `${widget.title} (Copy)`
    };
    // Insert after current index
    list.splice(idx + 1, 0, duplicate);
    onUpdateWidgets(list);
  };

  const handleDelete = (idx) => {
    const list = [...widgets];
    list.splice(idx, 1);
    onUpdateWidgets(list);
  };

  const handleRefreshWidget = async (widget, idx) => {
    const wId = widget.id;
    setLoadingWidgets(prev => ({ ...prev, [wId]: true }));
    try {
      // Execute the widget's current SQL on backend
      const res = await api.executeSql(widget.sql, widget.title, "dashboard_run");

      const list = [...widgets];
      list[idx] = {
        ...widget,
        data: res.data,
        chart: res.chart,
        insights: res.insights
      };
      onUpdateWidgets(list);
    } catch (err) {
      console.error(err);
      alert(`Refresh failed: ${err.message}`);
    } finally {
      setLoadingWidgets(prev => ({ ...prev, [wId]: false }));
    }
  };

  const handleCopySql = (sqlText, wId) => {
    navigator.clipboard.writeText(sqlText).then(() => {
      setCopiedStates(prev => ({ ...prev, [wId]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [wId]: false })), 2000);
    });
  };

  const handleDownloadCSV = (widget) => {
    const data = widget.data;
    if (!data || !data.rows || data.rows.length === 0) return;

    const columns = data.columns;
    const header = columns.join(',');
    const body = data.rows.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const valStr = String(val).replace(/"/g, '""');
        return valStr.includes(',') || valStr.includes('\n') || valStr.includes('"')
          ? `"${valStr}"`
          : valStr;
      }).join(',')
    ).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + '\n' + body);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${widget.title.toLowerCase().replace(/\s+/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render widget content based on tab
  const renderWidgetContent = (widget, idx) => {
    if (widget.status === 'queued') {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-3 bg-slate-50/50 dark:bg-slate-900/10">
          <div className="p-3 bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl text-slate-400">
            <Clock className="w-6 h-6" />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Queued / Waiting
          </span>
        </div>
      );
    }

    if (widget.status === 'running') {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-3 bg-violet-50/20 dark:bg-violet-950/10">
          <RefreshCw className="w-7 h-7 text-violet-500 animate-spin" />
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider animate-pulse">
            {widget.step_label || 'Processing Widget...'}
          </span>
        </div>
      );
    }

    const tab = getTab(widget.id);
    const data = widget.data || { columns: [], rows: [] };

    if (loadingWidgets[widget.id]) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Refreshing dataset...</span>
        </div>
      );
    }

    switch (tab) {
      case 'visualize':
        return <ChartTab chartConfig={widget.chart} rows={data.rows} columns={data.columns} colorMode={theme || 'dark'} />;
      case 'data':
        return <DataGrid rows={data.rows} columns={data.columns} />;
      case 'sql':
        return (
          <SqlEditorTab
            messageId={widget.id}
            originalSql={widget.sql}
            activeSql={widget.sql}
            onQuerySuccess={() => handleRefreshWidget(widget, idx)}
          />
        );
      case 'insights': {
        const isGenerating = loadingInsights[widget.id];
        if (isGenerating) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[220px] space-y-3 bg-violet-50/20 dark:bg-violet-950/10 rounded-xl p-6">
              <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider animate-pulse">
                Generating insights...
              </span>
            </div>
          );
        }

        if (widget.insights) {
          return (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setTab(widget.id, 'visualize')}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold transition-all"
                  title="Return to original chart view"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Chart</span>
                </button>
                <button
                  onClick={() => handleGenerateInsights(widget, idx)}
                  className="text-[10px] text-slate-400 hover:text-violet-500 flex items-center space-x-1 px-2 py-0.5 rounded"
                  title="Regenerate insights"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1 text-xs">
                <MarkdownRenderer content={widget.insights} />
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col items-center justify-center min-h-[220px] space-y-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl p-6 text-center border border-dashed border-slate-300 dark:border-slate-800">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Insights have not been generated yet.
              </p>
              <p className="text-[10px] text-slate-400">
                Click below to generate AI-powered observations for this dataset on-demand.
              </p>
            </div>
            <button
              onClick={() => handleGenerateInsights(widget, idx)}
              disabled={isGenerating}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm transition-all transform hover:scale-[1.02] active:scale-100 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Insights</span>
            </button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Filter out any widgets that returned no data or are empty
  const validWidgets = widgets.filter(
    w => w && (w.status === 'queued' || w.status === 'running' || (w.data && w.data.row_count > 0 && Array.isArray(w.data.rows) && w.data.rows.length > 0))
  );

  if (validWidgets.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {validWidgets.map((widget, idx) => {
        const tab = getTab(widget.id);
        const wId = widget.id;
        const rowCount = widget.data?.row_count || 0;
        const timeMs = widget.data?.execution_time_ms || 0;

        return (
          <div
            key={wId}
            className="flex flex-col bg-white dark:bg-[#121824] border border-slate-400 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md relative group/card"
          >
            {/* Widget Header Toolbar */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
              <h3 className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100 pr-4">
                {widget.title}
              </h3>

              {/* Toolbar Actions */}
              <div className="flex items-center space-x-1 opacity-60 group-hover/card:opacity-100 transition-opacity">
                {/* Swap Left */}
                <button
                  onClick={() => moveWidget(idx, -1)}
                  disabled={idx === 0}
                  title="Shift Left / Up"
                  className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-400 rounded disabled:opacity-20 transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 rotate-90 lg:rotate-0" />
                </button>

                {/* Swap Right */}
                <button
                  onClick={() => moveWidget(idx, 1)}
                  disabled={idx === widgets.length - 1}
                  title="Shift Right / Down"
                  className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-400 rounded disabled:opacity-20 transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 -rotate-90 lg:rotate-0" />
                </button>

                {/* Generate Insights Button */}
                <button
                  onClick={() => {
                    setTab(wId, 'insights');
                    if (!widget.insights && !loadingInsights[wId]) {
                      handleGenerateInsights(widget, idx);
                    }
                  }}
                  title="Generate AI Insights"
                  className="px-2 py-0.5 rounded-lg border border-violet-200 dark:border-violet-800/80 bg-violet-50/80 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/80 text-violet-700 dark:text-violet-300 text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Generate Insight</span>
                </button>

                {/* Refresh */}
                <button
                  onClick={() => handleRefreshWidget(widget, idx)}
                  title="Refresh Query"
                  className="p-1 text-slate-400 hover:text-violet-400 rounded transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWidgets[wId] ? 'animate-spin' : ''}`} />
                </button>

                {/* Copy SQL */}
                <button
                  onClick={() => handleCopySql(widget.sql, wId)}
                  title="Copy SQL Query"
                  className="p-1 text-slate-400 hover:text-violet-400 rounded transition-colors"
                >
                  {copiedStates[wId] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                {/* CSV download */}
                <button
                  onClick={() => handleDownloadCSV(widget)}
                  title="Download CSV"
                  className="p-1 text-slate-400 hover:text-violet-400 rounded transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* Duplicate */}
                <button
                  onClick={() => handleDuplicate(widget, idx)}
                  title="Duplicate Widget"
                  className="p-1 text-slate-400 hover:text-violet-400 rounded transition-colors"
                >
                  <Layers3 className="w-3.5 h-3.5" />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={() => setFullscreenWidget(widget)}
                  title="Expand Focus View"
                  className="p-1 text-slate-400 hover:text-violet-400 rounded transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(idx)}
                  title="Delete Widget"
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Widget Tabs selectors */}
            <div className="flex border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-900/5 px-2">
              <button
                onClick={() => setTab(wId, 'visualize')}
                className={`flex items-center space-x-1 px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${tab === 'visualize' ? 'border-violet-500 text-violet-500 dark:text-violet-450' : 'border-transparent text-slate-450 hover:text-slate-300'
                  }`}
              >
                <BarChart2 className="w-3 h-3" />
                <span>Chart</span>
              </button>
              <button
                onClick={() => setTab(wId, 'data')}
                className={`flex items-center space-x-1 px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${tab === 'data' ? 'border-violet-500 text-violet-500 dark:text-violet-450' : 'border-transparent text-slate-450 hover:text-slate-300'
                  }`}
              >
                <Table className="w-3 h-3" />
                <span>Data</span>
              </button>
              <button
                onClick={() => setTab(wId, 'sql')}
                className={`flex items-center space-x-1 px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${tab === 'sql' ? 'border-violet-500 text-violet-500 dark:text-violet-450' : 'border-transparent text-slate-450 hover:text-slate-300'
                  }`}
              >
                <Terminal className="w-3 h-3" />
                <span>SQL</span>
              </button>
              <button
                onClick={() => setTab(wId, 'insights')}
                className={`flex items-center space-x-1 px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors ${tab === 'insights' ? 'border-violet-500 text-violet-500 dark:text-violet-450' : 'border-transparent text-slate-450 hover:text-slate-300'
                  }`}
              >
                <Lightbulb className="w-3 h-3" />
                <span>Insights</span>
              </button>
            </div>

            {/* Widget Body */}
            <div className="flex-1 p-3.5 bg-white dark:bg-[#111622] min-h-[260px]">
              {renderWidgetContent(widget, idx)}
            </div>

            {/* Widget Footer stats */}
            <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/10 px-3.5 py-1.5 border-t border-slate-400 dark:border-slate-800/80 text-[9px] text-slate-400 font-mono">
              <span>Rows: {rowCount}</span>
              <span>Time: {timeMs}ms</span>
            </div>
          </div>
        );
      })}

      {/* Expanded Focus View Modal */}
      {fullscreenWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-sm">
          <div className="w-full max-w-5xl h-[85vh] flex flex-col bg-white dark:bg-[#121824] border border-slate-400 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel-heavy">
            <div className="flex items-center justify-between p-4 border-b border-slate-400 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Focus Mode: <span className="text-violet-450 font-mono font-medium">{fullscreenWidget.title}</span>
              </h3>
              <button
                onClick={() => setFullscreenWidget(null)}
                className="p-1 text-slate-400 hover:text-slate-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-[#0f1420]">
              <div className="h-full flex flex-col space-y-4">
                {/* Full screen renders the active tab currently selected for this widget */}
                <div className="flex-1">
                  {renderWidgetContent(fullscreenWidget, widgets.findIndex(w => w.id === fullscreenWidget.id))}
                </div>

                {/* Inline SQL summary show at the bottom of focus mode for developer context */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 font-mono text-[11px] text-violet-400 overflow-x-auto max-h-32">
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Widget SQL</span>
                  {fullscreenWidget.sql}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
