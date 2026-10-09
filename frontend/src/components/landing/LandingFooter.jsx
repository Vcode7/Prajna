import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart, Terminal, Layers, Globe, Code } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs font-sans border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand Col (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-9 px-2.5 py-1 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <img src="/logo.png" alt="PRAJNA Logo" className="h-6 w-auto max-w-[110px] object-contain" />
              </div>
              <span className="font-black text-lg tracking-wider text-white">PRAJNA</span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Predictive Research &amp; Analytics for Judgement, Navigation &amp; Action. The unified enterprise intelligence operating system connecting conversational SQL, automated ML training, and decision pipelines.
            </p>

            <div className="pt-2 flex items-center space-x-3 text-slate-400">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </span>
              <span className="text-[10px] text-slate-500">v2.4.0-enterprise</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Product</h4>
            <ul className="space-y-2">
              <li><a href="#capabilities" className="hover:text-white transition-colors">Text-to-SQL Engine</a></li>
              <li><a href="#ml-studio" className="hover:text-white transition-colors">AutoML Studio</a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">Apache ECharts BI</a></li>
              <li><a href="#architecture" className="hover:text-white transition-colors">System Architecture</a></li>
              <li><Link to="/app" className="hover:text-violet-400 font-bold transition-colors">Launch Workspace</Link></li>
            </ul>
          </div>

          {/* Solutions & Framework */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">PRAJNA Framework</h4>
            <ul className="space-y-2">
              <li><a href="#philosophy" className="hover:text-white transition-colors">P — Predictive</a></li>
              <li><a href="#philosophy" className="hover:text-white transition-colors">R — Research</a></li>
              <li><a href="#philosophy" className="hover:text-white transition-colors">A — Analytics</a></li>
              <li><a href="#philosophy" className="hover:text-white transition-colors">J — Judgement</a></li>
              <li><a href="#philosophy" className="hover:text-white transition-colors">N — Navigation</a></li>
              <li><a href="#philosophy" className="hover:text-white transition-colors">A — Action</a></li>
            </ul>
          </div>

          {/* Compliance & Security */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Enterprise</h4>
            <ul className="space-y-2">
              <li><a href="#security" className="hover:text-white transition-colors">Air-Gapped Deployment</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Zero Data Retention</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">SOC2 Type II Certified</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Plans &amp; Licensing</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Enterprise Portal</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-14 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} PRAJNA AI Corp. All rights reserved.
          </div>
          <div className="flex items-center space-x-6">
            <a href="#security" className="hover:text-slate-400">Security Whitepaper</a>
            <a href="#security" className="hover:text-slate-400">Privacy Policy</a>
            <a href="#security" className="hover:text-slate-400">Terms of Service</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
