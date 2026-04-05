import { Component, type ErrorInfo, type ReactNode } from 'react'
import { kk } from '@/locales/kk'
import { ru } from '@/locales/ru'

type Props = { children: ReactNode }

type State = { hasError: boolean; message: string }

function errorTitle(): string {
  if (typeof document === 'undefined') return ru['errorBoundary.title']
  return document.documentElement.lang === 'kk' ? kk['errorBoundary.title'] : ru['errorBoundary.title']
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Qara]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#0a0a0b',
            color: '#fafafa',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>{errorTitle()}</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, opacity: 0.9 }}>
            {this.state.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
