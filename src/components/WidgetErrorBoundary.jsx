import React from 'react';

export default class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Widget crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 text-center text-red-200">
          <h3 className="font-bold text-red-400 mb-2">Widget Error</h3>
          <p className="text-sm">This section encountered an error and failed to load.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
