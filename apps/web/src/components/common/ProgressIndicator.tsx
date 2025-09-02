import { cn } from "@/lib/utils"

interface ProgressIndicatorProps {
  value: number
  max?: number
  className?: string
  showPercentage?: boolean
}

const ProgressIndicator = ({ 
  value, 
  max = 100, 
  className,
  showPercentage = false 
}: ProgressIndicatorProps) => {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className="text-sm text-gray-600 mt-1 text-right">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  )
}

export { ProgressIndicator }