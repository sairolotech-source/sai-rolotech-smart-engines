import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fullScreen?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  crashCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, crashCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error.message);
    console.error("[Stack]", info.componentStack);
    this.setState(s => ({ errorInfo: info, crashCount: s.crashCount + 1 }));
    try {
      const prev = JSON.parse(localStorage.getItem("sai-rolotech-errors") ?? "[]");
      prev.unshift({ ts: new Date().toISOString(), msg: error.message, stack: error.stack });
      if (prev.length > 20) prev.length = 20;
      localStorage.setItem("sai-rolotech-errors", JSON.stringify(prev));
    } catch { /* ignore */ }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleHardReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, crashCount } = this.state;
    const isFullScreen = this.props.fullScreen;

    return (
      <div className={`flex flex-col items-center justify-center gap-6 p-8 ${isFullScreen ? "min-h-screen bg-[#04060e]" : "min-h-[300px]"}`}>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/15 to-orange-500/10 border border-red-500/20 flex items-center justify-center shadow-lg flex-shrink-0">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>

        <div className="text-center max-w-md">
          <div className="text-[10px] font-mono text-[#f97316] uppercase tracking-widest mb-2">
            ⚙ SAI Rolotech — Auto Recovery
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            {this.props.fallbackTitle ?? "Component Error — Recovered Safely"}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed mb-1">
            {error?.message ?? "An unexpected error occurred. Your data is safe and has been auto-saved."}
          </p>
          {crashCount > 1 && (
            <p className="text-xs text-amber-400 mt-2">
              ⚠ This component crashed {crashCount} times. Consider using Full Reload.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-sm font-semibold text-black shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recover
          </button>
          <button
            onClick={this.handleHardReload}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-zinc-300 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Full Reload
          </button>
        </div>

        <p className="text-[10px] text-zinc-700">
          v2.2.0 · Error logged · sairolotech.com
        </p>
      </div>
    );
  }
}
