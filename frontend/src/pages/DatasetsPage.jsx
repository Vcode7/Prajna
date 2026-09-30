import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import DataGrid from '../components/DataGrid';
import {
  Upload, Database, AlertTriangle, CheckCircle2, FileSpreadsheet,
  Trash2, Download, ArrowRight, RefreshCw, Layers, Sparkles, Info
} from 'lucide-react';

export default function DatasetsPage() {
  const {
    datasets, setDatasets, activeDataset, setActiveDataset,
    activeDatasetId, setActiveDatasetId, setActiveTab
  } = useChatStore();

  const [uploading, setUploading] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [switchingSheet, setSwitchingSheet] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isSupported = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isSupported) {
        setSelectedFile(file);
        setErrorMessage('');
      } else {
        setErrorMessage('Please upload a valid .csv, .xlsx, or .xls file.');
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setErrorMessage('');
    try {
      const res = await api.uploadDataset(selectedFile, datasetName || undefined);
      await loadDatasets();
      setActiveDataset(res);
      setSelectedFile(null);
      setDatasetName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload and parse CSV.');
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
  const catCount = Object.values(colMeta).filter(m => m.data_type === 'categorical').length;
  const dateCount = Object.values(colMeta).filter(m => m.data_type === 'datetime').length;
  const boolCount = Object.values(colMeta).filter(m => m.data_type === 'boolean').length;

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
          <h3 className="text-sm font-bold">Drag and drop your CSV dataset here</h3>
          <p className="text-xs text-slate-400 mt-1">Supports CSV and Excel (.xlsx/.xls) multi-sheet workbooks</p>
        </div>

        <form onSubmit={handleUpload} className="max-w-md mx-auto space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
                setErrorMessage('');
              }
            }}
            className="hidden"
            id="csv-file-input"
          />

          <div className="flex items-center justify-center space-x-2">
            <label
              htmlFor="csv-file-input"
              className="cursor-pointer px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
            >
              {selectedFile ? selectedFile.name : 'Browse CSV or Excel (.xlsx) Files'}
            </label>

            {selectedFile && (
              <input
                type="text"
                placeholder="Dataset Name (Optional)"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            )}
          </div>

          {selectedFile && (
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Dataset...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze & Upload Dataset</span>
                </>
              )}
            </button>
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
              { label: 'Total Rows', val: activeDataset.row_count.toLocaleString() },
              { label: 'Total Columns', val: activeDataset.column_count },
              { label: 'Numerical', val: numCount },
              { label: 'Categorical', val: catCount },
              { label: 'Date/Time', val: dateCount },
              { label: 'Missing Cells', val: `${dataQuality.missing_cells_pct || 0}%` },
              { label: 'Duplicates', val: dataQuality.duplicate_rows || 0 },
            ].map((m, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">{m.label}</span>
                <span className="text-base font-bold mt-1 block">{m.val}</span>
              </div>
            ))}
          </div>

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

          {/* ── AG Grid Data Preview ─────────────────────────────── */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-bold">Dataset Live Preview (First 100 Rows)</h3>
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
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
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
            ) : previewData ? (
              <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <DataGrid columns={previewData.columns} rows={previewData.rows} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                No preview data available.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
