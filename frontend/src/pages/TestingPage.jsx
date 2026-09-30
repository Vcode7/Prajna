import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import DataGrid from '../components/DataGrid';
import ChartTab from '../components/ChartTab';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  FlaskConical, Upload, CheckCircle2, AlertTriangle, Sparkles,
  Rocket, RefreshCw, BarChart3, ArrowRight, Layers, Table, Info
} from 'lucide-react';

export default function TestingPage() {
  const {
    activeExperiment, setActiveDeployment, setActiveTab, settings
  } = useChatStore();

  const [testFile, setTestFile] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Deploy Modal
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployName, setDeployName] = useState('');
  const [deployVersion, setDeployVersion] = useState('1.0.0');
  const [deployDesc, setDeployDesc] = useState('');
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (activeExperiment) {
      setDeployName(activeExperiment.model_name || 'Deployed Model');
    }
  }, [activeExperiment]);

  const handleTestUpload = async (e) => {
    e.preventDefault();
    if (!testFile || !activeExperiment?.id) return;

    setTesting(true);
    setErrorMessage('');
    setTestResults(null);
    setInsights('');

    try {
      const results = await api.testModelWithFile(activeExperiment.id, testFile);
      setTestResults(results);
    } catch (err) {
      setErrorMessage(err.message || 'Testing failed');
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!activeExperiment?.id || !testResults) return;
    setLoadingInsights(true);
    try {
      const res = await api.generateTestingInsights({
        model_id: activeExperiment.id,
        prediction_summary: {
          metrics: testResults.evaluation_metrics,
          total_records: testResults.total_records,
          sample_predictions: testResults.rows?.slice(0, 10)
        },
        model: settings?.model
      });
      setInsights(res.insights);
    } catch (err) {
      alert(`Failed to generate insights: ${err.message}`);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!activeExperiment?.id) return;

    setDeploying(true);
    try {
      const dep = await api.deployModel({
        experiment_id: activeExperiment.id,
        deployment_name: deployName || activeExperiment.model_name,
        version: deployVersion || '1.0.0',
        description: deployDesc || ''
      });
      setActiveDeployment(dep);
      setDeployOpen(false);
      setActiveTab('deployments');
    } catch (err) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  if (!activeExperiment) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <FlaskConical className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold">No Trained Model Selected for Testing</h3>
        <p className="text-xs text-slate-400">Please train a model in Step 3 before testing with new or sample datasets.</p>
        <button
          onClick={() => setActiveTab('ml_training')}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl"
        >
          Go to ML Training
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Header & Active Model Badge ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-indigo-500" />
            <h1 className="text-xl font-bold">Model Testing & Evaluation</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Step 4: Upload test CSV data, validate feature alignment, generate predictions, and deploy.
          </p>
        </div>

        <button
          onClick={() => setDeployOpen(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-900/20 active:scale-[0.98] transition-all"
        >
          <Rocket className="w-4 h-4" />
          <span>Deploy Model →</span>
        </button>
      </div>

      {/* ── Active Model Summary Card ────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {activeExperiment.algorithm}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeExperiment.model_name}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Target: <strong>{activeExperiment.target_column || 'None'}</strong> • Features: <strong>{activeExperiment.feature_columns?.length} columns</strong> ({activeExperiment.problem_type})
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs font-bold">
          {activeExperiment.metrics?.accuracy && (
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block font-normal">Train Acc</span>
              <span className="text-emerald-600 dark:text-emerald-400">{(activeExperiment.metrics.accuracy * 100).toFixed(1)}%</span>
            </div>
          )}
          {activeExperiment.metrics?.r2_score && (
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block font-normal">Train R²</span>
              <span className="text-emerald-600 dark:text-emerald-400">{activeExperiment.metrics.r2_score}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Test CSV Upload Form ─────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold flex items-center space-x-2">
          <Upload className="w-4 h-4 text-violet-500" />
          <span>Upload Test Dataset (.csv)</span>
        </h3>
        <p className="text-xs text-slate-400">
          Upload a sample or testing CSV matching the required features. If ground-truth target is included, evaluation metrics will automatically be computed.
        </p>

        <form onSubmit={handleTestUpload} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setTestFile(e.target.files[0]);
                setErrorMessage('');
              }
            }}
            className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200"
          />

          <button
            type="submit"
            disabled={testing || !testFile}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            <span>Run Test & Generate Predictions</span>
          </button>
        </form>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ── Test Results & Live Predictions ──────────────────────── */}
      {testResults && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Mode & Evaluation Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            testResults.has_ground_truth
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
          }`}>
            <div className="flex items-center space-x-2 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {testResults.has_ground_truth
                  ? `Ground-Truth Target Detected! Evaluated on ${testResults.total_records} test observations.`
                  : `Prediction-Only Mode: Generated predictions for ${testResults.total_records} records.`}
              </span>
            </div>

            {testResults.has_ground_truth && (
              <div className="flex items-center space-x-4 text-xs font-bold">
                {testResults.evaluation_metrics?.accuracy && (
                  <span>Accuracy: {(testResults.evaluation_metrics.accuracy * 100).toFixed(1)}%</span>
                )}
                {testResults.evaluation_metrics?.r2_score && (
                  <span>R² Score: {testResults.evaluation_metrics.r2_score}</span>
                )}
              </div>
            )}
          </div>

          {/* Predictions Table (AG Grid) */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Input Data + ML Predictions ({testResults.rows?.length} records preview)
              </h3>
              <button
                onClick={handleGenerateInsights}
                disabled={loadingInsights}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {loadingInsights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate Prediction Insights (AI)</span>
              </button>
            </div>

            {testResults.rows && (
              <div className="h-[380px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <DataGrid columns={testResults.columns} rows={testResults.rows} />
              </div>
            )}

            {/* AI Insights Display */}
            {insights && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-violet-600 dark:text-violet-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI-Generated Prediction Insights</span>
                </div>
                <MarkdownRenderer content={insights} />
              </div>
            )}
          </div>

          {/* Automated Prediction Visualizations */}
          {testResults.charts && testResults.charts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {testResults.charts.map((ch, idx) => (
                <div key={idx} className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{ch.title}</h4>
                  <div className="h-56 w-full">
                    <ChartTab
                      chartConfig={{
                        chart_type: ch.chart_type,
                        title: ch.title,
                        x_axis: ch.x_axis,
                        y_axis: ch.y_axis
                      }}
                      columns={ch.columns}
                      rows={ch.rows}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── Deploy Model Modal ───────────────────────────────────── */}
      {deployOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-2">
              <Rocket className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold">Deploy Model for Live Inference</h3>
            </div>

            <form onSubmit={handleDeploy} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Deployment Name</label>
                <input
                  type="text"
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Version</label>
                <input
                  type="text"
                  value={deployVersion}
                  onChange={(e) => setDeployVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Description (Optional)</label>
                <textarea
                  value={deployDesc}
                  onChange={(e) => setDeployDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeployOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deploying}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                >
                  {deploying ? 'Deploying...' : 'Confirm Deployment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
