import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import client from './api/client.js';
import { DEFAULT_PANEL } from './panels.js';

function Splash() {
  return (
    <div className="min-h-screen bg-panel-bg flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-panel-accent/30 border-t-panel-accent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { setUser, user } = useStore();
  // 'loading' durumu olmadan, /auth/me daha dönmeden kullanıcı null olduğu için
  // her sayfa yenilemesinde bir anlığına login ekranı görünüyordu.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    client.get('/auth/me', { skipAuthRedirect: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [setUser]);

  if (checking) return <Splash />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={`/${DEFAULT_PANEL}`} replace /> : <Login />}
        />
        {/* Her panelin kendi adresi var: /docker, /logs … Böylece yer imi,
            tarayıcı geri tuşu ve sayfa yenileme doğru panelde kalıyor. */}
        <Route
          path="/:tab"
          element={user ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="*"
          element={<Navigate to={user ? `/${DEFAULT_PANEL}` : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
