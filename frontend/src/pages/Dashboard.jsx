import React, { Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar.jsx';
import TopBar from '../components/layout/TopBar.jsx';
import ErrorBoundary from '../components/ui/ErrorBoundary.jsx';
import { findPanel, DEFAULT_PANEL } from '../panels.js';

function PanelFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="w-5 h-5 border-2 border-panel-accent/30 border-t-panel-accent rounded-full animate-spin" />
    </div>
  );
}

export default function Dashboard() {
  const { tab } = useParams();
  const panel = findPanel(tab);

  // Bilinmeyen adres varsayılan panele düşer (URL de düzeltilir).
  if (!panel) return <Navigate to={`/${DEFAULT_PANEL}`} replace />;

  const { Component, wrapperClass } = panel;
  const content = <Component />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        {/* pb-14 on mobile to avoid content hiding behind bottom nav */}
        <main className="flex-1 min-h-0 overflow-hidden pb-14 md:pb-0">
          <ErrorBoundary resetKey={panel.id}>
            <Suspense fallback={<PanelFallback />}>
              {wrapperClass ? <div className={wrapperClass}>{content}</div> : content}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
