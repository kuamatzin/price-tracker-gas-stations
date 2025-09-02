import { Suspense } from "react"
import LoadingScreen from "./LoadingScreen"
import { Spinner } from "./Spinner"

interface SuspenseBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  type?: "screen" | "component"
}

const SuspenseBoundary = ({ 
  children, 
  fallback,
  type = "component" 
}: SuspenseBoundaryProps) => {
  const defaultFallback = type === "screen" 
    ? <LoadingScreen />
    : (
        <div className="flex items-center justify-center p-8">
          <Spinner size="md" />
        </div>
      )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  )
}

export { SuspenseBoundary }