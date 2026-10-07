import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useChatStore } from '../store/chatStore';
import { Download, Maximize2, Minimize2, BarChart2 } from 'lucide-react';
import { resolveThemeTemplate } from '../constants/dashboardThemes';

const CHART_TYPES = [
  'Bar', 'Horizontal Bar', 'Line', 'Area', 'Pie', 'Donut',
  'Scatter', 'Treemap', 'Stacked Bar', 'Stacked Area', 'Metric'
];

const formatTitle = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const parseNum = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

// Detect if a metric or title represents financial data
const isFinancialMetric = (str) => {
  if (!str) return false;
  return /revenue|sales|price|cost|profit|amount|budget|salary|spend|rupee|inr|income|expense|margin|valuation/i.test(String(str));
};

// Compact number formatting using Indian numbering metrics (Cr, L, K) with optional Rupee (₹) prefix
const formatCompactNumber = (val, isCurrency = false) => {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return String(val);
  const prefix = isCurrency ? '₹' : '';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e7) {
    const cr = (abs / 1e7).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${prefix}${cr} Cr`;
  }
  if (abs >= 1e5) {
    const lk = (abs / 1e5).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${prefix}${lk} L`;
  }
  if (abs >= 1e3) {
    const k = (abs / 1e3).toFixed(1).replace(/\.?0+$/, '');
    return `${sign}${prefix}${k} K`;
  }
  if (Number.isInteger(num)) {
    return `${sign}${prefix}${Math.abs(num).toLocaleString('en-IN')}`;
  }
  return `${sign}${prefix}${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// Full precision formatting with Indian numbering separators (en-IN) and optional Rupee (₹) prefix
const formatFullNumber = (val, isCurrency = false) => {
  if (val === null || val === undefined) return isCurrency ? '₹0' : '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return String(val);
  const prefix = isCurrency ? '₹' : '';
  const sign = num < 0 ? '-' : '';
  return `${sign}${prefix}${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// Calculate optimal chart height based on label lengths, rotation, density, and chart type
export const calculateChartHeight = (chartConfig = {}, rows = [], columns = [], overrideType = null) => {
  if (!rows || rows.length === 0) return 280;

  const type = overrideType || chartConfig?.chart_type || 'Bar';
  if (type === 'Metric') return 240;

  const count = rows.length;
  const xKey = chartConfig?.x_axis || chartConfig?.x_variable || (columns.length > 0 ? columns[0] : '');

  // Horizontal Bar: Height scales proportionally with category count and spacing
  if (type === 'Horizontal Bar') {
    return Math.max(320, Math.min(700, count * 36 + 80));
  }

  // Scan category / X labels to find length distribution
  let maxLabelLen = 0;
  let totalLen = 0;
  for (let i = 0; i < count; i++) {
    const val = rows[i]?.[xKey];
    const s = String(val ?? '');
    if (s.length > maxLabelLen) maxLabelLen = s.length;
    totalLen += s.length;
  }
  const avgLabelLen = count > 0 ? totalLen / count : 0;

  // Pie / Donut
  if (['Pie', 'Donut'].includes(type)) {
    if (count > 8 || maxLabelLen > 16) return 380;
    return 330;
  }

  // Treemap
  if (type === 'Treemap') {
    return 340;
  }

  // Cartesian charts: Bar, Stacked Bar, Line, Area, Stacked Area, Scatter
  // When labels are long, rotated labels consume significant vertical space.
  // We allocate generous height so the chart plotting area remains large and readable.
  let labelSpace = 50; // base for short labels
  if (maxLabelLen >= 26 || avgLabelLen >= 20) {
    labelSpace = 190; // very long labels (26+ chars)
  } else if (maxLabelLen >= 15 || avgLabelLen >= 11) {
    labelSpace = 140; // long labels (15-25 chars)
  } else if (maxLabelLen >= 8 || count > 6) {
    labelSpace = 90; // medium labels or rotated (8-14 chars)
  }

  // Extra space for slider dataZoom when dense data
  const sliderSpace = count > 10 ? 24 : 0;

  // Extra space for legend when multiple series
  const seriesConfigs = chartConfig?.series || [];
  const hasMultipleSeries = seriesConfigs.length > 1;
  const legendSpace = hasMultipleSeries ? 24 : 0;

  // Base plotting space (at least 240px of clear plotting area for the bars/lines)
  const basePlotSpace = 240;
  const topHeaderSpace = 46;

  const total = basePlotSpace + topHeaderSpace + labelSpace + sliderSpace + legendSpace;
  return Math.min(580, Math.max(320, total));
};

// Rich glassmorphism HTML tooltip generator
const renderTooltipHtml = (params, isDarkTheme, isChartFinancial = false) => {
  if (!params) return '';
  const items = Array.isArray(params) ? params : [params];
  if (items.length === 0) return '';

  const first = items[0];
  const headerTitle = first.axisValueLabel || (first.data && typeof first.data === 'object' && first.data.name) || first.name || '';
  const textMain = isDarkTheme ? '#f8fafc' : '#0f172a';
  const textMuted = isDarkTheme ? '#94a3b8' : '#64748b';
  const borderCol = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  const rows = items.map(item => {
    let rawVal = item.value;
    if (Array.isArray(rawVal)) {
      rawVal = rawVal[1] !== undefined ? rawVal[1] : rawVal[0];
    } else if (typeof rawVal === 'object' && rawVal !== null) {
      rawVal = rawVal.value;
    }
    if (rawVal === null || rawVal === undefined) return '';

    const color = item.color || '#6366f1';
    const seriesName = formatTitle(item.seriesName || 'Value');
    const isCurrency = isChartFinancial || isFinancialMetric(seriesName) || isFinancialMetric(item.seriesName);
    const displayVal = formatFullNumber(rawVal, isCurrency);
    const percentStr = item.percent !== undefined ? ` (${item.percent}%)` : '';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 5px; font-size: 11px;">
        <div style="display: flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; flex-shrink: 0; box-shadow: 0 0 5px ${color}60;"></span>
          <span style="color: ${textMuted}; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${seriesName}</span>
        </div>
        <div style="font-weight: 700; color: ${textMain}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap;">
          ${displayVal}${percentStr}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  return `
    <div style="font-family: Inter, system-ui, -apple-system, sans-serif; min-width: 140px; max-width: 290px;">
      ${headerTitle ? `
        <div style="font-weight: 600; font-size: 11.5px; color: ${textMain}; border-bottom: 1px solid ${borderCol}; padding-bottom: 4px; margin-bottom: 3px; word-break: break-word;">
          ${headerTitle}
        </div>
      ` : ''}
      ${rows}
    </div>
  `;
};

// Normalizes arbitrary type strings to canonical ECharts types
const normalizeChartType = (t) => {
  if (!t) return 'Bar';
  const found = CHART_TYPES.find(ct => ct.toLowerCase() === String(t).toLowerCase());
  return found || 'Bar';
};

export default function ChartTab({
  chartConfig = {},
  rows = [],
  columns = [],
  themePalette = null,
  dashboardTheme = null,
  themeTemplate = null,
  colorMode = null,
  customAccent = null,
  option = null,
  style = {},
  className = ''
}) {
  const { theme } = useChatStore();
  const effectiveTheme = colorMode || theme || 'dark';
  const isDarkTheme = effectiveTheme === 'dark';
  const template = resolveThemeTemplate(themeTemplate || dashboardTheme, customAccent);
  const modeTokens = isDarkTheme ? template.dark : template.light;
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const [selectedType, setSelectedType] = useState(normalizeChartType(chartConfig.chart_type));
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync state if backend config changes
  useEffect(() => {
    if (chartConfig.chart_type) {
      setSelectedType(normalizeChartType(chartConfig.chart_type));
    }
  }, [chartConfig]);

  // Handle Resize smoothly
  useEffect(() => {
    if (!chartInstance) return;
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance && !chartInstance.isDisposed()) {
        chartInstance.resize();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [chartInstance]);

  // Build the option map based on chart type and datasets
  const getChartOption = (type, config, data, cols, activeTheme, customPalette, templateObj, accentColor) => {
    try {
      const titleText = config.title || '';
      const xKey = config.x_axis || (cols.length > 0 ? cols[0] : '');
      const seriesConfigs = config.series || [];
      const modeTokens = activeTheme === 'dark' ? templateObj.dark : templateObj.light;

      const DEFAULT_PALETTE = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

      const resolvedPalette = (customPalette && customPalette.length > 0)
        ? customPalette
        : (modeTokens?.chartColors || DEFAULT_PALETTE);

      const primaryTextColor = modeTokens?.text?.primary || (activeTheme === 'dark' ? '#f8fafc' : '#0f172a');
      const secondaryTextColor = modeTokens?.text?.secondary || (activeTheme === 'dark' ? '#cbd5e1' : '#475569');
      const surfaceColor = modeTokens?.surface || (activeTheme === 'dark' ? '#101426' : '#ffffff');
      const borderColor = modeTokens?.border || (activeTheme === 'dark' ? '#1e293b' : '#e2e8f0');
      const splitLineColor = activeTheme === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';

      // Resolve active series with support for y_axis or y_variable
      let activeSeries = seriesConfigs;
      if (!activeSeries || activeSeries.length === 0) {
        const nonXCols = cols.filter(c => c !== xKey);
        const yCandidate = config.y_axis || config.y_variable;
        const validY = (yCandidate && yCandidate !== xKey && cols.includes(yCandidate))
          ? yCandidate
          : null;

        if (validY) {
          activeSeries = [{ name: formatTitle(validY), data_key: validY }];
        } else if (nonXCols.length > 0) {
          const preferredCol = nonXCols.find(c => c.toLowerCase() === 'count' || c.toLowerCase() === 'value') || nonXCols[0];
          activeSeries = [{ name: formatTitle(preferredCol), data_key: preferredCol }];
        } else if (cols.length > 1) {
          activeSeries = [{ name: formatTitle(cols[1]), data_key: cols[1] }];
        } else {
          activeSeries = [{ name: formatTitle(xKey), data_key: xKey }];
        }
      }

      const hasMultipleSeries = activeSeries.length > 1;

      // Determine if chart visualizes financial / currency metrics
      const isChartFinancial = isFinancialMetric(titleText) ||
        isFinancialMetric(config.y_axis) ||
        isFinancialMetric(config.y_variable) ||
        activeSeries.some(s => isFinancialMetric(s.name) || isFinancialMetric(s.data_key));

      // Base properties with enhanced typography, glassmorphism tooltips, and responsive layout
      const baseOption = {
        color: resolvedPalette,
        title: {
          text: titleText,
          textStyle: {
            color: primaryTextColor,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontSize: 13,
            fontWeight: 600
          },
          left: 'center',
          top: 6
        },
        tooltip: {
          trigger: ['Pie', 'Donut', 'Treemap', 'Metric'].includes(type) ? 'item' : 'axis',
          confine: true,
          axisPointer: {
            type: type === 'Horizontal Bar' ? 'shadow' : 'cross',
            crossStyle: { color: borderColor },
            shadowStyle: { color: activeTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)' }
          },
          backgroundColor: activeTheme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
          borderColor: activeTheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: [8, 12],
          extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2); border-radius: 10px; backdrop-filter: blur(8px);',
          formatter: (params) => renderTooltipHtml(params, activeTheme === 'dark', isChartFinancial)
        },
        legend: {
          show: !['Metric', 'Treemap'].includes(type) && (hasMultipleSeries || ['Pie', 'Donut'].includes(type)),
          bottom: 2,
          type: 'scroll',
          itemWidth: 12,
          itemHeight: 12,
          itemGap: 12,
          pageTextStyle: {
            color: secondaryTextColor,
            fontSize: 10
          },
          textStyle: {
            color: secondaryTextColor,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontSize: 11
          }
        },
        grid: {
          top: titleText ? 44 : 24,
          left: 10,
          right: 18,
          bottom: hasMultipleSeries ? 38 : 22,
          containLabel: true
        },
        backgroundColor: 'transparent'
      };

      // 1. Metric / Single KPI Display
      if (type === 'Metric') {
        const val = data.length > 0 ? (data[0].value ?? data[0][cols[1]] ?? data[0][cols[0]] ?? 0) : 0;
        const metricName = config.title || formatTitle(xKey) || 'Metric';
        const isMetricFinancial = isChartFinancial || isFinancialMetric(metricName);
        const primaryMetricColor = modeTokens?.primary || resolvedPalette[0] || (activeTheme === 'dark' ? '#818cf8' : '#6366f1');

        return {
          ...baseOption,
          graphic: {
            elements: [
              {
                type: 'text',
                left: 'center',
                top: '36%',
                style: {
                  text: typeof val === 'number' ? formatFullNumber(val, isMetricFinancial) : String(val),
                  fontSize: 36,
                  fontWeight: 'bold',
                  fill: primaryMetricColor,
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                }
              },
              {
                type: 'text',
                left: 'center',
                top: '64%',
                style: {
                  text: metricName,
                  fontSize: 13,
                  fontWeight: 600,
                  fill: secondaryTextColor,
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                }
              }
            ]
          }
        };
      }

      // 2. Pie / Donut
      if (['Pie', 'Donut'].includes(type)) {
        const isDonut = type === 'Donut';
        const data_key = activeSeries[0].data_key;

        const pieData = data.map(row => ({
          name: String(row[xKey] ?? 'Unknown'),
          value: parseNum(row[data_key])
        }));

        const isManySlices = pieData.length > 8;

        return {
          ...baseOption,
          legend: {
            show: true,
            type: 'scroll',
            bottom: 2,
            pageTextStyle: { color: secondaryTextColor, fontSize: 10 },
            textStyle: {
              color: secondaryTextColor,
              fontSize: 11,
              fontFamily: 'Inter, sans-serif'
            }
          },
          series: [{
            name: activeSeries[0].name,
            type: 'pie',
            radius: isDonut ? ['42%', '68%'] : '64%',
            center: ['50%', '46%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: surfaceColor,
              borderWidth: 2
            },
            label: {
              show: !isManySlices,
              formatter: '{b}: {d}%',
              color: secondaryTextColor,
              fontSize: 11,
              fontFamily: 'Inter, sans-serif'
            },
            labelLine: {
              show: !isManySlices,
              lineStyle: {
                color: borderColor
              }
            },
            data: pieData
          }]
        };
      }

      // 3. Treemap
      if (type === 'Treemap') {
        const data_key = activeSeries[0].data_key;
        const treemapData = data.map(row => ({
          name: String(row[xKey] ?? 'Unknown'),
          value: parseNum(row[data_key])
        }));

        return {
          ...baseOption,
          color: resolvedPalette,
          series: [{
            name: activeSeries[0].name,
            type: 'treemap',
            visibleMinArea: 300,
            color: resolvedPalette,
            levels: [
              {
                itemStyle: {
                  borderColor: surfaceColor,
                  borderWidth: 2,
                  gapWidth: 2
                },
                color: resolvedPalette
              }
            ],
            label: {
              show: true,
              formatter: (params) => `${params.name}\n${formatCompactNumber(params.value, isChartFinancial)}`,
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 'bold',
              fontFamily: 'Inter, sans-serif'
            },
            breadcrumb: { show: false },
            data: treemapData
          }]
        };
      }

      // 4. Cartesian Charts (Bar, Horizontal Bar, Line, Area, Stacked, Scatter)
      const mlForecast = config.ml_forecast;
      let xData = data.map(row => String(row[xKey] ?? ''));
      let series = [];

      const rawPredPts = mlForecast?.prediction_points || (mlForecast?.future_predictions || mlForecast?.forecast_data?.future_predictions || []).map(p => ({ x: p.date, y: p.predicted }));
      const rawHistPts = mlForecast?.historical_points || (mlForecast?.actual_vs_predicted || mlForecast?.forecast_data?.actual_vs_predicted || []).map(p => ({ x: p.date, y: p.actual }));

      if (mlForecast && rawPredPts.length > 0) {
        // ML Model Forecast Integration
        const histPts = rawHistPts.length > 0
          ? rawHistPts
          : data.map(r => ({ x: String(r[xKey] ?? ''), y: parseNum(r[activeSeries[0]?.data_key || cols[1]]) }));

        const predPts = rawPredPts;
        const histX = histPts.map(p => p.x);
        const predX = predPts.map(p => p.x);
        xData = [...histX, ...predX];

        const actualData = [...histPts.map(p => p.y), ...predPts.map(() => null)];
        const actualName = mlForecast.legend_actual || 'Actual';
        const actualColor = modeTokens?.primary || resolvedPalette[0] || (activeTheme === 'dark' ? '#818cf8' : '#4f46e5');
        const predColor = modeTokens?.accent || mlForecast.color_prediction || '#f97316';

        const actualSeriesOpt = {
          name: actualName,
          data: actualData,
          type: type.includes('Bar') && !type.includes('Stacked') ? 'bar' : 'line',
          smooth: 0.35,
          barMaxWidth: 36,
          barMinWidth: 6,
          itemStyle: {
            color: actualColor,
            borderRadius: [4, 4, 0, 0]
          },
          lineStyle: {
            color: actualColor,
            width: 3
          }
        };
        if (type === 'Area') {
          actualSeriesOpt.areaStyle = {
            opacity: activeTheme === 'dark' ? 0.4 : 0.25,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: actualColor },
              { offset: 1, color: activeTheme === 'dark' ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)' }
            ])
          };
        }

        const predData = [];
        const lastHistVal = histPts.length > 0 ? histPts[histPts.length - 1].y : null;

        for (let i = 0; i < histPts.length; i++) {
          if (i === histPts.length - 1) {
            predData.push(lastHistVal);
          } else {
            predData.push(null);
          }
        }
        for (const pp of predPts) {
          predData.push(pp.y);
        }

        const predName = mlForecast.legend_prediction || 'ML Prediction';

        const predSeriesOpt = {
          name: predName,
          data: predData,
          type: type.includes('Bar') && !type.includes('Stacked') ? 'bar' : 'line',
          smooth: 0.35,
          barMaxWidth: 36,
          barMinWidth: 6,
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: {
            color: predColor,
            borderRadius: [4, 4, 0, 0]
          },
          lineStyle: {
            color: predColor,
            width: 3,
            type: 'dashed'
          }
        };

        series = [actualSeriesOpt, predSeriesOpt];
      } else if (type === 'Horizontal Bar') {
        // Horizontal Bar: Value axis is X, Category axis is Y
        series = activeSeries.map((s, sIdx) => {
          const sData = data.map(row => parseNum(row[s.data_key]));
          return {
            name: s.name,
            data: sData,
            type: 'bar',
            barMaxWidth: 26,
            barMinWidth: 6,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: hasMultipleSeries
                ? resolvedPalette[sIdx % resolvedPalette.length]
                : (params) => resolvedPalette[params.dataIndex % resolvedPalette.length]
            },
            label: {
              show: true,
              position: 'right',
              color: secondaryTextColor,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              formatter: (params) => {
                const v = params.value;
                return (v !== null && v !== undefined && v !== 0) ? formatCompactNumber(v, isChartFinancial) : '';
              }
            }
          };
        });

        // Horizontal Bar dataZoom: mouse-wheel/pinch inside zoom along Y-axis if data is large
        const showYSlider = xData.length > 14;
        const zoomConfig = [
          {
            type: 'inside',
            yAxisIndex: 0,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: true
          }
        ];

        return {
          ...baseOption,
          grid: {
            ...baseOption.grid,
            left: 10,
            right: 48,
            bottom: hasMultipleSeries ? 36 : 20
          },
          xAxis: {
            type: 'value',
            axisLabel: {
              color: secondaryTextColor,
              fontSize: 11,
              fontFamily: 'Inter, sans-serif',
              formatter: (val) => formatCompactNumber(val, isChartFinancial)
            },
            axisLine: { show: false },
            splitLine: {
              lineStyle: {
                color: splitLineColor,
                type: 'dashed'
              }
            }
          },
          yAxis: {
            type: 'category',
            data: xData,
            axisLabel: {
              color: secondaryTextColor,
              fontSize: 11,
              fontFamily: 'Inter, sans-serif',
              interval: 0,
              width: 110,
              overflow: 'truncate',
              ellipsis: '...'
            },
            axisLine: { lineStyle: { color: borderColor } },
            axisTick: { show: false },
            splitLine: { show: false }
          },
          series: series,
          dataZoom: zoomConfig
        };
      } else if (type === 'Scatter') {
        const scatterColor = modeTokens?.primary || resolvedPalette[0];
        series = activeSeries.map((s, sIdx) => {
          const sColor = resolvedPalette[sIdx % resolvedPalette.length] || scatterColor;
          const sData = data.map(row => [
            parseNum(row[xKey]) || String(row[xKey] ?? ''),
            parseNum(row[s.data_key])
          ]);

          return {
            name: s.name,
            data: sData,
            type: 'scatter',
            symbolSize: 10,
            itemStyle: {
              color: sColor,
              borderColor: surfaceColor,
              borderWidth: 1.5,
              shadowBlur: 6,
              shadowColor: `${sColor}50`
            }
          };
        });
      } else {
        // Standard series building (Bar, Stacked Bar, Line, Area, Stacked Area)
        series = activeSeries.map((s, sIdx) => {
          const sKey = s.data_key;
          const sData = data.map(row => parseNum(row[sKey]));
          const sColor = resolvedPalette[sIdx % resolvedPalette.length];
          const isBar = type.includes('Bar');
          const isStacked = type.includes('Stacked');
          const isArea = type === 'Area' || type === 'Stacked Area';

          const sOpt = {
            name: s.name,
            data: sData,
            type: isBar ? 'bar' : 'line',
          };

          if (isStacked) {
            sOpt.stack = 'total';
          }

          if (isBar) {
            sOpt.barMaxWidth = 36;
            sOpt.barMinWidth = 6;
            sOpt.barGap = '20%';
            sOpt.barCategoryGap = '35%';
            sOpt.itemStyle = {
              borderRadius: isStacked ? 0 : [6, 6, 0, 0],
              color: hasMultipleSeries || isStacked
                ? sColor
                : (params) => resolvedPalette[params.dataIndex % resolvedPalette.length]
            };
            sOpt.label = {
              show: !isStacked && xData.length <= 14,
              position: 'top',
              color: secondaryTextColor,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              formatter: (params) => {
                const v = params.value;
                const isCur = isChartFinancial || isFinancialMetric(s.name) || isFinancialMetric(s.data_key);
                return (v !== null && v !== undefined && v !== 0) ? formatCompactNumber(v, isCur) : '';
              }
            };
          } else {
            // Line / Area
            sOpt.smooth = 0.35;
            sOpt.symbol = 'circle';
            sOpt.symbolSize = 6;
            sOpt.showSymbol = xData.length <= 25;
            sOpt.itemStyle = {
              color: sColor,
              borderColor: surfaceColor,
              borderWidth: 2
            };
            sOpt.lineStyle = {
              color: sColor,
              width: 3
            };

            if (isArea) {
              sOpt.areaStyle = {
                opacity: activeTheme === 'dark' ? 0.45 : 0.28,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: sColor },
                  { offset: 1, color: activeTheme === 'dark' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)' }
                ])
              };
            }
          }

          return sOpt;
        });
      }

      // Automatically configure X-axis zoom & scroll and rotation when labels are long or data points are dense
      const maxLabelLen = xData.reduce((m, l) => Math.max(m, String(l ?? '').length), 0);
      const isDenseX = xData.length > 10;
      const isRotated = xData.length > 6 || maxLabelLen > 8;
      const visibleCount = Math.min(xData.length, 12);
      const initialEndPct = isDenseX ? Math.max(8, Math.round((visibleCount / xData.length) * 100)) : 100;

      let xAxisConfig = {
        type: 'category',
        data: xData,
        axisLabel: {
          color: secondaryTextColor,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: 11,
          interval: 0,
          rotate: maxLabelLen > 14 ? 40 : (isRotated ? 28 : 0),
          hideOverlap: true,
          margin: 10,
          formatter: (val) => {
            const s = String(val ?? '');
            return s.length > 28 ? s.slice(0, 26) + '…' : s;
          }
        },
        axisLine: { lineStyle: { color: borderColor } },
        axisTick: { show: false },
        splitLine: { show: false }
      };

      let yAxisConfig = {
        type: 'value',
        axisLabel: {
          color: secondaryTextColor,
          fontSize: 11,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          formatter: (val) => formatCompactNumber(val, isChartFinancial)
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed'
          }
        }
      };

      const zoomConfig = [
        {
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: initialEndPct,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: true
        }
      ];

      if (isDenseX) {
        zoomConfig.push({
          type: 'slider',
          xAxisIndex: 0,
          show: true,
          start: 0,
          end: initialEndPct,
          bottom: 2,
          height: 18,
          borderColor: 'transparent',
          backgroundColor: activeTheme === 'dark' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(226, 232, 240, 0.65)',
          fillerColor: `${modeTokens?.primary || '#8b5cf6'}35`,
          handleSize: '100%',
          handleStyle: {
            color: modeTokens?.primary || '#8b5cf6',
            borderColor: modeTokens?.surface || '#1e293b',
            borderWidth: 1.5,
            shadowBlur: 4,
            shadowColor: 'rgba(0,0,0,0.2)'
          },
          moveHandleStyle: {
            color: modeTokens?.primary || '#8b5cf6',
            opacity: 0.7
          },
          selectedDataBackground: {
            lineStyle: { color: modeTokens?.primary || '#8b5cf6' },
            areaStyle: { color: `${modeTokens?.primary || '#8b5cf6'}20` }
          },
          dataBackground: {
            lineStyle: { color: activeTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            areaStyle: { color: activeTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }
          },
          textStyle: {
            color: secondaryTextColor,
            fontSize: 10,
            fontFamily: 'Inter, sans-serif'
          }
        });
      }

      const hasTitle = Boolean(titleText);
      let bottomPadding = (isDenseX ? 28 : 10) + (isRotated ? (maxLabelLen > 14 ? 36 : 26) : 14) + (hasMultipleSeries ? 24 : 10);
      if (bottomPadding < 30) bottomPadding = 30;

      return {
        ...baseOption,
        grid: {
          ...baseOption.grid,
          top: hasTitle ? 46 : 26,
          left: 10,
          right: isDenseX ? 22 : 16,
          bottom: bottomPadding,
          containLabel: true
        },
        xAxis: xAxisConfig,
        yAxis: yAxisConfig,
        series: series,
        dataZoom: zoomConfig
      };
    } catch (err) {
      console.error('getChartOption failed:', err);
      return null;
    }
  };

  // Setup ECharts instance
  useEffect(() => {
    if (!chartRef.current) return;
    if (!option && rows.length === 0) return;

    // Dispose existing instance on DOM element if present
    const existing = echarts.getInstanceByDom(chartRef.current);
    if (existing && !existing.isDisposed()) {
      existing.dispose();
    }

    let chart = null;
    try {
      chart = echarts.init(chartRef.current, effectiveTheme === 'dark' ? 'dark' : null);
      setChartInstance(chart);

      const finalOption = option || getChartOption(selectedType, chartConfig, rows, columns, effectiveTheme, themePalette, template, customAccent);
      if (finalOption && !chart.isDisposed()) {
        chart.setOption(finalOption, true);
        requestAnimationFrame(() => {
          if (chart && !chart.isDisposed()) {
            chart.resize();
          }
        });
      }
    } catch (err) {
      console.error('Error rendering chart:', err);
    }

    return () => {
      if (chart && !chart.isDisposed()) {
        chart.dispose();
      }
    };
  }, [option, selectedType, chartConfig, rows, columns, effectiveTheme, themePalette, dashboardTheme, themeTemplate, customAccent]);

  const handleDownloadImage = () => {
    if (!chartInstance) return;
    const url = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: modeTokens?.surface || (isDarkTheme ? '#0f172a' : '#ffffff')
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chartConfig.title || 'chart'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Calculate optimal chart height based on label lengths and type
  const optimalHeight = calculateChartHeight(chartConfig, rows, columns, selectedType);

  // Dynamic canvas height: automatically expands when many categories on Horizontal Bar or when labels are long
  const isHorizontalBar = selectedType === 'Horizontal Bar';
  const dataCount = rows.length;
  const isDenseCategories = isHorizontalBar && dataCount > 6;
  const canvasHeight = isDenseCategories
    ? `${Math.max(320, dataCount * 36 + 70)}px`
    : (style?.height ? '100%' : `${optimalHeight}px`);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full relative ${
        isFullscreen ? 'fixed inset-0 z-50 p-6' : 'p-2'
      } ${className}`}
      style={{
        backgroundColor: isFullscreen
          ? (modeTokens?.surface || (isDarkTheme ? '#0f172a' : '#ffffff'))
          : 'transparent',
        color: modeTokens?.text?.primary || (isDarkTheme ? '#f8fafc' : '#0f172a'),
        minHeight: isFullscreen ? undefined : (style?.height ? undefined : `${optimalHeight}px`),
        ...style
      }}
    >
      {/* Chart Control Bar */}
      <div
        className="flex flex-wrap items-center justify-between pb-2 mb-2 space-y-1 sm:space-y-0 shrink-0"
        style={{
          borderBottom: `1px solid ${modeTokens?.border || (isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`
        }}
      >
        {/* Type selector (only displayed when rendered with dynamic rows) */}
        {!option ? (
          <div className="flex items-center space-x-2">
            <BarChart2 className="w-3.5 h-3.5" style={{ color: modeTokens?.primary }} />
            <span
              className="text-[11px] font-semibold"
              style={{ color: modeTokens?.text?.secondary || (isDarkTheme ? '#94a3b8' : '#64748b') }}
            >
              Type:
            </span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-[11px] font-medium px-2 py-0.5 rounded-lg focus:outline-none transition-colors"
              style={{
                backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${modeTokens?.border || (isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')}`,
                color: modeTokens?.text?.primary || (isDarkTheme ? '#f1f5f9' : '#1e293b')
              }}
            >
              {CHART_TYPES.map(t => (
                <option
                  key={t}
                  value={t}
                  style={{
                    backgroundColor: modeTokens?.surface || (isDarkTheme ? '#1e293b' : '#ffffff'),
                    color: modeTokens?.text?.primary || (isDarkTheme ? '#f1f5f9' : '#1e293b')
                  }}
                >
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <BarChart2 className="w-3.5 h-3.5" style={{ color: modeTokens?.primary }} />
            <span className="text-[11px] font-semibold" style={{ color: modeTokens?.text?.secondary }}>
              {chartConfig?.title || 'Chart'}
            </span>
          </div>
        )}

        {/* Action icons */}
        <div className="flex items-center space-x-1.5 ml-auto">
          <button
            onClick={handleDownloadImage}
            title="Download PNG"
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            style={{
              color: modeTokens?.text?.secondary || (isDarkTheme ? '#94a3b8' : '#64748b'),
              backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
            }}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            style={{
              color: modeTokens?.text?.secondary || (isDarkTheme ? '#94a3b8' : '#64748b'),
              backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
            }}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chart Canvas with Smooth Scroll Container */}
      <div
        className="flex-1 w-full relative overflow-y-auto overflow-x-hidden custom-scrollbar min-h-[180px]"
        style={{
          maxHeight: isFullscreen ? 'calc(100vh - 80px)' : undefined
        }}
      >
        {(rows.length > 0 || option) ? (
          <div
            ref={chartRef}
            style={{
              width: '100%',
              height: canvasHeight,
              minHeight: '180px'
            }}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full min-h-[160px] space-y-2"
            style={{ color: modeTokens?.text?.muted || (isDarkTheme ? '#64748b' : '#94a3b8') }}
          >
            <span className="text-xs italic">No data returned to plot.</span>
          </div>
        )}
      </div>
    </div>
  );
}
