import React, { useState } from 'react';
import {
  FileSpreadsheet, MessageSquare, BrainCircuit, Rocket,
  CheckCircle2, ArrowRight, Play, Terminal, Database, BarChart3,
  ChevronRight, Sparkles
} from 'lucide-react';

const STEPS = [
  {
    number: '01',
    title: 'Ingest Any Dataset',
    subtitle: 'Drag & Drop CSV, Excel, or Connect SQLite/ERP',
    icon: FileSpreadsheet,
    badge: 'Instant Ingestion',
    description: 'Upload complex tabular datasets up to millions of records. PRAJNA automatically profiles column distributions, infers relational schemas, and creates lightning-fast in-memory query indexes.',
    preview: {
      type: 'table',
      title: 'enterprise_invoices.csv (3.2 MB profiled)',
      headers: ['invoice_id', 'customer_segment', 'gross_sales', 'payment_status', 'delay_risk'],
      rows: [
        ['INV-88219', 'Global Enterprise', '$142,500.00', 'PAID', 'Low (0.04)'],
        ['INV-88220', 'Mid-Market SaaS', '$48,200.00', 'PENDING', 'Medium (0.42)'],
        ['INV-88221', 'Government Agency', '$520,000.00', 'PAID', 'Low (0.01)'],
        ['INV-88222', 'Strategic Retailer', '$89,150.00', 'OVERDUE', 'High (0.89)'],
      ],
    },
  },
  {
    number: '02',
    title: 'Ask in Natural Language',
    subtitle: 'Conversational Text-to-SQL & Statistical Auditing',
    icon: MessageSquare,
    badge: 'LLM Powered',
    description: 'No need to construct multi-table JOINs manually. Simply prompt PRAJNA: "Which retail customers have overdue balances exceeding 60 days?" The AI synthesizes, executes, and validates the SQL code in milliseconds.',
    preview: {
      type: 'chat',
      userQuery: 'Find all accounts with high payment risk and summarize their exposure by geographic region',
      sqlGenerated: 'SELECT region, COUNT(invoice_id) AS risk_invoices, SUM(gross_sales) AS total_exposure FROM enterprise_invoices WHERE delay_risk > 0.75 GROUP BY region ORDER BY total_exposure DESC;',
      resultSummary: '3 regions identified with critical cashflow exposure: EMEA ($1.4M), APAC ($980K), LATAM ($420K).',
    },
  },
  {
    number: '03',
    title: 'Train Machine Learning Models',
    subtitle: 'Automated Model Selection, Hyperparameter Search & Metrics',
    icon: BrainCircuit,
    badge: 'Zero-Code AutoML',
    description: 'Select your target variable with one click. PRAJNA trains, benchmarks, and tunes Random Forest, XGBoost, and Logistic Regression algorithms, generating confusion matrices, ROC curves, and feature importance rankings.',
    preview: {
      type: 'ml',
      modelName: 'XGBoost Invoice Risk Predictor v1.8',
      metrics: [
        { name: 'Precision', val: '98.9%' },
        { name: 'Recall', val: '97.4%' },
        { name: 'F1-Score', val: '98.1%' },
        { name: 'Latency', val: '12.4ms' },
      ],
      topFeatures: [
        { feat: 'days_past_due', importance: '42%' },
        { feat: 'credit_rating', importance: '28%' },
        { feat: 'dispute_history', importance: '19%' },
      ],
    },
  },
  {
    number: '04',
    title: 'Deploy & Automate Decisions',
    subtitle: 'Single-Click Dashboards, REST Endpoints & Webhooks',
    icon: Rocket,
    badge: 'Production Ready',
    description: 'Publish interactive business dashboards with drag-and-drop tiles, or deploy your trained model as a live production REST endpoint with automated retries and real-time inference telemetry.',
    preview: {
      type: 'deploy',
      endpoint: 'https://api.prajna.internal/v2/predict/invoice_risk',
      status: '200 OK • 12ms',
      dashboardName: 'Executive Supply & Revenue Cockpit',
      featuresActive: ['Real-time Risk Alerting', 'Automated Weekly Briefs', 'REST Microservice Live'],
    },
  },
];

