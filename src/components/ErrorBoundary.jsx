import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <p className="eyebrow">Something went wrong</p>
          <h1>Let&apos;s try that again</h1>
          <p className="subtitle">Blessuth couldn&apos;t load this moment. Your saved data is safe.</p>
          <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
            Reload Blessuth
          </button>
        </div>
      </main>
    )
  }
}
