import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import DataGrid from './DataGrid';
import MarkdownRenderer from './MarkdownRenderer';
import ChartForecastModal from './ChartForecastModal';
import {
  Rocket, Download, Play, Trash2, CheckCircle2, AlertTriangle,
  FileSpreadsheet, Sparkles, RefreshCw, Upload, ArrowRight, Folder,
  TrendingUp, Star, History, Check, Layers, BarChart3, ChevronRight, Eye
} from 'lucide-react';

export default function GlobalDeploymentsView() {
  const {
    activeDeployment, setActiveDeployment, refreshProjectTree,
    selectModel, selectProjectView, settings
  } = useChatStore();

  // Top-level View Tab: 'chart_forecasts' | 'general_deployments'
  const [hubTab, setHubTab] = useState('chart_forecasts');

  // General Deployments State
  const [deployments, setDeployments] = useState([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [inferenceMode, setInferenceMode] = useState('single');
  const [singleInputs, setSingleInputs] = useState({});
  const [batchFile, setBatchFile] = useState(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [inferenceResults, setInferenceResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  // All Trained Models / Chart Forecasting State
  const [allExperiments, setAllExperiments] = useState([]);
  const [loadingExperiments, setLoadingExperiments] = useState(false);
  const [selectedForecastModalChart, setSelectedForecastModalChart] = useState(null);
  const [activeActionModelId, setActiveActionModelId] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    loadDeployments();
    loadAllExperiments();
  };

  const loadDeployments = async () => {
    setLoadingDeployments(true);
    try {
      const list = await api.listDeployments();
      setDeployments(list);
      if (list.length > 0 && !activeDeployment) {
        setActiveDeployment(list[0]);
      }
    } catch (err) {
      console.error('Failed to list deployments', err);
    } finally {
      setLoadingDeployments(false);
    }
  };

  const loadAllExperiments = async () => {
    setLoadingExperiments(true);
    try {
      const list = await api.listExperiments();
      setAllExperiments(list || []);
    } catch (err) {
      console.error('Failed to list all experiments', err);
    } finally {
      setLoadingExperiments(false);
    }
  };

  // Group chart-based forecasting models by chart_id
  const forecastModels = allExperiments.filter(e => e.workflow_type === 'chart_forecast');
  const chartGroupsMap = {};
  forecastModels.forEach(m => {
    const cid = m.chart_id || 'unknown';
    if (!chartGroupsMap[cid]) {
      chartGroupsMap[cid] = {
        chart_id: cid,
        chart_title: m.chart_title || m.model_name || `Chart ${cid.slice(0, 8)}`,
        dataset_name: m.dataset_name || 'Project Dataset',
        dataset_id: m.dataset_id,
        models: []
      };
    }
    chartGroupsMap[cid].models.push(m);
  });
  const chartGroups = Object.values(chartGroupsMap);

  // Switch Active Model for a Chart
  const handleSwitchActiveModel = async (chartId, experimentId) => {
    setActiveActionModelId(experimentId);
    try {
      await api.activateChartForecast(experimentId, chartId);
      await loadAllExperiments();
      await refreshProjectTree();
    } catch (err) {
      alert(`Failed to activate model: ${err.message}`);
    } finally {
      setActiveActionModelId(null);
    }
  };

  // Deploy an experiment to deployed_models
  const handleDeployExperiment = async (exp) => {
    try {
      await api.deployModel({
        experiment_id: exp.id,
        deployment_name: `${exp.model_name || 'Model'} Deployed`,
        version: '1.0.0',
        description: `Deployed from ${exp.workflow_type === 'chart_forecast' ? 'Chart Forecasting' : 'ML Studio'} (${exp.algorithm})`
      });
      await loadDeployments();
      setHubTab('general_deployments');
      alert(`Model '${exp.model_name}' successfully deployed to Global Hub!`);
    } catch (err) {
      alert(`Deployment failed: ${err.message}`);
    }
  };

  const handleDeleteDeployment = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this deployment?')) return;
    try {
      await api.deleteDeployment(id);
      await loadDeployments();
      await refreshProjectTree();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSingleInference = async (e) => {
    e.preventDefault();
    if (!activeDeployment?.id) return;

    setInferenceLoading(true);
    setErrorMessage('');
    setInferenceResults(null);
    setInsights('');

    try {
      const results = await api.runDeployedInference(activeDeployment.id, {
        records: [singleInputs]
      });
      setInferenceResults(results);
    } catch (err) {
      setErrorMessage(err.message || 'Inference failed');
    } finally {
      setInferenceLoading(false);
    }
  };

  const handleBatchInference = async (e) => {
    e.preventDefault();
    if (!activeDeployment?.experiment_id || !batchFile) return;

    setInferenceLoading(true);
    setErrorMessage('');
    setInferenceResults(null);
    setInsights('');

    try {
      const results = await api.testModelWithFile(activeDeployment.experiment_id, batchFile);
      setInferenceResults(results);
    } catch (err) {
      setErrorMessage(err.message || 'Batch inference failed');
    } finally {
      setInferenceLoading(false);
    }
  };

  const requiredFeatures = activeDeployment?.experiment?.feature_columns || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Rocket className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold">Model Deployments &amp; History Hub</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage active chart forecasting models, view per-chart history &amp; accuracy metrics, and execute live API inference.
          </p>
        </div>

        {/* Workflow Hub Tabs */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 text-xs font-bold shadow-xs">
          <button
            onClick={() => setHubTab('chart_forecasts')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
              hubTab === 'chart_forecasts'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span>Chart Forecasting Models ({forecastModels.length})</span>
          </button>
          <button
            onClick={() => setHubTab('general_deployments')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
              hubTab === 'general_deployments'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Rocket className="w-4 h-4 text-amber-500" />
            <span>General ML Deployments ({deployments.length})</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          TAB 1: CHART-BASED FORECASTING MODELS & HISTORY
         ════════════════════════════════════════════════════════════ */}
      {hubTab === 'chart_forecasts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Chart Forecasting Models Grouped by Chart
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each chart maintains its own model history. The currently active model is applied directly to dashboard visualizations.
              </p>
            </div>
            <button
              onClick={loadAllExperiments}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Refresh Models"
            >
              <RefreshCw className={`w-4 h-4 ${loadingExperiments ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingExperiments ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
              <span>Loading chart forecasting models...</span>
            </div>
          ) : chartGroups.length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center mx-auto">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold">No Chart Forecasting Models Trained Yet</h4>
              <p className="text-xs text-slate-400">
                Open any chart in the <strong>Visualizations</strong> workspace or click <strong>Train ML</strong> on any dashboard chart card to train your first time-series forecaster.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {chartGroups.map((group) => {
                const activeModel = group.models.find(m => m.is_active_for_chart) || group.models[0];

                return (
                  <div
                    key={group.chart_id}
                    className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
                  >
                    {/* Chart Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                              Chart ID: {group.chart_id.slice(0, 12)}...
                            </span>
                            <span className="text-xs text-slate-400">{group.dataset_name}</span>
                          </div>
                          <h3 className="text-base font-bold truncate mt-0.5" title={group.chart_title}>
                            {group.chart_title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-slate-400 font-medium">
                          Total Trained Models: <strong>{group.models.length}</strong>
                        </span>
                        <button
                          onClick={() => {
                            setSelectedForecastModalChart({
                              id: group.chart_id,
                              title: group.chart_title,
                              dataset_id: group.dataset_id
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Train New Forecast</span>
                        </button>
                      </div>
                    </div>

                    {/* Models Table / List for This Chart */}
                    <div className="space-y-3">
                      {group.models.map((m) => {
                        const isActive = m.is_active_for_chart;

                        return (
                          <div
                            key={m.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isActive
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 shadow-sm ring-1 ring-emerald-500/20'
                                : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              {/* Model Info */}
                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                    {m.model_name}
                                  </span>
                                  {isActive ? (
                                    <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black tracking-wider flex items-center space-x-1 shadow-xs">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      <span>CURRENTLY ACTIVE</span>
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                      History
                                    </span>
                                  )}
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 font-semibold">
                                    {m.algorithm}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>Target: <strong>{m.target_column || '—'}</strong></span>
                                  <span>•</span>
                                  <span>Date Axis: <strong>{m.date_column || '—'}</strong></span>
                                  <span>•</span>
                                  <span>Horizon: <strong>+{m.forecast_horizon || 12} periods</strong></span>
                                  <span>•</span>
                                  <span>{new Date(m.created_at).toLocaleString()}</span>
                                </div>

                                {/* Accuracy Metrics Row */}
                                {m.metrics && (
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {m.metrics.mae != null && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300 font-mono">
                                        MAE: <strong>{m.metrics.mae.toFixed(4)}</strong>
                                      </span>
                                    )}
                                    {m.metrics.rmse != null && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300 font-mono">
                                        RMSE: <strong>{m.metrics.rmse.toFixed(4)}</strong>
                                      </span>
                                    )}
                                    {m.metrics.mape != null && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300 font-mono">
                                        MAPE: <strong>{m.metrics.mape.toFixed(2)}%</strong>
                                      </span>
                                    )}
                                    {m.metrics.r2_score != null && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300 font-mono">
                                        R²: <strong>{m.metrics.r2_score.toFixed(4)}</strong>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center space-x-2 shrink-0">
                                {!isActive && (
                                  <button
                                    onClick={() => handleSwitchActiveModel(group.chart_id, m.id)}
                                    disabled={activeActionModelId === m.id}
                                    className="px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                    title="Switch this model to be the active forecast for this chart"
                                  >
                                    {activeActionModelId === m.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                    <span>Set as Active</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setSelectedForecastModalChart({
                                      id: group.chart_id,
                                      title: group.chart_title,
                                      dataset_id: group.dataset_id,
                                      model: m
                                    });
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                                  title="View Actual vs Forecast and Accuracy details"
                                >
                                  <Eye className="w-3.5 h-3.5 text-violet-500" />
                                  <span>View Forecast</span>
                                </button>

                                <button
                                  onClick={() => handleDeployExperiment(m)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                                  title="Deploy model for live REST inference"
                                >
                                  <Rocket className="w-3.5 h-3.5" />
                                  <span>Deploy</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 2: GENERAL ML DEPLOYMENTS & LIVE INFERENCE
         ════════════════════════════════════════════════════════════ */}
      {hubTab === 'general_deployments' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Deployed Models Active for Live Inference
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deployed models expose HTTP endpoints, serialization downloads (.joblib), and instant interactive testing.
              </p>
            </div>
            <button
              onClick={loadDeployments}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Refresh Deployments"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDeployments ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingDeployments ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
              <span>Loading deployed models...</span>
            </div>
          ) : deployments.length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800">
              <Rocket className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold">No Deployed Models Available</h4>
              <p className="text-xs text-slate-400">
                Deploy any trained model from the Chart Forecasting tab or from the ML Training Studio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {deployments.map((dep) => {
                const isSelected = activeDeployment?.id === dep.id;
                const exp = dep.experiment || {};

                return (
                  <div
                    key={dep.id}
                    onClick={() => {
                      setActiveDeployment(dep);
                      setInferenceResults(null);
                      setSingleInputs({});
                    }}
                    className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                          {dep.status} • v{dep.version}
                        </span>
                        <button
                          onClick={(e) => handleDeleteDeployment(dep.id, e)}
                          className="text-slate-400 hover:text-rose-500"
                          title="Delete Deployment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-sm font-bold truncate">{dep.deployment_name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Algorithm: <strong>{exp.algorithm}</strong> ({exp.problem_type})
                      </p>

                      <div className="mt-2 text-[11px] text-slate-400 flex items-center space-x-1">
                        <Folder className="w-3 h-3 text-slate-400" />
                        <span className="truncate">Target: {exp.target_column || 'Unsupervised'}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <a
                        href={api.downloadDeploymentModelUrl(dep.id)}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download (.joblib)</span>
                      </a>

                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {exp.metrics?.accuracy ? `Acc: ${(exp.metrics.accuracy * 100).toFixed(1)}%` : (exp.metrics?.mae != null ? `MAE: ${exp.metrics.mae.toFixed(2)}` : '')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Live Inference Workspace ─────────────────────────────── */}
          {activeDeployment && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold">Use Model for Live Prediction</h3>
                  <p className="text-xs text-slate-400">
                    Inference Target: <strong className="text-amber-600 dark:text-amber-400">{activeDeployment.deployment_name}</strong>
                  </p>
                </div>

                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setInferenceMode('single')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${inferenceMode === 'single' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Single Form
                  </button>
                  <button
                    onClick={() => setInferenceMode('batch')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${inferenceMode === 'batch' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Batch CSV
                  </button>
                </div>
              </div>

              {/* Single Form Mode */}
              {inferenceMode === 'single' && (
                <form onSubmit={handleSingleInference} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                    {requiredFeatures.map((feat) => (
                      <div key={feat} className="space-y-1">
                        <label className="font-bold text-slate-600 dark:text-slate-400 block truncate" title={feat}>
                          {feat}
                        </label>
                        <input
                          type="text"
                          placeholder={`Enter ${feat}`}
                          value={singleInputs[feat] || ''}
                          onChange={(e) => setSingleInputs({ ...singleInputs, [feat]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={inferenceLoading}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {inferenceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>Run Prediction</span>
                  </button>
                </form>
              )}

              {/* Batch CSV Mode */}
              {inferenceMode === 'batch' && (
                <form onSubmit={handleBatchInference} className="space-y-4 text-xs">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setBatchFile(e.target.files[0]);
                        setErrorMessage('');
                      }
                    }}
                    className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 cursor-pointer"
                  />

                  <button
                    type="submit"
                    disabled={inferenceLoading || !batchFile}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {inferenceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>Run Batch Predictions</span>
                  </button>
                </form>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Inference Output */}
              {inferenceResults && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
                  {inferenceMode === 'single' && inferenceResults.rows?.length === 1 && (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-900 dark:text-amber-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider block">Predicted Output</span>
                      <span className="text-3xl font-black">{String(inferenceResults.rows[0].__ml_prediction)}</span>
                    </div>
                  )}

                  <div className="h-[340px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <DataGrid columns={inferenceResults.columns} rows={inferenceResults.rows} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Chart Forecast & History Modal ── */}
      {selectedForecastModalChart && (
        <ChartForecastModal
          isOpen={!!selectedForecastModalChart}
          onClose={() => setSelectedForecastModalChart(null)}
          chart={selectedForecastModalChart}
          datasetId={selectedForecastModalChart.dataset_id}
          activeForecast={selectedForecastModalChart.model}
          onApplyForecastToCard={async () => {
            await loadAllExperiments();
            setSelectedForecastModalChart(null);
          }}
        />
      )}

    </div>
  );
}
