import { Suspense } from "react"
import { ReportsContent } from "./reports-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsContent />
    </Suspense>
  )
}

function ReportsLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <LoadingSkeleton variant="chart" />
      <div className="grid gap-6 lg:grid-cols-2">
        <LoadingSkeleton variant="chart" />
        <LoadingSkeleton variant="chart" />
      </div>
    </div>
  )
}
