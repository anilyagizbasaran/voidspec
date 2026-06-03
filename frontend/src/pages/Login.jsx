import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore.js';
import client from '../api/client.js';
import { Cpu, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await client.post('/auth/login', { username, password });
      const me = await client.get('/auth/me');
      setUser(me.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-panel-bg flex items-center justify-center relative overflow-hidden">

      {/* Dot grid background */}
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />

      {/* Radial glow center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(88,166,255,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4 animate-fade-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-panel-surface border border-panel-border mb-4"
            style={{ boxShadow: '0 0 24px rgba(88,166,255,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <Cpu size={24} className="text-panel-accent" />
          </div>
          <h1 className="text-xl font-bold text-panel-text tracking-tight">ServerPanel</h1>
          <p className="text-panel-muted text-xs mt-1">Ubuntu Server Management</p>
        </div>

        {/* Form card */}
        <div
          className="card-gradient-border bg-panel-surface rounded-2xl p-6"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset' }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-panel-muted uppercase tracking-wider font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-panel-bg border border-panel-border rounded-lg px-3 py-2.5 text-sm text-panel-text placeholder-panel-muted/40
                  focus:outline-none focus:border-panel-accent focus:ring-1 focus:ring-panel-accent/20 transition-all"
                placeholder="admin"
                autoFocus
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-panel-muted uppercase tracking-wider font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-panel-bg border border-panel-border rounded-lg px-3 py-2.5 pr-9 text-sm text-panel-text placeholder-panel-muted/40
                    focus:outline-none focus:border-panel-accent focus:ring-1 focus:ring-panel-accent/20 transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text transition-colors"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-panel-red/10 border border-panel-red/25 rounded-lg px-3 py-2.5">
                <AlertCircle size={13} className="text-panel-red shrink-0" />
                <span className="text-panel-red text-xs">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 bg-panel-accent text-white rounded-lg px-4 py-2.5 text-sm font-semibold
                hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 mt-1"
              style={{ boxShadow: '0 1px 8px rgba(88,166,255,0.3)' }}
            >
              <Lock size={13} />
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-panel-muted text-[11px] mt-5">
          Secure access · Session expires in 24h
        </p>
      </div>
    </div>
  );
}
