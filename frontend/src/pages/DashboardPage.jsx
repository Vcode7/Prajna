import React, { useEffect, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { api } from '../api/client';
import {
  Database, BarChart3, BrainCircuit, Rocket, ArrowRight,
  Sparkles, CheckCircle2, Clock, Upload, Plus, Layers, ChevronRight
} from 'lucide-react';

export default function DashboardPage() {
  const { setActiveTab, setActiveDataset, setActiveExperiment, setActiveDeployment } = useChatStore();
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await api.getDashboardStats();
        setStatsData(data);
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const stats = statsData?.stats || {
    total_datasets: 0,
    total_visualizations: 0,
    total_trained_models: 0,
    total_deployed_models: 0
  };

  const recentSessions = statsData?.recent_sessions || [];
  const recentModels = statsData?.recent_models || [];
  const recentDeployments = statsData?.recent_deployments || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      
      {/* ── Welcome & Pipeline Stepper Banner ────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 p-8 text-white shadow-xl">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-violet-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered End-to-End Data Science Workspace</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            CSV Analysis → Visualizations → ML Training → Deployment
          </h1>
          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed">
            Upload any CSV dataset, automatically inspect data quality, explore recommended charts, 
            train state-of-the-art machine learning models with AI recommendations, test on sample data, 
            and deploy inference endpoints.
          </p>

          {/* Stepper Steps Shortcut */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { num: 1, label: 'Datasets', tab: 'datasets', desc: 'Upload & Profile' },
              { num: 2, label: 'Visualizations', tab: 'visualizations', desc: 'Single/Bi/Multi' },
              { num: 3, label: 'ML Training', tab: 'ml_training', desc: 'Algorithms & AI' },
              { num: 4, label: 'Testing', tab: 'testing', desc: 'Predict & Evaluate' },
              { num: 5, label: 'Deployments', tab: 'deployments', desc: 'Live Inference' },
            ].map((step) => (
              <button
                key={step.num}
                onClick={() => setActiveTab(step.tab)}
                className="flex flex-col text-left p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-400/30 text-white">
                    Step {step.num}
                  </span>
                  <ChevronRight className="w-3 h-3 text-violet-300" />
                </div>
                <span className="text-xs font-bold text-white truncate">{step.label}</span>
                <span className="text-[10px] text-violet-200 truncate">{step.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── Metric Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Uploaded Datasets',
            value: stats.total_datasets,
            icon: Database,
            color: 'text-violet-500',
            bg: 'bg-violet-500/10',
            tab: 'datasets',
            action: 'Manage Datasets'
          },
          {
            title: 'Saved Visualizations',
            value: stats.total_visualizations,
            icon: BarChart3,
            color: 'text-sky-500',
            bg: 'bg-sky-500/10',
            tab: 'visualizations',
            action: 'Explore Charts'
          },
          {
            title: 'Trained ML Models',
            value: stats.total_trained_models,
            icon: BrainCircuit,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            tab: 'ml_training',
            action: 'Train New Model'
          },
          {
            title: 'Active Deployments',
            value: stats.total_deployed_models,
            icon: Rocket,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            tab: 'deployments',
            action: 'Live Predictions'
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="my-3">
                <span className="text-3xl font-black tracking-tight">{card.value}</span>
              </div>
              <button
                onClick={() => setActiveTab(card.tab)}
                className="inline-flex items-center text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800/80"
              >
                <span>{card.action}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Recent Activity & Quick Navigation ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Datasets */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-bold">Recent Datasets</h3>
            </div>
            <button
              onClick={() => setActiveTab('datasets')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Upload New
            </button>
          </div>

          <div className="space-y-2">
            {recentSessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No datasets uploaded yet. Click below to start.
              </div>
            ) : (
              recentSessions.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setActiveDataset(d);
                    setActiveTab('datasets');
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-slate-100 dark:border-slate-700/50 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">
                      {d.name}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {d.row_count} rows • {d.column_count} cols
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-500 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Trained Models */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <BrainCircuit className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold">Trained Models</h3>
            </div>
            <button
              onClick={() => setActiveTab('ml_training')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Train Model
            </button>
          </div>

          <div className="space-y-2">
            {recentModels.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No models trained yet.
              </div>
            ) : (
              recentModels.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setActiveExperiment(m);
                    setActiveTab('testing');
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-100 dark:border-slate-700/50 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {m.model_name}
                    </h4>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                      <span>{m.algorithm}</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {m.metrics?.accuracy ? `Acc: ${(m.metrics.accuracy * 100).toFixed(1)}%` : (m.metrics?.r2_score ? `R²: ${m.metrics.r2_score}` : m.problem_type)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deployed Models */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Rocket className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold">Active Deployments</h3>
            </div>
            <button
              onClick={() => setActiveTab('deployments')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-2">
            {recentDeployments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No active deployments yet.
              </div>
            ) : (
              recentDeployments.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setActiveDeployment(d);
                    setActiveTab('deployments');
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-100 dark:border-slate-700/50 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      {d.deployment_name}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      v{d.version} • {d.status}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
