import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import DataGrid from './DataGrid';
import MarkdownRenderer from './MarkdownRenderer';
import {
  Database, Upload, Table, Sparkles, Filter, Sliders,
  Download, RefreshCw, AlertTriangle, CheckCircle2, Play,
  Send, Trash2, Edit3, Plus, ArrowRight, Terminal, HelpCircle, Layers,
  Wand2, X, Check
} from 'lucide-react';

export default function ProjectDatabaseView() {
  const {
    activeProjectId, activeProject, databaseSubTab, setDatabaseSubTab,
    refreshProjectTree, settings, selectProjectView
  } = useChatStore();

  const [previewData, setPreviewData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [switchingSheet, setSwitchingSheet] = useState(false);
  const fileInputRef = useRef(null);

  // Transformations State
  const [transType, setTransType] = useState('add_column');
  const [transParams, setTransParams] = useState({
    new_column: '',
    formula: '',
    old_name: '',
    new_name: '',
    column: '',
    strategy: 'mean',
    value: '',
    query: ''
  });
  const [transLoading, setTransLoading] = useState(false);
  const [transMessage, setTransMessage] = useState('');
  const [transError, setTransError] = useState('');

  // Query State
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM dataset LIMIT 20');
  const [queryResults, setQueryResults] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');

  // AI Chat State
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (activeProjectId) {
      loadPreview(activeProjectId);
      loadFullProjectDetails(activeProjectId);
      setTransMessage('');
      setTransError('');
      setQueryError('');
    }
  }, [activeProjectId]);

  const loadFullProjectDetails = async (projectId) => {
    try {
      const data = await api.getDataset(projectId);
      if (data) {
        useChatStore.setState(prev => ({
          activeProject: { ...prev.activeProject, ...data }
        }));
      }
    } catch (err) {
      console.error('Failed to load full project details', err);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const loadPreview = async (projectId) => {
    setLoadingData(true);
    try {
      const data = await api.getDatasetPreview(projectId, 100);
      setPreviewData(data);
    } catch (err) {
      console.error('Failed to load dataset preview', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUploadCSV = async (e) => {
    e.preventDefault();
    if (!selectedFile || !activeProjectId) return;

    setUploading(true);
    setUploadError('');
    try {
      await api.uploadDataset(selectedFile, activeProject?.name || undefined, activeProjectId);
      await refreshProjectTree();
      await loadPreview(activeProjectId);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Run Transformation
  const handleApplyTransformation = async (e) => {
    e.preventDefault();
    if (!activeProjectId) return;

    setTransLoading(true);
    setTransMessage('');
    setTransError('');

    try {
      const res = await api.transformProjectData(activeProjectId, transType, transParams);
      setTransMessage(res.message);
      setPreviewData(res.preview);
      await refreshProjectTree();
    } catch (err) {
      setTransError(err.message || 'Transformation failed');
    } finally {
      setTransLoading(false);
    }
  };

  // Run SQL Query
  const handleRunQuery = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !sqlQuery.trim()) return;

    setQueryLoading(true);
    setQueryError('');
    try {
      const res = await api.queryProjectData(activeProjectId, sqlQuery);
      setQueryResults(res);
    } catch (err) {
      setQueryError(err.message || 'Query execution error');
    } finally {
      setQueryLoading(false);
    }
  };

  // Project AI Chat
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatPrompt.trim() || !activeProjectId) return;

    const userMsg = chatPrompt;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatPrompt('');
    setChatLoading(true);

    try {
      const res = await api.chatProjectData(activeProjectId, userMsg, settings?.model);
      const isExec = Boolean(res.is_executable && res.operation && res.operation.transformation_type);
      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: res.explanation || res.reply || 'Analysis complete.',
          is_executable: isExec,
          operation: res.operation,
          clarification_needed: Boolean(res.clarification_needed),
          status: 'pending', // 'pending' | 'executing' | 'executed' | 'dismissed' | 'failed'
          executionMessage: null,
          errorMessage: null
        }
      ]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: `Unable to process request: ${err.message || 'Server error'}`,
          is_executable: false,
          clarification_needed: false,
          status: 'failed'
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Execute an AI-proposed transformation
  const handleExecuteAiTransformation = async (msgIndex) => {
    const msg = chatMessages[msgIndex];
    if (!msg || !msg.operation || !activeProjectId) return;

    // Set message status to executing
    setChatMessages(prev => prev.map((m, idx) => idx === msgIndex ? { ...m, status: 'executing', errorMessage: null } : m));

    try {
      const res = await api.transformProjectData(
        activeProjectId,
        msg.operation.transformation_type,
        msg.operation.params || {}
      );

      // Refresh data preview grid and project statistics immediately
      if (res.preview) {
        setPreviewData(res.preview);
      }
      await refreshProjectTree();
      await loadFullProjectDetails(activeProjectId);

      setChatMessages(prev => prev.map((m, idx) => idx === msgIndex ? {
        ...m,
        status: 'executed',
        executionMessage: res.message || 'Transformation applied successfully! Dataset and preview refreshed.'
      } : m));

    } catch (err) {
      console.error('Failed to execute AI transformation:', err);
      setChatMessages(prev => prev.map((m, idx) => idx === msgIndex ? {
        ...m,
        status: 'failed',
        errorMessage: err.message || 'Transformation execution failed'
      } : m));
    }
  };

  const handleDismissAiTransformation = (msgIndex) => {
    setChatMessages(prev => prev.map((m, idx) => idx === msgIndex ? { ...m, status: 'dismissed' } : m));
  };

  const colMeta = activeProject?.column_metadata || {};
  const dataQuality = activeProject?.data_quality || {};
  const metaColumns = Object.keys(colMeta).filter(c => !c.startsWith('_'));
  const availableColumns = metaColumns.length > 0 ? metaColumns : (previewData?.columns || []);

  if (!activeProject) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
        <div className="mb-4 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Company Logo"
            className="h-16 w-auto object-contain max-w-[280px] drop-shadow-sm"
          />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
          Welcome to PRAJNA
        </h2>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mt-1 max-w-md uppercase tracking-wider">
          Predictive Research &amp; Analytics for Judgement, Navigation &amp; Action
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          Select a project from the explorer sidebar, or create a new session to ingest datasets, explore data, generate charts, and train ML models.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold">Project Database Workspace</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Project: <strong className="text-violet-600 dark:text-violet-400">{activeProject.name}</strong> • {activeProject.row_count} rows, {activeProject.column_count} columns
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeProject.has_data && (
            <a
              href={api.exportDatasetUrl(activeProject.id)}
              download
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          )}

          <button
            onClick={() => selectProjectView(activeProject.id, 'visualizations')}
            className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <span>Go to Visualizations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── CSV Upload Area (if no data yet or to replace) ─────── */}
      {(!activeProject.has_data || previewData?.rows?.length === 0) && (
        <div className="p-8 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Upload Dataset for {activeProject.name}</h3>
            <p className="text-xs text-slate-400 mt-1">Upload a CSV or Excel (.xlsx/.xls) file to initialize this project's database.</p>
          </div>

          <form onSubmit={handleUploadCSV} className="max-w-md mx-auto space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                  setUploadError('');
                }
              }}
              className="hidden"
              id="proj-csv-file"
            />
            
            <label
              htmlFor="proj-csv-file"
              className="inline-block cursor-pointer px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
            >
              {selectedFile ? selectedFile.name : 'Select CSV or Excel (.xlsx) File'}
            </label>

            {selectedFile && (
              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
              >
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Upload & Parse Data</span>
              </button>
            )}

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs">
                {uploadError}
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── Multi-Sheet Selector Bar ────────────────────────────── */}
      {activeProject.has_data && (activeProject.available_sheets?.length > 1 || (colMeta._sheets && colMeta._sheets.length > 1)) && (
        <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/20 border border-violet-200/80 dark:border-violet-900/40 animate-fadeIn">
          <div className="flex items-center space-x-2 text-xs font-bold text-violet-700 dark:text-violet-300 mr-2">
            <Layers className="w-4 h-4 text-violet-500" />
            <span>Workbook Sheets:</span>
          </div>
          {(activeProject.available_sheets || colMeta._sheets || []).map((sheet) => {
            const isCurrent = (activeProject.active_sheet || colMeta._active_sheet) === sheet;
            return (
              <button
                key={sheet}
                onClick={async () => {
                  if (isCurrent || switchingSheet) return;
                  setSwitchingSheet(true);
                  try {
                    await api.switchDatasetSheet(activeProjectId, sheet);
                    await refreshProjectTree();
                    await loadPreview(activeProjectId);
                  } catch (err) {
                    alert(`Failed to switch sheet: ${err.message}`);
                  } finally {
                    setSwitchingSheet(false);
                  }
                }}
                disabled={switchingSheet}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  isCurrent
                    ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-400/30'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-violet-100/60 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{sheet}</span>
                {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </button>
            );
          })}
          {switchingSheet && <RefreshCw className="w-4 h-4 animate-spin text-violet-500 ml-2" />}
        </div>
      )}

      {/* ── Sub-Navigation Tabs ─────────────────────────────────── */}
      {activeProject.has_data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {[
              { key: 'data_view', label: 'Data View', icon: Table },
              { key: 'schema', label: 'Schema & Quality', icon: Sliders },
              { key: 'transform', label: 'Transform & Clean', icon: Filter },
              { key: 'query', label: 'SQL Query', icon: Terminal },
              { key: 'ai_chat', label: 'AI Data Chat', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = databaseSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setDatabaseSubTab(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Sub-Tab 1: Data View ─────────────────────────────── */}
          {databaseSubTab === 'data_view' && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center space-x-2">
                  <Table className="w-4 h-4 text-violet-500" />
                  <span>Dataset Records Preview (First 100 Rows)</span>
                </h3>
              </div>

              {loadingData ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  <span>Loading table...</span>
                </div>
              ) : previewData ? (
                <div className="h-[460px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <DataGrid columns={previewData.columns} rows={previewData.rows} />
                </div>
              ) : null}
            </div>
          )}

          {/* ── Sub-Tab 2: Schema & Quality ──────────────────────── */}
          {databaseSubTab === 'schema' && (
            <div className="space-y-6 animate-fadeIn">
              {dataQuality.has_warnings && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 space-y-1.5 text-xs">
                  <div className="flex items-center space-x-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Data Quality Auditing Warnings</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    {dataQuality.warnings?.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold">Columns & Schema Breakdown</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                        <th className="py-2.5 px-3">Column</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Unique</th>
                        <th className="py-2.5 px-3">Null %</th>
                        <th className="py-2.5 px-3">Statistics / Samples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {availableColumns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            {loadingData ? 'Loading schema metadata...' : 'No columns found for this dataset.'}
                          </td>
                        </tr>
                      ) : (
                        availableColumns.map((col) => {
                          const m = colMeta[col] || {};
                          const detectedType = m.data_type || previewData?.column_types?.[col] || 'string';
                          return (
                            <tr key={col} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{col}</td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                  detectedType === 'numerical' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400'
                                }`}>
                                  {detectedType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono">{m.unique_count ?? (previewData?.rows ? new Set(previewData.rows.map(r => r[col])).size : '—')}</td>
                              <td className="py-2.5 px-3 font-mono">{m.null_pct !== undefined ? `${m.null_pct}%` : '0%'}</td>
                              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                {detectedType === 'numerical' && m.min !== undefined ? (
                                  <span>Min: {m.min} • Max: {m.max} • Mean: {m.mean}</span>
                                ) : m.sample_values?.length > 0 ? (
                                  <span>Samples: {m.sample_values.slice(0, 3).join(', ')}</span>
                                ) : previewData?.rows?.length > 0 ? (
                                  <span>Sample: {String(previewData.rows[0]?.[col] ?? '—')}</span>
                                ) : (
                                  <span>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Sub-Tab 3: Transform & Clean ─────────────────────── */}
          {databaseSubTab === 'transform' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 animate-fadeIn text-xs">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Filter className="w-4 h-4 text-violet-500" />
                <span>Data Transformation Engine</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { id: 'add_column', label: 'Add Calculated Column' },
                  { id: 'rename_column', label: 'Rename Column' },
                  { id: 'fill_missing', label: 'Fill Missing Values' },
                  { id: 'drop_column', label: 'Drop Column' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTransType(t.id)}
                    className={`p-3 rounded-2xl border font-bold transition-all text-center ${
                      transType === t.id
                        ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 text-violet-600 dark:text-violet-400 ring-2 ring-violet-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleApplyTransformation} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                {/* Form fields based on transType */}
                {transType === 'add_column' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">New Column Name</label>
                      <input
                        type="text"
                        placeholder="e.g. total_price"
                        value={transParams.new_column}
                        onChange={(e) => setTransParams({ ...transParams, new_column: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Calculation Formula / Expression</label>
                      <input
                        type="text"
                        placeholder="e.g. price * quantity or sales * 1.15"
                        value={transParams.formula}
                        onChange={(e) => setTransParams({ ...transParams, formula: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        required
                      />
                    </div>
                  </div>
                )}

                {transType === 'rename_column' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Select Column</label>
                      <select
                        value={transParams.old_name}
                        onChange={(e) => setTransParams({ ...transParams, old_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        required
                      >
                        <option value="">Choose Column...</option>
                        {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">New Name</label>
                      <input
                        type="text"
                        placeholder="e.g. customer_segment"
                        value={transParams.new_name}
                        onChange={(e) => setTransParams({ ...transParams, new_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        required
                      />
                    </div>
                  </div>
                )}

                {transType === 'fill_missing' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Target Column</label>
                      <select
                        value={transParams.column}
                        onChange={(e) => setTransParams({ ...transParams, column: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        required
                      >
                        <option value="">Choose Column...</option>
                        {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Fill Strategy</label>
                      <select
                        value={transParams.strategy}
                        onChange={(e) => setTransParams({ ...transParams, strategy: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      >
                        <option value="mean">Mean (Average)</option>
                        <option value="median">Median</option>
                        <option value="mode">Mode (Most Frequent)</option>
                        <option value="constant">Constant Value</option>
                        <option value="drop_na">Drop Rows with Missing</option>
                      </select>
                    </div>
                  </div>
                )}

                {transType === 'drop_column' && (
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Select Column to Drop</label>
                    <select
                      value={transParams.column}
                      onChange={(e) => setTransParams({ ...transParams, columns: [e.target.value] })}
                      className="w-full max-w-sm px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      required
                    >
                      <option value="">Choose Column...</option>
                      {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {transMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{transMessage}</span>
                  </div>
                )}

                {transError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{transError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={transLoading}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  {transLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>Execute Transformation & Save</span>
                </button>
              </form>
            </div>
          )}

          {/* ── Sub-Tab 4: SQL Query ─────────────────────────────── */}
          {databaseSubTab === 'query' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn text-xs">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-violet-500" />
                <span>Interactive SQL Query Runner (Table: `dataset`)</span>
              </h3>

              <form onSubmit={handleRunQuery} className="space-y-3">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={4}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-200"
                  placeholder="SELECT * FROM dataset WHERE ..."
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Query table names: <code className="text-violet-500">dataset</code>, <code className="text-violet-500">data</code>
                    {(activeProject.available_sheets?.length > 1 || (colMeta._sheets && colMeta._sheets.length > 1)) && (
                      <span className="ml-2 font-semibold text-violet-600 dark:text-violet-400">
                        • Multi-sheet tables: {(activeProject.available_sheets || colMeta._sheets || []).map(s => s.toLowerCase().replace(/[^a-z0-9_]/g, '_')).join(', ')}
                      </span>
                    )}
                  </span>
                  <button
                    type="submit"
                    disabled={queryLoading}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                  >
                    {queryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>Run Query</span>
                  </button>
                </div>
              </form>

              {queryError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  {queryError}
                </div>
              )}

              {queryResults && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-400">
                    Query Result: {queryResults.row_count} rows returned
                  </span>
                  <div className="h-[320px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <DataGrid columns={queryResults.columns} rows={queryResults.rows} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Sub-Tab 5: AI Data Chat ──────────────────────────── */}
          {databaseSubTab === 'ai_chat' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      AI Data & Transformation Assistant
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Target Project: <span className="font-semibold text-violet-600 dark:text-violet-400">{activeProject.name}</span> • {activeProject.row_count} rows, {activeProject.column_count} columns
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>LLM Engine Ready</span>
                  </span>
                </div>
              </div>

              {/* Chat Message History */}
              <div className="min-h-[360px] max-h-[520px] overflow-y-auto p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3.5">
                {chatMessages.length === 0 ? (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Interactive AI Data Transformation Engine
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Ask any data transformation, missing value cleaning, row filtering, or calculated column in plain English. The AI analyzes your dataset schema, explains the proposed action clearly, and waits for your confirmation to execute.
                      </p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="p-3 px-4 rounded-2xl max-w-lg leading-relaxed bg-violet-600 text-white rounded-tr-none text-xs shadow-sm">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="w-full max-w-2xl space-y-2">
                          {/* Case 1: Executable Action Proposal */}
                          {msg.is_executable && msg.operation ? (
                            <div className="rounded-2xl border border-violet-200 dark:border-violet-800/80 bg-gradient-to-b from-white to-violet-50/30 dark:from-[#131b2e] dark:to-[#0f172a] p-4 shadow-sm space-y-3">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="p-1 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </span>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                                    Action Proposal
                                  </span>
                                </div>
                                {msg.status === 'executed' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Applied</span>
                                  </span>
                                )}
                              </div>

                              {/* Natural-Language Explanation - NO SQL OR CODE */}
                              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-violet-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs leading-relaxed font-medium">
                                <p className="text-[13px]">{msg.content}</p>
                              </div>

                              {/* Action Controls & Feedback */}
                              {msg.status === 'pending' && (
                                <div className="flex items-center space-x-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteAiTransformation(i)}
                                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-violet-500/20 transition-all cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Execute</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDismissAiTransformation(i)}
                                    className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              )}

                              {msg.status === 'executing' && (
                                <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs font-semibold animate-pulse">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                                  <span>Executing transformation and refreshing dataset...</span>
                                </div>
                              )}

                              {msg.status === 'executed' && (
                                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                                  <div className="flex items-center space-x-1.5 font-bold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>Dataset Updated Successfully</span>
                                  </div>
                                  {msg.executionMessage && (
                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pl-5.5">
                                      {msg.executionMessage}
                                    </p>
                                  )}
                                </div>
                              )}

                              {msg.status === 'failed' && (
                                <div className="space-y-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs">
                                  <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-300 font-bold">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Execution Failed: {msg.errorMessage}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteAiTransformation(i)}
                                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-[11px] flex items-center space-x-1"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Retry Execution</span>
                                  </button>
                                </div>
                              )}

                              {msg.status === 'dismissed' && (
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                  Proposal dismissed
                                </div>
                              )}
                            </div>
                          ) : msg.clarification_needed ? (
                            /* Case 2: Clarification Needed */
                            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-slate-800 dark:text-slate-200 space-y-2">
                              <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                                <HelpCircle className="w-4 h-4" />
                                <span>Clarification Needed</span>
                              </div>
                              <div className="text-xs leading-relaxed">
                                <MarkdownRenderer content={msg.content} />
                              </div>
                            </div>
                          ) : (
                            /* Case 3: Informational Response */
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm leading-relaxed text-xs">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center space-x-2 text-slate-400 p-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                    <span className="text-xs font-medium">Analyzing request against schema...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Transformation Suggestion Pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                  Suggestions:
                </span>
                {[
                  `Fill missing values in ${availableColumns[0] || 'Revenue'} using column median`,
                  `Remove rows where ${availableColumns[0] || 'Product_ID'} is missing`,
                  `Create calculated column from ${availableColumns[0] || 'Revenue'} and ${availableColumns[1] || 'Cost'}`,
                  `Remove duplicate rows`,
                  `Convert ${availableColumns[0] || 'Date'} to datetime`
                ].slice(0, 4).map((pill, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setChatPrompt(pill)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-950/60 dark:hover:text-violet-300 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Describe your transformation (e.g. 'Fill missing Revenue using median' or 'Remove rows where ID is null')..."
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-xs"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatPrompt.trim()}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold flex items-center space-x-1.5 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
