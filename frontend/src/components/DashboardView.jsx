import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useChatStore } from '../store/chatStore';
import { DollarSign, Landmark, TrendingUp, ShoppingBag, Users, Globe, FolderHeart, LayoutGrid, X } from 'lucide-react';

export default function DashboardView({ dashboardData = {}, onClose = () => { } }) {
  const { theme } = useChatStore();
  const trendRef = useRef(null);
  const productsRef = useRef(null);
  const customersRef = useRef(null);
  const regionRef = useRef(null);
  const categoryRef = useRef(null);

  const [instances, setInstances] = useState({});

  // Helper to format currency
  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  useEffect(() => {
    const chartRefs = {
      trend: { ref: trendRef, data: dashboardData.monthly_trend, type: 'Line' },
      products: { ref: productsRef, data: dashboardData.top_products, type: 'Bar' },
      customers: { ref: customersRef, data: dashboardData.top_customers, type: 'Horizontal Bar' },
      region: { ref: regionRef, data: dashboardData.region_chart, type: 'Pie' },
      category: { ref: categoryRef, data: dashboardData.category_chart, type: 'Donut' }
    };

    const newInstances = {};

    Object.entries(chartRefs).forEach(([key, info]) => {
      if (info.ref.current && info.data && info.data.type === 'chart') {
        const chart = echarts.init(info.ref.current, theme === 'dark' ? 'dark' : null);
        newInstances[key] = chart;

        const option = buildOption(info.type, info.data, theme);
        chart.setOption(option);
      }
    });

    setInstances(newInstances);

    // Resize handlers
    const handleResize = () => {
      Object.values(newInstances).forEach(inst => inst.resize());
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      Object.values(newInstances).forEach(inst => inst.dispose());
    };
  }, [dashboardData, theme]);

  const buildOption = (type, chartInfo, activeTheme) => {
    const { title, data, x_axis, y_axis } = chartInfo;
    const rows = data.rows || [];
    const cols = data.columns || [];

    const textStyle = {
      color: activeTheme === 'dark' ? '#94a3b8' : '#475569',
      fontFamily: 'Inter, sans-serif',
      fontSize: 11
    };

    const baseOption = {
      title: {
        text: title,
        textStyle: {
          color: activeTheme === 'dark' ? '#cbd5e1' : '#1e293b',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif'
        },
        left: '5%',
        top: 5
      },
      tooltip: {
        trigger: ['Pie', 'Donut'].includes(type) ? 'item' : 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        top: 40,
        left: '5%',
        right: '5%',
        bottom: 15,
        containLabel: true
      },
      backgroundColor: 'transparent'
    };

    if (['Pie', 'Donut'].includes(type)) {
      const isDonut = type === 'Donut';
      return {
        ...baseOption,
        series: [{
          name: title,
          type: 'pie',
          radius: isDonut ? ['40%', '65%'] : '60%',
          center: ['50%', '55%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: activeTheme === 'dark' ? '#0f172a' : '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {d}%',
            color: activeTheme === 'dark' ? '#94a3b8' : '#64748b',
            fontSize: 9
          },
          data: rows.map(r => ({
            name: String(r[x_axis]),
            value: Number(r[y_axis])
          }))
        }]
      };
    }

    const xData = rows.map(r => String(r[x_axis]));
    const yData = rows.map(r => Number(r[y_axis]));

    let xAxis = {
      type: 'category',
      data: xData,
      axisLabel: { color: textStyle.color, fontSize: 9 },
      axisLine: { lineStyle: { color: activeTheme === 'dark' ? '#334155' : '#e2e8f0' } }
    };

    let yAxis = {
      type: 'value',
      axisLabel: { color: textStyle.color, fontSize: 9 },
      splitLine: { lineStyle: { color: activeTheme === 'dark' ? '#1e293b' : '#f1f5f9' } }
    };

    if (type === 'Horizontal Bar') {
      const temp = xAxis;
      xAxis = yAxis;
      yAxis = temp;
      yAxis.type = 'category';
      yAxis.data = xData;
    }

    return {
      ...baseOption,
      xAxis,
      yAxis,
      series: [{
        name: title,
        type: type === 'Line' ? 'line' : 'bar',
        data: yData,
        itemStyle: {
          borderRadius: type === 'Horizontal Bar' ? [0, 4, 4, 0] : [4, 4, 0, 0],
          color: type === 'Line' ? '#8b5cf6' : '#6366f1'
        },
        smooth: type === 'Line'
      }]
    };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-800 dark:text-slate-400">
      {/* Title Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-400 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="w-5 h-5 text-violet-500" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Interactive Sales Dashboard</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-150 dark:hover:bg-slate-850 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main scroll grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Scalar cards rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales Revenue</span>
              <h3 className="text-2xl font-bold font-mono tracking-tight text-emerald-500">
                {formatCurrency(dashboardData.revenue_card?.value)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:rotate-6 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-500/5 rounded-full translate-x-8 translate-y-8 filter blur-lg" />
          </div>

          {/* Profit */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales Profit</span>
              <h3 className="text-2xl font-bold font-mono tracking-tight text-indigo-500">
                {formatCurrency(dashboardData.profit_card?.value)}
              </h3>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500 group-hover:rotate-6 transition-transform">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/5 rounded-full translate-x-8 translate-y-8 filter blur-lg" />
          </div>
        </div>

        {/* Full-width trend chart */}
        <div className="glass-panel p-4 rounded-2xl shadow-sm h-64 flex flex-col justify-between">
          <div ref={trendRef} className="w-full h-full min-h-[220px]" />
        </div>

        {/* 2 column grid row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-2xl shadow-sm h-60">
            <div ref={productsRef} className="w-full h-full min-h-[200px]" />
          </div>
          <div className="glass-panel p-4 rounded-2xl shadow-sm h-60">
            <div ref={customersRef} className="w-full h-full min-h-[200px]" />
          </div>
        </div>

        {/* 2 column grid row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-2xl shadow-sm h-60">
            <div ref={regionRef} className="w-full h-full min-h-[200px]" />
          </div>
          <div className="glass-panel p-4 rounded-2xl shadow-sm h-60">
            <div ref={categoryRef} className="w-full h-full min-h-[200px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
