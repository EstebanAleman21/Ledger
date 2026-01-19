import { Suspense } from "react"
import { CategoriesContent } from "./categories-content"
import { LoadingSkeleton } from "@/components/ui/loading-skeleton"

export default function CategoriesPage() {
  return (
    <Suspense fallback={<CategoriesLoading />}>
      <CategoriesContent />
    </Suspense>
  )
}

function CategoriesLoading() {
  return (
    <div className="p-4 lg:p-6">
      <LoadingSkeleton variant="list" count={10} />
    </div>
  )
}
