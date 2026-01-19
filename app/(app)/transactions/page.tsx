import { Suspense } from "react"
import { TransactionsContent } from "./transactions-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsLoading />}>
      <TransactionsContent />
    </Suspense>
  )
}

function TransactionsLoading() {
  return (
    <div className="p-4 lg:p-6">
      <LoadingSkeleton variant="table" count={10} />
    </div>
  )
}
