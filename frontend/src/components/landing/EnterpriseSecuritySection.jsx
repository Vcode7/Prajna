import React from 'react';
import {
  ShieldCheck, Lock, Server, EyeOff, KeyRound, FileCheck,
  CheckCircle2, Sparkles, AlertCircle
} from 'lucide-react';

const SECURITY_POINTS = [
  {
    icon: Server,
    title: '100% Air-Gapped Deployment',
    desc: 'Deploy inside your VPC or isolated on-premise Kubernetes clusters. No outbound telemetry, phone-homes, or third-party cloud dependencies.',
  },
  {
    icon: EyeOff,
    title: 'Zero Data Retention Guarantee',
    desc: 'Your proprietary ERP databases and CSV rows are NEVER used to train external LLMs. Memory is strictly ephemeral and cryptographically wiped.',
  },
  {
    icon: Lock,
    title: 'SOC2 Type II & ISO 27001 Ready',
    desc: 'Engineered following strict enterprise controls, TLS 1.3 in-transit encryption, AES-256 data-at-rest encryption, and comprehensive immutable audit trails.',
  },
  {
    icon: KeyRound,
    title: 'Enterprise SSO & Role-Based Access',
    desc: 'Seamless integration with Okta, Microsoft Azure AD, Google Workspace, and PingFederate via SAML 2.0 and OpenID Connect (OIDC).',
  },
];

export default function EnterpriseSecuritySection() {
  return (
    <section id="security" className="py-24 lg:py-32 bg-white dark:bg-[#090d16] border-b border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Enterprise Security &amp; Compliance</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white">
            Your Proprietary Data <span className="text-prajna-gradient">Never Leaves Your Perimeter.</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
            Engineered from ground zero for defence-grade compliance, regulated industries, healthcare, financial institutions, and confidential IP operations.
          </p>
        </div>

        {/* 4 Security Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {SECURITY_POINTS.map((item, idx) => {
            const ItemIcon = item.icon;

            return (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-slate-50/70 dark:bg-[#0c101a] border border-slate-200/90 dark:border-slate-800 shadow-enterprise flex space-x-5 group hover:border-emerald-500/50 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/60 shrink-0">
                  <ItemIcon className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security Compliance Badges Ribbon */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-50 dark:bg-[#0f1422] border border-slate-200/80 dark:border-slate-800 max-w-4xl mx-auto flex flex-wrap items-center justify-around gap-6 text-xs font-mono text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">SOC2 Type II</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">HIPAA Compliant</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">GDPR &amp; CCPA</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">AES-256 / TLS 1.3</span>
          </div>
        </div>

      </div>
    </section>
  );
}
