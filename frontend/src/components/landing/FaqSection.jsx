import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

const FAQS = [
  {
    q: 'What types of data can I ingest into PRAJNA?',
    a: 'PRAJNA seamlessly ingests CSV, multi-sheet Excel (.xlsx), SQLite databases, DuckDB files, and direct enterprise ERP connections. There are no strict row limits—the internal engine profiles schemas and builds vector indexes automatically.',
  },
  {
    q: 'How does the Conversational Text-to-SQL engine prevent hallucinations?',
    a: 'PRAJNA uses a dual-pass schema reflection system. First, it extracts foreign keys, data types, and enum distributions. Before executing any query, it validates the SQL against an isolated dry-run parser to ensure semantic and syntactic accuracy.',
  },
  {
    q: 'Can PRAJNA run completely offline or on an air-gapped server?',
    a: 'Yes. PRAJNA natively supports local inference via Ollama (including Qwen, Llama, and Mistral models). When deployed on-premise, zero data packets leave your network, making it suitable for defense, healthcare, and banking environments.',
  },
  {
    q: 'How does the Automated Machine Learning (AutoML) Studio work?',
    a: 'You simply select your target variable and problem type (Classification, Regression, or Anomaly Detection). PRAJNA automatically splits the dataset, runs 5-fold cross-validation, evaluates multiple models (Random Forest, XGBoost, LightGBM), and produces full metric dashboards.',
  },
  {
    q: 'Can I export or deploy trained models as production REST APIs?',
    a: 'Yes. In the Model Detail Hub, you can click "Deploy Model" to immediately launch a live REST API microservice with Swagger documentation, ready to receive JSON payloads from your existing backend services.',
  },
  {
    q: 'How is user authentication and workspace access managed?',
    a: 'PRAJNA features role-based access control (RBAC) with support for enterprise SSO via SAML 2.0 (Okta, Azure AD, Google). You can organize data into projects with fine-grained team permissions.',
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-24 bg-slate-50 dark:bg-[#070b13] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs font-bold text-violet-600 dark:text-violet-400">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            Frequently Asked <span className="text-prajna-gradient">Questions.</span>
          </h2>

          <p className="text-base text-slate-600 dark:text-slate-300 font-normal">
            Everything you need to know about PRAJNA enterprise deployment, security, and algorithms.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {FAQS.map((item, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl bg-white dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs transition-all"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm sm:text-base font-bold text-slate-950 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transform transition-transform ${
                      isOpen ? 'rotate-180 text-violet-500' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 font-normal">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
