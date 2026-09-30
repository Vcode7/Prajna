/**
 * Dashboard Theme Templates & Card Styles Definition Engine
 * Provides professionally curated color palettes (light & dark),
 * multiple card style presets, and utility helper functions.
 */

export const THEME_TEMPLATES = [
  {
    id: 'royal_indigo',
    name: 'Royal Indigo',
    category: 'Vibrant Modern',
    previewSwatches: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6'],
    light: {
      background: 'bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/50',
      canvasBg: '#f8faff',
      surface: '#ffffff',
      primary: '#6366f1',
      primaryGradient: 'from-indigo-600 to-violet-600',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      text: {
        primary: '#0f172a',
        secondary: '#475569',
        muted: '#94a3b8'
      },
      border: '#e2e8f0',
      chartColors: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#f59e0b']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#090b14] via-[#0e1224] to-[#080913]',
      canvasBg: '#090b14',
      surface: '#101426',
      primary: '#818cf8',
      primaryGradient: 'from-indigo-500 to-violet-500',
      secondary: '#a78bfa',
      accent: '#f472b6',
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b'
      },
      border: '#1e293b',
      chartColors: ['#818cf8', '#a78bfa', '#f472b6', '#60a5fa', '#2dd4bf', '#fbbf24']
    }
  },
  {
    id: 'oceanic_cyan',
    name: 'Oceanic Cyan',
    category: 'Vibrant Modern',
    previewSwatches: ['#0284c7', '#06b6d4', '#3b82f6', '#10b981'],
    light: {
      background: 'bg-gradient-to-br from-slate-50 via-sky-50/40 to-cyan-50/40',
      canvasBg: '#f0f9ff',
      surface: '#ffffff',
      primary: '#0284c7',
      primaryGradient: 'from-sky-600 to-cyan-600',
      secondary: '#0891b2',
      accent: '#0ea5e9',
      text: {
        primary: '#0f172a',
        secondary: '#334155',
        muted: '#94a3b8'
      },
      border: '#e0f2fe',
      chartColors: ['#0284c7', '#06b6d4', '#3b82f6', '#10b981', '#6366f1', '#f59e0b']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#050b14] via-[#071324] to-[#040810]',
      canvasBg: '#050b14',
      surface: '#0b172a',
      primary: '#38bdf8',
      primaryGradient: 'from-sky-500 to-cyan-500',
      secondary: '#22d3ee',
      accent: '#60a5fa',
      text: {
        primary: '#f0f9ff',
        secondary: '#bae6fd',
        muted: '#64748b'
      },
      border: '#1e3a5f',
      chartColors: ['#38bdf8', '#22d3ee', '#60a5fa', '#34d399', '#818cf8', '#fbbf24']
    }
  },
  {
    id: 'emerald_aurora',
    name: 'Emerald Aurora',
    category: 'Nature & Tech',
    previewSwatches: ['#059669', '#14b8a6', '#0d9488', '#84cc16'],
    light: {
      background: 'bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/50',
      canvasBg: '#f0fdf4',
      surface: '#ffffff',
      primary: '#059669',
      primaryGradient: 'from-emerald-600 to-teal-600',
      secondary: '#0d9488',
      accent: '#10b981',
      text: {
        primary: '#064e3b',
        secondary: '#374151',
        muted: '#9ca3af'
      },
      border: '#d1fae5',
      chartColors: ['#059669', '#14b8a6', '#0284c7', '#84cc16', '#f59e0b', '#8b5cf6']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#040d08] via-[#071810] to-[#030a06]',
      canvasBg: '#040d08',
      surface: '#091f15',
      primary: '#34d399',
      primaryGradient: 'from-emerald-500 to-teal-500',
      secondary: '#2dd4bf',
      accent: '#a3e635',
      text: {
        primary: '#ecfdf5',
        secondary: '#a7f3d0',
        muted: '#6ee7b7'
      },
      border: '#134e35',
      chartColors: ['#34d399', '#2dd4bf', '#38bdf8', '#a3e635', '#fbbf24', '#c084fc']
    }
  },
  {
    id: 'sunset_horizon',
    name: 'Sunset Horizon',
    category: 'Warm & Dynamic',
    previewSwatches: ['#f97316', '#f59e0b', '#ef4444', '#fb923c'],
    light: {
      background: 'bg-gradient-to-br from-slate-50 via-amber-50/40 to-orange-50/40',
      canvasBg: '#fffaf5',
      surface: '#ffffff',
      primary: '#ea580c',
      primaryGradient: 'from-orange-600 to-amber-600',
      secondary: '#d97706',
      accent: '#f97316',
      text: {
        primary: '#1c1917',
        secondary: '#44403c',
        muted: '#a8a29e'
      },
      border: '#ffedd5',
      chartColors: ['#f97316', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#10b981']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#120a06] via-[#1a0f08] to-[#0d0704]',
      canvasBg: '#120a06',
      surface: '#20130b',
      primary: '#fb923c',
      primaryGradient: 'from-orange-500 to-amber-500',
      secondary: '#fbbf24',
      accent: '#f87171',
      text: {
        primary: '#fff7ed',
        secondary: '#fed7aa',
        muted: '#78716c'
      },
      border: '#432616',
      chartColors: ['#fb923c', '#fbbf24', '#f87171', '#c084fc', '#38bdf8', '#34d399']
    }
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    category: 'High Contrast',
    previewSwatches: ['#ec4899', '#06b6d4', '#eab308', '#8b5cf6'],
    light: {
      background: 'bg-gradient-to-br from-slate-50 via-pink-50/30 to-purple-50/30',
      canvasBg: '#fdf4ff',
      surface: '#ffffff',
      primary: '#db2777',
      primaryGradient: 'from-pink-600 to-cyan-600',
      secondary: '#7c3aed',
      accent: '#0891b2',
      text: {
        primary: '#0f172a',
        secondary: '#475569',
        muted: '#94a3b8'
      },
      border: '#fce7f3',
      chartColors: ['#ec4899', '#06b6d4', '#eab308', '#8b5cf6', '#10b981', '#f97316']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#0c0514] via-[#140822] to-[#09030f]',
      canvasBg: '#0c0514',
      surface: '#190c2e',
      primary: '#f472b6',
      primaryGradient: 'from-pink-500 to-cyan-500',
      secondary: '#22d3ee',
      accent: '#facc15',
      text: {
        primary: '#fdf2f8',
        secondary: '#fbcfe8',
        muted: '#701a75'
      },
      border: '#4a1d6d',
      chartColors: ['#f472b6', '#22d3ee', '#facc15', '#a78bfa', '#34d399', '#fb923c']
    }
  },
  {
    id: 'slate_corporate',
    name: 'Slate Corporate',
    category: 'Executive & Clean',
    previewSwatches: ['#2563eb', '#0284c7', '#475569', '#64748b'],
    light: {
      background: 'bg-gradient-to-br from-slate-100/80 via-slate-50 to-blue-50/20',
      canvasBg: '#f8fafc',
      surface: '#ffffff',
      primary: '#2563eb',
      primaryGradient: 'from-blue-600 to-slate-700',
      secondary: '#475569',
      accent: '#0284c7',
      text: {
        primary: '#0f172a',
        secondary: '#334155',
        muted: '#94a3b8'
      },
      border: '#cbd5e1',
      chartColors: ['#2563eb', '#0284c7', '#475569', '#10b981', '#f59e0b', '#8b5cf6']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#0b0f19] via-[#0f1422] to-[#080b12]',
      canvasBg: '#0b0f19',
      surface: '#131929',
      primary: '#60a5fa',
      primaryGradient: 'from-blue-500 to-slate-400',
      secondary: '#94a3b8',
      accent: '#38bdf8',
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b'
      },
      border: '#1e293b',
      chartColors: ['#60a5fa', '#38bdf8', '#94a3b8', '#34d399', '#fbbf24', '#a78bfa']
    }
  },
  {
    id: 'midnight_velvet',
    name: 'Midnight Velvet',
    category: 'Ultra Sleek',
    previewSwatches: ['#334155', '#818cf8', '#38bdf8', '#cbd5e1'],
    light: {
      background: 'bg-gradient-to-br from-slate-100 via-zinc-50 to-slate-200/50',
      canvasBg: '#f4f4f5',
      surface: '#ffffff',
      primary: '#334155',
      primaryGradient: 'from-slate-800 to-slate-600',
      secondary: '#6366f1',
      accent: '#0ea5e9',
      text: {
        primary: '#020617',
        secondary: '#334155',
        muted: '#64748b'
      },
      border: '#e2e8f0',
      chartColors: ['#334155', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#030407] via-[#06080e] to-[#020305]',
      canvasBg: '#030407',
      surface: '#0b0e17',
      primary: '#cbd5e1',
      primaryGradient: 'from-slate-300 to-indigo-400',
      secondary: '#818cf8',
      accent: '#38bdf8',
      text: {
        primary: '#ffffff',
        secondary: '#94a3b8',
        muted: '#475569'
      },
      border: '#161c2b',
      chartColors: ['#cbd5e1', '#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f472b6']
    }
  },
  {
    id: 'rose_gold',
    name: 'Rose Gold',
    category: 'Elegance',
    previewSwatches: ['#e11d48', '#be185d', '#fb7185', '#f59e0b'],
    light: {
      background: 'bg-gradient-to-br from-slate-50 via-rose-50/40 to-pink-50/30',
      canvasBg: '#fff1f2',
      surface: '#ffffff',
      primary: '#e11d48',
      primaryGradient: 'from-rose-600 to-pink-600',
      secondary: '#be185d',
      accent: '#fb7185',
      text: {
        primary: '#1c1917',
        secondary: '#4c0519',
        muted: '#9f1239'
      },
      border: '#ffe4e6',
      chartColors: ['#e11d48', '#be185d', '#fb7185', '#f59e0b', '#8b5cf6', '#0ea5e9']
    },
    dark: {
      background: 'bg-gradient-to-br from-[#120408] via-[#1a080d] to-[#0c0305]',
      canvasBg: '#120408',
      surface: '#210a12',
      primary: '#fb7185',
      primaryGradient: 'from-rose-500 to-pink-500',
      secondary: '#f43f5e',
      accent: '#fda4af',
      text: {
        primary: '#fff1f2',
        secondary: '#fecdd3',
        muted: '#881337'
      },
      border: '#4c0519',
      chartColors: ['#fb7185', '#f43f5e', '#fda4af', '#fbbf24', '#c084fc', '#38bdf8']
    }
  }
];

