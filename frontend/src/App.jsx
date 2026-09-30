import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardBuilderPage from './pages/DashboardBuilderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard/:dashboardId" element={<DashboardBuilderPage />} />
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
