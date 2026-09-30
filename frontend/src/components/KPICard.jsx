import React from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Hash,
  Activity, Layers, Award, BarChart2
} from 'lucide-react';

// Format numbers cleanly
function formatValue(val) {
  if (val === null || val === undefined || val === '') return '0';
  if (typeof val === 'number') {
    if (isNaN(val)) return '0';
    if (Math.abs(val) >= 1_000_000_000) {
      return (val / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'B';
    }
    if (Math.abs(val) >= 1_000_000) {
      return (val / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
    }
    if (Math.abs(val) >= 10_000) {
      return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(val);
}

// Select an appropriate icon based on title
function getMetricIcon(title = '') {
  const t = title.toLowerCase();
  if (t.includes('revenue') || t.includes('sales') || t.includes('price') || t.includes('cost') || t.includes('profit') || t.includes('amount') || t.includes('dollar')) {
    return DollarSign;
  }
  if (t.includes('user') || t.includes('customer') || t.includes('client') || t.includes('employee') || t.includes('people')) {
    return Users;
  }
  if (t.includes('count') || t.includes('total') || t.includes('number') || t.includes('quantity') || t.includes('volume')) {
    return Hash;
  }
  if (t.includes('growth') || t.includes('rate') || t.includes('trend') || t.includes('conversion') || t.includes('score')) {
    return TrendingUp;
  }
  if (t.includes('rank') || t.includes('top') || t.includes('best')) {
    return Award;
  }
  return Activity;
}

import { resolveThemeTemplate } from '../constants/dashboardThemes';

export default function KPICard({
  title = 'Metric',
  value = 0,
  aggregation,
  field,
  theme = 'royal_indigo',
  themeTemplate = null,
  cardStyle = 'glass',
  colorMode = null,
  customAccent = null,
  mode = 'edit',
  isLoading = false
}) {
  const Icon = getMetricIcon(title);
  const formattedVal = formatValue(value);

  const template = resolveThemeTemplate(themeTemplate || theme, customAccent);
  const isDark = colorMode ? colorMode === 'dark' : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const tokens = isDark ? template.dark : template.light;

  // Dynamic colors derived from the active Theme Template
  const dynamicStyles = {
    iconStyle: {
      backgroundColor: `${tokens.primary}18`,
      color: tokens.primary,
      borderColor: `${tokens.primary}30`
    },
    badgeStyle: {
      backgroundColor: `${tokens.accent}20`,
      color: tokens.accent,
      borderColor: `${tokens.accent}35`
    },
    valueStyle: {
      color: tokens.text.primary
    }
  };

  return (
    <div
      className={`h-full w-full flex flex-col justify-between p-4 select-none ${
        mode === 'preview' ? 'transition-all duration-200' : ''
      }`}
    >
      {/* Top row: Icon + Title + Aggregation Tag */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div
            className="w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs"
            style={dynamicStyles.iconStyle}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span
            className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate"
            title={title}
          >
            {title}
          </span>
        </div>

        {aggregation && aggregation !== 'none' && (
          <span
            className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md shrink-0 tracking-wide border shadow-2xs"
            style={dynamicStyles.badgeStyle}
          >
            {aggregation}
          </span>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-auto py-1">
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
        ) : (
          <div
            className="text-2xl sm:text-3xl font-black tracking-tight leading-none truncate"
            style={dynamicStyles.valueStyle}
            title={typeof value === 'number' ? value.toLocaleString() : String(value)}
          >
            {formattedVal}
          </div>
        )}
      </div>

      {/* Bottom Context label */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 truncate pt-1">
        <span className="truncate">{field ? `Field: ${field}` : 'Metric Summary'}</span>
        <span className="text-[9px] opacity-70">Live</span>
      </div>
    </div>
  );
}
