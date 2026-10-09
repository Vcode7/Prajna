import React, { useState } from 'react';
import {
  TrendingUp, Search, BarChart3, Brain, Compass, Zap,
  CheckCircle2, ArrowRight, Sparkles, Shield, Cpu
} from 'lucide-react';

const PILLARS = [
  {
    letter: 'P',
    title: 'Predictive',
    tagline: 'Autonomous Forecasting & Regression',
    icon: TrendingUp,
    description: 'Trained algorithms forecast multi-variate sales volumes, inventory attrition, customer churn, and operational bottlenecks before they impact margin.',
    deliverables: [
      'Multi-variate ARIMA & Prophet series projections',
      'XGBoost & LightGBM classification models',
      'Continuous anomaly detection with sigma confidence bands',
    ],
    metric: '99.4% Horizon Precision',
  },
  {
    letter: 'R',
    title: 'Research',
    tagline: 'Deep Exploratory Data Mining',
    icon: Search,
    description: 'Autonomous agents audit data distributions, detect missing values, test statistical hypotheses, and uncover non-obvious enterprise cross-table correlations.',
    deliverables: [
      'Automated schema introspection and relational graphing',
      'Pearson & Spearman correlation matrices',
      'Synthetic data scenario stress-testing',
    ],
    metric: '10x Faster Hypothesis Validation',
  },
  {
    letter: 'A',
    title: 'Analytics',
    tagline: 'Conversational SQL & BI Engine',
    icon: BarChart3,
    description: 'Transform complex English questions into optimized SQL queries instantly. Seamless execution on SQLite, DuckDB, or high-throughput PostgreSQL data warehouses.',
    deliverables: [
      'Natural language to syntactically verified SQL',
      'Direct CSV, Excel & ERP batch ingestion',
      'Instant aggregations, pivot tables, and filters',
    ],
    metric: '< 15ms Query Response',
  },
  {
    letter: 'J',
    title: 'Judgement',
    tagline: 'Multi-Model Cognitive Reasoning',
    icon: Brain,
    description: 'Go beyond raw data numbers. PRAJNA synthesizes executive judgement, evaluating business trade-offs, confidence levels, and downside risks with LLM reasoning.',
    deliverables: [
      'Executive-level qualitative risk analysis',
      'Confidence scoring with explicit uncertainty bounds',
      'Multi-model ensemble voting (Qwen, Llama, DeepSeek)',
    ],
    metric: 'Zero-Hallucination Guardrails',
  },
  {
    letter: 'N',
    title: 'Navigation',
    tagline: 'Prescriptive Decision Roadmaps',
    icon: Compass,
    description: 'PRAJNA charts clear operational trajectories. Instead of just displaying what happened, it prescribes the exact next steps your leadership team should take.',
    deliverables: [
      'Prescriptive scenario roadmaps (Best, Expected, Worst)',
      'Supply chain and resource allocation guidance',
      'Real-time KPI progress tracking against fiscal targets',
    ],
    metric: 'Clear Strategic Next Steps',
  },
  {
    letter: 'A',
    title: 'Action',
    tagline: 'Automated Operations & Deployment',
    icon: Zap,
    description: 'Close the loop between insight and outcome. Deploy trained machine learning models as production REST endpoints, schedule reports, and arm operational alerts.',
    deliverables: [
      '1-Click REST API model microservice deployment',
      'Automated ERP trigger webhooks and Slack/Email alerts',
      'Self-updating executive dashboards and weekly briefs',
    ],
    metric: 'Single-Click Production Ready',
  },
];

export default function PrajnaPhilosophySection() {
  const [activeTab, setActiveTab] = useState(0);
  const activePillar = PILLARS[activeTab];
  const Icon = activePillar.icon;

  return (
    <section id="philosophy" className="py-24 lg:py-32 bg-white dark:bg-[#090d16] border-y border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-indigo-500/08 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-900/60 text-violet-600 dark:text-violet-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Enterprise Intelligence Framework</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            What is <span className="text-prajna-gradient">PRAJNA?</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            PRAJNA is an ancient Sanskrit term representing profound insight, supreme wisdom, and decisive discrimination. We engineered it into a 6-pillar enterprise system:
          </p>
        </div>

        {/* The 6 Letters Acrostic Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {PILLARS.map((p, idx) => {
            const PillarIcon = p.icon;
            const isActive = activeTab === idx;

            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between group ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-violet-500 shadow-lg shadow-violet-500/15'
                    : 'bg-slate-50/80 dark:bg-[#0f1422] border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-violet-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-2xl font-black ${isActive ? 'text-violet-400' : 'text-violet-600 dark:text-violet-400'}`}>
                    {p.letter}
                  </span>
                  <div className={`p-1.5 rounded-xl ${isActive ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 group-hover:text-violet-500'} transition-colors`}>
                    <PillarIcon className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <h3 className="font-extrabold text-sm leading-tight">
                    {p.title}
                  </h3>
                  <p className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {p.tagline.split(' ')[0]} {p.tagline.split(' ')[1]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Selected Pillar Showcase Card */}
        <div className="rounded-3xl bg-slate-50 dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-10 shadow-enterprise transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-prajna flex items-center justify-center text-white shadow-md shadow-violet-500/25">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                      Pillar {activeTab + 1} of 6
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-xs font-bold text-slate-500">{activePillar.metric}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">
                    {activePillar.letter} is for <span className="text-prajna-gradient">{activePillar.title}</span>
                  </h3>
                </div>
              </div>

              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {activePillar.description}
              </p>

              {/* Deliverables List */}
              <div className="space-y-2.5 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Enterprise Capabilities:
                </h4>
                {activePillar.deliverables.map((item, i) => (
                  <div key={i} className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Interactive Visual Card (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500">Autonomous Workflow</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold">
                  Active in PRAJNA Studio
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">Target Engine</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">PRAJNA Core / {activePillar.title} Pipeline</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">Impact Metric</span>
                  <span className="text-violet-600 dark:text-violet-400 font-extrabold text-sm">{activePillar.metric}</span>
                </div>

                <div className="p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-900/40 text-[11px] text-violet-800 dark:text-violet-300">
                  ⚡ Pre-configured and ready to run against your enterprise databases and CSV files.
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
