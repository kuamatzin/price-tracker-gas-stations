import { cn } from "@/lib/utils"

interface ShimmerEffectProps {
  className?: string
  children?: React.ReactNode
}

const ShimmerEffect = ({ className, children }: ShimmerEffectProps) => {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      {children}
    </div>
  )
}

const ShimmerCard = ({ className }: { className?: string }) => (
  <ShimmerEffect className={cn("rounded-lg border p-6", className)}>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  </ShimmerEffect>
)

const ShimmerList = ({ items = 5, className }: { items?: number; className?: string }) => (
  <div className={cn("space-y-3", className)}>
    {Array.from({ length: items }).map((_, i) => (
      <ShimmerEffect key={i} className="flex items-center space-x-3 p-3">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </ShimmerEffect>
    ))}
  </div>
)

export {
  ShimmerEffect,
  ShimmerCard,
  ShimmerList
}