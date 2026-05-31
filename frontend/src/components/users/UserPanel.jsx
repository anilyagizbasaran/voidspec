import React, { useState } from 'react';
import {
  Users, Plus, Trash2, RefreshCw, X, Check, Key, Lock, Unlock,
  ChevronRight, AlertTriangle, Eye, EyeOff, Shield,
} from 'lucide-react';
import {
  useUsers, useUserDetail, useCreateUser, useDeleteUser,
  useChangePassword, useLockUser, useAddSSHKey, useDeleteSSHKey,
} from '../../hooks/useUsers.js';

// ── User detail panel ────────────────────────────────────────────────────────
function UserDetail({ username, onClose }) {
  const { data, isLoading, refetch } = useUserDetail(username, true);
  const addKey   = useAddSSHKey();
  const delKey   = useDeleteSSHKey();
  const [newKey, setNewKey] = useState('');
  const [toast,  setToast]  = useState(null);

  function showToast(ok, msg) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAddKey() {
    try {
      await addKey.mutateAsync({ username, key: newKey.trim() });
      setNewKey('');
      showToast(true, 'Key added');
      refetch();
    } catch (e) { showToast(false, e.response?.data?.error || 'Failed'); }
  }

  async function handleDelKey(idx) {
    try {
      await delKey.mutateAsync({ username, idx });
      showToast(true, 'Key removed');
      refetch();
    } catch (e) { showToast(false, e.response?.data?.error || 'Failed'); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-xl h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border shrink-0">
          <Shield size={13} className="text-panel-muted" />
          <span className="text-panel-text text-sm font-mono font-medium">{username}</span>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-panel-hover rounded animate-pulse" />)}</div>
          ) : !data ? null : (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['UID', data.uid],
                  ['GID', data.gid],
                  ['Home', data.home],
                  ['Shell', data.shell],
                ].map(([k, v]) => (
                  <div key={k} className="bg-panel-bg rounded p-2 flex justify-between">
                    <span className="text-panel-muted">{k}</span>
                    <span className="text-panel-text font-mono">{v}</span>
                  </div>
                ))}
              </div>

              {/* Groups */}
              <div>
                <p className="text-panel-muted text-xs mb-2 uppercase tracking-wider">Groups</p>
                <div className="flex flex-wrap gap-1.5">
                  {(data.groups || []).map(g => (
                    <span key={g} className={`px-2 py-0.5 text-xs rounded border font-mono ${
                      g === 'sudo' ? 'border-panel-yellow/40 text-panel-yellow bg-panel-yellow/10'
                        : 'border-panel-border text-panel-muted'
                    }`}>{g}</span>
                  ))}
                </div>
              </div>

              {/* Recent logins */}
              {data.logins?.length > 0 && (
                <div>
                  <p className="text-panel-muted text-xs mb-2 uppercase tracking-wider">Recent Logins</p>
                  <div className="space-y-1">
                    {data.logins.map((l, i) => (
                      <div key={i} className="flex gap-4 text-xs font-mono">
                        <span className="text-panel-muted w-32 truncate">{l.from}</span>
                        <span className="text-panel-text">{l.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SSH Keys */}
              <div>
                <p className="text-panel-muted text-xs mb-2 uppercase tracking-wider">SSH Authorized Keys ({data.sshKeys?.length || 0})</p>
                <div className="space-y-1.5 mb-3">
                  {data.sshKeys?.length === 0 && <p className="text-panel-muted text-xs">No keys</p>}
                  {data.sshKeys?.map(k => (
                    <div key={k.idx} className="flex items-center gap-2 bg-panel-bg rounded p-2 text-xs">
                      <Key size={11} className="text-panel-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-panel-cyan">{k.type}</span>
                        <span className="font-mono text-panel-muted ml-2">{k.key}</span>
                        {k.comment && <span className="text-panel-muted ml-2">({k.comment})</span>}
                      </div>
                      <button onClick={() => handleDelKey(k.idx)}
                        className="p-1 text-panel-muted hover:text-panel-red shrink-0">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="ssh-ed25519 AAAA… comment"
                    className="flex-1 bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono"
                  />
                  <button
                    onClick={handleAddKey}
                    disabled={!newKey.trim() || addKey.isPending}
                    className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {toast && (
          <div className={`mx-4 mb-3 px-3 py-2 rounded border text-xs font-mono ${
            toast.ok ? 'bg-panel-green/10 border-panel-green text-panel-green'
                     : 'bg-panel-red/10 border-panel-red text-panel-red'
          }`}>{toast.msg}</div>
        )}
      </div>
    </div>
  );
}

// ── Create user modal ────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreate, loading }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [shell,    setShell]    = useState('/bin/bash');
  const [sudo,     setSudo]     = useState(false);
  const valid = username.trim() && password.length >= 8;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-md p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-panel-muted" />
          <h3 className="text-panel-text text-sm font-medium">Create User</h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="johndoe"
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent font-mono" />
          </div>

          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Password <span className="text-panel-muted/50">(min 8 chars)</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text focus:outline-none focus:border-panel-accent pr-8"
              />
              <button onClick={() => setShowPw(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text">
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {password && password.length < 8 && (
              <p className="text-panel-red text-xs mt-1">Too short</p>
            )}
          </div>

          <div>
            <label className="text-panel-muted text-xs block mb-1.5">Shell</label>
            <select value={shell} onChange={e => setShell(e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text focus:outline-none focus:border-panel-accent">
              <option value="/bin/bash">/bin/bash</option>
              <option value="/bin/sh">/bin/sh</option>
              <option value="/bin/zsh">/bin/zsh</option>
              <option value="/usr/sbin/nologin">/usr/sbin/nologin</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => setSudo(v => !v)}
              className={`w-8 h-4 rounded-full transition-colors relative ${sudo ? 'bg-panel-yellow' : 'bg-panel-hover'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${sudo ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-panel-text">Add to <span className="text-panel-yellow">sudo</span> group</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button disabled={!valid || loading} onClick={() => onCreate({ username, password, shell, sudo })}
            className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change password modal ────────────────────────────────────────────────────
function ChangePasswordModal({ username, onClose, onSave, loading }) {
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-panel-muted" />
          <h3 className="text-panel-text text-sm font-medium">Change Password — <span className="font-mono">{username}</span></h3>
          <button onClick={onClose} className="ml-auto text-panel-muted hover:text-panel-text"><X size={14} /></button>
        </div>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent pr-8" />
          <button onClick={() => setShowPw(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text">
            {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
          <button disabled={password.length < 8 || loading} onClick={() => onSave(password)}
            className="px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30 disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function UserPanel() {
  const [createOpen, setCreateOpen]   = useState(false);
  const [detailUser, setDetailUser]   = useState(null);
  const [pwUser,     setPwUser]       = useState(null);
  const [deleteUser, setDeleteUser]   = useState(null);
  const [removeHome, setRemoveHome]   = useState(false);
  const [toast,      setToast]        = useState(null);

  const { data, isLoading, refetch, isFetching } = useUsers();
  const createMut  = useCreateUser();
  const deleteMut  = useDeleteUser();
  const lockMut    = useLockUser();
  const pwMut      = useChangePassword();

  function showToast(ok, msg) { setToast({ ok, msg }); setTimeout(() => setToast(null), 3000); }

  async function handleCreate(userData) {
    try {
      await createMut.mutateAsync(userData);
      setCreateOpen(false);
      showToast(true, `User "${userData.username}" created`);
    } catch (e) { showToast(false, e.response?.data?.error || 'Failed'); }
  }

  async function handleDelete() {
    try {
      await deleteMut.mutateAsync({ username: deleteUser.username, removeHome });
      setDeleteUser(null);
      showToast(true, `User "${deleteUser.username}" deleted`);
    } catch (e) { showToast(false, e.response?.data?.error || 'Failed'); }
  }

  async function handleLock(user) {
    try {
      await lockMut.mutateAsync({ username: user.username, lock: !user.locked });
      showToast(true, user.locked ? 'Account unlocked' : 'Account locked');
    } catch (e) { showToast(false, e.response?.data?.error || 'Failed'); }
  }

  async function handlePwChange(password) {
    try {
      await pwMut.mutateAsync({ username: pwUser.username, password });
      setPwUser(null);
      showToast(true, 'Password changed');
    } catch (e) { showToast(false, e.response?.data?.error || 'Failed'); }
  }

  const users = data?.users || [];

  return (
    <div className="p-4 h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-panel-text font-medium flex items-center gap-2">
          <Users size={15} className="text-panel-muted" />
          Users
        </h2>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-panel-accent/20 text-panel-accent rounded hover:bg-panel-accent/30">
          <Plus size={12} /> New User
        </button>
        <button onClick={() => refetch()} disabled={isFetching}
          className="ml-auto p-1.5 text-panel-muted hover:text-panel-text disabled:opacity-40">
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-panel-surface border border-panel-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-panel-muted border-b border-panel-border">
            <tr>
              <th className="text-left pl-4 py-2 font-normal">User</th>
              <th className="text-left py-2 font-normal w-12 hidden sm:table-cell">UID</th>
              <th className="text-left py-2 font-normal hidden md:table-cell">Groups</th>
              <th className="text-left py-2 font-normal hidden lg:table-cell">Last login</th>
              <th className="text-left py-2 font-normal hidden sm:table-cell w-24">Shell</th>
              <th className="text-right pr-4 py-2 font-normal w-36">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({length: 3}).map((_, i) => (
                <tr key={i} className="border-b border-panel-border/30">
                  <td colSpan={6} className="py-2 pl-4"><div className="h-6 bg-panel-hover rounded animate-pulse" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-panel-muted">No users found</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.username} className={`border-b border-panel-border/30 last:border-0 hover:bg-panel-hover/20 ${user.locked ? 'opacity-60' : ''}`}>
                  {/* Username */}
                  <td className="pl-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        user.uid === 0 ? 'bg-panel-red/20 text-panel-red' : 'bg-panel-accent/20 text-panel-accent'
                      }`}>{user.username[0].toUpperCase()}</div>
                      <div>
                        <p className="font-mono text-panel-text">{user.username}</p>
                        {user.locked && <p className="text-panel-red text-xs">locked</p>}
                      </div>
                      {user.groups?.includes('sudo') && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-panel-yellow/10 border border-panel-yellow/30 text-panel-yellow font-mono">sudo</span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 text-panel-muted font-mono hidden sm:table-cell">{user.uid}</td>

                  <td className="py-2.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(user.groups || []).filter(g => g !== user.username).slice(0, 4).map(g => (
                        <span key={g} className="text-xs text-panel-muted font-mono">{g}</span>
                      ))}
                    </div>
                  </td>

                  <td className="py-2.5 text-panel-muted text-xs font-mono hidden lg:table-cell">
                    {user.lastLogin?.date || '—'}
                  </td>

                  <td className="py-2.5 text-panel-muted font-mono text-xs hidden sm:table-cell truncate max-w-[6rem]">
                    {user.shell?.split('/').pop()}
                  </td>

                  <td className="py-2.5 pr-4">
                    <div className="flex items-center justify-end gap-0.5">
                      {/* Detail */}
                      <button onClick={() => setDetailUser(user.username)}
                        title="Details & SSH keys"
                        className="p-1.5 text-panel-muted hover:text-panel-accent rounded transition-colors">
                        <Key size={13} />
                      </button>
                      {/* Change password */}
                      <button onClick={() => setPwUser(user)}
                        title="Change password"
                        className="p-1.5 text-panel-muted hover:text-panel-cyan rounded transition-colors">
                        <ChevronRight size={13} />
                      </button>
                      {/* Lock / unlock */}
                      {user.username !== 'root' && (
                        <button onClick={() => handleLock(user)}
                          title={user.locked ? 'Unlock' : 'Lock'}
                          className={`p-1.5 rounded transition-colors ${user.locked ? 'text-panel-yellow hover:text-panel-green' : 'text-panel-muted hover:text-panel-yellow'}`}>
                          {user.locked ? <Unlock size={13} /> : <Lock size={13} />}
                        </button>
                      )}
                      {/* Delete */}
                      {user.username !== 'root' && (
                        <button onClick={() => { setDeleteUser(user); setRemoveHome(false); }}
                          title="Delete user"
                          className="p-1.5 text-panel-muted hover:text-panel-red rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel-surface border border-panel-border rounded-lg w-full max-w-sm p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-panel-yellow" />
              <h3 className="text-panel-text text-sm font-medium">Delete <span className="font-mono">{deleteUser.username}</span>?</h3>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={removeHome} onChange={e => setRemoveHome(e.target.checked)}
                className="w-3.5 h-3.5 accent-panel-red" />
              <span className="text-xs text-panel-text">Also delete home directory <span className="text-panel-muted">({deleteUser.home})</span></span>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteUser(null)} className="px-3 py-1.5 text-xs text-panel-muted hover:text-panel-text rounded hover:bg-panel-hover">Cancel</button>
              <button disabled={deleteMut.isPending} onClick={handleDelete}
                className="px-3 py-1.5 text-xs bg-panel-red/20 text-panel-red rounded hover:bg-panel-red/30 disabled:opacity-40 flex items-center gap-1.5">
                {deleteMut.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onCreate={handleCreate} loading={createMut.isPending} />}
      {detailUser  && <UserDetail username={detailUser} onClose={() => setDetailUser(null)} />}
      {pwUser      && <ChangePasswordModal username={pwUser.username} onClose={() => setPwUser(null)} onSave={handlePwChange} loading={pwMut.isPending} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-4 right-4 px-4 py-2.5 rounded-lg border text-xs font-mono z-50 shadow-lg ${
          toast.ok ? 'bg-panel-green/10 border-panel-green text-panel-green'
                   : 'bg-panel-red/10 border-panel-red text-panel-red'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
