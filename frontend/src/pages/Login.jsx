import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore.js';
import client from '../api/client.js';
import { Terminal, Lock } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-panel-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Terminal size={32} className="text-panel-cyan" />
            <h1 className="text-2xl font-semibold text-panel-text">ServerPanel</h1>
          </div>
          <p className="text-panel-muted text-sm">Ubuntu Server Management</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel-surface border border-panel-border rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-xs text-panel-muted mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-panel-text focus:outline-none focus:border-panel-accent text-sm"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs text-panel-muted mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-panel-text focus:outline-none focus:border-panel-accent text-sm"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-panel-red text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-panel-accent text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            <Lock size={14} />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
