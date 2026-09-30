import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import ChartTab from './ChartTab';
import CorrelationMatrixView from './CorrelationMatrixView';
import {
  BrainCircuit, Sparkles, CheckCircle2, AlertTriangle,
  Play, RefreshCw, BarChart3, Check, X, Grid,
  TrendingUp, Clock, History, Star, Eye, EyeOff, ChevronDown
} from 'lucide-react';

// ── Chart Forecast Visualization Sub-Component ─────────────────
function ForecastVisualization({ forecastData, metrics }) {
  if (!forecastData?.actual_vs_predicted?.length) return null;

  const avp = forecastData.actual_vs_predicted;
  const futurePreds = forecastData.future_predictions || [];

  const dates = avp.map(p => p.date);
  const actuals = avp.map(p => p.actual);
  const predicted = avp.map(p => p.predicted);
  const splitIdx = avp.findIndex(p => p.split === 'test');

  const futureDates = futurePreds.map(p => p.date);
  const futureValues = futurePreds.map(p => p.predicted);

  const allDates = [...dates, ...futureDates];
  const actualSeries = [...actuals, ...futureDates.map(() => null)];

  const chartOption = {
    tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
    legend: {
      data: ['Actual', 'Model Prediction', 'Future Forecast'],
      bottom: 0,
      textStyle: { fontSize: 11 }
    },
    grid: { left: 50, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: allDates,
      axisLabel: { fontSize: 10, rotate: 30 }
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      {
        name: 'Actual',
        type: 'line',
        data: actualSeries,
        lineStyle: { width: 2, color: '#6366f1' },
        itemStyle: { color: '#6366f1' },
        symbol: 'circle',
        symbolSize: 4,
        connectNulls: false
      },
      {
        name: 'Model Prediction',
        type: 'line',
        data: predicted.map((v, i) => i >= (splitIdx > 0 ? splitIdx : 0) ? v : null),
        lineStyle: { width: 2, color: '#10b981', type: 'dashed' },
        itemStyle: { color: '#10b981' },
        symbol: 'circle',
        symbolSize: 4,
        connectNulls: false
      },
      {
        name: 'Future Forecast',
        type: 'line',
        data: [...dates.map(() => null), ...futureValues],
        lineStyle: { width: 2.5, color: '#f97316' },
        itemStyle: { color: '#f97316' },
        symbol: 'diamond',
        symbolSize: 6,
        areaStyle: { color: 'rgba(249,115,22,0.08)' }
      }
    ]
  };

  return (
    <div className="space-y-4">
      <div style={{ height: 350 }}>
        <ChartTab option={chartOption} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}


export default function ProjectMLView() {
  const {
    activeProjectId, activeProject, selectedVisualizationIds,
    clearSelectedVisualizations, selectModel, refreshProjectTree,
    settings
  } = useChatStore();

  // ── General ML State ──────────────────────────────────────────
  const [targetColumn, setTargetColumn] = useState('');
  const [problemDetection, setProblemDetection] = useState(null);
  const [featureColumns, setFeatureColumns] = useState([]);
  const [techniques, setTechniques] = useState([]);
  const [selectedTechnique, setSelectedTechnique] = useState(null);
  const [hyperparameters, setHyperparameters] = useState({});
  const [trainConfig, setTrainConfig] = useState({
    test_size: 0.2,
    random_state: 42,
    scaling: 'standard'
  });

  const [selectedVisObjects, setSelectedVisObjects] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [loadingRecommend, setLoadingRecommend] = useState(false);
  const [modelName, setModelName] = useState('');
  const [training, setTraining] = useState(false);
  const [trainingError, setTrainingError] = useState('');

  // ── Correlation & AI Build States ──────────────────────────
  const [correlationData, setCorrelationData] = useState({
    target_column: null,
    correlations: [],
    pairwise_matrix: null,
    eligible_columns: []
  });
  const [loadingCorrelation, setLoadingCorrelation] = useState(false);
  const [loadingAIDecide, setLoadingAIDecide] = useState(false);
  const [aiBuildSummary, setAiBuildSummary] = useState(null);
  const [showCorrelationSection, setShowCorrelationSection] = useState(false);

  // ── Chart Forecast State ─────────────────────────────────────
  const [forecastTraining, setForecastTraining] = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastError, setForecastError] = useState('');
  const [forecastHistory, setForecastHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState(12);

  const availableColumns = Object.keys(activeProject?.column_metadata || {});

  // Determine workflow mode
  const isSingleChartSelected = selectedVisualizationIds.length === 1;
  const isMultiChartSelected = selectedVisualizationIds.length > 1;
  const isChartForecastMode = isSingleChartSelected;

  // Load selected visualization objects
  useEffect(() => {
    if (activeProjectId) {
      api.listVisualizations(activeProjectId).then(allVis => {
        const matched = allVis.filter(v => selectedVisualizationIds.includes(v.id));
        setSelectedVisObjects(matched);

        if (!isChartForecastMode) {
          const visFeatures = new Set();
          matched.forEach(v => {
            if (v.x_variable && availableColumns.includes(v.x_variable)) visFeatures.add(v.x_variable);
            if (v.group_variable && availableColumns.includes(v.group_variable)) visFeatures.add(v.group_variable);
            if (v.size_variable && availableColumns.includes(v.size_variable)) visFeatures.add(v.size_variable);
          });

          let initialTarget = targetColumn;
          if (!initialTarget) {
            const visWithY = matched.find(v => v.y_variable && availableColumns.includes(v.y_variable));
            if (visWithY) {
              initialTarget = visWithY.y_variable;
            } else if (availableColumns.length > 1) {
              initialTarget = availableColumns[availableColumns.length - 1];
            }
            setTargetColumn(initialTarget);
            detectProblem(initialTarget);
          }

          if (visFeatures.size > 0) {
            const filtered = Array.from(visFeatures).filter(f => f !== initialTarget);
            setFeatureColumns(filtered);
          } else {
            setFeatureColumns(availableColumns.filter(c => c !== initialTarget));
          }

          setModelName(`${activeProject?.name || 'Project'} Model ${matched.length > 0 ? `(${matched.length} charts)` : ''}`);
        }

        if (isSingleChartSelected) {
          loadChartForecastHistory(selectedVisualizationIds[0]);
        }
      }).catch(() => {});
    }
  }, [activeProjectId, selectedVisualizationIds]);

  const loadChartForecastHistory = async (chartId) => {
    try {
      const history = await api.getChartForecastHistory(chartId);
      setForecastHistory(history);
      if (history.active_model_id) {
        const activeModel = history.models.find(m => m.id === history.active_model_id);
        if (activeModel && activeModel.forecast_data) {
          setForecastResult(activeModel);
        }
      }
    } catch (err) {
      console.error('Failed to load forecast history', err);
    }
  };

  const detectProblem = async (target) => {
    if (!activeProjectId) return;
    try {
      const detection = await api.detectProblemType(activeProjectId, target || undefined);
      setProblemDetection(detection);
      loadTechniques(detection.problem_type);
    } catch (err) {
      console.error('Failed to detect problem type', err);
    }
  };

  const loadTechniques = async (problemType) => {
    try {
      const list = await api.getTechniques(problemType);
      setTechniques(list);
      if (list.length > 0) {
        setSelectedTechnique(list[0]);
        setHyperparameters(list[0].default_hyperparameters || {});
      }
    } catch (err) {
      console.error('Failed to list techniques', err);
    }
  };

  const handleCreateCorrelationMatrix = async (targetOverride = null) => {
    if (!activeProjectId) return;
    const targetToUse = targetOverride !== null ? targetOverride : targetColumn;
    setLoadingCorrelation(true);
    setShowCorrelationSection(true);
    try {
      const res = await api.getTargetCorrelation({
        dataset_id: activeProjectId,
        target_column: targetToUse || undefined
      });
      setCorrelationData(res);
      if (res.target_column && !targetColumn) {
        setTargetColumn(res.target_column);
        detectProblem(res.target_column);
      }
    } catch (err) {
      console.error('Failed to create correlation matrix', err);
      alert(`Correlation Matrix calculation error: ${err.message}`);
    } finally {
      setLoadingCorrelation(false);
    }
  };

  const handleBuildUsingAI = async () => {
    if (!activeProjectId) return;
    setLoadingAIDecide(true);
    setAiBuildSummary(null);
    setShowCorrelationSection(true);
    try {
      const res = await api.aiDecideML({
        dataset_id: activeProjectId,
        target_column: targetColumn || undefined,
        target_mode: targetColumn ? 'manual' : 'ai'
      });

      const chosenTarget = res.target_column;
      setTargetColumn(chosenTarget);
      setFeatureColumns(res.feature_columns || []);

      setProblemDetection({
        problem_type: res.ml_category,
        target_column: chosenTarget,
        reason: res.reasoning?.target_reason || `Auto-detected ${res.ml_category}`
      });

      try {
        const list = await api.getTechniques(res.ml_category);
        setTechniques(list);
        const matched = list.find(t =>
          t.name.toLowerCase().includes(res.algorithm.toLowerCase()) ||
          res.algorithm.toLowerCase().includes(t.name.toLowerCase())
        );
        if (matched) {
          setSelectedTechnique(matched);
          setHyperparameters(res.hyperparameters || matched.default_hyperparameters || {});
        } else if (list.length > 0) {
          setSelectedTechnique(list[0]);
          setHyperparameters(list[0].default_hyperparameters || {});
        }
      } catch (techErr) {
        console.warn('Techniques fetch failed', techErr);
      }

      setCorrelationData({
        target_column: chosenTarget,
        correlations: res.correlations || [],
        pairwise_matrix: res.pairwise_matrix,
        eligible_columns: res.eligible_columns || []
      });

      setAiBuildSummary(res.reasoning || null);
      setModelName(`${activeProject?.name || 'Project'} AI ${res.algorithm} Model`);
    } catch (err) {
      console.error('AI Decide failed', err);
      alert(`AI Build error: ${err.message}`);
    } finally {
      setLoadingAIDecide(false);
    }
  };

  const handleTargetChange = (newTarget) => {
    setTargetColumn(newTarget);
    setFeatureColumns(prev => prev.filter(c => c !== newTarget));
    detectProblem(newTarget);
    setRecommendation(null);
    if (showCorrelationSection) {
      handleCreateCorrelationMatrix(newTarget);
    }
  };

  const toggleFeature = (col) => {
    if (featureColumns.includes(col)) {
      setFeatureColumns(prev => prev.filter(c => c !== col));
    } else {
      setFeatureColumns(prev => [...prev, col]);
    }
  };

  const handleSuggestBestMethod = async () => {
    if (!activeProjectId || !problemDetection) return;
    setLoadingRecommend(true);
    setRecommendation(null);
    try {
      const rec = await api.recommendMLMethod({
        dataset_id: activeProjectId,
        target_column: targetColumn || undefined,
        problem_type: problemDetection.problem_type,
        feature_columns: featureColumns,
        model: settings?.model
      });
      setRecommendation(rec);

      if (rec?.recommendation) {
        const found = techniques.find(t => t.name.toLowerCase().includes(rec.recommendation.toLowerCase()) || rec.recommendation.toLowerCase().includes(t.name.toLowerCase()));
        if (found) {
          setSelectedTechnique(found);
          setHyperparameters(found.default_hyperparameters || {});
        }
      }
    } catch (err) {
      alert(`AI Recommendation error: ${err.message}`);
    } finally {
      setLoadingRecommend(false);
    }
  };

  const handleTrainModel = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !selectedTechnique) return;
    if (featureColumns.length === 0) {
      setTrainingError('Please select at least one input feature column.');
      return;
    }

    setTraining(true);
    setTrainingError('');

    try {
      const result = await api.trainModel({
        dataset_id: activeProjectId,
        source_visualization_ids: selectedVisualizationIds,
        model_name: modelName || `${selectedTechnique.name} Model`,
        problem_type: problemDetection.problem_type,
        target_column: targetColumn || undefined,
        feature_columns: featureColumns,
        ignored_columns: availableColumns.filter(c => c !== targetColumn && !featureColumns.includes(c)),
        algorithm: selectedTechnique.name,
        hyperparameters: hyperparameters,
        train_config: trainConfig
      });

      await refreshProjectTree();
      selectModel(result);
    } catch (err) {
      setTrainingError(err.message || 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  // ── Chart Forecast Training ────────────────────────────────
  const handleTrainChartForecast = async () => {
    if (!activeProjectId || !isSingleChartSelected) return;
    const chartId = selectedVisualizationIds[0];
    const chartObj = selectedVisObjects[0];

    setForecastTraining(true);
    setForecastError('');
    setForecastResult(null);

    try {
      const result = await api.trainChartForecast({
        dataset_id: activeProjectId,
        chart_id: chartId,
        model_name: `${chartObj?.title || 'Chart'} Forecast`,
        forecast_horizon: forecastHorizon,
        model: settings?.model
      });

      setForecastResult(result);
      await loadChartForecastHistory(chartId);
      await refreshProjectTree();
    } catch (err) {
      setForecastError(err.message || 'Forecast training failed');
    } finally {
      setForecastTraining(false);
    }
  };

  const handleActivateModel = async (experimentId) => {
    const chartId = selectedVisualizationIds[0];
    try {
      await api.activateChartForecast(experimentId, chartId);
      await loadChartForecastHistory(chartId);
      const history = await api.getChartForecastHistory(chartId);
      const activated = history.models.find(m => m.id === experimentId);
      if (activated) setForecastResult(activated);
    } catch (err) {
      alert(`Failed to activate model: ${err.message}`);
    }
  };

  if (!activeProject) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm border border-emerald-200/60 dark:border-emerald-900/60">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100">
          PRAJNA ML Training Studio
        </h2>
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 max-w-md uppercase tracking-wider">
          Predictive Research &amp; Analytics for Judgement, Navigation &amp; Action
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          Select a project from the sidebar to configure and train predictive machine learning models.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART-BASED FORECASTING WORKFLOW (Single chart selected)
  // ═══════════════════════════════════════════════════════════════
  if (isChartForecastMode) {
    const chartObj = selectedVisObjects[0];
    const histModels = forecastHistory?.models || [];

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h1 className="text-xl font-bold">Chart Forecasting ML</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Time-series forecasting for chart: <strong className="text-orange-600 dark:text-orange-400">{chartObj?.title || 'Selected Chart'}</strong>
              {' '}• AI selects the best forecasting approach automatically
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {histModels.length > 0 && (
              <button type="button" onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer">
                <History className="w-3.5 h-3.5 text-violet-500" />
                <span>Model History ({histModels.length})</span>
              </button>
            )}
            <button type="button" onClick={clearSelectedVisualizations}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">
              <X className="w-3.5 h-3.5 inline mr-1" />Clear Chart Selection
            </button>
          </div>
        </div>

        {/* Selected Chart Info */}
        {chartObj && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50/50 to-yellow-50/30 dark:from-orange-950/40 dark:via-amber-950/20 dark:to-slate-900 border border-orange-200 dark:border-orange-800/60 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">{chartObj.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {chartObj.chart_type} • X: {chartObj.x_variable || '—'} • Y: {chartObj.y_variable || '—'}
                  {chartObj.aggregation && chartObj.aggregation !== 'none' ? ` • Agg: ${chartObj.aggregation}` : ''}
                </p>
              </div>
            </div>
            {forecastResult?.is_active_for_chart && (
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-700 flex items-center space-x-1">
                <Star className="w-3 h-3" /><span>Active Model</span>
              </span>
            )}
          </div>
        )}

        {/* Forecast Configuration & Train */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
              <span>Train Forecasting Model</span>
            </h3>
            <div className="flex items-center space-x-3 text-xs">
              <label className="font-semibold text-slate-600 dark:text-slate-400">Forecast Horizon:</label>
              <select value={forecastHorizon} onChange={(e) => setForecastHorizon(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                <option value={3}>3 periods</option>
                <option value={6}>6 periods</option>
                <option value={12}>12 periods</option>
                <option value={24}>24 periods</option>
              </select>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p className="font-semibold">The AI will automatically:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
              <li>Detect the date/time column and target metric from the chart</li>
              <li>Select the most appropriate forecasting technique (not hardcoded)</li>
              <li>Prepare time-series data with sliding-window and lag features</li>
              <li>Train the model with chronological train/validation split</li>
              <li>Generate {forecastHorizon} future forecast predictions</li>
            </ul>
          </div>
          {forecastError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /><span>{forecastError}</span>
            </div>
          )}
          <button type="button" onClick={handleTrainChartForecast} disabled={forecastTraining}
            className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer">
            {forecastTraining ? (<><RefreshCw className="w-5 h-5 animate-spin" /><span>Training Forecast Model...</span></>) : (<><Play className="w-5 h-5 fill-current" /><span>Train ML Forecast Model</span></>)}
          </button>
        </div>

        {/* Forecast Results */}
        {forecastResult && forecastResult.forecast_data && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                  <span>Actual vs Forecast Visualization</span>
                </h3>
                <div className="flex items-center gap-2">
                  {forecastResult.algorithm && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold border border-violet-200 dark:border-violet-700">
                      {forecastResult.algorithm}
                    </span>
                  )}
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    {forecastResult.training_time_seconds}s
                  </span>
                </div>
              </div>
              {forecastResult.approach_reasoning && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic px-1">{forecastResult.approach_reasoning}</p>
              )}
              <ForecastVisualization forecastData={forecastResult.forecast_data} metrics={forecastResult.metrics} />
            </div>

            {/* Metrics */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <button type="button" onClick={() => setShowMetrics(!showMetrics)} className="w-full flex items-center justify-between py-2 cursor-pointer">
                <h3 className="text-sm font-bold flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                  <span>View Model Accuracy</span>
                </h3>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMetrics ? 'rotate-180' : ''}`} />
              </button>
              {showMetrics && forecastResult.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 animate-fadeIn">
                  {forecastResult.metrics.mae != null && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAE</span>
                      <span className="text-lg font-black text-slate-800 dark:text-slate-100">{forecastResult.metrics.mae.toFixed(4)}</span>
                    </div>
                  )}
                  {forecastResult.metrics.rmse != null && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">RMSE</span>
                      <span className="text-lg font-black text-slate-800 dark:text-slate-100">{forecastResult.metrics.rmse.toFixed(4)}</span>
                    </div>
                  )}
                  {forecastResult.metrics.mape != null && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAPE</span>
                      <span className="text-lg font-black text-slate-800 dark:text-slate-100">{forecastResult.metrics.mape.toFixed(1)}%</span>
                    </div>
                  )}
                  {forecastResult.metrics.r2_score != null && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">R² Score</span>
                      <span className="text-lg font-black text-slate-800 dark:text-slate-100">{forecastResult.metrics.r2_score.toFixed(4)}</span>
                    </div>
                  )}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Train / Test</span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">{forecastResult.metrics.train_samples} / {forecastResult.metrics.test_samples}</span>
                  </div>
                </div>
              )}
              {showMetrics && forecastResult.training_data_range && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><span className="text-[10px] font-bold text-slate-400 block">Date Column</span><span className="font-semibold">{forecastResult.date_column}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-400 block">Target</span><span className="font-semibold">{forecastResult.target_column}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-400 block">Data Range</span><span className="font-semibold">{forecastResult.training_data_range?.start?.slice(0, 10)} → {forecastResult.training_data_range?.end?.slice(0, 10)}</span></div>
                  <div><span className="text-[10px] font-bold text-slate-400 block">Horizon</span><span className="font-semibold">{forecastResult.forecast_horizon} periods</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Model History */}
        {showHistory && histModels.length > 0 && (
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <History className="w-4 h-4 text-violet-500" /><span>Model History ({histModels.length} models)</span>
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {histModels.map((model) => (
                <div key={model.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${model.is_active_for_chart ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold">{model.model_name}</span>
                      {model.is_active_for_chart && <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold">ACTIVE</span>}
                      {model.status === 'failed' && <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold">FAILED</span>}
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{model.algorithm}</span><span>•</span>
                      <span>{new Date(model.created_at).toLocaleString()}</span>
                      {model.metrics?.mae != null && (<><span>•</span><span className="font-semibold">MAE: {model.metrics.mae.toFixed(2)}</span></>)}
                      {model.metrics?.rmse != null && (<span className="font-semibold">RMSE: {model.metrics.rmse.toFixed(2)}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {model.status === 'completed' && !model.is_active_for_chart && (
                      <button onClick={() => handleActivateModel(model.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 transition-all border border-emerald-200 dark:border-emerald-700 cursor-pointer">
                        Activate
                      </button>
                    )}
                    {model.status === 'completed' && (
                      <button onClick={() => setForecastResult(model)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all cursor-pointer">
                        <Eye className="w-3.5 h-3.5 inline mr-1" />View
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERAL ML TRAINING WORKFLOW (No chart or multiple charts)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-bold">ML Training Studio</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Project: <strong className="text-violet-600 dark:text-violet-400">{activeProject.name}</strong> • Configure, analyze feature correlations, and train high-performance predictive models.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => handleCreateCorrelationMatrix()} disabled={loadingCorrelation || loadingAIDecide}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            title="Generate pairwise and target correlation heatmap matrix">
            {loadingCorrelation ? (<RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />) : (<Grid className="w-3.5 h-3.5 text-violet-500" />)}
            <span>Create Correlation Matrix</span>
          </button>
          <button type="button" onClick={handleBuildUsingAI} disabled={loadingAIDecide || loadingCorrelation}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black flex items-center space-x-2 shadow-lg shadow-violet-900/30 ring-2 ring-violet-400/40 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            title="Automatically select target, evaluate correlations, pick highest-signal features, and configure optimal model">
            {loadingAIDecide ? (<RefreshCw className="w-4 h-4 animate-spin text-white" />) : (<Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />)}
            <span>Build using AI</span>
          </button>
        </div>
      </div>

      {/* Multiple Charts Warning */}
      {isMultiChartSelected && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-bold">Multiple charts selected ({selectedVisualizationIds.length})</p>
            <p className="mt-0.5">For chart-based forecasting, select exactly <strong>one chart</strong>. The current selection will use the general ML training pipeline.
              <button onClick={clearSelectedVisualizations} className="text-amber-600 dark:text-amber-400 underline ml-1 cursor-pointer">Clear selection</button>
            </p>
          </div>
        </div>
      )}

      {/* AI Build Summary */}
      {aiBuildSummary && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-purple-50/50 to-indigo-50/30 dark:from-violet-950/40 dark:via-purple-950/20 dark:to-slate-900 border border-violet-200 dark:border-violet-800/80 space-y-3 animate-fadeIn text-xs shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">AI Build Activated &amp; Configured</h4>
            </div>
            <button type="button" onClick={() => setAiBuildSummary(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Dismiss banner"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">{aiBuildSummary.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-violet-100 dark:border-slate-700">
              <span className="font-extrabold uppercase text-[10px] text-violet-500 block">Target Selection</span>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{aiBuildSummary.target_reason}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-violet-100 dark:border-slate-700">
              <span className="font-extrabold uppercase text-[10px] text-violet-500 block">Feature Selection</span>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{aiBuildSummary.feature_reason}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-violet-100 dark:border-slate-700">
              <span className="font-extrabold uppercase text-[10px] text-violet-500 block">Algorithm Choice</span>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{aiBuildSummary.algorithm_reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Visualizations Banner */}
      {selectedVisObjects.length > 0 && (
        <div className="p-4 rounded-2xl bg-violet-50/80 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                Training with {selectedVisObjects.length} Selected Visualization{selectedVisObjects.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedVisObjects.map(v => (
                <span key={v.id} className="text-[11px] px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-violet-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                  {v.title} ({v.chart_type})
                </span>
              ))}
            </div>
          </div>
          <button onClick={clearSelectedVisualizations} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">Clear Selection</button>
        </div>
      )}

      {/* 1. Target & Problem Type */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
            <span>Target Variable &amp; Detected Problem Type</span>
          </h3>
          {!showCorrelationSection && (
            <button type="button" onClick={() => handleCreateCorrelationMatrix()} disabled={loadingCorrelation}
              className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center space-x-1">
              <Grid className="w-3.5 h-3.5" /><span>Create Correlation Matrix</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Target Column to Predict:</label>
            <select value={targetColumn} onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">None (Clustering / Unsupervised)</option>
              {availableColumns.map(col => (
                <option key={col} value={col}>{col} ({activeProject?.column_metadata?.[col]?.data_type || 'column'})</option>
              ))}
            </select>
          </div>
          {problemDetection && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Problem Type:</span>
                <span className="font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">{problemDetection.problem_type}</span>
                {problemDetection.sub_type && (<span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">{problemDetection.sub_type}</span>)}
              </div>
              <p className="text-slate-600 dark:text-slate-300">{problemDetection.reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Correlation Matrix */}
      {showCorrelationSection && (
        <CorrelationMatrixView targetColumn={targetColumn} correlations={correlationData.correlations} pairwiseMatrix={correlationData.pairwise_matrix}
          eligibleColumns={correlationData.eligible_columns} selectedFeatures={featureColumns} onToggleFeature={toggleFeature}
          onBatchSelectFeatures={(list) => setFeatureColumns(list.filter(c => c !== targetColumn))} loading={loadingCorrelation}
          onRecalculate={() => handleCreateCorrelationMatrix()} />
      )}

      {/* 2. Feature Selection */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
            <span>Input Feature Matrix ({featureColumns.length} selected)</span>
          </h3>
          <div className="flex items-center space-x-2 text-xs">
            <button onClick={() => setFeatureColumns(availableColumns.filter(c => c !== targetColumn))} className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Select All</button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button onClick={() => setFeatureColumns([])} className="font-semibold text-slate-500 hover:underline">Deselect All</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {availableColumns.map((col) => {
            const isTarget = col === targetColumn;
            const isSelected = featureColumns.includes(col);
            const colType = activeProject?.column_metadata?.[col]?.data_type || 'cat';
            const corrItem = (correlationData.correlations || []).find(c => c.feature === col);
            return (
              <div key={col} onClick={() => !isTarget && toggleFeature(col)}
                className={`p-3 rounded-2xl border text-xs cursor-pointer select-none transition-all flex flex-col justify-between ${
                  isTarget ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 cursor-not-allowed opacity-90'
                    : isSelected ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-400 dark:border-violet-600 text-violet-900 dark:text-violet-200 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 opacity-60 hover:opacity-100'
                }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${colType === 'numerical' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'}`}>{colType}</span>
                  {isTarget ? (<span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white">TARGET</span>) : isSelected ? (<Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />) : null}
                </div>
                <div>
                  <span className="font-bold truncate block" title={col}>{col}</span>
                  {corrItem && !isTarget && (
                    <span className={`text-[10px] font-mono font-bold block mt-0.5 ${corrItem.correlation >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}`}>
                      r = {corrItem.correlation >= 0 ? '+' : ''}{corrItem.correlation.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Technique Library */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
            <span>ML Technique Library</span>
          </h3>
          <button onClick={handleSuggestBestMethod} disabled={loadingRecommend}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all disabled:opacity-50">
            {loadingRecommend ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Suggest Best Training Method (AI)</span>
          </button>
        </div>
        {recommendation && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50/50 to-slate-50 dark:from-violet-950/40 dark:via-indigo-950/20 dark:to-slate-900 border border-violet-200 dark:border-violet-800/80 space-y-3 text-xs animate-fadeIn">
            <span className="font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
              AI Recommendation: {recommendation.recommendation} ({recommendation.suitability_score}% suitability)
            </span>
            <p className="text-slate-600 dark:text-slate-300">{recommendation.reasoning}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {techniques.map((tech) => {
            const isSelected = selectedTechnique?.id === tech.id;
            return (
              <div key={tech.id} onClick={() => { setSelectedTechnique(tech); setHyperparameters(tech.default_hyperparameters || {}); }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${isSelected ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 shadow-md ring-2 ring-violet-500/20' : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'}`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{tech.category}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                  </div>
                  <h4 className="text-xs font-bold mb-1">{tech.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{tech.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Training Execution */}
      <form onSubmit={handleTrainModel} className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-sm font-bold flex items-center space-x-2">
          <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">4</span>
          <span>Training Configuration &amp; Execution</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Model Name</label>
            <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" required />
          </div>
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Test Split: {Math.round(trainConfig.test_size * 100)}%</label>
            <input type="range" min="0.1" max="0.4" step="0.05" value={trainConfig.test_size}
              onChange={(e) => setTrainConfig({ ...trainConfig, test_size: parseFloat(e.target.value) })} className="w-full mt-2 accent-violet-600" />
          </div>
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Feature Scaling</label>
            <select value={trainConfig.scaling} onChange={(e) => setTrainConfig({ ...trainConfig, scaling: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <option value="standard">StandardScaler (Mean 0, Std 1)</option>
              <option value="robust">RobustScaler (Median / IQR)</option>
              <option value="minmax">MinMaxScaler (0 to 1)</option>
            </select>
          </div>
        </div>
        {trainingError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /><span>{trainingError}</span>
          </div>
        )}
        <button type="submit" disabled={training || !selectedTechnique}
          className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50">
          {training ? (<><RefreshCw className="w-5 h-5 animate-spin" /><span>Training Model &amp; Validating...</span></>) : (<><Play className="w-5 h-5 fill-current" /><span>Train Model ({selectedTechnique?.name || 'Selected Algorithm'})</span></>)}
        </button>
      </form>
    </div>
  );
}
