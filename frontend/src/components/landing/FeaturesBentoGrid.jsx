import React from 'react';
import {
  Database, BrainCircuit, BarChart3, ShieldCheck, Cpu,
  Sparkles, Zap, ArrowRight, Code2, LineChart, FileSpreadsheet,
  GitBranch, Server, Layers, CheckCircle2
} from 'lucide-react';

export default function FeaturesBentoGrid() {
  return (
    <section id="capabilities" className="py-24 lg:py-32 bg-slate-50 dark:bg-[#070b13] relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-indigo-500/08 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-bold text-violet-600 dark:text-violet-400 shadow-xs">
            <Cpu className="w-3.5 h-3.5" />
            <span>Enterprise-Grade Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            Built for High-Stakes <span className="text-prajna-gradient">Decision Velocity.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            Eliminate fragmented tools. PRAJNA unifies natural language database querying, autonomous model training, and executive visualization into one cohesive operating system.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Large Featured Card (2 Columns on Desktop) */}
          <div className="lg:col-span-2 p-8 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-violet-500/50 transition-all flex flex-col justify-between group">
            <div className="space-y-4 max-w-xl">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60 shadow-xs">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                Conversational Text-to-SQL &amp; Direct Database Introspection
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Ask questions in colloquial English. PRAJNA dynamically analyzes foreign keys, table schemas, and data types to generate syntactically perfect SQL queries with automated execution safety checks.
              </p>
            </div>

            {/* Simulated Live Query Preview Widget */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 shadow-inner space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5 text-violet-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Natural Query
                </span>
                <span className="text-emerald-400 font-bold">Latency: 11.2ms</span>
              </div>
              <p className="text-slate-300 font-sans italic text-xs">
                "Rank sales reps by margin contribution in Q3 and highlight those below 12% quota."
              </p>
              <div className="bg-slate-950 p-2.5 rounded-xl text-violet-300 text-[11px] overflow-x-auto leading-relaxed">
                SELECT rep_name, SUM(revenue * margin_pct) AS contribution_margin<br/>
                FROM enterprise_sales WHERE quarter = 'Q3'<br/>
                GROUP BY rep_name ORDER BY contribution_margin DESC;
              </div>
            </div>
          </div>

          {/* Card 2: Zero-Code AutoML Studio */}
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-violet-500/50 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60 shadow-xs">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Autonomous Machine Learning Studio
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Zero boilerplate Python required. Train Random Forest, XGBoost, and LightGBM models directly from tabular datasets with automated hyperparameter tuning.
              </p>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Model Evaluation</span>
                <span className="font-extrabold text-violet-600 dark:text-violet-400">98.4% ROC-AUC</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-prajna h-full rounded-full w-[98%]" />
              </div>
              <span className="text-[10px] text-slate-400 block pt-1">
                Cross-validated over 5 folds • Auto-persisted to Model Hub
              </span>
            </div>
          </div>

          {/* Card 3: Self-Generating Visualizations & BI */}
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-violet-500/50 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60 shadow-xs">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Apache ECharts &amp; AI Visualizations
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                High-performance vector charts generated on the fly. Interactive heatmaps, confidence scatter bands, bar breakdowns, and multi-axis timelines.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 text-xs">
              <div className="flex items-center space-x-2">
                <LineChart className="w-4 h-4 text-violet-500" />
                <span className="font-bold text-slate-800 dark:text-slate-200">Interactive Canvas</span>
              </div>
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-full">
                Zero Config
              </span>
            </div>
          </div>

          {/* Card 4: Private On-Premise Shield */}
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-violet-500/50 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Private &amp; Air-Gapped Deployment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Run fully air-gapped on your own GPUs via Ollama, or harness lightning-fast inference on Groq Cloud with guaranteed zero customer data retention.
              </p>
            </div>

            <div className="mt-6 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-[11px]">SOC2 Type II • HIPAA &amp; GDPR Ready</span>
            </div>
          </div>

          {/* Card 5: Model Deployment & REST Endpoints */}
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-violet-500/50 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60 shadow-xs">
                <Server className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Single-Click Model APIs
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Turn any trained machine learning model into a production REST endpoint in 1 click. Complete with OpenAPI docs, payload validation, and latency logging.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 text-xs font-mono">
              <span className="text-slate-500">POST /api/models/predict</span>
              <span className="text-emerald-500 font-bold">200 OK</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
