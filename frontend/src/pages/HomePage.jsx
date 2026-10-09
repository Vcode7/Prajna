import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import FeaturesBentoGrid from '../components/landing/FeaturesBentoGrid';
import PrajnaPhilosophySection from '../components/landing/PrajnaPhilosophySection';
import InteractiveWorkflowSection from '../components/landing/InteractiveWorkflowSection';
import ArchitectureSection from '../components/landing/ArchitectureSection';
import EnterpriseSecuritySection from '../components/landing/EnterpriseSecuritySection';
import PricingSection from '../components/landing/PricingSection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import FaqSection from '../components/landing/FaqSection';
import CtaBanner from '../components/landing/CtaBanner';
import LandingFooter from '../components/landing/LandingFooter';
import AuthModal from '../components/auth/AuthModal';

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    // Set page title for SEO & branding
    document.title = 'PRAJNA — Predictive Research & Analytics for Judgement, Navigation & Action';
  }, []);

  // If already authenticated, redirect directly to the workspace studio
  if (isAuthenticated && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-slate-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* ── 1. Sticky Navigation Bar ───────────────────────────────── */}
      <LandingNavbar />

      {/* ── 2. Monumental Hero Section ─────────────────────────────── */}
      <main>
        <HeroSection />

        {/* ── 3. Enterprise Features Bento Grid ────────────────────── */}
        <FeaturesBentoGrid />

        {/* ── 4. The 6 PRAJNA Pillars Framework ────────────────────── */}
        <PrajnaPhilosophySection />

        {/* ── 5. Interactive 4-Step Operational Flow ───────────────── */}
        <InteractiveWorkflowSection />

        {/* ── 6. System Architecture ───────────────────────────────── */}
        <ArchitectureSection />

        {/* ── 7. Defense-Grade Security & Air-Gapped Compliance ────── */}
        <EnterpriseSecuritySection />

        {/* ── 8. Pricing & Enterprise Licensing ────────────────────── */}
        <PricingSection />

        {/* ── 9. Executive Testimonials & Impact Metrics ───────────── */}
        <TestimonialsSection />

        {/* ── 10. Frequently Asked Questions ───────────────────────── */}
        <FaqSection />

        {/* ── 11. Final High-Impact Conversion Banner ──────────────── */}
        <CtaBanner />
      </main>

      {/* ── 12. Enterprise Footer ──────────────────────────────────── */}
      <LandingFooter />

      {/* ── Global Authentication Modal ────────────────────────────── */}
      <AuthModal />
    </div>
  );
}