export const CARD_STYLES = [
  {
    id: 'glass',
    name: 'Glass',
    subtitle: 'Frosted Glassmorphism',
    description: 'Translucent frosted backdrop with specular highlights and depth blur',
    lightClass: 'bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]',
    darkClass: 'bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]',
    headerLight: 'bg-white/40 border-b border-white/40',
    headerDark: 'bg-white/5 border-b border-white/10',
  },
  {
    id: 'metallic',
    name: 'Metallic',
    subtitle: 'Titanium & Brushed Steel',
    description: 'Subtle titanium sheen with crisp chrome bevels and specular edge',
    lightClass: 'bg-gradient-to-br from-slate-100/95 via-slate-50 to-slate-200/90 border border-slate-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_4px_16px_rgba(0,0,0,0.06)]',
    darkClass: 'bg-gradient-to-br from-[#1b2230] via-[#141924] to-[#1e2636] border border-slate-700/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.4)]',
    headerLight: 'bg-slate-200/40 border-b border-slate-300/80',
    headerDark: 'bg-white/[0.04] border-b border-slate-700/80',
  },
  {
    id: 'solid',
    name: 'Solid',
    subtitle: 'Classic High Contrast',
    description: 'High-contrast opaque surface with crisp borders and clean elevation',
    lightClass: 'bg-white border border-slate-200 shadow-md',
    darkClass: 'bg-[#101524] border border-slate-800 shadow-xl',
    headerLight: 'bg-slate-50/80 border-b border-slate-100',
    headerDark: 'bg-slate-900/50 border-b border-slate-800/80',
  },
  {
    id: 'neumorphic',
    name: 'Neumorphic',
    subtitle: 'Soft Tactile Relief',
    description: 'Tactile embossed surface with soft directional dual-shadow extrusion',
    lightClass: 'bg-[#f0f3f8] border border-slate-200/50 shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(166,180,200,0.25)]',
    darkClass: 'bg-[#0d121c] border border-slate-800/40 shadow-[-6px_-6px_14px_rgba(255,255,255,0.02),_6px_6px_14px_rgba(0,0,0,0.6)]',
    headerLight: 'bg-transparent border-b border-slate-200/60',
    headerDark: 'bg-transparent border-b border-slate-800/60',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    subtitle: 'Borderless & Flat',
    description: 'Ultra-clean hairline outline focusing entirely on data and typography',
    lightClass: 'bg-white/95 border border-slate-200/60 shadow-2xs hover:border-slate-300 transition-colors',
    darkClass: 'bg-[#0c101a]/95 border border-slate-800/50 shadow-2xs hover:border-slate-700 transition-colors',
    headerLight: 'bg-transparent border-b border-slate-100',
    headerDark: 'bg-transparent border-b border-slate-800/40',
  }
];

