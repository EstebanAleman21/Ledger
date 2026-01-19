import { Suspense } from "react"
import { DebtContent } from "./debt-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function DebtPage() {
  return (
    <Suspense fallback={<DebtLoading />}>
      <DebtContent />
    </Suspense>
  )
}

function DebtLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <LoadingSkeleton variant="card" count={2} />
      <LoadingSkeleton variant="list" count={5} />
    </div>
  )
}

