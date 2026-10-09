import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import DataGrid from './DataGrid';
import ChartTab from './ChartTab';
import MarkdownRenderer from './MarkdownRenderer';
import {
  BrainCircuit, CheckCircle2, Rocket, FlaskConical, Download,
  Sliders, Play, RefreshCw, AlertTriangle, Sparkles, Upload,
  BarChart3, ArrowRight, Layers, Table, Info
} from 'lucide-react';

export default function ModelDetailView() {
  const {
    activeModelId, activeModel, modelSubTab, setModelSubTab,
    refreshProjectTree, settings
  } = useChatStore();

  const [modelData, setModelData] = useState(activeModel);
  const [loadingModel, setLoadingModel] = useState(false);

  // Testing State
  const [testFile, setTestFile] = useState(null);
  const [testingLoading, setTestingLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testError, setTestError] = useState('');
  const [testInsights, setTestInsights] = useState('');
  const [loadingTestInsights, setLoadingTestInsights] = useState(false);

  // Deployment & Live Inference State
  const [deploying, setDeploying] = useState(false);
  const [inferenceMode, setInferenceMode] = useState('single'); // single, batch
  const [singleInputs, setSingleInputs] = useState({});
  const [batchFile, setBatchFile] = useState(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [inferenceResults, setInferenceResults] = useState(null);
  const [inferenceError, setInferenceError] = useState('');
  const [deployInsights, setDeployInsights] = useState('');
  const [loadingDeployInsights, setLoadingDeployInsights] = useState(false);

  useEffect(() => {
    if (activeModelId) {
      loadModel(activeModelId);
    }
  }, [activeModelId]);

  const loadModel = async (id) => {
    setLoadingModel(true);
    try {
      const exp = await api.getExperiment(id);
      setModelData(exp);
    } catch (err) {
      console.error('Failed to load experiment details', err);
    } finally {
      setLoadingModel(false);
    }
  };

  // Test Model with CSV
  const handleTestUpload = async (e) => {
    e.preventDefault();
    if (!testFile || !modelData?.id) return;

    setTestingLoading(true);
    setTestError('');
    setTestResults(null);
    setTestInsights('');

    try {
      const results = await api.testModelWithFile(modelData.id, testFile);
      setTestResults(results);
    } catch (err) {
      setTestError(err.message || 'Testing failed');
    } finally {
      setTestingLoading(false);
    }
  };

  // Generate Testing Insights
  const handleGenerateTestInsights = async () => {
    if (!modelData?.id || !testResults) return;
    setLoadingTestInsights(true);
    try {
      const res = await api.generateTestingInsights({
        model_id: modelData.id,
        prediction_summary: {
          metrics: testResults.evaluation_metrics,
          total_records: testResults.total_records,
          sample_predictions: testResults.rows?.slice(0, 10)
        },
        model: settings?.model
      });
      setTestInsights(res.insights);
    } catch (err) {
      alert(`Insights error: ${err.message}`);
    } finally {
      setLoadingTestInsights(false);
    }
  };

  // Deploy Model
  const handleDeployModel = async () => {
    if (!modelData?.id) return;
    setDeploying(true);
    try {
      await api.deployModel({
        experiment_id: modelData.id,
        deployment_name: modelData.model_name,
        version: '1.0.0',
        description: `Deployed from project session`
      });
      await loadModel(modelData.id);
      await refreshProjectTree();
      alert('Model deployed successfully!');
    } catch (err) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  // Single Inference
  const handleSingleInference = async (e) => {
    e.preventDefault();
    if (!modelData?.deployment_id) return;

    setInferenceLoading(true);
    setInferenceError('');
    setInferenceResults(null);
    setDeployInsights('');

    try {
      const res = await api.runDeployedInference(modelData.deployment_id, {
        records: [singleInputs]
      });
      setInferenceResults(res);
    } catch (err) {
      setInferenceError(err.message || 'Inference failed');
    } finally {
      setInferenceLoading(false);
    }
  };

  // Batch Inference
  const handleBatchInference = async (e) => {
    e.preventDefault();
    if (!modelData?.id || !batchFile) return;

    setInferenceLoading(true);
    setInferenceError('');
    setInferenceResults(null);
    setDeployInsights('');

    try {
      const res = await api.testModelWithFile(modelData.id, batchFile);
      setInferenceResults(res);
    } catch (err) {
      setInferenceError(err.message || 'Batch inference failed');
    } finally {
      setInferenceLoading(false);
    }
  };

  const handleGenerateDeployInsights = async () => {
    if (!modelData?.deployment_id || !inferenceResults) return;
    setLoadingDeployInsights(true);
    try {
      const res = await api.generateDeploymentInsights(modelData.deployment_id, {
        model_name: modelData.model_name,
        input_summary: { count: inferenceResults.total_records },
        predictions_summary: { sample: inferenceResults.rows?.slice(0, 10) },
        model: settings?.model
      });
      setDeployInsights(res.insights);
    } catch (err) {
      alert(`Insights error: ${err.message}`);
    } finally {
      setLoadingDeployInsights(false);
    }
  };

  if (!modelData) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        Select an ML Model from the sidebar to view its workspace.
      </div>
    );
  }

  const requiredFeatures = modelData.feature_columns || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-bold">{modelData.model_name}</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Algorithm: <strong className="text-emerald-600 dark:text-emerald-400">{modelData.algorithm}</strong> • Problem: <strong>{modelData.problem_type}</strong> • Target: <strong>{modelData.target_column || 'None'}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {modelData.is_deployed ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center space-x-1.5">
              <Rocket className="w-3.5 h-3.5" />
              <span>Deployed to Production</span>
            </span>
          ) : (
            <button
              onClick={handleDeployModel}
              disabled={deploying}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {deploying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              <span>Deploy Model →</span>
            </button>
          )}

          {modelData.deployment_id && (
            <a
              href={api.downloadDeploymentModelUrl(modelData.deployment_id)}
              download
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.joblib)</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { key: 'overview', label: 'Overview & Config', icon: Sliders },
          { key: 'results', label: 'Training Results & Metrics', icon: BarChart3 },
          { key: 'testing', label: 'Testing & Prediction', icon: FlaskConical },
          { key: 'deployment', label: 'Live Inference Workspace', icon: Rocket },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = modelSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setModelSubTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Overview & Config ─────────────────────────────── */}
      {modelSubTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn text-xs">
          
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {modelData.problem_type === 'classification' ? (
              <>
                <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Accuracy</span>
                  <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
                    {((modelData.metrics?.accuracy || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">F1 Score</span>
                  <span className="text-2xl font-black">{modelData.metrics?.f1_score || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Precision</span>
                  <span className="text-2xl font-black">{modelData.metrics?.precision || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Recall</span>
                  <span className="text-2xl font-black">{modelData.metrics?.recall || 0}</span>
                </div>
              </>
            ) : modelData.problem_type === 'forecasting' ? (
              <>
                <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">MAPE Error</span>
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                    {modelData.metrics?.mape != null ? `${modelData.metrics.mape.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">RMSE</span>
                  <span className="text-2xl font-black">{modelData.metrics?.rmse ? modelData.metrics.rmse.toFixed(2) : '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">MAE</span>
                  <span className="text-2xl font-black">{modelData.metrics?.mae ? modelData.metrics.mae.toFixed(2) : '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Horizon</span>
                  <span className="text-2xl font-black">{modelData.forecast_horizon || 12} periods</span>
                </div>
              </>
            ) : (modelData.problem_type === 'segmentation' || modelData.problem_type === 'clustering') ? (
              <>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Silhouette Score</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {modelData.metrics?.silhouette_score ?? 'N/A'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Clusters</span>
                  <span className="text-2xl font-black">{modelData.metrics?.num_clusters || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Samples</span>
                  <span className="text-2xl font-black">{modelData.metrics?.total_samples || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Training Time</span>
                  <span className="text-2xl font-black">{modelData.training_time_seconds || 0}s</span>
                </div>
              </>
            ) : modelData.problem_type === 'anomaly_detection' ? (
              <>
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Anomalies Detected</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {modelData.metrics?.anomaly_count ?? 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Anomaly Rate</span>
                  <span className="text-2xl font-black">{modelData.metrics?.anomaly_percentage ?? 0}%</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Inliers (Normal)</span>
                  <span className="text-2xl font-black">{modelData.metrics?.inlier_count ?? 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Evaluated</span>
                  <span className="text-2xl font-black">{modelData.metrics?.total_samples ?? 0}</span>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">R² Score</span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {modelData.metrics?.r2_score || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">RMSE</span>
                  <span className="text-2xl font-black">{modelData.metrics?.rmse || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">MAE</span>
                  <span className="text-2xl font-black">{modelData.metrics?.mae || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Training Time</span>
                  <span className="text-2xl font-black">{modelData.training_time_seconds || 0}s</span>
                </div>
              </>
            )}
          </div>

          {/* Configuration Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold">Model Configuration & Features</h3>
            
            <div className="space-y-2">
              <span className="text-slate-400 font-bold block">Input Features ({requiredFeatures.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {requiredFeatures.map((feat) => (
                  <span key={feat} className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold font-mono text-[11px]">
                    {feat}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Scaling</span>
                <span className="font-bold">{modelData.train_config?.scaling || 'StandardScaler'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Test Split</span>
                <span className="font-bold">{Math.round((modelData.train_config?.test_size || 0.2) * 100)}%</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Random State</span>
                <span className="font-bold">{modelData.train_config?.random_state || 42}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Tab 2: Training Results & Feature Importance ─────────── */}
      {modelSubTab === 'results' && (
        <div className="space-y-6 animate-fadeIn text-xs">
          {modelData.feature_importances && modelData.feature_importances.length > 0 && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-bold">Feature Importance Scores</h3>
              <div className="h-64 w-full">
                <ChartTab
                  chartConfig={{
                    chart_type: 'Horizontal Bar',
                    title: 'Feature Importances',
                    x_axis: 'feature',
                    y_axis: 'importance'
                  }}
                  columns={['feature', 'importance']}
                  rows={modelData.feature_importances}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Testing & Evaluation ──────────────────────────── */}
      {modelSubTab === 'testing' && (
        <div className="space-y-6 animate-fadeIn text-xs">
          
          {/* Upload Test CSV */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Upload className="w-4 h-4 text-violet-500" />
              <span>Upload Test Dataset (.csv)</span>
            </h3>

            <form onSubmit={handleTestUpload} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setTestFile(e.target.files[0]);
                    setTestError('');
                  }
                }}
                className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300"
              />

              <button
                type="submit"
                disabled={testingLoading || !testFile}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center space-x-2 shadow-sm disabled:opacity-50"
              >
                {testingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                <span>Run Test & Predict</span>
              </button>
            </form>

            {testError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                {testError}
              </div>
            )}
          </div>

          {/* Test Results Table & Charts */}
          {testResults && (
            <div className="space-y-6 animate-fadeIn">
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                testResults.has_ground_truth ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-800 dark:text-emerald-300' : 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 text-blue-800 dark:text-blue-300'
              }`}>
                <span>
                  {testResults.has_ground_truth ? `Ground-truth target verified! Evaluated on ${testResults.total_records} test records.` : `Prediction-only mode on ${testResults.total_records} records.`}
                </span>

                {testResults.has_ground_truth && (
                  <span className="font-bold">
                    {testResults.evaluation_metrics?.accuracy ? `Accuracy: ${(testResults.evaluation_metrics.accuracy * 100).toFixed(1)}%` : (testResults.evaluation_metrics?.r2_score ? `R²: ${testResults.evaluation_metrics.r2_score}` : '')}
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold">Inputs & Predictions ({testResults.rows?.length} rows)</h4>
                  <button
                    onClick={handleGenerateTestInsights}
                    disabled={loadingTestInsights}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-violet-600 font-semibold flex items-center space-x-1.5"
                  >
                    {loadingTestInsights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Generate AI Insights</span>
                  </button>
                </div>

                <div className="h-[360px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <DataGrid columns={testResults.columns} rows={testResults.rows} />
                </div>

                {testInsights && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mt-2">
                    <MarkdownRenderer content={testInsights} />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Tab 4: Live Inference Workspace ──────────────────────── */}
      {modelSubTab === 'deployment' && (
        <div className="space-y-6 animate-fadeIn text-xs">
          
          <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Live Inference Workspace</h3>
              
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl font-bold">
                <button
                  onClick={() => setInferenceMode('single')}
                  className={`px-3 py-1 rounded-lg ${inferenceMode === 'single' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                >
                  Single Form
                </button>
                <button
                  onClick={() => setInferenceMode('batch')}
                  className={`px-3 py-1 rounded-lg ${inferenceMode === 'batch' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                >
                  Batch CSV
                </button>
              </div>
            </div>

            {/* Single Form Mode */}
            {inferenceMode === 'single' && (
              <form onSubmit={handleSingleInference} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {requiredFeatures.map((feat) => (
                    <div key={feat} className="space-y-1">
                      <label className="font-bold text-slate-500 block truncate" title={feat}>{feat}</label>
                      <input
                        type="text"
                        placeholder={`Enter ${feat}`}
                        value={singleInputs[feat] || ''}
                        onChange={(e) => setSingleInputs({ ...singleInputs, [feat]: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        required
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={inferenceLoading}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center space-x-2 shadow-md disabled:opacity-50"
                >
                  {inferenceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>Run Live Prediction</span>
                </button>
              </form>
            )}

            {/* Batch CSV Mode */}
            {inferenceMode === 'batch' && (
              <form onSubmit={handleBatchInference} className="space-y-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBatchFile(e.target.files[0]);
                      setInferenceError('');
                    }
                  }}
                  className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300"
                />

                <button
                  type="submit"
                  disabled={inferenceLoading || !batchFile}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center space-x-2 shadow-md disabled:opacity-50"
                >
                  {inferenceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>Run Batch Inference</span>
                </button>
              </form>
            )}

            {inferenceError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                {inferenceError}
              </div>
            )}
          </div>

          {/* Inference Output */}
          {inferenceResults && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn">
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
  );
}
