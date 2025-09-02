import { Spinner } from "./Spinner"
import { cn } from "@/lib/utils"

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  className?: string
}

const LoadingOverlay = ({ 
  isVisible, 
  message = "Loading...", 
  className 
}: LoadingOverlayProps) => {
  if (!isVisible) return null

  return (
    <div className={cn(
      "absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center",
      className
    )}>
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

export { LoadingOverlay }