// Fallback mappings for old theme ids ('purple', 'blue', 'orange', 'dark', 'emerald', 'custom')
const LEGACY_THEME_MAP = {
  purple: 'royal_indigo',
  blue: 'oceanic_cyan',
  emerald: 'emerald_aurora',
  orange: 'sunset_horizon',
  dark: 'midnight_velvet',
  custom: 'custom'
};

export const DEFAULT_CUSTOM_PALETTE = {
  light: {
    background: '#f8faff',
    surface: '#ffffff',
    primary: '#4f46e5',
    secondary: '#7c3aed',
    accent: '#ec4899',
    text: '#0f172a',
    border: '#e2e8f0',
    chartColors: ['#4f46e5', '#7c3aed', '#ec4899', '#2563eb', '#10b981', '#f59e0b']
  },
  dark: {
    background: '#090b14',
    surface: '#101426',
    primary: '#818cf8',
    secondary: '#a78bfa',
    accent: '#f472b6',
    text: '#f8fafc',
    border: '#1e293b',
    chartColors: ['#818cf8', '#a78bfa', '#f472b6', '#60a5fa', '#2dd4bf', '#fbbf24']
  }
};

/**
 * Resolves a template object from an ID or legacy string, with custom accent and customTheme support.
 */
export function resolveThemeTemplate(themeIdOrObj = 'royal_indigo', customAccent = null, customTheme = null) {
  // If already an object with light/dark properties, validate or return it
  if (themeIdOrObj && typeof themeIdOrObj === 'object') {
    if (themeIdOrObj.light && themeIdOrObj.dark) {
      if ((themeIdOrObj.id === 'custom' || customAccent) && customAccent) {
        return {
          ...themeIdOrObj,
          id: 'custom',
          name: 'Custom Theme',
          previewSwatches: [customAccent, '#8b5cf6', '#ec4899', '#3b82f6'],
          light: {
            ...themeIdOrObj.light,
            primary: customAccent,
            accent: customAccent,
            chartColors: [customAccent, ...(themeIdOrObj.light.chartColors?.slice(1) || [])]
          },
          dark: {
            ...themeIdOrObj.dark,
            primary: customAccent,
            accent: customAccent,
            chartColors: [customAccent, ...(themeIdOrObj.dark.chartColors?.slice(1) || [])]
          }
        };
      }
      return themeIdOrObj;
    }
    if (themeIdOrObj.id) {
      themeIdOrObj = themeIdOrObj.id;
    }
  }

  const themeId = typeof themeIdOrObj === 'string' ? themeIdOrObj : 'royal_indigo';
  const normalizedId = LEGACY_THEME_MAP[themeId] || themeId;

  // Dedicated handling for expanded custom theme
  if (normalizedId === 'custom' || (!themeIdOrObj && customTheme)) {
    const rawLight = customTheme?.light || customTheme || {};
    const rawDark = customTheme?.dark || customTheme || {};

    const customLight = {
      background: rawLight.background || DEFAULT_CUSTOM_PALETTE.light.background,
      surface: rawLight.surface || rawLight.card || DEFAULT_CUSTOM_PALETTE.light.surface,
      primary: rawLight.primary || customAccent || DEFAULT_CUSTOM_PALETTE.light.primary,
      secondary: rawLight.secondary || DEFAULT_CUSTOM_PALETTE.light.secondary,
      accent: rawLight.accent || customAccent || DEFAULT_CUSTOM_PALETTE.light.accent,
      text: rawLight.text || DEFAULT_CUSTOM_PALETTE.light.text,
      border: rawLight.border || DEFAULT_CUSTOM_PALETTE.light.border,
      chartColors: Array.isArray(rawLight.chartColors) && rawLight.chartColors.length > 0
        ? rawLight.chartColors
        : DEFAULT_CUSTOM_PALETTE.light.chartColors
    };

    const customDark = {
      background: rawDark.background || DEFAULT_CUSTOM_PALETTE.dark.background,
      surface: rawDark.surface || rawDark.card || DEFAULT_CUSTOM_PALETTE.dark.surface,
      primary: rawDark.primary || customAccent || DEFAULT_CUSTOM_PALETTE.dark.primary,
      secondary: rawDark.secondary || DEFAULT_CUSTOM_PALETTE.dark.secondary,
      accent: rawDark.accent || customAccent || DEFAULT_CUSTOM_PALETTE.dark.accent,
      text: rawDark.text || DEFAULT_CUSTOM_PALETTE.dark.text,
      border: rawDark.border || DEFAULT_CUSTOM_PALETTE.dark.border,
      chartColors: Array.isArray(rawDark.chartColors) && rawDark.chartColors.length > 0
        ? rawDark.chartColors
        : DEFAULT_CUSTOM_PALETTE.dark.chartColors
    };

    const swatches = customLight.chartColors.slice(0, 4);

    return {
      id: 'custom',
      name: 'Custom Theme',
      category: 'User Custom',
      previewSwatches: swatches.length >= 4 ? swatches : [customLight.primary, customLight.secondary, customLight.accent, customLight.chartColors[0]],
      light: {
        background: 'bg-transparent',
        canvasBg: customLight.background,
        surface: customLight.surface,
        primary: customLight.primary,
        primaryGradient: `from-[${customLight.primary}] to-[${customLight.secondary}]`,
        secondary: customLight.secondary,
        accent: customLight.accent,
        text: {
          primary: customLight.text,
          secondary: customLight.text === '#0f172a' ? '#475569' : `${customLight.text}cc`,
          muted: customLight.text === '#0f172a' ? '#94a3b8' : `${customLight.text}88`
        },
        border: customLight.border,
        chartColors: customLight.chartColors
      },
      dark: {
        background: 'bg-transparent',
        canvasBg: customDark.background,
        surface: customDark.surface,
        primary: customDark.primary,
        primaryGradient: `from-[${customDark.primary}] to-[${customDark.secondary}]`,
        secondary: customDark.secondary,
        accent: customDark.accent,
        text: {
          primary: customDark.text,
          secondary: customDark.text === '#f8fafc' ? '#cbd5e1' : `${customDark.text}cc`,
          muted: customDark.text === '#f8fafc' ? '#64748b' : `${customDark.text}88`
        },
        border: customDark.border,
        chartColors: customDark.chartColors
      }
    };
  }

  const found = THEME_TEMPLATES.find(t => t.id === normalizedId) || THEME_TEMPLATES[0];

  if (customAccent) {
    return {
      ...found,
      id: 'custom',
      name: 'Custom Accent',
      previewSwatches: [customAccent, '#8b5cf6', '#ec4899', '#3b82f6'],
      light: {
        ...found.light,
        primary: customAccent,
        accent: customAccent,
        chartColors: [customAccent, ...found.light.chartColors.slice(1)]
      },
      dark: {
        ...found.dark,
        primary: customAccent,
        accent: customAccent,
        chartColors: [customAccent, ...found.dark.chartColors.slice(1)]
      }
    };
  }

  return found;
}

