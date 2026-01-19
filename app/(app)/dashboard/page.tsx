import { Suspense } from "react"
import { DashboardContent } from "./dashboard-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <LoadingSkeleton variant="card" count={4} />
      <div className="grid gap-6 lg:grid-cols-2">
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="chart" />
      </div>
      <LoadingSkeleton variant="table" count={5} />
    </div>
  )
}
