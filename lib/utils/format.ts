import type { Currency } from "../types"

export function formatCurrency(amount: number, currency: Currency): string {
  const formatter = new Intl.NumberFormat(currency === "MXN" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(amount)
}

export function formatCompactCurrency(amount: number, currency: Currency): string {
  const absAmount = Math.abs(amount)
  let value: string
  if (absAmount >= 1000000) {
    value = `${(amount / 1000000).toFixed(1)}M`
  } else if (absAmount >= 1000) {
    value = `${(amount / 1000).toFixed(1)}K`
  } else {
    value = amount.toFixed(2)
  }
  return `${currency === "MXN" ? "$" : "US$"}${value}`
}

// Parse date string as local date (not UTC) to avoid timezone shifts
function parseLocalDate(dateStr: string): Date {
  // Handle YYYY-MM-DD format - parse as local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  // For other formats (ISO with time), use regular parsing
  return new Date(dateStr)
}

export function formatDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateShort(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-")
  return new Date(Number.parseInt(year), Number.parseInt(m) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

export function getRelativeTime(date: string): string {
  const now = new Date()
  const then = parseLocalDate(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateShort(date)
}
