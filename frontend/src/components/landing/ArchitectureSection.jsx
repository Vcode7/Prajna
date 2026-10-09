import React from 'react';
import {
  Layers, Database, Cpu, BrainCircuit, BarChart3, ShieldCheck,
  Zap, ArrowRight, Server, FileText, CheckCircle2, Lock
} from 'lucide-react';

const ARCH_LAYERS = [
  {
    title: '1. Ingestion & Storage',
    tag: 'Data Layer',
    icon: Database,
    items: ['CSV & Multi-Sheet Excel Ingestion', 'DuckDB & SQLite In-Memory Engine', 'Enterprise ERP & PostgreSQL Adapters', 'Automatic Data Profiling & Cleaning'],
  },
  {
    title: '2. Cognitive Intelligence',
    tag: 'LLM Reasoning',
    icon: BrainCircuit,
    items: ['Groq Cloud Llama-3.3-70B (Fast)', 'Local Private Ollama Qwen 3.8 / 14B', 'Prompt Optimizers & Schema Reflection', 'Syntactic SQL Guardrails & Dry-Runs'],
  },
  {
    title: '3. Analytics & ML Engine',
    tag: 'Compute Layer',
    icon: Cpu,
    items: ['Dynamic Scikit-Learn Pipeline', 'XGBoost & LightGBM Regressors', 'Apache ECharts High-Speed Renderer', 'Automated Hyperparameter Tuning'],
  },
  {
    title: '4. Decision & Action Delivery',
    tag: 'Consumption Layer',
    icon: Zap,
    items: ['Multi-Tile Drag-and-Drop Dashboards', 'Single-Click REST Prediction APIs', 'Executive Briefs & Automated Alerts', 'Audit Logging & RBAC Governance'],
  },
];

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="py-24 lg:py-32 bg-slate-50 dark:bg-[#070b13] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-500/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-bold text-violet-600 dark:text-violet-400">
            <Layers className="w-3.5 h-3.5" />
            <span>Under The Hood</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            Enterprise-Grade <span className="text-prajna-gradient">End-to-End Pipeline.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            Designed for sub-15ms analytics latency, complete cryptographic isolation, and zero foreign model training on your proprietary corporate datasets.
          </p>
        </div>

        {/* 4 Architecture Layer Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ARCH_LAYERS.map((layer, idx) => {
            const LayerIcon = layer.icon;

            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-violet-500/50 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60">
                      <LayerIcon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {layer.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-950 dark:text-white mb-4">
                    {layer.title}
                  </h3>

                  <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {layer.items.map((item, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-mono text-slate-400">
                  Subsystem {idx + 1} • High Availability
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
