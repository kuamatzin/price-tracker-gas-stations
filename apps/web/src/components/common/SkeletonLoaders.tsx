import { Skeleton } from "@/components/ui/skeleton"

const CardSkeleton = () => (
  <div className="rounded-lg border p-6 space-y-3">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-8 w-1/2" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
)

const TableSkeleton = ({ rows = 5 }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-4 gap-4 p-4 border-b">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="grid grid-cols-4 gap-4 p-4">
        {Array.from({ length: 4 }).map((_, j) => (
          <Skeleton key={j} className="h-4 w-full" />
        ))}
      </div>
    ))}
  </div>
)

const ListSkeleton = ({ items = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center space-x-3 p-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
)

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-1/4" />
        <ListSkeleton items={4} />
      </div>
    </div>
  </div>
)

export {
  CardSkeleton,
  TableSkeleton,
  ListSkeleton,
  DashboardSkeleton
}