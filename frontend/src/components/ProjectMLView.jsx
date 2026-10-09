import React, { useState, useEffect, useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import ChartTab from './ChartTab';
import CorrelationMatrixView from './CorrelationMatrixView';
import {
  BrainCircuit, Sparkles, CheckCircle2, AlertTriangle,
  Play, RefreshCw, BarChart3, Check, X, Grid,
  TrendingUp, Clock, History, Star, Eye, ChevronDown,
  Users, ShieldAlert, Target, Sliders, Layers, PieChart,
  HelpCircle, ArrowRight, Gauge, Database, Info, Filter,
  Activity, Hash, Calendar, CheckSquare, Square
} from 'lucide-react';

// ── ML Categories Definition ────────────────────────────────────
const ML_CATEGORIES = [
  {
    id: 'regression',
    name: 'Regression',
    badge: 'Continuous',
    icon: TrendingUp,
    accent: 'blue',
    colorClasses: {
      activeBorder: 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20',
      activeBg: 'bg-blue-50/80 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300',
      gradient: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500',
      indicator: 'bg-blue-600 text-white'
    },
    tagline: 'Continuous Numerical Prediction',
    description: 'Predict numerical targets like sales, prices, duration, costs, scores, or continuous metrics.'
  },
  {
    id: 'classification',
    name: 'Classification',
    badge: 'Categorical',
    icon: CheckCircle2,
    accent: 'violet',
    colorClasses: {
      activeBorder: 'border-violet-500 dark:border-violet-500 ring-2 ring-violet-500/20',
      activeBg: 'bg-violet-50/80 dark:bg-violet-950/40',
      text: 'text-violet-600 dark:text-violet-400',
      badgeBg: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300',
      gradient: 'from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500',
      indicator: 'bg-violet-600 text-white'
    },
    tagline: 'Discrete Category & Class Prediction',
    description: 'Predict discrete outcomes, binary churn/fraud flags, risk levels, or multi-class categories.'
  },
  {
    id: 'forecasting',
    name: 'Forecasting',
    badge: 'Time Series',
    icon: Clock,
    accent: 'orange',
    colorClasses: {
      activeBorder: 'border-orange-500 dark:border-orange-500 ring-2 ring-orange-500/20',
      activeBg: 'bg-orange-50/80 dark:bg-orange-950/40',
      text: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300',
      gradient: 'from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500',
      indicator: 'bg-orange-600 text-white'
    },
    tagline: 'Sequential Chronological Forecasting',
    description: 'Forecast sequential time-series forward across future horizons with temporal lag modeling.'
  },
  {
    id: 'segmentation',
    name: 'Segmentation',
    badge: 'Unsupervised',
    icon: Users,
    accent: 'emerald',
    colorClasses: {
      activeBorder: 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20',
      activeBg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
      gradient: 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500',
      indicator: 'bg-emerald-600 text-white'
    },
    tagline: 'Cohort Discovery & Unsupervised Clustering',
    description: 'Discover hidden customer cohorts, behavioral personas, and natural multi-dimensional clusters.'
  },
  {
    id: 'anomaly_detection',
    name: 'Anomaly Detection',
    badge: 'Outliers & Fraud',
    icon: ShieldAlert,
    accent: 'rose',
    colorClasses: {
      activeBorder: 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20',
      activeBg: 'bg-rose-50/80 dark:bg-rose-950/40',
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300',
      gradient: 'from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500',
      indicator: 'bg-rose-600 text-white'
    },
    tagline: 'Irregular Spikes & Fraud Outlier Detection',
    description: 'Detect abnormal behavior, fraudulent patterns, sensor failures, and statistical outliers.'
  }
];

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

// ── 2D PCA Cluster Scatter Visualization ────────────────────────
function ClusterScatterVisualization({ pcaPoints, clusterDistribution }) {
  if (!pcaPoints?.length) return null;

  const clusterIds = Object.keys(clusterDistribution || {}).map(c => parseInt(c.replace('Cluster ', ''))).filter(n => !isNaN(n));
  const uniqueClusters = clusterIds.length > 0 ? clusterIds : Array.from(new Set(pcaPoints.map(p => p.cluster)));
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];

  const chartOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params) => `<strong>Cluster ${params.data[2]}</strong><br/>PCA 1: ${params.data[0]}<br/>PCA 2: ${params.data[1]}`
    },
    legend: {
      data: uniqueClusters.map(c => `Cluster ${c}`),
      bottom: 0,
      textStyle: { fontSize: 11 }
    },
    grid: { left: 40, right: 30, top: 20, bottom: 45 },
    xAxis: { type: 'value', name: 'PCA Component 1', nameLocation: 'middle', nameGap: 24, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: 'PCA Component 2', nameLocation: 'middle', nameGap: 24, axisLabel: { fontSize: 10 } },
    series: uniqueClusters.map((c, idx) => ({
      name: `Cluster ${c}`,
      type: 'scatter',
      data: pcaPoints.filter(p => p.cluster === c).map(p => [p.x, p.y, p.cluster]),
      symbolSize: 9,
      itemStyle: { color: colors[idx % colors.length] }
    }))
  };

  return (
    <div style={{ height: 320 }}>
      <ChartTab option={chartOption} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export default function ProjectMLView() {
  const {
    activeProjectId, activeProject, selectedVisualizationIds,
    clearSelectedVisualizations, selectModel, refreshProjectTree,
    settings
  } = useChatStore();

  // ── Active ML Training Category ───────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState('regression');

  // ── Target & Feature State ────────────────────────────────────
  const [targetColumn, setTargetColumn] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [groundTruthColumn, setGroundTruthColumn] = useState('');
  const [featureColumns, setFeatureColumns] = useState([]);
  const [problemDetection, setProblemDetection] = useState(null);

  // ── Models & Techniques Library ───────────────────────────────
  const [techniques, setTechniques] = useState([]);
  const [selectedTechnique, setSelectedTechnique] = useState(null);
  const [hyperparameters, setHyperparameters] = useState({});

  // ── Preprocessing & Training Parameters ────────────────────────
  const [modelName, setModelName] = useState('');
  const [trainConfig, setTrainConfig] = useState({
    test_size: 0.2,
    random_state: 42,
    scaling: 'standard',
    imbalance_handling: 'none',
    imputation: 'median',
    outlier_handling: 'none',
    // Category specifics
    n_clusters: 3,
    contamination: 0.05,
    forecast_horizon: 12,
    lag_window: 7,
    cluster_linkage: 'ward'
  });

  // ── Correlation & AI Build States ────────────────────────────
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

  // ── Recommendation State ──────────────────────────────────────
  const [recommendation, setRecommendation] = useState(null);
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  // ── Execution & Results State ─────────────────────────────────
  const [training, setTraining] = useState(false);
  const [trainingError, setTrainingError] = useState('');
  const [trainedResult, setTrainedResult] = useState(null);
  const [showResultMetrics, setShowResultMetrics] = useState(true);

  // ── Chart Linkage State ───────────────────────────────────────
  const [selectedVisObjects, setSelectedVisObjects] = useState([]);
  const [forecastHistory, setForecastHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const availableColumns = Object.keys(activeProject?.column_metadata || {});
  const activeCategoryMeta = useMemo(
    () => ML_CATEGORIES.find(c => c.id === selectedCategory) || ML_CATEGORIES[0],
    [selectedCategory]
  );

  // Detect column types
  const columnTypes = useMemo(() => {
    const meta = activeProject?.column_metadata || {};
    const numeric = [];
    const categorical = [];
    const datetime = [];
    availableColumns.forEach(c => {
      const dt = meta[c]?.data_type;
      if (dt === 'numerical') numeric.push(c);
      else if (dt === 'datetime' || c.toLowerCase().includes('date') || c.toLowerCase().includes('time') || c.toLowerCase().includes('year')) datetime.push(c);
      else categorical.push(c);
    });
    return { numeric, categorical, datetime };
  }, [activeProject, availableColumns]);

  // Load selected visualization objects
  useEffect(() => {
    if (activeProjectId) {
      api.listVisualizations(activeProjectId).then(allVis => {
        const matched = allVis.filter(v => selectedVisualizationIds.includes(v.id));
        setSelectedVisObjects(matched);

        if (matched.length === 1) {
          const single = matched[0];
          // Pre-populate based on chart
          if (single.x_variable && availableColumns.includes(single.x_variable)) {
            setDateColumn(single.x_variable);
          }
          if (single.y_variable && availableColumns.includes(single.y_variable)) {
            setTargetColumn(single.y_variable);
          }
          loadChartForecastHistory(single.id);
        }
      }).catch(() => {});
    }
  }, [activeProjectId, selectedVisualizationIds]);

  // Initialize techniques on category change
  useEffect(() => {
    loadTechniquesForCategory(selectedCategory);
    setRecommendation(null);
    setTrainingError('');
  }, [selectedCategory]);

  // Set default model name and target/feature suggestions on category change or project load
  useEffect(() => {
    if (!activeProject) return;

    const baseName = activeProject.name || 'Project';

    if (selectedCategory === 'regression') {
      const numCol = columnTypes.numeric.find(c => c !== targetColumn) || columnTypes.numeric[columnTypes.numeric.length - 1];
      if (!targetColumn && numCol) {
        setTargetColumn(numCol);
        detectProblem(numCol);
      }
      if (featureColumns.length === 0) {
        setFeatureColumns(columnTypes.numeric.filter(c => c !== (targetColumn || numCol)));
      }
      setModelName(`${baseName} Regression Model`);
    } else if (selectedCategory === 'classification') {
      const catCol = columnTypes.categorical[0] || (columnTypes.numeric.find(c => activeProject.column_metadata?.[c]?.unique_count <= 5));
      if (!targetColumn && catCol) {
        setTargetColumn(catCol);
        detectProblem(catCol);
      }
      if (featureColumns.length === 0) {
        setFeatureColumns(availableColumns.filter(c => c !== (targetColumn || catCol)));
      }
      setModelName(`${baseName} Classification Model`);
    } else if (selectedCategory === 'forecasting') {
      if (!dateColumn && columnTypes.datetime.length > 0) {
        setDateColumn(columnTypes.datetime[0]);
      } else if (!dateColumn && availableColumns.length > 0) {
        setDateColumn(availableColumns[0]);
      }
      if (!targetColumn && columnTypes.numeric.length > 0) {
        setTargetColumn(columnTypes.numeric[0]);
      }
      setModelName(`${baseName} Time-Series Forecast (${trainConfig.forecast_horizon} periods)`);
    } else if (selectedCategory === 'segmentation') {
      setTargetColumn('');
      if (featureColumns.length === 0) {
        setFeatureColumns(columnTypes.numeric.length > 0 ? columnTypes.numeric : availableColumns);
      }
      setModelName(`${baseName} Cohort Segmentation (${trainConfig.n_clusters} clusters)`);
    } else if (selectedCategory === 'anomaly_detection') {
      if (featureColumns.length === 0) {
        setFeatureColumns(columnTypes.numeric.length > 0 ? columnTypes.numeric : availableColumns);
      }
      setModelName(`${baseName} Anomaly & Outlier Detector`);
    }
  }, [selectedCategory, activeProject]);

  const loadTechniquesForCategory = async (cat) => {
    try {
      const list = await api.getTechniques(cat);
      setTechniques(list);
      if (list.length > 0) {
        setSelectedTechnique(list[0]);
        setHyperparameters(list[0].default_hyperparameters || {});
      }
    } catch (err) {
      console.error('Failed to list techniques', err);
    }
  };

  const loadChartForecastHistory = async (chartId) => {
    try {
      const history = await api.getChartForecastHistory(chartId);
      setForecastHistory(history);
      if (history.active_model_id) {
        const activeModel = history.models.find(m => m.id === history.active_model_id);
        if (activeModel && activeModel.forecast_data) {
          setTrainedResult(activeModel);
        }
      }
    } catch (err) {
      console.error('Failed to load forecast history', err);
    }
  };

  const detectProblem = async (target) => {
    if (!activeProjectId || !target) return;
    try {
      const detection = await api.detectProblemType(activeProjectId, target);
      setProblemDetection(detection);
    } catch (err) {
      console.error('Failed to detect problem type', err);
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
    try {
      const res = await api.aiDecideML({
        dataset_id: activeProjectId,
        category_mode: 'manual',
        ml_category: selectedCategory,
        target_column: targetColumn || undefined,
        target_mode: targetColumn ? 'manual' : 'ai'
      });

      if (res.target_column) {
        setTargetColumn(res.target_column);
      }
      if (res.feature_columns && res.feature_columns.length > 0) {
        setFeatureColumns(res.feature_columns);
      }

      if (res.correlations) {
        setCorrelationData({
          target_column: res.target_column,
          correlations: res.correlations || [],
          pairwise_matrix: res.pairwise_matrix,
          eligible_columns: res.eligible_columns || []
        });
      }

      // Match technique
      if (res.algorithm && techniques.length > 0) {
        const matched = techniques.find(t =>
          t.name.toLowerCase().includes(res.algorithm.toLowerCase()) ||
          res.algorithm.toLowerCase().includes(t.name.toLowerCase())
        );
        if (matched) {
          setSelectedTechnique(matched);
          setHyperparameters(res.hyperparameters || matched.default_hyperparameters || {});
        }
      }

      setAiBuildSummary(res.reasoning || null);
      setModelName(`${activeProject?.name || 'Project'} AI ${res.algorithm || activeCategoryMeta.name} Model`);
    } catch (err) {
      console.error('AI Decide failed', err);
      alert(`AI Build error: ${err.message}`);
    } finally {
      setLoadingAIDecide(false);
    }
  };

  const handleSuggestBestMethod = async () => {
    if (!activeProjectId) return;
    setLoadingRecommend(true);
    setRecommendation(null);
    try {
      const rec = await api.recommendMLMethod({
        dataset_id: activeProjectId,
        target_column: targetColumn || undefined,
        problem_type: selectedCategory,
        feature_columns: featureColumns,
        model: settings?.model
      });
      setRecommendation(rec);

      if (rec?.recommendation && techniques.length > 0) {
        const found = techniques.find(t =>
          t.name.toLowerCase().includes(rec.recommendation.toLowerCase()) ||
          rec.recommendation.toLowerCase().includes(t.name.toLowerCase())
        );
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

  // ── Train Model Execution ─────────────────────────────────────
  const handleTrainModel = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!activeProjectId || !selectedTechnique) return;

    if (selectedCategory !== 'forecasting' && featureColumns.length === 0) {
      setTrainingError('Please select at least one input feature column.');
      return;
    }
    if ((selectedCategory === 'regression' || selectedCategory === 'classification') && !targetColumn) {
      setTrainingError(`Target column is required for ${activeCategoryMeta.name}.`);
      return;
    }
    if (selectedCategory === 'forecasting' && !targetColumn) {
      setTrainingError('Target metric column is required for Forecasting.');
      return;
    }

    setTraining(true);
    setTrainingError('');
    setTrainedResult(null);

    try {
      // Build training configuration payload
      const payload = {
        dataset_id: activeProjectId,
        source_visualization_ids: selectedVisualizationIds,
        model_name: modelName || `${selectedTechnique.name} Model`,
        problem_type: selectedCategory,
        target_column: targetColumn || undefined,
        date_column: dateColumn || undefined,
        forecast_horizon: trainConfig.forecast_horizon,
        feature_columns: selectedCategory === 'forecasting' ? [targetColumn, ...featureColumns.filter(c => c !== targetColumn)] : featureColumns,
        ignored_columns: availableColumns.filter(c => c !== targetColumn && !featureColumns.includes(c)),
        algorithm: selectedTechnique.name,
        hyperparameters: hyperparameters,
        train_config: {
          ...trainConfig,
          n_clusters: trainConfig.n_clusters,
          contamination: trainConfig.contamination,
          imbalance_handling: trainConfig.imbalance_handling,
          forecast_horizon: trainConfig.forecast_horizon
        }
      };

      const result = await api.trainModel(payload);
      setTrainedResult(result);
      await refreshProjectTree();
      selectModel(result);
    } catch (err) {
      setTrainingError(err.message || 'Training failed');
    } finally {
      setTraining(false);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── 1. Top Header & ML Paradigm Overview ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-black tracking-tight">ML Training Studio</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Project: <strong className="text-violet-600 dark:text-violet-400">{activeProject.name}</strong> • Select an ML category below to configure models, preprocessing, parameters &amp; evaluation.
          </p>
        </div>

        {/* Global AI Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(selectedCategory === 'regression' || selectedCategory === 'classification') && (
            <button
              type="button"
              onClick={() => handleCreateCorrelationMatrix()}
              disabled={loadingCorrelation || loadingAIDecide}
              className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-1.5 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              title="Calculate feature correlation matrix"
            >
              {loadingCorrelation ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" /> : <Grid className="w-3.5 h-3.5 text-violet-500" />}
              <span>{showCorrelationSection ? 'Refresh Matrix' : 'Correlation Matrix'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleBuildUsingAI}
            disabled={loadingAIDecide || loadingCorrelation}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black flex items-center space-x-2 shadow-lg shadow-violet-900/30 ring-2 ring-violet-400/40 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            title={`Automatically configure optimal ${activeCategoryMeta.name} model using AI`}
          >
            {loadingAIDecide ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />}
            <span>Build with AI ({activeCategoryMeta.name})</span>
          </button>
        </div>
      </div>

      {/* ── 2. Five Prominent ML Category Selector Cards ────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black tracking-wider uppercase text-slate-400 block">
            Select Machine Learning Training Paradigm:
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            Category: <strong className={activeCategoryMeta.colorClasses.text}>{activeCategoryMeta.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ML_CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative select-none flex flex-col justify-between ${
                  isSelected
                    ? `${cat.colorClasses.activeBg} ${cat.colorClasses.activeBorder} shadow-md`
                    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isSelected ? cat.colorClasses.indicator : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full ${cat.colorClasses.badgeBg}`}>
                      {cat.badge}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400">{idx + 1}.</span>
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">{cat.name}</h3>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-bold">
                    <span className={cat.colorClasses.text}>Active Mode</span>
                    <Check className={`w-3.5 h-3.5 ${cat.colorClasses.text}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Build Summary Banner if triggered */}
      {aiBuildSummary && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-purple-50/50 to-indigo-50/30 dark:from-violet-950/40 dark:via-purple-950/20 dark:to-slate-900 border border-violet-200 dark:border-violet-800/80 space-y-3 animate-fadeIn text-xs shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                AI Configuration Applied ({activeCategoryMeta.name})
              </h4>
            </div>
            <button type="button" onClick={() => setAiBuildSummary(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">{aiBuildSummary.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-violet-100 dark:border-slate-700">
              <span className="font-extrabold uppercase text-[10px] text-violet-500 block">Target / Scope</span>
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

      {/* Selected Chart Notice if any chart selected */}
      {selectedVisObjects.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-3 animate-fadeIn text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200">
                {selectedVisObjects.length} Chart Selected: <span className="underline">{selectedVisObjects[0].title}</span>
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                X: {selectedVisObjects[0].x_variable || '—'} • Y: {selectedVisObjects[0].y_variable || '—'}
                {selectedCategory === 'forecasting' ? ' • Auto-linked for time-series forecasting' : ' • You can train any ML category on this project'}
              </p>
            </div>
          </div>
          <button onClick={clearSelectedVisualizations} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100/50">
            Clear Selection
          </button>
        </div>
      )}

      {/* ── 3. Step 1: Target & Feature Selection (Category Specific) ─ */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className={`w-5 h-5 rounded-full ${activeCategoryMeta.colorClasses.indicator} text-[11px] flex items-center justify-center font-bold`}>
              1
            </span>
            <span>
              {selectedCategory === 'segmentation' ? 'Feature Matrix (Unsupervised — No Target Needed)'
                : selectedCategory === 'anomaly_detection' ? 'Features to Monitor & Optional Ground-Truth Target'
                : selectedCategory === 'forecasting' ? 'Time Dimension & Continuous Metric to Forecast'
                : 'Target Outcome & Input Feature Selection'}
            </span>
          </h3>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setFeatureColumns(availableColumns.filter(c => c !== targetColumn))}
              className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Select All Features
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            {columnTypes.numeric.length > 0 && (
              <>
                <button
                  onClick={() => setFeatureColumns(columnTypes.numeric.filter(c => c !== targetColumn))}
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Numeric Only
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
              </>
            )}
            <button
              onClick={() => setFeatureColumns([])}
              className="font-semibold text-slate-500 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Category-Specific Target / Dimension Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Target / Dimension selector */}
          {selectedCategory === 'regression' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex items-center justify-between">
                <span>Target Continuous Metric to Predict:</span>
                <span className="text-[10px] text-blue-500 font-bold uppercase">Continuous Numeric</span>
              </label>
              <select
                value={targetColumn}
                onChange={(e) => handleTargetChange(e.target.value)}
                className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a continuous target column...</option>
                {columnTypes.numeric.map(col => (
                  <option key={col} value={col}>{col} (numeric)</option>
                ))}
                {availableColumns.filter(c => !columnTypes.numeric.includes(c)).map(col => (
                  <option key={col} value={col}>{col} ({activeProject.column_metadata?.[col]?.data_type || 'col'})</option>
                ))}
              </select>
            </div>
          )}

          {selectedCategory === 'classification' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex items-center justify-between">
                <span>Target Outcome Class to Predict:</span>
                <span className="text-[10px] text-violet-500 font-bold uppercase">Categorical / Binary</span>
              </label>
              <select
                value={targetColumn}
                onChange={(e) => handleTargetChange(e.target.value)}
                className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select categorical target column...</option>
                {columnTypes.categorical.map(col => (
                  <option key={col} value={col}>{col} ({activeProject.column_metadata?.[col]?.unique_count || 0} classes)</option>
                ))}
                {availableColumns.filter(c => !columnTypes.categorical.includes(c)).map(col => (
                  <option key={col} value={col}>{col} ({activeProject.column_metadata?.[col]?.data_type || 'col'})</option>
                ))}
              </select>
            </div>
          )}

          {selectedCategory === 'forecasting' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex items-center justify-between">
                  <span>Chronological Time / Date Column:</span>
                  <span className="text-[10px] text-orange-500 font-bold uppercase">Timestamp / Date</span>
                </label>
                <select
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select datetime column...</option>
                  {columnTypes.datetime.map(col => (
                    <option key={col} value={col}>{col} (datetime)</option>
                  ))}
                  {availableColumns.filter(c => !columnTypes.datetime.includes(c)).map(col => (
                    <option key={col} value={col}>{col} ({activeProject.column_metadata?.[col]?.data_type || 'col'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex items-center justify-between">
                  <span>Target Value to Forecast:</span>
                  <span className="text-[10px] text-orange-500 font-bold uppercase">Numerical Metric</span>
                </label>
                <select
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select continuous metric...</option>
                  {columnTypes.numeric.map(col => (
                    <option key={col} value={col}>{col} (numeric)</option>
                  ))}
                  {availableColumns.filter(c => !columnTypes.numeric.includes(c)).map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {selectedCategory === 'segmentation' && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 md:col-span-2 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Unsupervised Segmentation (No Target Variable Required)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Data clustering groups rows by multivariate distance patterns. Select the behavioral, transaction, or demographic feature columns below to discover natural cohort profiles.
              </p>
            </div>
          )}

          {selectedCategory === 'anomaly_detection' && (
            <>
              <div className="space-y-1.5 md:col-span-2">
                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 space-y-1 mb-2">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Unsupervised / Semi-Supervised Anomaly Detection</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Isolates statistical anomalies, rare operational deviations, and extreme spikes across the selected feature matrix.
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <label>Optional Ground-Truth Verification Target (Benchmark Evaluation):</label>
                  <span className="text-[10px] text-slate-400">Optional</span>
                </div>
                <select
                  value={groundTruthColumn}
                  onChange={(e) => setGroundTruthColumn(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="">None (Pure Unsupervised Anomaly Detection)</option>
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col} ({activeProject.column_metadata?.[col]?.data_type || 'col'})</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Target Summary Badge if detected */}
          {problemDetection && selectedCategory !== 'segmentation' && selectedCategory !== 'forecasting' && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Detected:</span>
                <span className="font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-300 dark:border-emerald-700">
                  {problemDetection.problem_type}
                </span>
                {problemDetection.sub_type && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    {problemDetection.sub_type}
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2">{problemDetection.reason}</p>
            </div>
          )}
        </div>

        {/* Feature Matrix Selector Grid */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Input Feature Columns ({featureColumns.length} selected of {availableColumns.length}):
            </label>
            <span className="text-[11px] text-slate-400">Click column badge to toggle</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto p-1 rounded-xl">
            {availableColumns.map((col) => {
              const isTarget = col === targetColumn || (selectedCategory === 'forecasting' && col === dateColumn);
              const isSelected = featureColumns.includes(col);
              const colType = activeProject?.column_metadata?.[col]?.data_type || 'cat';
              const corrItem = (correlationData.correlations || []).find(c => c.feature === col);

              return (
                <div
                  key={col}
                  onClick={() => !isTarget && toggleFeature(col)}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer select-none transition-all flex flex-col justify-between ${
                    isTarget
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 cursor-not-allowed opacity-90'
                      : isSelected
                      ? `${activeCategoryMeta.colorClasses.activeBg} ${activeCategoryMeta.colorClasses.activeBorder} ${activeCategoryMeta.colorClasses.text} shadow-xs font-semibold`
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      colType === 'numerical'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                        : colType === 'datetime'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                    }`}>
                      {colType}
                    </span>
                    {isTarget ? (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                        {col === dateColumn ? 'DATE' : 'TARGET'}
                      </span>
                    ) : isSelected ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : null}
                  </div>
                  <div>
                    <span className="font-bold truncate block" title={col}>{col}</span>
                    {corrItem && !isTarget && (
                      <span className={`text-[10px] font-mono font-bold block mt-0.5 ${
                        corrItem.correlation >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'
                      }`}>
                        r = {corrItem.correlation >= 0 ? '+' : ''}{corrItem.correlation.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Correlation Section if open */}
        {showCorrelationSection && (
          <CorrelationMatrixView
            targetColumn={targetColumn}
            correlations={correlationData.correlations}
            pairwiseMatrix={correlationData.pairwise_matrix}
            eligibleColumns={correlationData.eligible_columns}
            selectedFeatures={featureColumns}
            onToggleFeature={toggleFeature}
            onBatchSelectFeatures={(list) => setFeatureColumns(list.filter(c => c !== targetColumn))}
            loading={loadingCorrelation}
            onRecalculate={() => handleCreateCorrelationMatrix()}
          />
        )}
      </div>

      {/* ── 4. Step 2: Preprocessing Options (Category Specific) ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold flex items-center space-x-2">
          <span className={`w-5 h-5 rounded-full ${activeCategoryMeta.colorClasses.indicator} text-[11px] flex items-center justify-center font-bold`}>
            2
          </span>
          <span>Preprocessing &amp; Feature Transformations ({activeCategoryMeta.name})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          
          {/* Feature Scaling */}
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Feature Scaling</label>
            <select
              value={trainConfig.scaling}
              onChange={(e) => setTrainConfig({ ...trainConfig, scaling: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              <option value="standard">StandardScaler (Mean 0, Std 1)</option>
              <option value="robust">RobustScaler (Median / IQR — Outlier-Resistant)</option>
              <option value="minmax">MinMaxScaler (0 to 1 Normalization)</option>
            </select>
            <span className="text-[10px] text-slate-400 block mt-1">
              {selectedCategory === 'anomaly_detection' ? 'RobustScaler recommended for anomaly isolation' : 'StandardScaler recommended for distance-based ML'}
            </span>
          </div>

          {/* Missing Value Imputation */}
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Missing Value Imputation</label>
            <select
              value={trainConfig.imputation}
              onChange={(e) => setTrainConfig({ ...trainConfig, imputation: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              <option value="median">Median (Numeric) / Mode (Categorical)</option>
              <option value="mean">Mean (Numeric) / Mode (Categorical)</option>
              <option value="most_frequent">Most Frequent (Mode)</option>
            </select>
          </div>

          {/* Category-Specific Preprocessing Options */}
          {selectedCategory === 'classification' && (
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Class Imbalance Handling</label>
              <select
                value={trainConfig.imbalance_handling}
                onChange={(e) => setTrainConfig({ ...trainConfig, imbalance_handling: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              >
                <option value="none">Standard Uniform Weights</option>
                <option value="balanced">Balanced Class Weights (Weighted Loss)</option>
              </select>
            </div>
          )}

          {selectedCategory === 'regression' && (
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Outlier Clipping / Filtering</label>
              <select
                value={trainConfig.outlier_handling}
                onChange={(e) => setTrainConfig({ ...trainConfig, outlier_handling: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              >
                <option value="none">Retain Full Range</option>
                <option value="clip_iqr">Clip at 1.5x IQR Outer Bounds</option>
                <option value="clip_percentile">Winsorize 1st / 99th Percentiles</option>
              </select>
            </div>
          )}

          {selectedCategory === 'forecasting' && (
            <>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Lag Window Steps</label>
                <select
                  value={trainConfig.lag_window}
                  onChange={(e) => setTrainConfig({ ...trainConfig, lag_window: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value={3}>3 Historical Lags</option>
                  <option value={7}>7 Historical Lags (Weekly)</option>
                  <option value={12}>12 Historical Lags (Annual/Monthly)</option>
                  <option value={24}>24 Historical Lags</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Forecast Horizon</label>
                <select
                  value={trainConfig.forecast_horizon}
                  onChange={(e) => setTrainConfig({ ...trainConfig, forecast_horizon: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value={3}>3 Future Periods</option>
                  <option value={6}>6 Future Periods</option>
                  <option value={12}>12 Future Periods</option>
                  <option value={24}>24 Future Periods</option>
                </select>
              </div>
            </>
          )}

          {selectedCategory === 'segmentation' && (
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Target Clusters (K): {trainConfig.n_clusters}</label>
              <input
                type="range"
                min="2"
                max="8"
                step="1"
                value={trainConfig.n_clusters}
                onChange={(e) => setTrainConfig({ ...trainConfig, n_clusters: parseInt(e.target.value) })}
                className="w-full mt-2 accent-emerald-600"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Select 2 to 8 cohort groups</span>
            </div>
          )}

          {selectedCategory === 'anomaly_detection' && (
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Contamination Rate: {Math.round(trainConfig.contamination * 100)}%
              </label>
              <input
                type="range"
                min="0.01"
                max="0.15"
                step="0.01"
                value={trainConfig.contamination}
                onChange={(e) => setTrainConfig({ ...trainConfig, contamination: parseFloat(e.target.value) })}
                className="w-full mt-2 accent-rose-600"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Expected proportion of outliers</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Step 3: Models Library (Category Specific) ───────── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className={`w-5 h-5 rounded-full ${activeCategoryMeta.colorClasses.indicator} text-[11px] flex items-center justify-center font-bold`}>
              3
            </span>
            <span>{activeCategoryMeta.name} Algorithm Library ({techniques.length} models)</span>
          </h3>

          <button
            type="button"
            onClick={handleSuggestBestMethod}
            disabled={loadingRecommend}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loadingRecommend ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Suggest Best {activeCategoryMeta.name} Method (AI)</span>
          </button>
        </div>

        {/* AI Recommendation Banner */}
        {recommendation && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50/50 to-slate-50 dark:from-violet-950/40 dark:via-indigo-950/20 dark:to-slate-900 border border-violet-200 dark:border-violet-800/80 space-y-2 text-xs animate-fadeIn">
            <span className="font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
              AI Recommendation: {recommendation.recommendation} ({recommendation.suitability_score}% suitability)
            </span>
            <p className="text-slate-600 dark:text-slate-300">{recommendation.reasoning}</p>
          </div>
        )}

        {/* Model Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {techniques.map((tech) => {
            const isSelected = selectedTechnique?.id === tech.id;
            return (
              <div
                key={tech.id}
                onClick={() => {
                  setSelectedTechnique(tech);
                  setHyperparameters(tech.default_hyperparameters || {});
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? `${activeCategoryMeta.colorClasses.activeBg} ${activeCategoryMeta.colorClasses.activeBorder} shadow-md`
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tech.category}
                    </span>
                    {isSelected && <CheckCircle2 className={`w-4 h-4 ${activeCategoryMeta.colorClasses.text}`} />}
                  </div>
                  <h4 className="text-xs font-bold mb-1">{tech.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {tech.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6. Step 4: Training Parameters & Execution Form ─────── */}
      <form onSubmit={handleTrainModel} className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-sm font-bold flex items-center space-x-2">
          <span className={`w-5 h-5 rounded-full ${activeCategoryMeta.colorClasses.indicator} text-[11px] flex items-center justify-center font-bold`}>
            4
          </span>
          <span>Training Parameters &amp; Execution</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold"
              required
            />
          </div>

          {(selectedCategory === 'regression' || selectedCategory === 'classification') && (
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Train / Test Split: {Math.round(trainConfig.test_size * 100)}% Test
              </label>
              <input
                type="range"
                min="0.1"
                max="0.4"
                step="0.05"
                value={trainConfig.test_size}
                onChange={(e) => setTrainConfig({ ...trainConfig, test_size: parseFloat(e.target.value) })}
                className="w-full mt-2 accent-violet-600"
              />
            </div>
          )}

          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Random Seed</label>
            <input
              type="number"
              value={trainConfig.random_state}
              onChange={(e) => setTrainConfig({ ...trainConfig, random_state: parseInt(e.target.value) || 42 })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        {trainingError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{trainingError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={training || !selectedTechnique}
          className={`w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r ${activeCategoryMeta.colorClasses.gradient} text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer`}
        >
          {training ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Training {activeCategoryMeta.name} Model ({selectedTechnique?.name})...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>Train {activeCategoryMeta.name} Model ({selectedTechnique?.name || 'Selected Algorithm'})</span>
            </>
          )}
        </button>
      </form>

      {/* ── 7. Step 5: Live Trained Results & Category Visuals ──── */}
      {trainedResult && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Training Completed: {trainedResult.model_name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Algorithm: <strong>{trainedResult.algorithm}</strong> • Runtime: {trainedResult.training_time_seconds}s
              </p>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
              Active Experiment Ready
            </span>
          </div>

          {/* Results Display by Category */}
          {/* A. Regression Results */}
          {selectedCategory === 'regression' && trainedResult.metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">R² Score</span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{trainedResult.metrics.r2_score ?? '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAE</span>
                  <span className="text-xl font-bold">{trainedResult.metrics.mae ?? '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">RMSE</span>
                  <span className="text-xl font-bold">{trainedResult.metrics.rmse ?? '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Samples (Train/Test)</span>
                  <span className="text-xl font-bold">{trainedResult.metrics.train_samples} / {trainedResult.metrics.test_samples}</span>
                </div>
              </div>

              {trainedResult.metrics.pred_vs_actual_sample && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <span className="font-bold block">Actual vs. Predicted Sample Observations:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {trainedResult.metrics.pred_vs_actual_sample.slice(0, 6).map((pair, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Obs #{idx + 1}</span>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Act: {pair.actual.toFixed(2)}</div>
                        <div className="text-[11px] font-black text-blue-600 dark:text-blue-400">Pred: {pair.predicted.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* B. Classification Results */}
          {selectedCategory === 'classification' && trainedResult.metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Accuracy</span>
                  <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
                    {trainedResult.metrics.accuracy ? `${(trainedResult.metrics.accuracy * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">F1 Score</span>
                  <span className="text-xl font-bold">{trainedResult.metrics.f1_score ?? '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Precision</span>
                  <span className="text-xl font-bold">{trainedResult.metrics.precision ?? '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Recall</span>
                  <span className="text-xl font-bold">{trainedResult.metrics.recall ?? '—'}</span>
                </div>
              </div>

              {trainedResult.metrics.confusion_matrix && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <span className="font-bold block">Confusion Matrix:</span>
                  <div className="overflow-x-auto">
                    <table className="text-center font-mono text-[11px] border-collapse">
                      <tbody>
                        {trainedResult.metrics.confusion_matrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="p-1.5 font-bold text-slate-400 text-[10px]">Actual {trainedResult.metrics.classes?.[rIdx] || rIdx}</td>
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold min-w-16">
                                {val}
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
          )}

          {/* C. Forecasting Results */}
          {selectedCategory === 'forecasting' && trainedResult.forecast_data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAPE Error</span>
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                    {trainedResult.metrics?.mape != null ? `${trainedResult.metrics.mape.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">RMSE</span>
                  <span className="text-xl font-bold">{trainedResult.metrics?.rmse ? trainedResult.metrics.rmse.toFixed(2) : '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAE</span>
                  <span className="text-xl font-bold">{trainedResult.metrics?.mae ? trainedResult.metrics.mae.toFixed(2) : '—'}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Forecast Horizon</span>
                  <span className="text-xl font-bold">{trainedResult.forecast_horizon || trainConfig.forecast_horizon} periods</span>
                </div>
              </div>

              <ForecastVisualization forecastData={trainedResult.forecast_data} metrics={trainedResult.metrics} />
            </div>
          )}

          {/* D. Segmentation Results */}
          {selectedCategory === 'segmentation' && trainedResult.metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Silhouette Score</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {trainedResult.metrics.silhouette_score ?? 'N/A'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Clusters</span>
                  <span className="text-2xl font-black">{trainedResult.metrics.num_clusters}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Clustered Samples</span>
                  <span className="text-2xl font-black">{trainedResult.metrics.total_samples}</span>
                </div>
              </div>

              {/* Cluster distribution */}
              {trainedResult.metrics.cluster_distribution && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <span className="font-bold block">Cluster Size Breakdown:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(trainedResult.metrics.cluster_distribution).map(([cName, info]) => (
                      <div key={cName} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">{cName}</span>
                        <div className="text-lg font-black mt-0.5">{info.count || info} items</div>
                        {info.percentage != null && (
                          <div className="text-[10px] text-emerald-600 font-bold">{info.percentage}% of dataset</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2D PCA Scatter plot */}
              {trainedResult.metrics.pca_2d_sample?.length > 0 && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold block">2D PCA Cluster Spatial Separation:</span>
                  <ClusterScatterVisualization pcaPoints={trainedResult.metrics.pca_2d_sample} clusterDistribution={trainedResult.metrics.cluster_distribution} />
                </div>
              )}

              {/* Segment Profiles */}
              {trainedResult.metrics.segment_profiles?.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <span className="font-bold block">Segment Feature Means Profile:</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px]">
                          <th className="py-2">Feature</th>
                          <th className="py-2">Overall Mean</th>
                          {Object.keys(trainedResult.metrics.cluster_distribution).map(c => (
                            <th key={c} className="py-2">{c} Mean</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trainedResult.metrics.segment_profiles.map((p, idx) => (
                          <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50">
                            <td className="py-2 font-bold">{p.feature}</td>
                            <td className="py-2 font-mono text-slate-500">{p.overall_mean}</td>
                            {Object.entries(p.cluster_means).map(([cName, cVal]) => (
                              <td key={cName} className="py-2 font-mono font-semibold">
                                {cVal.mean}
                                {cVal.diff_pct !== 0 && (
                                  <span className={`text-[10px] ml-1 font-bold ${cVal.diff_pct > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    ({cVal.diff_pct > 0 ? '+' : ''}{cVal.diff_pct}%)
                                  </span>
                                )}
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
          )}

          {/* E. Anomaly Detection Results */}
          {selectedCategory === 'anomaly_detection' && trainedResult.metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Outliers Detected</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{trainedResult.metrics.anomaly_count}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Anomaly Rate</span>
                  <span className="text-2xl font-black">{trainedResult.metrics.anomaly_percentage}%</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Inliers (Normal)</span>
                  <span className="text-2xl font-black">{trainedResult.metrics.inlier_count}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Evaluated</span>
                  <span className="text-2xl font-black">{trainedResult.metrics.total_samples}</span>
                </div>
              </div>

              {trainedResult.metrics.top_anomalies?.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <span className="font-bold block">Top Detected Outliers &amp; Anomalous Observations:</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px]">
                          <th className="py-2">Row #</th>
                          <th className="py-2">Anomaly Score</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Sample Feature Values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainedResult.metrics.top_anomalies.slice(0, 10).map((anom, idx) => (
                          <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50">
                            <td className="py-2 font-mono font-bold">#{anom.row_index}</td>
                            <td className="py-2 font-mono font-black text-rose-600 dark:text-rose-400">{anom.anomaly_score}</td>
                            <td className="py-2">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                                {anom.status}
                              </span>
                            </td>
                            <td className="py-2 text-[10px] font-mono text-slate-500">
                              {Object.entries(anom.values || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feature Importances if available */}
          {trainedResult.feature_importances && trainedResult.feature_importances.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-bold block">Top Feature Importances:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {trainedResult.feature_importances.slice(0, 8).map((imp) => (
                  <div key={imp.feature} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-bold truncate block">{imp.feature}</span>
                    <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 font-bold">
                      {(imp.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
