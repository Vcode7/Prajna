import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useChatStore } from '../store/chatStore';
import { Download, Maximize2, Minimize2, BarChart2, TrendingUp, PieChart, Layers } from 'lucide-react';

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
import { resolveThemeTemplate } from '../constants/dashboardThemes';

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
  customAccent = null
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

  // Handle Resize
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
    return () => {
      resizeObserver.disconnect();
    };
  }, [chartInstance]);

  // Setup ECharts instance
  useEffect(() => {
    if (!chartRef.current || rows.length === 0) return;

    // Dispose existing instance on DOM element if present
    const existing = echarts.getInstanceByDom(chartRef.current);
    if (existing && !existing.isDisposed()) {
      existing.dispose();
    }

    let chart = null;
    try {
      chart = echarts.init(chartRef.current, effectiveTheme === 'dark' ? 'dark' : null);
      setChartInstance(chart);

      const option = getChartOption(selectedType, chartConfig, rows, columns, effectiveTheme, themePalette, template, customAccent);
      if (option && !chart.isDisposed()) {
        chart.setOption(option, true);
      }
    } catch (err) {
      console.error('Error rendering chart:', err);
    }

    return () => {
      if (chart && !chart.isDisposed()) {
        chart.dispose();
      }
    };
  }, [selectedType, chartConfig, rows, columns, effectiveTheme, themePalette, dashboardTheme, themeTemplate, customAccent]);

  // Build the option map based on chart type and datasets
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
      const splitLineColor = activeTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

      // Fallback if series is empty
      let activeSeries = seriesConfigs;
      if (!activeSeries || activeSeries.length === 0) {
        const nonXCols = cols.filter(c => c !== xKey);
        const validY = (config.y_axis && config.y_axis !== xKey && cols.includes(config.y_axis))
          ? config.y_axis
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

      const textStyle = {
        color: secondaryTextColor,
        fontFamily: 'Inter, sans-serif'
      };

      const hasMultipleSeries = activeSeries.length > 1;

      // Base properties
      const baseOption = {
        color: resolvedPalette,
        title: {
          text: titleText,
          textStyle: {
            color: primaryTextColor,
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 600
          },
          left: 'center',
          top: 5
        },
        tooltip: {
          trigger: ['Pie', 'Donut', 'Treemap', 'Metric'].includes(type) ? 'item' : 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: surfaceColor,
          borderColor: borderColor,
          borderWidth: 1,
          padding: [8, 12],
          textStyle: {
            color: primaryTextColor,
            fontFamily: 'Inter, sans-serif',
            fontSize: 12
          }
        },
        legend: {
          show: !['Metric', 'Treemap'].includes(type) && (hasMultipleSeries || ['Pie', 'Donut'].includes(type)),
          bottom: 2,
          type: 'scroll',
          textStyle: {
            color: secondaryTextColor,
            fontFamily: 'Inter, sans-serif',
            fontSize: 11
          }
        },
        grid: {
          top: titleText ? 44 : 26,
          left: '3%',
          right: '4%',
          bottom: hasMultipleSeries ? 44 : 24,
          containLabel: true
        },
        backgroundColor: 'transparent'
      };

      // 1. Metric / Single KPI Display
      if (type === 'Metric') {
        const val = data.length > 0 ? (data[0].value ?? data[0][cols[1]] ?? data[0][cols[0]] ?? 0) : 0;
        const metricName = config.title || formatTitle(xKey) || 'Metric';
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
                  text: typeof val === 'number' ? val.toLocaleString() : String(val),
                  fontSize: 38,
                  fontWeight: 'bold',
                  fill: primaryMetricColor,
                  fontFamily: 'Inter, sans-serif'
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
                  fontFamily: 'Inter, sans-serif'
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

        return {
          ...baseOption,
          legend: {
            show: true,
            type: 'scroll',
            bottom: 2,
            textStyle: {
              color: secondaryTextColor,
              fontSize: 11
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
              show: true,
              formatter: '{b}: {d}%',
              color: secondaryTextColor,
              fontSize: 11
            },
            labelLine: {
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
              formatter: '{b}\n{c}',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 'bold'
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
          smooth: true,
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
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
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
        // Horizontal Bar: Value axis is X, Category is Y
        series = activeSeries.map((s, sIdx) => {
          const sData = data.map(row => parseNum(row[s.data_key]));
          return {
            name: s.name,
            data: sData,
            type: 'bar',
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
              fontSize: 11,
              fontWeight: 600,
              formatter: (params) => {
                const v = params.value;
                return (v !== null && v !== undefined && v !== 0) ? (typeof v === 'number' ? v.toLocaleString() : v) : '';
              }
            }
          };
        });

        const showSlider = xData.length > 12;
        const zoomConfig = [{ type: 'inside', start: 0, end: 100 }];
        if (showSlider) {
          zoomConfig.push({
            type: 'slider',
            yAxisIndex: 0,
            start: 0,
            end: 100,
            right: 4,
            width: 14,
            textStyle: { color: 'transparent' },
            borderColor: 'transparent',
            backgroundColor: activeTheme === 'dark' ? 'rgba(30,41,59,0.4)' : 'rgba(226,232,240,0.6)',
            fillerColor: `${modeTokens?.primary || '#8b5cf6'}40`
          });
        }

        return {
          ...baseOption,
          grid: {
            ...baseOption.grid,
            right: showSlider ? 36 : '4%'
          },
          xAxis: {
            type: 'value',
            axisLabel: { color: secondaryTextColor },
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
            axisLabel: { color: secondaryTextColor, interval: 0, rotate: 0 },
            axisLine: { lineStyle: { color: borderColor } },
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
            symbolSize: 12,
            itemStyle: {
              color: sColor,
              borderColor: surfaceColor,
              borderWidth: 1.5,
              shadowBlur: 8,
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
            sOpt.itemStyle = {
              borderRadius: isStacked ? 0 : [6, 6, 0, 0],
              color: hasMultipleSeries || isStacked
                ? sColor
                : (params) => resolvedPalette[params.dataIndex % resolvedPalette.length]
            };
            sOpt.label = {
              show: !isStacked,
              position: 'top',
              color: secondaryTextColor,
              fontSize: 11,
              fontWeight: 600,
              formatter: (params) => {
                const v = params.value;
                return (v !== null && v !== undefined && v !== 0) ? (typeof v === 'number' ? v.toLocaleString() : v) : '';
              }
            };
          } else {
            // Line / Area
            sOpt.smooth = true;
            sOpt.symbol = 'circle';
            sOpt.symbolSize = 6;
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

      let xAxisConfig = {
        type: 'category',
        data: xData,
        axisLabel: { color: secondaryTextColor, interval: 'auto', rotate: xData.length > 8 ? 30 : 0 },
        axisLine: { lineStyle: { color: borderColor } },
        splitLine: { show: false }
      };

      let yAxisConfig = {
        type: 'value',
        axisLabel: { color: secondaryTextColor },
        axisLine: { show: false },
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed'
          }
        }
      };

      const showSlider = xData.length > 12;
      const zoomConfig = [
        { type: 'inside', start: 0, end: 100 }
      ];
      if (showSlider) {
        zoomConfig.push({
          type: 'slider',
          start: 0,
          end: 100,
          bottom: 4,
          height: 14,
          textStyle: { color: 'transparent' },
          borderColor: 'transparent',
          backgroundColor: activeTheme === 'dark' ? 'rgba(30,41,59,0.4)' : 'rgba(226,232,240,0.6)',
          fillerColor: `${modeTokens?.primary || '#8b5cf6'}40`,
          handleStyle: {
            color: modeTokens?.primary || '#8b5cf6'
          }
        });
      }

      return {
        ...baseOption,
        grid: {
          ...baseOption.grid,
          bottom: showSlider ? (hasMultipleSeries ? 50 : 36) : (hasMultipleSeries ? 36 : 24)
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

  const handleDownloadImage = () => {
    if (!chartInstance) return;
    const url = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: modeTokens.surface || (isDarkTheme ? '#0f172a' : '#ffffff')
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

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full relative ${
        isFullscreen ? 'fixed inset-0 z-50 p-6' : 'p-2'
      }`}
      style={{
        backgroundColor: isFullscreen
          ? (modeTokens.surface || (isDarkTheme ? '#0f172a' : '#ffffff'))
          : 'transparent',
        color: modeTokens.text?.primary || (isDarkTheme ? '#f8fafc' : '#0f172a')
      }}
    >
      {/* Chart Control Bar */}
      <div
        className="flex flex-wrap items-center justify-between pb-2 mb-2 space-y-1 sm:space-y-0 shrink-0"
        style={{
          borderBottom: `1px solid ${modeTokens.border || (isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`
        }}
      >
        <div className="flex items-center space-x-2">
          <BarChart2 className="w-3.5 h-3.5" style={{ color: modeTokens.primary }} />
          <span
            className="text-[11px] font-semibold"
            style={{ color: modeTokens.text?.secondary || (isDarkTheme ? '#94a3b8' : '#64748b') }}
          >
            Type:
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-[11px] font-medium px-2 py-0.5 rounded-lg focus:outline-none transition-colors"
            style={{
              backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${modeTokens.border || (isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')}`,
              color: modeTokens.text?.primary || (isDarkTheme ? '#f1f5f9' : '#1e293b')
            }}
          >
            {CHART_TYPES.map(type => (
              <option
                key={type}
                value={type}
                style={{
                  backgroundColor: modeTokens.surface || (isDarkTheme ? '#1e293b' : '#ffffff'),
                  color: modeTokens.text?.primary || (isDarkTheme ? '#f1f5f9' : '#1e293b')
                }}
              >
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleDownloadImage}
            title="Download PNG"
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            style={{
              color: modeTokens.text?.secondary || (isDarkTheme ? '#94a3b8' : '#64748b'),
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
              color: modeTokens.text?.secondary || (isDarkTheme ? '#94a3b8' : '#64748b'),
              backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
            }}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 w-full relative min-h-[160px]">
        {rows.length > 0 ? (
          <div ref={chartRef} className="w-full h-full" style={{ minHeight: '160px' }} />
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full space-y-2"
            style={{ color: modeTokens.text?.muted || (isDarkTheme ? '#64748b' : '#94a3b8') }}
          >
            <span className="text-xs italic">No data returned to plot.</span>
          </div>
        )}
      </div>
    </div>
  );
}
