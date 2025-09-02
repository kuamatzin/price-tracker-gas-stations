import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

interface ErrorFallbackProps {
  error?: Error
  resetError?: () => void
  type?: "page" | "component" | "critical"
}

const ErrorFallback = ({ 
  error, 
  resetError, 
  type = "component" 
}: ErrorFallbackProps) => {
  const handleReload = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = "/dashboard"
  }

  if (type === "page") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Algo salió mal
          </h1>
          <p className="text-gray-600 mb-6">
            Ha ocurrido un error inesperado. Por favor, intenta recargar la página o regresa al inicio.
          </p>
          {error && (
            <details className="text-left text-sm bg-gray-50 p-3 rounded mb-4">
              <summary className="cursor-pointer text-gray-700 font-medium">
                Detalles del error
              </summary>
              <pre className="mt-2 text-xs text-red-600 overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
          <div className="space-y-2">
            <Button onClick={handleReload} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar página
            </Button>
            <Button 
              variant="outline" 
              onClick={handleGoHome} 
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" />
              Ir al inicio
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (type === "critical") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <Card className="max-w-lg w-full p-8 text-center border-red-200">
          <AlertTriangle className="h-20 w-20 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-red-800 mb-2">
            Error Crítico
          </h1>
          <p className="text-red-700 mb-6">
            La aplicación ha encontrado un error crítico. Por favor, contacta al soporte técnico.
          </p>
          <div className="bg-red-100 p-4 rounded-lg mb-6 text-left">
            <p className="text-sm text-red-800 font-medium mb-2">
              Información del error:
            </p>
            <pre className="text-xs text-red-700 overflow-auto">
              {error?.message || "Error desconocido"}
            </pre>
          </div>
          <Button onClick={handleReload} variant="destructive" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar aplicación
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Error en el componente
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Este componente no se pudo cargar correctamente.
        </p>
        {resetError && (
          <Button 
            onClick={resetError} 
            size="sm" 
            variant="outline"
          >
            Intentar de nuevo
          </Button>
        )}
      </div>
    </div>
  )
}

export { ErrorFallback }