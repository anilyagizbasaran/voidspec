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
      setError(err.response?.data?.error || 'Kullanıcı adı ya da parola yanlış.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-panel-bg flex items-center justify-center relative overflow-hidden">

      {/* Rack-ruler backdrop — the tick marks of a server rail, not a decorative grid */}
      <div className="absolute inset-0 bg-rack-ruler opacity-50 pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4 animate-fade-up">

        {/* Nameplate */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md border border-panel-border-light bg-panel-surface flex items-center justify-center shrink-0">
            <Cpu size={18} className="text-panel-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-panel-text truncate">ServerPanel</h1>
            <p className="text-panel-muted text-xs truncate">Ubuntu sunucu yönetimi</p>
          </div>
          <span className="led led-ok ml-auto shrink-0" title="Sunucu ayakta" />
        </div>

        {/* Form panel */}
        <div className="bg-panel-surface border border-panel-border rounded-md p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-panel-muted font-medium">Kullanıcı adı</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2.5 text-sm font-mono text-panel-text placeholder-panel-muted/40
                  focus:outline-none focus:border-panel-accent focus:ring-1 focus:ring-panel-accent/20 transition-colors"
                placeholder="admin"
                autoFocus
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-panel-muted font-medium">Parola</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2.5 pr-9 text-sm font-mono text-panel-text placeholder-panel-muted/40
                    focus:outline-none focus:border-panel-accent focus:ring-1 focus:ring-panel-accent/20 transition-colors"
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
              <div className="flex items-center gap-2 bg-panel-red/10 border border-panel-red/25 rounded px-3 py-2.5">
                <AlertCircle size={13} className="text-panel-red shrink-0" />
                <span className="text-panel-red text-xs">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 bg-panel-accent text-panel-bg rounded px-4 py-2.5 text-[15px] font-semibold
                hover:bg-panel-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 mt-1"
            >
              <Lock size={13} />
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-panel-bg/30 border-t-panel-bg rounded-full animate-spin" />
                  Doğrulanıyor…
                </span>
              ) : 'Giriş yap'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-panel-muted text-xs mt-5">
          Oturum 24 saat açık kalır.
        </p>
      </div>
    </div>
  );
}
