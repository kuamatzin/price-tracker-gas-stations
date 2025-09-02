import { Component, ReactNode } from "react"
import { ErrorFallback } from "./ErrorFallback"

interface Props {
  children: ReactNode
  onError?: (error: Error, errorInfo: any) => void
}

interface State {
  hasError: boolean
  error?: Error
}

class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("AsyncErrorBoundary caught error:", error, errorInfo)
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { 
          react: errorInfo,
          async: {
            type: 'async_operation'
          }
        },
      })
    }
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled promise rejection:", event.reason)
    
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason))
    
    this.setState({ 
      hasError: true, 
      error 
    })

    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          async: {
            type: 'unhandled_promise_rejection'
          }
        }
      })
    }

    event.preventDefault()
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          resetError={this.resetError}
          type="component"
        />
      )
    }

    return this.props.children
  }
}

export { AsyncErrorBoundary }