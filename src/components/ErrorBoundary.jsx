// src/components/ErrorBoundary.jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Platform caught critical layout collapse:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 font-sans text-white text-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong.</h2>
            <p className="text-slate-400 text-sm mb-6">Please refresh the page to restore system memory.</p>
            
            <div className="border-t border-slate-800/80 my-4 pt-4 font-urdu" dir="rtl">
              <h2 className="text-xl font-bold text-white mb-2">Something went wrong.</h2>
              <p className="text-slate-400 text-sm mb-4">Please refresh the page to reactivate the system.</p>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 active:scale-95 transition-all"
            >
              Refresh Platform
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