export default function InteractiveWorkflowSection() {
  const [activeStep, setActiveStep] = useState(0);
  const current = STEPS[activeStep];
  const StepIcon = current.icon;

  return (
    <section className="py-24 lg:py-32 bg-white dark:bg-[#090d16] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-900/60 text-xs font-bold text-violet-600 dark:text-violet-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Operational Flow</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            From Raw Tabular Data to <span className="text-prajna-gradient">Decisive Action.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            See how PRAJNA orchestrates the entire intelligence lifecycle in 4 seamless, zero-friction steps:
          </p>
        </div>

        {/* 4 Step Selector Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STEPS.map((s, idx) => {
            const SIcon = s.icon;
            const isActive = activeStep === idx;

            return (
              <button
                key={s.number}
                onClick={() => setActiveStep(idx)}
                className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between group ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-violet-500 shadow-lg shadow-violet-500/15'
                    : 'bg-slate-50 dark:bg-[#0c101a] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-violet-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-black font-mono px-2 py-1 rounded-lg ${isActive ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    STEP {s.number}
                  </span>
                  <SIcon className={`w-5 h-5 ${isActive ? 'text-violet-400' : 'text-slate-400 group-hover:text-violet-500'} transition-colors`} />
                </div>

                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-snug">
                    {s.title}
                  </h3>
                  <p className={`text-[11px] mt-1 line-clamp-1 ${isActive ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {s.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Step Deep Dive Canvas */}
        <div className="rounded-3xl bg-slate-50 dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-10 shadow-enterprise transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 text-[10px] font-black uppercase tracking-wider">
                {current.badge}
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white leading-tight">
                {current.title}
              </h3>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {current.description}
              </p>

              <div className="pt-2">
                <button
                  onClick={() => setActiveStep((activeStep + 1) % STEPS.length)}
                  className="inline-flex items-center space-x-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 group"
                >
                  <span>Next: {STEPS[(activeStep + 1) % STEPS.length].title}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Right Live Simulation Canvas (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6 overflow-hidden">
              
              {/* Step 1 Table Preview */}
              {current.preview.type === 'table' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                      {current.preview.title}
                    </span>
                    <span className="text-emerald-500">Auto-Indexed</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200/60 dark:border-slate-800">
                          {current.preview.headers.map((h, i) => (
                            <th key={i} className="py-2 px-3 font-semibold text-[11px] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {current.preview.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 2 Chat & SQL Preview */}
              {current.preview.type === 'chat' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-900/40 font-sans">
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold block mb-1">PROMPT:</span>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold">{current.preview.userQuery}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">GENERATED SQL:</span>
                    <p className="text-violet-300 leading-relaxed text-[11px]">{current.preview.sqlGenerated}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 font-sans">
                    <span className="text-[10px] text-emerald-600 font-bold block mb-1">EXECUTIVE SUMMARY:</span>
                    <p className="text-slate-700 dark:text-slate-300 text-xs">{current.preview.resultSummary}</p>
                  </div>
                </div>
              )}

              {/* Step 3 ML Studio Preview */}
              {current.preview.type === 'ml' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-violet-500" />
                      {current.preview.modelName}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      Trained &amp; Validated
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {current.preview.metrics.map((m, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">{m.name}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">{m.val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Predictive Features:</span>
                    {current.preview.topFeatures.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-600 dark:text-slate-300">{f.feat}</span>
                        <span className="text-violet-600 dark:text-violet-400 font-bold">{f.importance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4 Deployment Preview */}
              {current.preview.type === 'deploy' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block">ACTIVE REST MICROSERVICE:</span>
                    <div className="flex items-center justify-between">
                      <span className="text-violet-300 truncate text-[11px]">{current.preview.endpoint}</span>
                      <span className="text-emerald-400 font-bold text-[10px] ml-2 shrink-0">{current.preview.status}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{current.preview.dashboardName}</span>
                      <span className="text-[10px] text-violet-600 font-bold">Auto-Syncing</span>
                    </div>
                    <div className="space-y-1.5">
                      {current.preview.featuresActive.map((f, i) => (
                        <div key={i} className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