/**
 * Returns the card container classes and header classes for a given style and color mode.
 */
export function getCardStyleMeta(cardStyleId = 'glass', isDark = false) {
  const style = CARD_STYLES.find(s => s.id === cardStyleId) || CARD_STYLES[0];
  return {
    containerClass: isDark ? style.darkClass : style.lightClass,
    headerClass: isDark ? style.headerDark : style.headerLight,
    styleConfig: style
  };
}

/**
 * Returns box-shadow CSS value based on shadow toggle and intensity level.
 */
export function getChartShadowStyle(enabled = true, intensity = 'medium', isDark = false) {
  if (!enabled || intensity === 'none') {
    return 'none';
  }

  switch (intensity) {
    case 'light':
      return isDark
        ? '0 4px 14px -2px rgba(0, 0, 0, 0.45)'
        : '0 2px 8px -1px rgba(0, 0, 0, 0.06), 0 1px 3px -1px rgba(0, 0, 0, 0.04)';
    case 'strong':
      return isDark
        ? '0 24px 50px -8px rgba(0, 0, 0, 0.9), 0 10px 22px -4px rgba(0, 0, 0, 0.75)'
        : '0 20px 42px -8px rgba(0, 0, 0, 0.16), 0 8px 18px -4px rgba(0, 0, 0, 0.08)';
    case 'medium':
    default:
      return isDark
        ? '0 12px 32px -4px rgba(0, 0, 0, 0.72), 0 4px 12px -2px rgba(0, 0, 0, 0.5)'
        : '0 8px 24px -4px rgba(0, 0, 0, 0.09), 0 3px 8px -2px rgba(0, 0, 0, 0.05)';
  }
}

