import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function CtaBanner() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuthStore();

  const handleAction = () => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      openAuthModal('signup');
    }
  };

  return (
    <section className="py-20 lg:py-28 bg-white dark:bg-[#090d16] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="relative rounded-3xl bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 p-8 sm:p-14 lg:p-20 text-white shadow-2xl shadow-violet-600/25 overflow-hidden">
          
          {/* Ambient Overlay Patterns */}
          <div className="absolute inset-0 bg-grid-dots opacity-20 pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-black/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
            
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready for Immediate Deployment</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Turn Your Enterprise Data Into Decisive Action Today.
            </h2>

            <p className="text-base sm:text-lg text-white/90 leading-relaxed font-medium max-w-2xl mx-auto">
              Experience the full power of PRAJNA. Connect your databases, run conversational SQL, train predictive models, and publish real-time dashboards in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={handleAction}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-slate-900 font-extrabold text-sm hover:bg-slate-50 shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-2.5"
              >
                <span>{isAuthenticated ? 'Enter Workspace' : 'Launch Free Account'}</span>
                <ArrowRight className="w-4 h-4 text-violet-600" />
              </button>

              {!isAuthenticated && (
                <button
                  onClick={() => openAuthModal('login')}
                  className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-black/30 hover:bg-black/40 text-white border border-white/30 font-bold text-sm backdrop-blur-md transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Sign In to Account</span>
                </button>
              )}
            </div>

            <div className="pt-4 flex items-center justify-center space-x-6 text-xs text-white/80 font-medium">
              <span>✓ No credit card required</span>
              <span>✓ Instant local or cloud execution</span>
              <span>✓ Air-gapped on-premise ready</span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
