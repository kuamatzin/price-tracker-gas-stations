import { Component, ReactNode } from "react"
import { ErrorFallback } from "./ErrorFallback"

interface Props {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: any) => void
  maxRetries?: number
}

interface State {
  hasError: boolean
  error?: Error
  retryCount: number
}

class ErrorRecovery extends Component<Props, State> {
  private retryTimeoutId?: NodeJS.Timeout

  constructor(props: Props) {
    super(props)
    this.state = { 
      hasError: false, 
      retryCount: 0 
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      retryCount: 0
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorRecovery caught error:", error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  retry = () => {
    const { maxRetries = 3 } = this.props
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({ 
        hasError: false, 
        error: undefined,
        retryCount: prevState.retryCount + 1
      }))
    }
  }

  autoRetry = () => {
    this.retryTimeoutId = setTimeout(() => {
      this.retry()
    }, 2000)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback, maxRetries = 3 } = this.props
      
      if (fallback) {
        return fallback(this.state.error, this.retry)
      }

      const canRetry = this.state.retryCount < maxRetries

      return (
        <ErrorFallback 
          error={this.state.error}
          resetError={canRetry ? this.retry : undefined}
          type="component"
        />
      )
    }

    return this.props.children
  }
}

export { ErrorRecovery }