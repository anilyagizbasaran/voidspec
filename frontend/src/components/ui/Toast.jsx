import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

// Minimal, bağımlılıksız bildirim sistemi. React ağacının dışından da
// çağrılabilsin diye (react-query'nin global hata yakalayıcısı gibi)
// abonelik tabanlı basit bir store kullanıyor.
let counter = 0;
const listeners = new Set();
let toasts = [];

function emit() {
  for (const l of listeners) l(toasts);
}

// Yoklama yapan sorgular hata verdiğinde (backend kapalıysa saniyede birkaç
// kez) aynı bildirimin yığılmaması için kısa bir sessizlik penceresi.
const DEDUPE_MS = 8000;
const recent = new Map();

export function pushToast({ type = 'info', title, message, timeout = 6000 }) {
  const key = `${type}|${title}|${message}`;
  const now = Date.now();
  if (now - (recent.get(key) || 0) < DEDUPE_MS) return null;
  recent.set(key, now);
  if (recent.size > 50) recent.clear();

  const id = ++counter;
  toasts = [...toasts, { id, type, title, message }];
  emit();
  if (timeout) setTimeout(() => dismissToast(id), timeout);
  return id;
}

export function dismissToast(id) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export const toast = {
  error:   (message, title = 'Hata')    => pushToast({ type: 'error', title, message, timeout: 9000 }),
  success: (message, title = 'Tamam')   => pushToast({ type: 'success', title, message }),
  info:    (message, title = 'Bilgi')   => pushToast({ type: 'info', title, message }),
};

const STYLES = {
  error:   { icon: AlertCircle,  cls: 'border-panel-red/40   text-panel-red'   },
  success: { icon: CheckCircle2, cls: 'border-panel-green/40 text-panel-green' },
  info:    { icon: Info,         cls: 'border-panel-accent/40 text-panel-accent' },
};

export default function ToastHost() {
  const [items, setItems] = useState(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => listeners.delete(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto">
      {items.map(({ id, type, title, message }) => {
        const { icon: Icon, cls } = STYLES[type] || STYLES.info;
        return (
          <div
            key={id}
            role="status"
            className={`flex items-start gap-2.5 bg-panel-surface border ${cls} rounded-lg px-3 py-2.5 shadow-lg animate-[fadeSlideIn_0.12s_ease-out]`}
          >
            <Icon size={14} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-tight">{title}</p>
              {message && (
                <p className="text-[11px] text-panel-muted mt-0.5 break-words leading-snug">{message}</p>
              )}
            </div>
            <button
              onClick={() => dismissToast(id)}
              className="text-panel-muted hover:text-panel-text shrink-0"
              aria-label="Kapat"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
