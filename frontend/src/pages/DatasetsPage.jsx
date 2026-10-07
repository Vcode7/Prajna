import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import DataGrid from '../components/DataGrid';
import {
  Upload, Database, AlertTriangle, CheckCircle2, FileSpreadsheet,
  Trash2, Download, ArrowRight, RefreshCw, Layers, Sparkles, Info,
  X, Plus, Table, Hash, Type, Calendar, CheckSquare
} from 'lucide-react';

export default function DatasetsPage() {
  const {
    datasets, setDatasets, activeDataset, setActiveDataset,
    activeDatasetId, setActiveDatasetId, setActiveTab
  } = useChatStore();

  const [uploading, setUploading] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [switchingSheet, setSwitchingSheet] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dataTab, setDataTab] = useState('preview');
  const fileInputRef = useRef(null);

  // Load all datasets on mount
  useEffect(() => {
    loadDatasets();
  }, []);

  // When active dataset changes, fetch preview
  useEffect(() => {
    if (activeDataset?.id) {
      loadPreview(activeDataset.id);
    } else {
      setPreviewData(null);
    }
  }, [activeDataset?.id]);

  const loadDatasets = async () => {
    try {
      const list = await api.listDatasets();
      setDatasets(list);
      if (list.length > 0 && !activeDataset) {
        const found = list.find(d => d.id === activeDatasetId) || list[0];
        setActiveDataset(found);
      }
    } catch (err) {
      console.error('Failed to list datasets', err);
    }
  };

  const loadPreview = async (datasetId) => {
    setLoadingPreview(true);
    try {
      const data = await api.getDatasetPreview(datasetId, 100);
      setPreviewData(data);
    } catch (err) {
      console.error('Failed to load dataset preview', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const isSupportedFile = (file) => {
    const n = file.name.toLowerCase();
    return n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls');
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const incoming = Array.from(e.dataTransfer.files).filter(isSupportedFile);
      if (incoming.length > 0) {
        setSelectedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const newFiles = incoming.filter(f => !existingNames.has(f.name));
          return [...prev, ...newFiles];
        });
        setErrorMessage('');
      } else {
        setErrorMessage('Please upload valid .csv, .xlsx, or .xls files.');
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files).filter(isSupportedFile);
      if (incoming.length > 0) {
        setSelectedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const newFiles = incoming.filter(f => !existingNames.has(f.name));
          return [...prev, ...newFiles];
        });
        setErrorMessage('');
      } else {
        setErrorMessage('Please upload valid .csv, .xlsx, or .xls files.');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (fileName) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setErrorMessage('');
    try {
      const res = await api.uploadDataset(selectedFiles, datasetName || undefined);
      await loadDatasets();
      setActiveDataset(res);
      setSelectedFiles([]);
      setDatasetName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload and parse dataset.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this dataset session?')) return;
    try {
      await api.deleteDataset(id);
      const remaining = datasets.filter(d => d.id !== id);
      setDatasets(remaining);
      if (activeDataset?.id === id) {
        setActiveDataset(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const colMeta = activeDataset?.column_metadata || {};
  const dataQuality = activeDataset?.data_quality || {};
  const derivedFeatures = activeDataset?.derived_features || [];

  const numCount = Object.values(colMeta).filter(m => m.data_type === 'numerical').length;
  const textCount = Object.values(colMeta).filter(m => m.data_type === 'text').length;
  const catCount = Object.values(colMeta).filter(m => m.data_type === 'categorical').length;
  const dateCount = Object.values(colMeta).filter(m => m.data_type === 'datetime').length;
  const boolCount = Object.values(colMeta).filter(m => m.data_type === 'boolean').length;

  const metaColumns = Object.keys(colMeta).filter(c => !c.startsWith('_'));
  const availableColumns = metaColumns.length > 0 ? metaColumns : (previewData?.columns || []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header & Active Session Selector ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold">Datasets & Data Understanding</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Step 1: Upload CSV, inspect automated profiling, review quality warnings, and explore data.
          </p>
        </div>

        {/* Dataset Switcher */}
        {datasets.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Active Dataset:</span>
            <select
              value={activeDataset?.id || ''}
              onChange={(e) => {
                const found = datasets.find(d => d.id === e.target.value);
                if (found) setActiveDataset(found);
              }}
              className="text-xs font-semibold bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.row_count} rows)
                </option>
              ))}
            </select>

            {activeDataset && (
              <button
                onClick={(e) => handleDelete(activeDataset.id, e)}
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Delete Dataset"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Upload Area ────────────────────────────────────────── */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="p-6 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700/80 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md hover:border-violet-500 transition-all text-center space-y-4"
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Drag and drop CSV or Excel files here</h3>
          <p className="text-xs text-slate-400 mt-1">
            Upload multiple files at once — each file will load as a separate sheet, just like sheets in an Excel workbook.
          </p>
        </div>

        <form onSubmit={handleUpload} className="max-w-xl mx-auto space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv, .xlsx, .xls"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-file-input"
          />

          {selectedFiles.length === 0 ? (
            <div className="flex items-center justify-center">
              <label
                htmlFor="csv-file-input"
                className="cursor-pointer px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors flex items-center space-x-2 shadow-2xs hover:scale-[1.01]"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>Browse Files (Select Multiple CSV / Excel)</span>
              </label>
            </div>
          ) : (
            <div className="space-y-3 text-left">
              {/* Header info */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="font-semibold text-violet-600 dark:text-violet-400">
                  {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected {selectedFiles.length > 1 ? '(loaded as separate sheets)' : ''}
                </span>
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="csv-file-input"
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add more</span>
                  </label>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {/* Selected Files List Chips */}
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1.5 rounded-2xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 custom-scrollbar">
                {selectedFiles.map((file) => {
                  const sheetName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
                  return (
                    <div
                      key={file.name}
                      className="inline-flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      {selectedFiles.length > 1 && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                          Sheet: {sheetName.length > 16 ? sheetName.substring(0, 16) + '...' : sheetName}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.name)}
                        className="p-0.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={`Remove ${file.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Dataset Name Input */}
              <div>
                <input
                  type="text"
                  placeholder={
                    selectedFiles.length > 1
                      ? 'Combined Dataset Name (Optional)'
                      : 'Dataset Name (Optional)'
                  }
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing & Packaging Sheets...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Analyze & Upload {selectedFiles.length > 1 ? `${selectedFiles.length} Files as Sheets` : 'Dataset'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      </div>

      {/* ── Multi-Sheet Selector Bar ────────────────────────────── */}
      {activeDataset && (activeDataset.available_sheets?.length > 1 || (colMeta._sheets && colMeta._sheets.length > 1)) && (
        <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/20 border border-violet-200/80 dark:border-violet-900/40 animate-fadeIn">
          <div className="flex items-center space-x-2 text-xs font-bold text-violet-700 dark:text-violet-300 mr-2">
            <Layers className="w-4 h-4 text-violet-500" />
            <span>Workbook Sheets:</span>
          </div>
          {(activeDataset.available_sheets || colMeta._sheets || []).map((sheet) => {
            const isCurrent = (activeDataset.active_sheet || colMeta._active_sheet) === sheet;
            return (
              <button
                key={sheet}
                onClick={async () => {
                  if (isCurrent || switchingSheet) return;
                  setSwitchingSheet(true);
                  try {
                    const updated = await api.switchDatasetSheet(activeDataset.id, sheet);
                    await loadDatasets();
                    setActiveDataset(updated);
                    await loadPreview(activeDataset.id);
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

      {/* ── Active Dataset Profile & Statistics ────────────────── */}
      {activeDataset && (
        <div className="space-y-6">

          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total Rows', val: activeDataset.row_count.toLocaleString('en-IN') },
              { label: 'Total Columns', val: activeDataset.column_count },
              { label: 'Text', val: textCount },
              { label: 'Numerical', val: numCount },
              { label: 'Categorical', val: catCount },
              { label: 'Date/Time', val: dateCount },
              { label: 'Missing Cells', val: `${dataQuality.missing_cells_pct || 0}%` },
            ].map((m, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">{m.label}</span>
                <span className="text-base font-bold mt-1 block">{m.val}</span>
              </div>
            ))}
          </div>

          {/* Mixed Number+Text Auto-Conversion Notice */}
          {dataQuality.converted_mixed_columns && dataQuality.converted_mixed_columns.length > 0 && (
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 space-y-2 text-xs">
              <div className="flex items-center space-x-2 font-bold">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Mixed Number &amp; Text Fields Auto-Converted to Text</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Identified {dataQuality.converted_mixed_columns.length} column{dataQuality.converted_mixed_columns.length === 1 ? '' : 's'} containing both numbers and text. Their data types were automatically converted to <strong className="font-mono">Text</strong> to prevent type mismatches during queries and calculations:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {dataQuality.converted_mixed_columns.map(c => (
                  <span key={c} className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700/60">
                    {c} → TEXT
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quality Alerts Banner */}
          {dataQuality.has_warnings && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Automated Data Quality Audit</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-1 pl-1 text-amber-700 dark:text-amber-400">
                {dataQuality.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Derived Categorical Features (with explicit reasoning) */}
          {derivedFeatures.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Derived Features Generated for Analysis</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {derivedFeatures.map((df, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700 text-xs flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{df.derived_column}</span>
                      <span className="text-[10px] text-slate-400 ml-2">from ({df.original_column})</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{df.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AG Grid Data Preview & Schema Inspection ────────── */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setDataTab('preview')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                    dataTab === 'preview'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Live Data Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('schema')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                    dataTab === 'schema'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Columns &amp; Schema Types ({availableColumns.length})</span>
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <a
                  href={api.exportDatasetUrl(activeDataset.id)}
                  download
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Processed CSV</span>
                </a>

                <button
                  onClick={() => setActiveTab('visualizations')}
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>Proceed to Visualizations</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {loadingPreview ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span>Loading preview data...</span>
              </div>
            ) : dataTab === 'preview' ? (
              previewData ? (
                <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <DataGrid columns={previewData.columns} rows={previewData.rows} columnTypes={previewData.column_types} />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  No preview data available.
                </div>
              )
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="py-2.5 px-3">Column</th>
                      <th className="py-2.5 px-3">Data Type</th>
                      <th className="py-2.5 px-3">Database Type</th>
                      <th className="py-2.5 px-3">Unique</th>
                      <th className="py-2.5 px-3">Null %</th>
                      <th className="py-2.5 px-3">Statistics / Samples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {availableColumns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No columns found for this dataset.
                        </td>
                      </tr>
                    ) : (
                      availableColumns.map((col) => {
                        const m = colMeta[col] || {};
                        const detectedType = m.data_type || previewData?.column_types?.[col] || 'text';
                        const sqlType = m.sql_type || (previewData?.sql_types?.[col]) || (detectedType === 'numerical' ? 'REAL' : detectedType === 'boolean' ? 'BOOLEAN' : detectedType === 'datetime' ? 'DATETIME' : 'TEXT');
                        const isMixedConverted = m.converted_to_text || m.has_mixed_types || (previewData?.mixed_columns?.includes(col)) || (dataQuality?.converted_mixed_columns?.includes(col));

                        let TypeIcon = Type;
                        let badgeClass = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60';
                        
                        if (detectedType === 'numerical') {
                          TypeIcon = Hash;
                          badgeClass = 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800/60';
                        } else if (detectedType === 'datetime') {
                          TypeIcon = Calendar;
                          badgeClass = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/60';
                        } else if (detectedType === 'boolean') {
                          TypeIcon = CheckSquare;
                          badgeClass = 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800/60';
                        } else if (detectedType === 'categorical') {
                          TypeIcon = Layers;
                          badgeClass = 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/60';
                        }

                        return (
                          <tr key={col} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <TypeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-mono text-xs truncate">{col}</span>
                                {isMixedConverted && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shadow-2xs shrink-0"
                                    title="Column contained both numbers and text; automatically identified and converted data type to Text"
                                  >
                                    Mixed → Text
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border shadow-2xs ${badgeClass}`}>
                                {detectedType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
                                {sqlType}
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
            )}
          </div>

        </div>
      )}

    </div>
  );
}
