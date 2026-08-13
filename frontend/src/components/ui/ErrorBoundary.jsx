import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Bir panel render sırasında patlarsa tüm uygulama beyaz ekrana düşmesin.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ServerPanel] render hatası:', error, info);
  }

  componentDidUpdate(prevProps) {
    // Başka bir panele geçilince hatayı sıfırla.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-panel-surface border border-panel-red/30 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-panel-red">
            <AlertTriangle size={16} />
            <h2 className="text-sm font-semibold">Bu panel yüklenemedi</h2>
          </div>
          <p className="text-xs text-panel-muted break-words font-mono">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="self-start flex items-center gap-1.5 text-xs bg-panel-accent/15 text-panel-accent px-3 py-1.5 rounded-lg hover:bg-panel-accent/25"
          >
            <RotateCcw size={12} /> Tekrar dene
          </button>
        </div>
      </div>
    );
  }
}
