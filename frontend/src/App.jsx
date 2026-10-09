import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import MainLayout from './layouts/MainLayout';
import DashboardBuilderPage from './pages/DashboardBuilderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public Enterprise Landing Page ────────────────────── */}
        <Route path="/" element={<HomePage />} />

        {/* ── Enterprise Authentication Flow ───────────────────── */}
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="/signup" element={<AuthPage initialMode="signup" />} />

        {/* ── Dashboard Builder ─────────────────────────────────── */}
        <Route path="/dashboard/:dashboardId" element={<DashboardBuilderPage />} />

        {/* ── Central Enterprise Workspace & Studio ─────────────── */}
        <Route path="/app/*" element={<MainLayout />} />
        <Route path="/workspace/*" element={<MainLayout />} />

        {/* ── Fallback ─────────────────────────────────────────── */}
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
