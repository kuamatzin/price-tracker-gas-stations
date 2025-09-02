import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ErrorMessageProps {
  message: string
  type?: "error" | "warning" | "info" | "success"
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle
}

const colorMap = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800", 
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-green-200 bg-green-50 text-green-800"
}

const ErrorMessage = ({ 
  message, 
  type = "error", 
  dismissible = false,
  onDismiss,
  className 
}: ErrorMessageProps) => {
  const Icon = iconMap[type]

  return (
    <Alert className={cn(colorMap[type], className)}>
      <Icon className="h-4 w-4" />
      <AlertDescription className="flex-1">
        {message}
      </AlertDescription>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 hover:opacity-70 transition-opacity"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  )
}

interface NetworkErrorProps {
  onRetry?: () => void
  retryText?: string
}

const NetworkError = ({ onRetry, retryText = "Reintentar" }: NetworkErrorProps) => (
  <div className="text-center p-6">
    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      Error de conexión
    </h3>
    <p className="text-gray-600 mb-4">
      No se pudo conectar al servidor. Verifica tu conexión a internet.
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        {retryText}
      </button>
    )}
  </div>
)

const ValidationError = ({ errors }: { errors: string[] }) => (
  <div className="space-y-2">
    {errors.map((error, index) => (
      <ErrorMessage 
        key={index}
        message={error}
        type="error"
      />
    ))}
  </div>
)

const NotAuthorizedError = () => (
  <div className="text-center p-8">
    <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
    <h2 className="text-2xl font-bold text-gray-900 mb-2">
      Acceso Denegado
    </h2>
    <p className="text-gray-600 mb-6">
      No tienes permisos para acceder a este contenido.
    </p>
    <button
      onClick={() => window.location.href = "/login"}
      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
    >
      Iniciar Sesión
    </button>
  </div>
)

export {
  ErrorMessage,
  NetworkError,
  ValidationError,
  NotAuthorizedError
}