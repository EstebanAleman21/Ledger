import { Suspense } from "react"
import { AccountsContent } from "./accounts-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function AccountsPage() {
  return (
    <Suspense fallback={<AccountsLoading />}>
      <AccountsContent />
    </Suspense>
  )
}

function AccountsLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <LoadingSkeleton variant="card" count={2} />
      <LoadingSkeleton variant="list" count={5} />
    </div>
  )
}
