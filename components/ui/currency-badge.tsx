import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Currency } from "@/lib/types"

interface CurrencyBadgeProps {
  currency: Currency
  className?: string
}

export function CurrencyBadge({ currency, className }: CurrencyBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        currency === "USD"
          ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
        className,
      )}
    >
      {currency}
    </Badge>
  )
}
