import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import ChartTab from '../components/ChartTab';
import MarkdownRenderer from '../components/MarkdownRenderer';
import CorrelationMatrixView from '../components/CorrelationMatrixView';
import {
  BrainCircuit, Sparkles, CheckCircle2, AlertTriangle,
  Play, RefreshCw, ArrowRight, BarChart3,
  Check, X, Grid
} from 'lucide-react';

export default function MLTrainingPage() {
  const {
    activeDataset, selectedVisForML, setActiveTab,
    setActiveExperiment, settings
  } = useChatStore();

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

  // LLM Recommendation State
  const [recommendation, setRecommendation] = useState(null);
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  // Training State
  const [modelName, setModelName] = useState('');
  const [training, setTraining] = useState(false);
  const [trainingError, setTrainingError] = useState('');
  const [trainingResult, setTrainingResult] = useState(null);

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

  const availableColumns = Object.keys(activeDataset?.column_metadata || {});

  // Categorize columns for target selection
  const categoricalCols = availableColumns.filter(c => {
    const dt = activeDataset?.column_metadata?.[c]?.data_type;
    return dt === 'categorical' || dt === 'boolean';
  });
  const numericalCols = availableColumns.filter(c => {
    const dt = activeDataset?.column_metadata?.[c]?.data_type;
    return dt === 'numerical';
  });

  // Initialize target and features from active dataset or selected visualization
  useEffect(() => {
    if (activeDataset && availableColumns.length > 0) {
      // 1. If visualization was carried, use its Y variable as initial target candidate
      let initialTarget = '';
      if (selectedVisForML?.y_variable && availableColumns.includes(selectedVisForML.y_variable)) {
        initialTarget = selectedVisForML.y_variable;
      } else {
        // 2. Look for common target keywords
        const targetKeywords = ['churn', 'target', 'label', 'class', 'status', 'fraud', 'default', 'price', 'sales', 'revenue', 'salary', 'outcome', 'total', 'profit', 'is_'];
        const matched = availableColumns.find(c => targetKeywords.some(k => c.toLowerCase().includes(k)));
        if (matched) {
          initialTarget = matched;
        } else if (categoricalCols.length > 0) {
          initialTarget = categoricalCols[categoricalCols.length - 1];
        } else if (numericalCols.length > 0) {
          initialTarget = numericalCols[numericalCols.length - 1];
        } else if (availableColumns.length > 1) {
          initialTarget = availableColumns[availableColumns.length - 1];
        }
      }

      setTargetColumn(initialTarget);
      const initialFeatures = availableColumns.filter(c => c !== initialTarget);
      setFeatureColumns(initialFeatures);
      setModelName(`${activeDataset.name} ML Model`);

      // Trigger initial problem detection
      detectProblem(initialTarget);
    }
  }, [activeDataset?.id, selectedVisForML]);

  const detectProblem = async (target, forcedProblemType = null) => {
    if (!activeDataset?.id) return;
    try {
      if (forcedProblemType) {
        setProblemDetection({
          problem_type: forcedProblemType,
          target_column: target || null,
          reason: `Manually set to ${forcedProblemType.toUpperCase()}`
        });
        loadTechniques(forcedProblemType);
        return;
      }
      const detection = await api.detectProblemType(activeDataset.id, target || undefined);
      setProblemDetection(detection);
      loadTechniques(detection.problem_type);
    } catch (err) {
      console.error('Failed to detect problem type', err);
      // Graceful fallback
      const fallbackType = target ? (numericalCols.includes(target) ? 'regression' : 'classification') : 'clustering';
      setProblemDetection({
        problem_type: fallbackType,
        target_column: target || null,
        reason: target ? `Defaulted to ${fallbackType} for ${target}` : 'Clustering for unsupervised data.'
      });
      loadTechniques(fallbackType);
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

  // ── Correlation Matrix Calculation Handler ─────────────────
  const handleCreateCorrelationMatrix = async (targetOverride = null) => {
    if (!activeDataset?.id) return;
    const targetToUse = targetOverride !== null ? targetOverride : targetColumn;
    setLoadingCorrelation(true);
    setShowCorrelationSection(true);
    try {
      const res = await api.getTargetCorrelation({
        dataset_id: activeDataset.id,
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

  // ── Build Using AI Handler ──────────────────────────────────
  const handleBuildUsingAI = async () => {
    if (!activeDataset?.id) return;
    setLoadingAIDecide(true);
    setAiBuildSummary(null);
    setShowCorrelationSection(true);
    try {
      const res = await api.aiDecideML({
        dataset_id: activeDataset.id,
        target_column: targetColumn || undefined,
        target_mode: targetColumn ? 'manual' : 'ai'
      });

      const chosenTarget = res.target_column;
      setTargetColumn(chosenTarget);
      setFeatureColumns(res.feature_columns || []);

      // Problem detection update
      setProblemDetection({
        problem_type: res.ml_category,
        target_column: chosenTarget,
        reason: res.reasoning?.target_reason || `Auto-detected ${res.ml_category}`
      });

      // Load techniques and match recommended algorithm
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

      // Set correlation matrix
      setCorrelationData({
        target_column: chosenTarget,
        correlations: res.correlations || [],
        pairwise_matrix: res.pairwise_matrix,
        eligible_columns: res.eligible_columns || []
      });

      setAiBuildSummary(res.reasoning || null);
      setModelName(`${activeDataset?.name || 'Dataset'} AI ${res.algorithm} Model`);
    } catch (err) {
      console.error('AI Decide failed', err);
      alert(`AI Build error: ${err.message}`);
    } finally {
      setLoadingAIDecide(false);
    }
  };

  const handleTargetChange = (newTarget) => {
    setTargetColumn(newTarget);
    // Remove new target from selected features
    setFeatureColumns(prev => prev.filter(c => c !== newTarget));
    detectProblem(newTarget);
    setRecommendation(null);
    // If correlation matrix is visible, auto-refresh correlations with new target
    if (showCorrelationSection) {
      handleCreateCorrelationMatrix(newTarget);
    }
  };

  const handleProblemTypeOverride = (newType) => {
    detectProblem(targetColumn, newType);
    setRecommendation(null);
  };

  const toggleFeature = (col) => {
    if (featureColumns.includes(col)) {
      setFeatureColumns(prev => prev.filter(c => c !== col));
    } else {
      setFeatureColumns(prev => [...prev, col]);
    }
  };

  const handleSelectAllFeatures = () => {
    setFeatureColumns(availableColumns.filter(c => c !== targetColumn));
  };

  const handleDeselectAllFeatures = () => {
    setFeatureColumns([]);
  };

  // AI Recommendation Trigger
  const handleSuggestBestMethod = async () => {
    if (!activeDataset?.id || !problemDetection) return;
    setLoadingRecommend(true);
    setRecommendation(null);
    try {
      const rec = await api.recommendMLMethod({
        dataset_id: activeDataset.id,
        target_column: targetColumn || undefined,
        problem_type: problemDetection.problem_type,
        feature_columns: featureColumns,
        model: settings?.model
      });
      setRecommendation(rec);

      // Auto-select recommended technique if matched
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

  // Model Training Execution
  const handleTrainModel = async (e) => {
    e.preventDefault();
    if (!activeDataset?.id || !selectedTechnique) return;
    if (featureColumns.length === 0) {
      setTrainingError('Please select at least one input feature column.');
      return;
    }

    setTraining(true);
    setTrainingError('');
    setTrainingResult(null);

    try {
      const result = await api.trainModel({
        dataset_id: activeDataset.id,
        visualization_id: selectedVisForML?.id || undefined,
        model_name: modelName || `${selectedTechnique.name} Model`,
        problem_type: problemDetection.problem_type,
        target_column: targetColumn || undefined,
        feature_columns: featureColumns,
        ignored_columns: availableColumns.filter(c => c !== targetColumn && !featureColumns.includes(c)),
        algorithm: selectedTechnique.name,
        hyperparameters: hyperparameters,
        train_config: trainConfig
      });

      setTrainingResult(result);
      setActiveExperiment(result);
    } catch (err) {
      setTrainingError(err.message || 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  if (!activeDataset) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <BrainCircuit className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold">No Active Dataset Selected</h3>
        <p className="text-xs text-slate-400">Please upload or select a CSV dataset in Step 1 before configuring ML training.</p>
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Top Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-bold">Machine Learning Workspace</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Step 3: Select target &amp; features, review correlations, request AI recommendations, and train reproducible models.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleCreateCorrelationMatrix()}
            disabled={loadingCorrelation || loadingAIDecide}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            title="Generate pairwise and target correlation heatmap matrix"
          >
            {loadingCorrelation ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
            ) : (
              <Grid className="w-3.5 h-3.5 text-violet-500" />
            )}
            <span>Create Correlation Matrix</span>
          </button>

          <button
            type="button"
            onClick={handleBuildUsingAI}
            disabled={loadingAIDecide || loadingCorrelation}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black flex items-center space-x-2 shadow-lg shadow-violet-900/30 ring-2 ring-violet-400/40 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            title="Automatically select target, evaluate correlations, pick highest-signal features, and configure optimal model"
          >
            {loadingAIDecide ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            )}
            <span>Build using AI</span>
          </button>
        </div>
      </div>

      {/* ── AI Build Activated Summary Banner ─────────────────────── */}
      {aiBuildSummary && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-purple-50/50 to-indigo-50/30 dark:from-violet-950/40 dark:via-purple-950/20 dark:to-slate-900 border border-violet-200 dark:border-violet-800/80 space-y-3 animate-fadeIn text-xs shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                AI Build Activated &amp; Configured
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setAiBuildSummary(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">
            {aiBuildSummary.summary}
          </p>

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

      {/* ── Carried Visualization Context Banner ─────────────────── */}
      {selectedVisForML && (
        <div className="p-4 rounded-2xl bg-violet-50/80 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 block">
                  Active Visualization Context
                </span>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedVisForML.title} ({selectedVisForML.chart_type})
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  X: <strong>{selectedVisForML.x_variable}</strong> • Y: <strong>{selectedVisForML.y_variable || 'N/A'}</strong> {selectedVisForML.group_variable ? `• Group: ${selectedVisForML.group_variable}` : ''}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedVisForML(null)}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Clear Context
            </button>
          </div>

          {/* Quick-Pick Target from Chart Variables */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-violet-200/60 dark:border-violet-800/40">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Set Target from Chart:</span>
            {selectedVisForML.y_variable && availableColumns.includes(selectedVisForML.y_variable) && (
              <button
                type="button"
                onClick={() => handleTargetChange(selectedVisForML.y_variable)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  targetColumn === selectedVisForML.y_variable
                    ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-400'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-violet-500'
                }`}
              >
                🎯 Target Y: {selectedVisForML.y_variable}
              </button>
            )}
            {selectedVisForML.x_variable && availableColumns.includes(selectedVisForML.x_variable) && (
              <button
                type="button"
                onClick={() => handleTargetChange(selectedVisForML.x_variable)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  targetColumn === selectedVisForML.x_variable
                    ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-400'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-violet-500'
                }`}
              >
                🎯 Target X: {selectedVisForML.x_variable}
              </button>
            )}
            {selectedVisForML.group_variable && availableColumns.includes(selectedVisForML.group_variable) && (
              <button
                type="button"
                onClick={() => handleTargetChange(selectedVisForML.group_variable)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  targetColumn === selectedVisForML.group_variable
                    ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-400'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-violet-500'
                }`}
              >
                🎯 Target Group: {selectedVisForML.group_variable}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step A: Target & Problem Type ────────────────────────── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
            <span>Target Column &amp; Problem Type</span>
          </h3>

          <div className="flex items-center space-x-2">
            {!showCorrelationSection && (
              <button
                type="button"
                onClick={() => handleCreateCorrelationMatrix()}
                disabled={loadingCorrelation}
                className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center space-x-1"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Create Correlation Matrix</span>
              </button>
            )}

            {/* Quick Problem Type Switcher */}
            <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              {['classification', 'regression', 'clustering'].map((pt) => {
                const isActive = problemDetection?.problem_type === pt;
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => handleProblemTypeOverride(pt)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                      isActive
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {pt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
              Select Target Column to Predict:
            </label>
            <select
              value={targetColumn}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-200"
            >
              <option value="">None (Clustering / Unsupervised Learning)</option>
              {categoricalCols.length > 0 && (
                <optgroup label="Categorical & Binary Targets (Classification)">
                  {categoricalCols.map(col => (
                    <option key={col} value={col}>
                      {col} ({activeDataset?.column_metadata?.[col]?.data_type})
                    </option>
                  ))}
                </optgroup>
              )}
              {numericalCols.length > 0 && (
                <optgroup label="Numerical Targets (Regression)">
                  {numericalCols.map(col => (
                    <option key={col} value={col}>
                      {col} ({activeDataset?.column_metadata?.[col]?.data_type})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-[11px] text-slate-400">
              Select what to predict. Continuous numbers trigger <strong>Regression</strong>; categories/flags trigger <strong>Classification</strong>; selecting None triggers <strong>Clustering</strong>.
            </p>
          </div>

          {/* Problem Type Auto-Badge */}
          {problemDetection && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Detected Paradigm:</span>
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  {problemDetection.problem_type}
                </span>
                {problemDetection.sub_type && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {problemDetection.sub_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{problemDetection.reason}</p>
              {problemDetection.classes && problemDetection.classes.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] text-slate-400">Target Classes:</span>
                  {problemDetection.classes.map((cls, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-200">
                      {cls}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Correlation Matrix & Signal Explorer ──────────────────── */}
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

      {/* ── Step B: Feature Selection Matrix ─────────────────────── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
            <span>Feature Selection Matrix ({featureColumns.length} selected)</span>
          </h3>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSelectAllFeatures}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={handleDeselectAllFeatures}
              className="text-xs font-semibold text-slate-500 hover:underline"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {availableColumns.map((col) => {
            const isTarget = col === targetColumn;
            const isSelected = featureColumns.includes(col);
            const colType = activeDataset?.column_metadata?.[col]?.data_type || 'cat';
            const corrItem = (correlationData.correlations || []).find(c => c.feature === col);

            return (
              <div
                key={col}
                onClick={() => !isTarget && toggleFeature(col)}
                className={`p-3 rounded-2xl border text-xs cursor-pointer select-none transition-all flex flex-col justify-between ${
                  isTarget
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 cursor-not-allowed opacity-90'
                    : isSelected
                    ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-400 dark:border-violet-600 text-violet-900 dark:text-violet-200 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    colType === 'numerical' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                  }`}>
                    {colType}
                  </span>
                  {isTarget ? (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                      TARGET
                    </span>
                  ) : isSelected ? (
                    <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
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

      {/* ── Step C: Technique Library & AI Suggestion ────────────── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
            <span>
              ML Algorithm Library ({techniques.length} {problemDetection?.problem_type ? problemDetection.problem_type.charAt(0).toUpperCase() + problemDetection.problem_type.slice(1) : ''} Algorithms)
            </span>
          </h3>

          <button
            onClick={handleSuggestBestMethod}
            disabled={loadingRecommend}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-violet-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loadingRecommend ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Suggest Best Training Method (AI)</span>
          </button>
        </div>

        {/* AI Recommendation Box */}
        {recommendation && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50/50 to-slate-50 dark:from-violet-950/40 dark:via-indigo-950/20 dark:to-slate-900 border border-violet-200 dark:border-violet-800/80 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  AI Model Recommendation
                </h4>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-violet-600 text-white">
                Suitability: {recommendation.suitability_score}%
              </span>
            </div>

            <div className="text-xs space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Recommended Model:</span>
              <p className="text-base font-extrabold text-violet-700 dark:text-violet-300">
                {recommendation.recommendation}
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                {recommendation.reasoning}
              </p>
            </div>

            {/* Ranked Models List */}
            {recommendation.ranked_methods && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                {recommendation.ranked_methods.map((rm, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-violet-100 dark:border-slate-700 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span>{rm.algorithm}</span>
                      <span className="text-violet-600 dark:text-violet-400">{rm.suitability}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{rm.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Technique Cards Grid */}
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
                    ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 shadow-md ring-2 ring-violet-500/20'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tech.category}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
                  </div>
                  <h4 className="text-xs font-bold mb-1">{tech.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {tech.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-[10px] space-y-1">
                  {tech.pros && (
                    <span className="text-emerald-600 dark:text-emerald-400 block truncate">
                      ✓ {tech.pros[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step D: Hyperparameters & Train Model ────────────────── */}
      <form onSubmit={handleTrainModel} className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-sm font-bold flex items-center space-x-2">
          <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">4</span>
          <span>Training Configuration & Execution</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Test Split: {Math.round(trainConfig.test_size * 100)}%
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

          <div>
            <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Feature Scaling</label>
            <select
              value={trainConfig.scaling}
              onChange={(e) => setTrainConfig({ ...trainConfig, scaling: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              <option value="standard">StandardScaler (Mean 0, Std 1)</option>
              <option value="robust">RobustScaler (Median / IQR)</option>
              <option value="minmax">MinMaxScaler (0 to 1)</option>
            </select>
          </div>
        </div>

        {trainingError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{trainingError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={training || !selectedTechnique}
          className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {training ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Training Model & Computing Validation Metrics...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>Train Model ({selectedTechnique?.name || 'Selected Algorithm'})</span>
            </>
          )}
        </button>
      </form>

      {/* ── Step E: Training Results Dashboard ──────────────────── */}
      {trainingResult && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-emerald-500/50 shadow-xl space-y-6 animate-fadeIn">
          
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                  Model Trained Successfully: {trainingResult.model_name}
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Algorithm: <strong>{trainingResult.algorithm}</strong> • Trained in {trainingResult.training_time_seconds}s
              </span>
            </div>

            <button
              onClick={() => setActiveTab('testing')}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-violet-900/20 transition-all"
            >
              <span>Proceed to Testing Stage</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trainingResult.problem_type === 'classification' ? (
              <>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Accuracy</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {((trainingResult.metrics?.accuracy || 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">F1 Score</span>
                  <span className="text-2xl font-black">{trainingResult.metrics?.f1_score || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Precision</span>
                  <span className="text-2xl font-black">{trainingResult.metrics?.precision || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Recall</span>
                  <span className="text-2xl font-black">{trainingResult.metrics?.recall || 0}</span>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">R² Score</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {trainingResult.metrics?.r2_score || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">RMSE</span>
                  <span className="text-2xl font-black">{trainingResult.metrics?.rmse || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">MAE</span>
                  <span className="text-2xl font-black">{trainingResult.metrics?.mae || 0}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Test Samples</span>
                  <span className="text-2xl font-black">{trainingResult.metrics?.test_samples || 0}</span>
                </div>
              </>
            )}
          </div>

          {/* Feature Importances Chart */}
          {trainingResult.feature_importances && trainingResult.feature_importances.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Feature Importance Breakdown</h4>
              <div className="h-56 w-full">
                <ChartTab
                  chartConfig={{
                    chart_type: 'Horizontal Bar',
                    title: 'Feature Importance Scores',
                    x_axis: 'feature',
                    y_axis: 'importance'
                  }}
                  columns={['feature', 'importance']}
                  rows={trainingResult.feature_importances}
                />
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
