import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Check, Sparkles, ArrowRight, ShieldCheck, Zap,
  Server, HelpCircle
} from 'lucide-react';

export default function PricingSection() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const [annualBilling, setAnnualBilling] = useState(true);

  const handleAction = () => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      openAuthModal('signup');
    }
  };

  const PLANS = [
    {
      name: 'Developer Community',
      tagline: 'Ideal for individual data practitioners & researchers',
      price: '$0',
      period: 'forever free',
      highlighted: false,
      buttonText: 'Start Free Trial',
      features: [
        'Local SQLite & CSV data analysis',
        'Conversational Text-to-SQL engine',
        'Standard ML model training (Scikit-Learn)',
        'Local Ollama inference integration',
        'Up to 100,000 rows per dataset',
        'Community Discord & Github support',
      ],
    },
    {
      name: 'Enterprise Professional',
      tagline: 'For high-velocity data teams requiring fast decision loops',
      price: annualBilling ? '$39' : '$49',
      period: 'per seat / month',
      highlighted: true,
      popularBadge: 'MOST POPULAR',
      buttonText: 'Launch Pro Workspace',
      features: [
        'Everything in Developer, plus:',
        'Ultra-fast Groq Llama-3.3-70B cloud inference',
        'XGBoost & LightGBM advanced training studio',
        'Apache ECharts dynamic dashboard builder',
        'Unlimited CSV & SQLite file ingestion',
        '1-Click REST API model microservices',
        'Priority email & ticket support (4h SLA)',
      ],
    },
    {
      name: 'Dedicated Enterprise',
      tagline: 'Full air-gapped on-premise governance & compliance',
      price: 'Custom',
      period: 'tailored annual contract',
      highlighted: false,
      buttonText: 'Contact Enterprise Sales',
      features: [
        'Everything in Professional, plus:',
        '100% Air-gapped on-premise Kubernetes deployment',
        'Direct PostgreSQL, Snowflake & BigQuery connectors',
        'Single Sign-On (SAML 2.0 / Okta / Azure AD)',
        'Custom fine-tuned domain LLM adapters',
        'Dedicated Solutions Architect & 24/7 SLA',
        'SOC2 Type II & HIPAA audit certification reports',
      ],
    },
  ];

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-slate-50 dark:bg-[#070b13] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      
      {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-bold text-violet-600 dark:text-violet-400">
            <Zap className="w-3.5 h-3.5" />
            <span>Transparent Predictable Pricing</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            Simple Investment. <span className="text-prajna-gradient">Infinite ROI.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            Start free on your local workstation. Scale seamlessly to enterprise air-gapped multi-node deployments as your data volume expands.
          </p>

          <div className="pt-4 flex items-center justify-center space-x-3">
            <span className={`text-xs font-bold ${!annualBilling ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setAnnualBilling(!annualBilling)}
              className="relative w-12 h-6 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors p-0.5 focus:outline-none"
            >
              <div
                className={`w-5 h-5 rounded-full bg-violet-600 shadow-md transform transition-transform ${
                  annualBilling ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center space-x-1.5">
              <span className={`text-xs font-bold ${annualBilling ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                Annual Billing
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/60">
                Save 20%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PLANS.map((plan, idx) => (
            <div
              key={idx}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all ${
                plan.highlighted
                  ? 'bg-white dark:bg-[#0c101a] border-2 border-violet-500 shadow-2xl shadow-violet-500/15 scale-105 z-10'
                  : 'bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              {plan.popularBadge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-prajna text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-violet-500/30">
                  {plan.popularBadge}
                </div>
              )}

              <div>
                <h3 className="text-xl font-extrabold text-slate-950 dark:text-white">
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[32px]">
                  {plan.tagline}
                </p>

                <div className="my-6 pb-6 border-b border-slate-100 dark:border-slate-800/80 flex items-baseline space-x-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-slate-950 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/{plan.period}</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start space-x-2.5">
                      <Check className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  onClick={handleAction}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all transform active:scale-98 ${
                    plan.highlighted
                      ? 'bg-gradient-prajna text-white shadow-lg shadow-violet-500/25 hover:opacity-95'
                      : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{plan.buttonText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div> */}
    </section>
  );
}
