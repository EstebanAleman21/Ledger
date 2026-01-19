import { Suspense } from "react"
import { SettingsContent } from "./settings-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsLoading() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <LoadingSkeleton variant="card" count={1} />
      <LoadingSkeleton variant="list" count={4} />
    </div>
  )
}
