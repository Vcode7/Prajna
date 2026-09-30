import React, { useState, useMemo } from 'react';
import {
  BarChart2, Grid, Layers, Check, TrendingUp, TrendingDown, Info
} from 'lucide-react';

/**
 * Helper to get smooth heatmap color for Pearson correlation r in [-1, 1]
 */
function getCorrelationColor(r, isDark = true) {
  if (r === null || r === undefined || isNaN(r)) {
    return isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.8)';
  }
  const clamped = Math.max(-1, Math.min(1, r));

  if (clamped > 0) {
    // Emerald / Teal ramp (0 -> 1)
    const alpha = Math.min(1, Math.max(0.12, clamped));
    return isDark
      ? `rgba(16, 185, 129, ${alpha * 0.85})` // emerald-500
      : `rgba(16, 185, 129, ${alpha * 0.75})`;
  } else if (clamped < 0) {
    // Indigo / Violet ramp (0 -> -1)
    const alpha = Math.min(1, Math.max(0.12, Math.abs(clamped)));
    return isDark
      ? `rgba(139, 92, 246, ${alpha * 0.85})` // violet-500
      : `rgba(139, 92, 246, ${alpha * 0.75})`;
  }
  return isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.9)';
}

function getStrengthBadge(absR) {
  if (absR >= 0.7) {
    return { label: 'Very Strong', color: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' };
  }
  if (absR >= 0.5) {
    return { label: 'Strong', color: 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700' };
  }
  if (absR >= 0.3) {
    return { label: 'Moderate', color: 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700' };
  }
  if (absR >= 0.1) {
    return { label: 'Weak', color: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' };
  }
  return { label: 'Very Weak', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700' };
}

export default function CorrelationMatrixView({
  targetColumn,
  correlations = [],
  pairwiseMatrix = null,
  eligibleColumns = [],
  selectedFeatures = [],
  onToggleFeature,
  onBatchSelectFeatures,
  loading = false,
  onRecalculate
}) {
  const [activeSubTab, setActiveSubTab] = useState('ranked'); // 'ranked' | 'heatmap'
  const [hoveredCell, setHoveredCell] = useState(null);
  const [minStrengthFilter, setMinStrengthFilter] = useState(0.0);

  // Filter correlations by threshold
  const filteredCorrelations = useMemo(() => {
    if (!correlations) return [];
    return correlations.filter(c => c.abs_correlation >= minStrengthFilter);
  }, [correlations, minStrengthFilter]);

  const matrixColumns = pairwiseMatrix?.columns || [];
  const matrixValues = pairwiseMatrix?.matrix || [];

  // Quick action helpers
  const handleSelectTop5 = () => {
    if (!correlations || correlations.length === 0) return;
    const top5 = correlations.slice(0, 5).map(c => c.feature);
    onBatchSelectFeatures && onBatchSelectFeatures(top5);
  };

  const handleSelectCorrelated = () => {
    if (!correlations || correlations.length === 0) return;
    const meaningful = correlations.filter(c => c.abs_correlation >= 0.1).map(c => c.feature);
    onBatchSelectFeatures && onBatchSelectFeatures(meaningful.length > 0 ? meaningful : correlations.slice(0, 5).map(c => c.feature));
  };

  const handleSelectAllEligible = () => {
    if (!correlations || correlations.length === 0) return;
    const all = correlations.map(c => c.feature);
    onBatchSelectFeatures && onBatchSelectFeatures(all);
  };

  const handleClearSelection = () => {
    onBatchSelectFeatures && onBatchSelectFeatures([]);
  };

  if (loading) {
    return (
      <div className="p-8 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3">
        <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-600 rounded-full animate-spin mx-auto" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Calculating Correlation Matrix...
        </h4>
        <p className="text-xs text-slate-400">
          Evaluating linear dependencies between target <strong className="text-violet-500">{targetColumn || 'variables'}</strong> and all eligible features.
        </p>
      </div>
    );
  }

  if (!correlations || (correlations.length === 0 && matrixColumns.length === 0)) {
    return (
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
        <Layers className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">
          No Correlation Data Available
        </h4>
        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
          Click "Create Correlation Matrix" or "Build using AI" to compute dependencies across eligible fields.
        </p>
      </div>
    );
  }

  const topCorrelatedFeature = correlations.length > 0 ? correlations[0] : null;

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 animate-fadeIn">
      
      {/* ── Top Header & Stats Strip ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-bold">
              ★
            </span>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <span>Correlation Matrix &amp; Feature Signal Explorer</span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {targetColumn ? (
              <>
                Target: <strong className="text-amber-600 dark:text-amber-400 font-bold">{targetColumn}</strong> • Sorted strictly by absolute correlation strength with target.
              </>
            ) : (
              'Pairwise field-to-field correlation matrix across eligible dataset fields.'
            )}
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab('ranked')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'ranked'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Target Correlations ({correlations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('heatmap')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'heatmap'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Field-to-Field Heatmap ({matrixColumns.length}×{matrixColumns.length})</span>
          </button>
        </div>
      </div>

      {/* ── Key Signal Summary Bar ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Target Variable</span>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate block mt-0.5">
            {targetColumn || 'None (Unsupervised)'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Top Predictor</span>
          {topCorrelatedFeature ? (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate block mt-0.5">
              {topCorrelatedFeature.feature} ({topCorrelatedFeature.correlation > 0 ? '+' : ''}{topCorrelatedFeature.correlation.toFixed(3)})
            </span>
          ) : (
            <span className="text-xs text-slate-400 mt-0.5 block">N/A</span>
          )}
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Eligible Fields</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
            {eligibleColumns.length > 0 ? eligibleColumns.length : matrixColumns.length} fields analyzed
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Features Selected</span>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 block mt-0.5">
            {selectedFeatures.length} of {correlations.length} selected
          </span>
        </div>
      </div>

      {/* ── SUB-TAB 1: Ranked Target Correlations ───────────────── */}
      {activeSubTab === 'ranked' && (
        <div className="space-y-4">
          
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-slate-500">Quick Select:</span>
              <button
                type="button"
                onClick={handleSelectTop5}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold hover:border-violet-500 text-slate-700 dark:text-slate-200 transition-all"
              >
                Top 5
              </button>
              <button
                type="button"
                onClick={handleSelectCorrelated}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold hover:border-violet-500 text-slate-700 dark:text-slate-200 transition-all"
              >
                Correlated (|r| ≥ 0.1)
              </button>
              <button
                type="button"
                onClick={handleSelectAllEligible}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold hover:border-violet-500 text-slate-700 dark:text-slate-200 transition-all"
              >
                All Eligible
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-all"
              >
                Clear
              </button>
            </div>

            {/* Filter Slider */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-400">Min |r|:</span>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={minStrengthFilter}
                onChange={(e) => setMinStrengthFilter(parseFloat(e.target.value))}
                className="w-24 accent-violet-600"
              />
              <span className="text-[11px] font-mono font-bold text-violet-600 dark:text-violet-400">
                ≥ {minStrengthFilter.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Sorted Correlation Table / List */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#0d131f]">
            {filteredCorrelations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No features meet the minimum correlation filter threshold of |r| ≥ {minStrengthFilter.toFixed(2)}.
              </div>
            ) : (
              filteredCorrelations.map((item, idx) => {
                const isSelected = selectedFeatures.includes(item.feature);
                const isPos = item.correlation >= 0;
                const badge = getStrengthBadge(item.abs_correlation);
                const percent = Math.round(item.abs_correlation * 100);

                return (
                  <div
                    key={item.feature}
                    onClick={() => onToggleFeature && onToggleFeature(item.feature)}
                    className={`p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isSelected
                        ? 'bg-violet-50/40 dark:bg-violet-950/20'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    {/* Left: Checkbox + Rank + Column Name */}
                    <div className="flex items-center space-x-3 min-w-[200px] flex-1">
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-violet-600 border-violet-600 text-white shadow-xs'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>

                      <span className="text-[10px] font-mono font-bold text-slate-400 w-5">
                        #{idx + 1}
                      </span>

                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {item.feature}
                          </span>
                          <span className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded ${
                            item.data_type === 'numerical'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                          }`}>
                            {item.data_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {isSelected ? '✓ Included in training set' : 'Click to include'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Visual Magnitude Bar */}
                    <div className="w-48 sm:w-64 hidden sm:flex items-center space-x-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isPos
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                              : 'bg-gradient-to-r from-violet-500 to-purple-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-8 text-right">
                        {percent}%
                      </span>
                    </div>

                    {/* Right: Exact Correlation Value + Strength Badge */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="flex items-center space-x-1">
                        {isPos ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-violet-500" />
                        )}
                        <span className={`text-xs font-mono font-extrabold ${
                          isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'
                        }`}>
                          {isPos ? '+' : ''}{item.correlation.toFixed(3)}
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: Field-to-Field Heatmap Grid ──────────────── */}
      {activeSubTab === 'heatmap' && (
        <div className="space-y-4">
          
          {/* Tooltip banner on hover */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 min-h-[44px] flex items-center justify-between text-xs">
            {hoveredCell ? (
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-violet-500 shrink-0" />
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">{hoveredCell.row}</strong>
                  {' '}↔{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{hoveredCell.col}</strong>:
                  {' '}Pearson r ={' '}
                  <span className={`font-mono font-black ${
                    hoveredCell.val >= 0 ? 'text-emerald-500' : 'text-violet-400'
                  }`}>
                    {hoveredCell.val >= 0 ? '+' : ''}{hoveredCell.val.toFixed(3)}
                  </span>
                  {' '}({getStrengthBadge(Math.abs(hoveredCell.val)).label} {hoveredCell.val >= 0 ? 'Positive' : 'Negative'})
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Hover over any cell in the matrix to inspect exact pairwise correlation details.</span>
              </span>
            )}

            {/* Target Highlight Legend */}
            {targetColumn && (
              <div className="flex items-center space-x-2 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-400/40" />
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Target: {targetColumn}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Heatmap Grid Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[500px] overflow-y-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 bg-white/95 dark:bg-[#0d131f]/95 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 text-left text-[11px] font-extrabold uppercase text-slate-400 sticky left-0 bg-white dark:bg-[#0d131f] z-20 min-w-[120px]">
                    Variable
                  </th>
                  {matrixColumns.map(col => {
                    const isTargetCol = col === targetColumn;
                    return (
                      <th
                        key={col}
                        className={`p-2 text-[10px] font-bold uppercase tracking-wider min-w-[68px] max-w-[90px] truncate ${
                          isTargetCol
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-x border-amber-300 dark:border-amber-700/60 font-black'
                            : 'text-slate-500'
                        }`}
                        title={col}
                      >
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {matrixColumns.map((rowName, rowIdx) => {
                  const isTargetRow = rowName === targetColumn;
                  return (
                    <tr
                      key={rowName}
                      className={`border-b border-slate-100 dark:border-slate-800/40 transition-colors ${
                        isTargetRow ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Row Header */}
                      <td className={`p-2 text-left text-xs font-bold truncate max-w-[140px] sticky left-0 bg-white/95 dark:bg-[#0d131f]/95 z-10 border-r border-slate-200 dark:border-slate-800 ${
                        isTargetRow
                          ? 'text-amber-600 dark:text-amber-400 font-black'
                          : 'text-slate-700 dark:text-slate-300'
                      }`} title={rowName}>
                        <div className="flex items-center space-x-1">
                          {isTargetRow && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-white font-black">
                              T
                            </span>
                          )}
                          <span className="truncate">{rowName}</span>
                        </div>
                      </td>

                      {/* Matrix Values */}
                      {matrixColumns.map((colName, colIdx) => {
                        const val = matrixValues[rowIdx]?.[colIdx] ?? 0.0;
                        const isTargetCell = isTargetRow || colName === targetColumn;
                        const isDiag = rowIdx === colIdx;

                        return (
                          <td
                            key={colName}
                            onMouseEnter={() => setHoveredCell({ row: rowName, col: colName, val })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`p-2 text-[11px] font-mono transition-all cursor-crosshair border border-slate-100/50 dark:border-slate-800/30 ${
                              isTargetCell ? 'ring-1 ring-amber-400/20' : ''
                            } ${isDiag ? 'font-bold' : ''}`}
                            style={{
                              backgroundColor: getCorrelationColor(val, true)
                            }}
                          >
                            <span className={`font-semibold ${
                              val > 0.4 ? 'text-emerald-200' : (val < -0.4 ? 'text-violet-200' : 'text-slate-300')
                            }`}>
                              {val.toFixed(2)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Color Gradient Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[10px] text-slate-400">
            <span className="font-bold uppercase tracking-wider">Heatmap Scale:</span>
            <div className="flex items-center space-x-2">
              <span className="text-violet-400 font-mono font-bold">-1.0 (Inverse)</span>
              <div className="w-36 h-2 rounded-full bg-gradient-to-r from-violet-600 via-slate-800 to-emerald-500" />
              <span className="text-emerald-400 font-mono font-bold">+1.0 (Direct)</span>
            </div>
            <span>Diagonal = 1.00 (Self correlation)</span>
          </div>

        </div>
      )}

    </div>
  );
}
