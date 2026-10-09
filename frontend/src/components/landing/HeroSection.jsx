import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Sparkles, ArrowRight, Play, Database, BrainCircuit, BarChart3,
  CheckCircle2, ShieldCheck, Zap, Terminal, TrendingUp, Layers,
  ChevronRight, RefreshCw, Cpu
} from 'lucide-react';

const PRESET_QUERIES = [
  {
    id: 'forecast',
    label: 'Forecast Q4 Revenue & Risk',
    prompt: 'Predict Q4 revenue variance across European distribution hubs and flag high-risk accounts',
    sql: `SELECT hub_region, SUM(projected_sales) AS q4_est,\n       AVG(risk_score) AS risk_index\nFROM enterprise_sales\nWHERE fiscal_quarter = 'Q4'\nGROUP BY hub_region HAVING risk_index > 0.35;`,
    model: 'XGBoost Multi-Variate Regressor',
    accuracy: '98.7% Accuracy',
    latency: '11.4 ms',
    chartType: 'Confidence Band Area Chart',
    insight: 'Identified 3 distribution centers in DACH region with 18.4% supply chain margin vulnerability. Recommended stock rebalancing by Oct 24.',
    metrics: [
      { label: 'Projected Revenue', val: '$48.2M', change: '+14.2%' },
      { label: 'Margin At Risk', val: '$2.1M', change: '-4.8%' },
      { label: 'Model Confidence', val: '99.1%', change: 'High' },
    ],
  },
  {
    id: 'churn',
    label: 'Auto-Train Churn Predictor',
    prompt: 'Train Random Forest classifier on ERP invoice churn and identify primary retention drivers',
    sql: `SELECT customer_id, recency_days, frequency_orders,\n       monetary_value, churn_flag\nFROM customer_erp_profiles\nORDER BY monetary_value DESC LIMIT 5000;`,
    model: 'Random Forest Classifier v2.4',
    accuracy: '97.4% F1-Score',
    latency: '14.2 ms',
    chartType: 'Feature Importance Heatmap',
    insight: 'Top churn determinant: payment delay > 22 days combined with support tickets > 3. Automated retention webhooks armed for 412 enterprise accounts.',
    metrics: [
      { label: 'Accounts Analyzed', val: '24,800', change: '100% Data' },
      { label: 'Churn Prevention', val: '$840K', change: 'Protected' },
      { label: 'ROC-AUC Score', val: '0.984', change: 'Optimal' },
    ],
  },
  {
    id: 'anomaly',
    label: 'Supply Chain Bottlenecks',
    prompt: 'Detect manufacturing cycle time anomalies and correlate with factory shipment delays',
    sql: `SELECT factory_id, AVG(cycle_time_hrs) AS avg_cycle,\n       COUNT(delay_event) AS delay_count\nFROM factory_production_orders\nWHERE production_date >= date('now', '-90 days')\nGROUP BY factory_id ORDER BY delay_count DESC;`,
    model: 'Isolation Forest Anomaly Detector',
    accuracy: '99.2% Precision',
    latency: '9.8 ms',
    chartType: 'Multi-Scatter Anomaly Matrix',
    insight: 'Factory 02 cycle time spiked 3.4σ above baseline during shifts 2 & 3 due to component SKU-884 shortages. Auto-escalated to Procurement.',
    metrics: [
      { label: 'Anomalies Isolated', val: '14 Events', change: 'Real-time' },
      { label: 'Downtime Prevented', val: '128 Hours', change: '+32%' },
      { label: 'Inference Speed', val: '9.8ms', change: 'Instant' },
    ],
  },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const activeQuery = PRESET_QUERIES[activeQueryIndex];

  const handleSelectQuery = (idx) => {
    setIsSimulating(true);
    setActiveQueryIndex(idx);
    setTimeout(() => setIsSimulating(false), 300);
  };

  const handlePrimaryCTA = () => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      openAuthModal('signup');
    }
  };

  return (
    <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 overflow-hidden bg-[#f8fafc] dark:bg-[#090d16] bg-mesh-subtle">
      
      {/* ── Ambient Radial Glow Orbs ──────────────────────────────── */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/15 dark:bg-violet-600/20 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-[350px] h-[350px] bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-[90px] pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-grid-dots opacity-40 dark:opacity-20 pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── Top Eyebrow Badge ────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6">
          
          <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-300 backdrop-blur-sm animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-beacon" />
            <span className="font-extrabold text-violet-600 dark:text-violet-400 tracking-wider">PRAJNA</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-slate-600 dark:text-slate-400 font-medium">Predictive Research &amp; Analytics for Judgement, Navigation &amp; Action</span>
          </div>

          {/* ── Monumental Headline ───────────────────────────────── */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 dark:text-white leading-[1.08] max-w-4xl">
            Turn Data Into{' '}
            <span className="text-prajna-gradient relative inline-block">
              Decisions.
              <span className="absolute -bottom-1.5 left-0 right-0 h-1 bg-gradient-prajna rounded-full opacity-60" />
            </span>
          </h1>

          {/* ── Subtitle Copy ─────────────────────────────────────── */}
          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 font-normal max-w-2xl leading-relaxed">
            AI-powered analytics, instant database visualization, autonomous forecasting, and automated machine learning training for enterprise operations.
          </p>

          {/* ── Call to Action Buttons ────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto pt-2">
            <button
              onClick={handlePrimaryCTA}
              className="w-full sm:w-auto flex items-center justify-center space-x-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-prajna hover:opacity-95 shadow-lg shadow-violet-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>{isAuthenticated ? 'Open Enterprise Workspace' : 'Launch Platform Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {!isAuthenticated ? (
              <button
                onClick={() => openAuthModal('login')}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-violet-500/50 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-xs transition-all"
              >
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>Sign In to Account</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/app')}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-violet-500/50 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-xs transition-all"
              >
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>Go to Analytics Studio</span>
              </button>
            )}

            <a
              href="#capabilities"
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-5 py-3.5 rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Explore Features</span>
            </a>
          </div>

          {/* ── Trust Pillars & Metrics Bar ───────────────────────── */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-violet-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">&lt; 15ms</span>
              <span>Query Latency</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-violet-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">98.7%</span>
              <span>Model Precision</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Zero Data Egress</span>
              <span>(Air-Gapped Ready)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Local Ollama + Groq Cloud</span>
            </div>
          </div>
        </div>

        {/* ── Interactive Hero Showcase Canvas ────────────────────── */}
        <div className="mt-14 lg:mt-18 max-w-5xl mx-auto">
          
          {/* Preset Queries Switcher */}
          <div className="flex items-center justify-center gap-2 mb-4 overflow-x-auto pb-2 px-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:inline">
              Try Live Query:
            </span>
            {PRESET_QUERIES.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => handleSelectQuery(idx)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
                  activeQueryIndex === idx
                    ? 'bg-violet-600 text-white border border-violet-600 shadow-md shadow-violet-500/20'
                    : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-violet-500/50'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Browser Container Mockup */}
          <div className="relative rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise overflow-hidden transition-all">
            
            {/* Window Top Navigation Bar */}
            <div className="h-11 px-4 bg-slate-50/80 dark:bg-[#0f1422] border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-400/80" />
                <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-[11px] font-mono text-slate-400">prajna.internal/workspace/predictive-bi</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                  <Cpu className="w-3 h-3" />
                  <span>{activeQuery.model}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  ⚡ {activeQuery.latency}
                </span>
              </div>
            </div>

            {/* Interactive Query Input Bar */}
            <div className="p-4 sm:p-5 bg-white dark:bg-[#0c101a] border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 focus-within:border-violet-500/60 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
                <Sparkles className="w-5 h-5 text-violet-500 shrink-0 animate-pulse" />
                <input
                  type="text"
                  readOnly
                  value={activeQuery.prompt}
                  className="bg-transparent w-full text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <button
                  onClick={() => handleSelectQuery((activeQueryIndex + 1) % PRESET_QUERIES.length)}
                  className="p-1.5 text-slate-400 hover:text-violet-500 rounded-lg transition-colors"
                  title="Cycle Next Query"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Live Workspace Grid */}
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left Column: Metrics & Live Dynamic Visualization (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* 3 Real-time Metric Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  {activeQuery.metrics.map((m, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-slate-50/70 dark:bg-[#111726]/70 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight block truncate">
                        {m.label}
                      </span>
                      <div className="flex items-baseline space-x-1.5 mt-1">
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          {m.val}
                        </span>
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                          {m.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Simulated Visual Chart Card */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#111726]/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-violet-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {activeQuery.chartType}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {activeQuery.accuracy}
                    </span>
                  </div>

                  {/* SVG Simulated Chart Wave */}
                  <div className="h-44 w-full relative flex items-end justify-between pt-4 px-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradientViolet" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={
                          activeQueryIndex === 0
                            ? "M0,120 Q60,90 120,60 T240,40 T360,75 T480,20 L480,150 L0,150 Z"
                            : activeQueryIndex === 1
                            ? "M0,140 Q80,110 160,70 T320,50 T420,30 T500,15 L500,150 L0,150 Z"
                            : "M0,80 Q70,40 140,90 T280,30 T400,100 T500,25 L500,150 L0,150 Z"
                        }
                        fill="url(#chartGradientViolet)"
                      />
                      <path
                        d={
                          activeQueryIndex === 0
                            ? "M0,120 Q60,90 120,60 T240,40 T360,75 T480,20"
                            : activeQueryIndex === 1
                            ? "M0,140 Q80,110 160,70 T320,50 T420,30 T500,15"
                            : "M0,80 Q70,40 140,90 T280,30 T400,100 T500,25"
                        }
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx="360" cy="75" r="5" fill="#8b5cf6" className="animate-ping opacity-75" />
                      <circle cx="360" cy="75" r="4" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
                      <circle cx="480" cy="20" r="5" fill="#7c3aed" />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-400 font-mono">
                    <span>Baseline (T-90)</span>
                    <span>Trained Epoch 40/40</span>
                    <span>Projected Horizon (T+90)</span>
                  </div>
                </div>

              </div>

              {/* Right Column: SQL Synthesis & Executive Reasoning (5 cols) */}
              <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
                
                {/* Generated SQL Code Block */}
                <div className="rounded-2xl bg-slate-900 text-slate-100 p-3.5 font-mono text-[11px] border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-violet-400" />
                      <span className="font-bold text-slate-300">Auto-Synthesized SQL</span>
                    </div>
                    <span className="text-violet-400 font-bold">DuckDB / SQLite</span>
                  </div>
                  <pre className="overflow-x-auto text-[10.5px] leading-relaxed text-violet-200/90 whitespace-pre">
                    {activeQuery.sql}
                  </pre>
                </div>

                {/* Executive Judgment & Reasoning */}
                <div className="p-4 rounded-2xl bg-violet-50/60 dark:bg-[#151c2e] border border-violet-200/70 dark:border-violet-950/70">
                  <div className="flex items-center space-x-2 mb-2">
                    <BrainCircuit className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      PRAJNA Executive Judgement
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                    {activeQuery.insight}
                  </p>
                  
                  <div className="mt-3 pt-3 border-t border-violet-200/60 dark:border-violet-900/40 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Action Status:</span>
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      Pipeline Armed &amp; Monitored
                    </span>
                  </div>
                </div>

                {/* Direct Action Link into Platform */}
                <button
                  onClick={handlePrimaryCTA}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  <span>Open This Workflow in Workspace</span>
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
