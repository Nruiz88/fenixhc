// Shared skeleton loading components for dashboards and pages

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-800 animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-20 bg-gray-800 rounded animate-pulse mb-2" />
              <div className="h-6 w-16 bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="divide-y divide-gray-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gray-800 animate-pulse" />
              <div>
                <div className="h-4 w-32 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="h-3 w-48 bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl">
      <div className="p-4 border-b border-gray-800">
        <div className="h-5 w-40 bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="p-6 space-y-4">
        <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
      <StatsSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-64 bg-gray-800 rounded animate-pulse" />
      <div className="h-4 w-96 bg-gray-800 rounded animate-pulse" />
    </div>
  );
}
