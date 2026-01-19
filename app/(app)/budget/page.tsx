import { Suspense } from "react"
import { BudgetContent } from "./budget-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function BudgetPage() {
  return (
    <Suspense fallback={<BudgetLoading />}>
      <BudgetContent />
    </Suspense>
  )
}

function BudgetLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <LoadingSkeleton variant="card" count={3} />
      <LoadingSkeleton variant="list" count={8} />
    </div>
  )
}
