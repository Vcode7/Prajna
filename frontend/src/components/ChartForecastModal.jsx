import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useChatStore } from '../store/chatStore';
import ChartTab from './ChartTab';
import {
  TrendingUp, RefreshCw, Play, History, Check, X, AlertTriangle,
  ChevronDown, Star, CheckCircle2, BarChart3, Clock, Sparkles,
  Layers, ArrowRight
} from 'lucide-react';

export default function ChartForecastModal({
  isOpen,
  onClose,
  chart,
  datasetId,
  onApplyForecastToCard,
  activeForecast = null
}) {
  const { settings, refreshProjectTree } = useChatStore();

  const [activeTab, setActiveTab] = useState('train'); // 'train' | 'history'
  const [forecastHorizon, setForecastHorizon] = useState(6);
  const [userInstructions, setUserInstructions] = useState('');
  const [training, setTraining] = useState(false);
  const [trainingStep, setTrainingStep] = useState(0); // 0: idle, 1: detecting, 2: llm, 3: training, 4: forecasting
  const [forecastResult, setForecastResult] = useState(activeForecast || null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAccuracyMetrics, setShowAccuracyMetrics] = useState(true);

  // Model History state
  const [historyModels, setHistoryModels] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeModelId, setActiveModelId] = useState(null);

  const chartId = chart?.visualization_id || chart?.id;

  // Load history whenever modal opens or chart changes
  useEffect(() => {
    if (isOpen && chartId) {
      loadHistory();
      if (activeForecast) {
        setForecastResult(activeForecast);
      }
    }
  }, [isOpen, chartId]);

  const loadHistory = async () => {
    if (!chartId) return;
    setLoadingHistory(true);
    try {
      const res = await api.getChartForecastHistory(chartId);
      setHistoryModels(res.models || []);
      setActiveModelId(res.active_model_id);
      if (!forecastResult && res.models?.length > 0) {
        const active = res.models.find(m => m.id === res.active_model_id) || res.models[0];
        setForecastResult(active);
      }
    } catch (err) {
      console.error('Failed to load forecast history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTrainForecast = async () => {
    if (!datasetId || !chartId) return;
    setTraining(true);
    setErrorMsg('');
    setForecastResult(null);

    // Step simulation for rich UX
    setTrainingStep(1);
    const stepTimer1 = setTimeout(() => setTrainingStep(2), 700);
    const stepTimer2 = setTimeout(() => setTrainingStep(3), 1600);

    try {
      const result = await api.trainChartForecast({
        dataset_id: datasetId,
        chart_id: chartId,
        model_name: `${chart?.title || 'Chart'} Forecast`,
        forecast_horizon: forecastHorizon,
        user_instructions: userInstructions || undefined,
        model: settings?.model
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setTrainingStep(4);

      setForecastResult(result);
      setActiveModelId(result.id);
      await loadHistory();
      await refreshProjectTree();
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setErrorMsg(err.message || 'Forecast training failed');
    } finally {
      setTraining(false);
      setTrainingStep(0);
    }
  };

  const handleActivateModel = async (modelId) => {
    try {
      await api.activateChartForecast(modelId, chartId);
      setActiveModelId(modelId);
      await loadHistory();
      const activated = historyModels.find(m => m.id === modelId);
      if (activated) {
        setForecastResult(activated);
      }
    } catch (err) {
      alert(`Activation error: ${err.message}`);
    }
  };

  const handleApplyToCard = (modelToApply = null) => {
    const target = modelToApply || forecastResult;
    if (!target) return;
    if (onApplyForecastToCard) {
      onApplyForecastToCard(target);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Render Actual vs Forecast Line Chart Option
  const renderActualVsForecastChart = () => {
    if (!forecastResult?.forecast_data?.actual_vs_predicted?.length) return null;

    const avp = forecastResult.forecast_data.actual_vs_predicted;
    const futurePreds = forecastResult.forecast_data.future_predictions || [];

    const dates = avp.map(p => p.date);
    const actuals = avp.map(p => p.actual);
    const predicted = avp.map(p => p.predicted);
    const splitIdx = avp.findIndex(p => p.split === 'test');

    const futureDates = futurePreds.map(p => p.date);
    const futureValues = futurePreds.map(p => p.predicted);

    const allDates = [...dates, ...futureDates];
    const actualSeries = [...actuals, ...futureDates.map(() => null)];

    const isFinancial = /revenue|sales|price|cost|profit|amount|budget|salary|spend|rupee|inr/i.test(chart?.title || '');
    const curPrefix = isFinancial ? '₹' : '';

    const formatForecastVal = (v) => {
      if (v === null || v === undefined) return '';
      const num = Number(v);
      if (isNaN(num)) return String(v);
      const abs = Math.abs(num);
      const sign = num < 0 ? '-' : '';
      if (abs >= 1e7) return `${sign}${curPrefix}${(abs / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
      if (abs >= 1e5) return `${sign}${curPrefix}${(abs / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
      if (abs >= 1e3) return `${sign}${curPrefix}${(abs / 1e3).toFixed(1).replace(/\.?0+$/, '')} K`;
      return `${sign}${curPrefix}${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    };

    const option = {
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 11 },
        formatter: (params) => {
          let html = `<div style="font-weight:bold;margin-bottom:4px;">${params[0]?.axisValue || ''}</div>`;
          params.forEach(p => {
            if (p.value !== null && p.value !== undefined) {
              const valStr = typeof p.value === 'number'
                ? `${curPrefix}${p.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                : p.value;
              html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
                <span>${p.seriesName}:</span>
                <b>${valStr}</b>
              </div>`;
            }
          });
          return html;
        }
      },
      legend: {
        data: ['Actual Historical', 'Model Fit / Test Pred', 'Future Forecast'],
        bottom: 0,
        textStyle: { fontSize: 11 }
      },
      grid: { left: 45, right: 25, top: 25, bottom: 45 },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: { fontSize: 10, rotate: 25 }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          formatter: (val) => formatForecastVal(val)
        }
      },
      series: [
        {
          name: 'Actual Historical',
          type: 'line',
          data: actualSeries,
          lineStyle: { width: 2.5, color: '#6366f1' },
          itemStyle: { color: '#6366f1' },
          symbol: 'circle',
          symbolSize: 4,
          connectNulls: false
        },
        {
          name: 'Model Fit / Test Pred',
          type: 'line',
          data: predicted.map((v, i) => (i >= (splitIdx > 0 ? splitIdx : 0) ? v : null)),
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
          lineStyle: { width: 3, color: '#f97316' },
          itemStyle: { color: '#f97316' },
          symbol: 'diamond',
          symbolSize: 6,
          areaStyle: { color: 'rgba(249,115,22,0.08)' }
        }
      ]
    };

    return (
      <div style={{ height: 320 }} className="w-full">
        <ChartTab option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  Time-Series Forecasting
                </span>
                <span className="text-xs text-slate-400 font-medium">Chart Binding</span>
              </div>
              <h2 className="text-base font-bold truncate mt-0.5" title={chart?.title}>
                {chart?.title || 'Chart Forecasting'}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('train')}
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'train' ? 'bg-white dark:bg-slate-700 shadow-xs font-bold text-orange-600 dark:text-orange-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                Train Forecast
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 shadow-xs font-bold text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({historyModels.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: TRAIN FORECAST */}
          {activeTab === 'train' && (
            <div className="space-y-6">

              {/* Chart Metadata Badge Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-transparent dark:from-orange-950/30 dark:via-amber-950/20 dark:to-transparent border border-orange-200 dark:border-orange-800/60 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Detected Chart Axes:</span>
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border text-[11px] font-mono">
                      X (Time): <strong>{chart?.x_variable || 'Auto-detect'}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border text-[11px] font-mono">
                      Y (Metric): <strong>{chart?.y_variable || 'Auto-detect'}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    The backend automatically detects the date/time sequence, engineers sliding-window lag features, and selects the most accurate model (LSTM, Gradient Boosting, Ridge, etc.).
                  </p>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Forecast Horizon:</label>
                  <select
                    value={forecastHorizon}
                    onChange={(e) => setForecastHorizon(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                  >
                    <option value={3}>+3 periods</option>
                    <option value={6}>+6 periods</option>
                    <option value={12}>+12 periods</option>
                    <option value={24}>+24 periods</option>
                  </select>
                </div>
              </div>

              {/* Training Action Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Step 1: Train Forecasting Model
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Click below to let the LLM evaluate the time-series profile and train an optimal forecaster.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleTrainForecast}
                    disabled={training}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-orange-900/20 active:scale-95 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {training ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Training Forecasting Model...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Train ML Model</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Indicators */}
                {training && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/60 space-y-2 animate-fadeIn text-xs">
                    <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400 font-bold">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Pipeline executing:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className={`p-2 rounded-lg border ${trainingStep >= 1 ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 text-orange-700 dark:text-orange-300 font-bold' : 'text-slate-400 border-slate-200'}`}>
                        1. Detecting time-series
                      </div>
                      <div className={`p-2 rounded-lg border ${trainingStep >= 2 ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 text-orange-700 dark:text-orange-300 font-bold' : 'text-slate-400 border-slate-200'}`}>
                        2. LLM Model Selection
                      </div>
                      <div className={`p-2 rounded-lg border ${trainingStep >= 3 ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 text-orange-700 dark:text-orange-300 font-bold' : 'text-slate-400 border-slate-200'}`}>
                        3. Training Lag Sequences
                      </div>
                      <div className={`p-2 rounded-lg border ${trainingStep >= 4 ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 text-orange-700 dark:text-orange-300 font-bold' : 'text-slate-400 border-slate-200'}`}>
                        4. Generating Forecast
                      </div>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* FORECAST RESULTS & VISUALIZATION */}
              {forecastResult && forecastResult.forecast_data && (
                <div className="space-y-5 animate-fadeIn">
                  
                  {/* Actual vs Forecast Visualization */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                          <span>Actual vs Forecast Visualization</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Model: <strong>{forecastResult.algorithm}</strong> • Trained in {forecastResult.training_time_seconds || 0}s
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {forecastResult.is_active_for_chart && (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 flex items-center space-x-1">
                            <Star className="w-3 h-3" />
                            <span>Active Chart Model</span>
                          </span>
                        )}
                        <button
                          onClick={() => handleApplyToCard(forecastResult)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply Forecast to Chart</span>
                        </button>
                      </div>
                    </div>

                    {forecastResult.approach_reasoning && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        {forecastResult.approach_reasoning}
                      </p>
                    )}

                    {renderActualVsForecastChart()}
                  </div>

                  {/* Model Accuracy Button & Section */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowAccuracyMetrics(!showAccuracyMetrics)}
                        className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-extrabold">
                          Accuracy
                        </span>
                        <span>View Model Accuracy &amp; Metrics</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAccuracyMetrics ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {showAccuracyMetrics && forecastResult.metrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
                        {forecastResult.metrics.mae != null && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAE</span>
                            <span className="text-base font-black text-slate-800 dark:text-slate-100">
                              {forecastResult.metrics.mae.toFixed(4)}
                            </span>
                          </div>
                        )}
                        {forecastResult.metrics.rmse != null && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">RMSE</span>
                            <span className="text-base font-black text-slate-800 dark:text-slate-100">
                              {forecastResult.metrics.rmse.toFixed(4)}
                            </span>
                          </div>
                        )}
                        {forecastResult.metrics.mape != null && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">MAPE</span>
                            <span className="text-base font-black text-slate-800 dark:text-slate-100">
                              {forecastResult.metrics.mape.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {forecastResult.metrics.r2_score != null && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">R² Score</span>
                            <span className="text-base font-black text-slate-800 dark:text-slate-100">
                              {forecastResult.metrics.r2_score.toFixed(4)}
                            </span>
                          </div>
                        )}
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Train / Test Samples</span>
                          <span className="text-base font-black text-slate-800 dark:text-slate-100">
                            {forecastResult.metrics.train_samples} / {forecastResult.metrics.test_samples}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Metadata details */}
                    {showAccuracyMetrics && forecastResult.training_data_range && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Date Column:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{forecastResult.date_column}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Target Field:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{forecastResult.target_column}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Time Span:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {forecastResult.training_data_range?.start?.slice(0, 10)} → {forecastResult.training_data_range?.end?.slice(0, 10)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">Horizon:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{forecastResult.forecast_horizon} periods</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODEL HISTORY PER CHART */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-bold flex items-center space-x-2">
                    <History className="w-4 h-4 text-violet-500" />
                    <span>Forecast Model History ({historyModels.length})</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    All forecasting models trained specifically for <strong>{chart?.title}</strong>. Select any past model to view, activate, or apply to the dashboard.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadHistory}
                  className="p-1.5 rounded-lg border text-slate-400 hover:text-slate-600 transition-colors"
                  title="Refresh History"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
                  <span>Loading chart model history...</span>
                </div>
              ) : historyModels.length === 0 ? (
                <div className="py-12 text-center space-y-2 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <History className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold">No Forecasting Models Trained Yet</p>
                  <p className="text-[11px] text-slate-400">Switch to the "Train Forecast" tab to train your first model for this chart.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyModels.map((model) => {
                    const isActive = model.id === activeModelId || model.is_active_for_chart;
                    const isSelected = forecastResult?.id === model.id;

                    return (
                      <div
                        key={model.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400/20'
                            : isSelected
                            ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-300 dark:border-violet-700'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold truncate">{model.model_name}</span>
                              {isActive && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-extrabold tracking-wider">
                                  ACTIVE
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                                {model.algorithm}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>Target: <strong>{model.target_column}</strong></span>
                              <span>•</span>
                              <span>Horizon: <strong>{model.forecast_horizon || 12} periods</strong></span>
                              <span>•</span>
                              <span>{new Date(model.created_at).toLocaleString()}</span>
                              {model.metrics?.mae != null && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-700 dark:text-slate-200 font-mono">
                                    MAE: <strong>{model.metrics.mae.toFixed(2)}</strong>
                                  </span>
                                </>
                              )}
                              {model.metrics?.rmse != null && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-700 dark:text-slate-200 font-mono">
                                    RMSE: <strong>{model.metrics.rmse.toFixed(2)}</strong>
                                  </span>
                                </>
                              )}
                              {model.metrics?.mape != null && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-700 dark:text-slate-200 font-mono">
                                    MAPE: <strong>{model.metrics.mape.toFixed(1)}%</strong>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {!isActive && (
                              <button
                                onClick={() => handleActivateModel(model.id)}
                                className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 text-xs font-bold transition-all cursor-pointer"
                              >
                                Set as Active
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setForecastResult(model);
                                setActiveTab('train');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                            >
                              View Viz
                            </button>

                            <button
                              onClick={() => handleApplyToCard(model)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Chart ID: <code className="font-mono">{chartId}</code>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
