import React from 'react';
import { Star, Quote, Building2, TrendingUp, ShieldCheck } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "PRAJNA transformed how our cross-functional teams interact with enterprise databases. What took our data engineering team 4 days to extract and model is now done in under 15 seconds by business operators directly.",
    name: "Dr. Elena Vance",
    role: "Chief Data Officer",
    company: "Apex Global Industries",
    initials: "EV",
    metric: "10x Analytics Acceleration",
  },
  {
    quote: "The ability to train XGBoost models and immediately deploy them as REST prediction endpoints in one seamless window without spinning up separate ML pipelines is worth its weight in gold.",
    name: "Marcus Chen",
    role: "Lead Machine Learning Engineer",
    company: "Neural Dynamics Labs",
    initials: "MC",
    metric: "98.7% Horizon Precision",
  },
  {
    quote: "For financial institutions, data leakage is an absolute dealbreaker. PRAJNA's air-gapped architecture running on our local GPU cluster gives us cutting-edge intelligence with zero compliance risk.",
    name: "Sarah Jenkins",
    role: "VP of Business Analytics",
    company: "Logix Logistics & Trade",
    initials: "SJ",
    metric: "100% Air-Gapped Security",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-white dark:bg-[#090d16] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-900/60 text-xs font-bold text-violet-600 dark:text-violet-400">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>Proven Enterprise Impact</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            Trusted by Leaders <span className="text-prajna-gradient">Shaping Modern Industry.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            See how enterprise executives and machine learning researchers leverage PRAJNA to drive decisive operational outcomes.
          </p>
        </div>

        {/* Testimonials Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-slate-50 dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise flex flex-col justify-between group hover:border-violet-500/50 transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-500 space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                    {t.metric}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed font-normal">
                  "{t.quote}"
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-prajna flex items-center justify-center font-bold text-xs text-white shadow-sm">
                  {t.initials}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-950 dark:text-white">{t.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.role}</p>
                  <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">{t.company}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
