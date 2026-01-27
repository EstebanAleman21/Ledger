"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createInstallment, deleteInstallment, getAccounts, getInstallments, updateInstallment } from "@/lib/api"
import type { Account, Currency, Installment } from "@/lib/types"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type DebtConfig = {
  version: 1
  currencyBudgets: Record<Currency, { extraPayment: number }>
  minPaymentsByAccountId: Record<string, number>
}

type DebtItem = {
  id: string
  name: string
  currency: Currency
  balance: number
  creditLimit?: number
  remainingCredit?: number
  remainingCreditAfterInstallments?: number
  installmentPrincipalRemaining?: number
  debtAmount: number
  minPayment: number
}

type SnowballMonth = {
  monthIndex: number
  totalPaid: number
  payments: Record<string, number>
  remainingById: Record<string, number>
}

const CONFIG_KEY = "debt_tracker_config_v1"

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function loadConfig(): DebtConfig {
  if (typeof window === "undefined") {
    return { version: 1, currencyBudgets: { MXN: { extraPayment: 0 }, USD: { extraPayment: 0 } }, minPaymentsByAccountId: {} }
  }
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY)
    if (!raw) {
      return { version: 1, currencyBudgets: { MXN: { extraPayment: 0 }, USD: { extraPayment: 0 } }, minPaymentsByAccountId: {} }
    }
    const parsed = JSON.parse(raw) as Partial<DebtConfig>
    return {
      version: 1,
      currencyBudgets: {
        MXN: { extraPayment: parsed.currencyBudgets?.MXN?.extraPayment ?? 0 },
        USD: { extraPayment: parsed.currencyBudgets?.USD?.extraPayment ?? 0 },
      },
      minPaymentsByAccountId: parsed.minPaymentsByAccountId ?? {},
    }
  } catch {
    return { version: 1, currencyBudgets: { MXN: { extraPayment: 0 }, USD: { extraPayment: 0 } }, minPaymentsByAccountId: {} }
  }
}

function saveConfig(config: DebtConfig) {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

function defaultConfig(): DebtConfig {
  return {
    version: 1,
    currencyBudgets: { MXN: { extraPayment: 0 }, USD: { extraPayment: 0 } },
    minPaymentsByAccountId: {},
  }
}

function runSnowball(debts: DebtItem[], extraPayment: number, maxMonths = 600): SnowballMonth[] {
  const active = debts
    .filter((d) => d.debtAmount > 0)
    .map((d) => ({ ...d, remaining: d.debtAmount }))

  if (active.length === 0) return []

  const totalMonthly = active.reduce((sum, d) => sum + (d.minPayment || 0), 0) + extraPayment
  const months: SnowballMonth[] = []

  for (let monthIndex = 1; monthIndex <= maxMonths; monthIndex += 1) {
    const remainingById: Record<string, number> = {}
    const payments: Record<string, number> = {}

    const stillActive = active.filter((d) => d.remaining > 0)
    if (stillActive.length === 0) break

    const requiredMin = stillActive.reduce((sum, d) => sum + (d.minPayment || 0), 0)
    let extra = Math.max(0, totalMonthly - requiredMin)

    // Pay minimums first
    for (const debt of stillActive) {
      const minPay = Math.max(0, debt.minPayment || 0)
      const paid = Math.min(debt.remaining, minPay)
      debt.remaining -= paid
      payments[debt.id] = (payments[debt.id] || 0) + paid
      remainingById[debt.id] = debt.remaining
    }

    // Snowball: apply extra to smallest remaining debt
    while (extra > 0.000001) {
      const target = stillActive
        .filter((d) => d.remaining > 0.000001)
        .sort((a, b) => a.remaining - b.remaining)[0]
      if (!target) break
      const paid = Math.min(target.remaining, extra)
      target.remaining -= paid
      extra -= paid
      payments[target.id] = (payments[target.id] || 0) + paid
      remainingById[target.id] = target.remaining
    }

    const totalPaid = Object.values(payments).reduce((sum, v) => sum + v, 0)
    months.push({ monthIndex, totalPaid, payments, remainingById })

    if (stillActive.every((d) => d.remaining <= 0.000001)) break
  }

  return months
}

export function DebtContent() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<DebtConfig>(() => loadConfig())
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("MXN")
  const [section, setSection] = useState<"snowball" | "installments">("snowball")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    saveConfig(config)
  }, [config])

  const loadData = async () => {
    try {
      setLoading(true)
      const [accs, insts] = await Promise.all([getAccounts(), getInstallments()])
      setAccounts(accs)
      setInstallments(insts)
    } catch (error) {
      console.error(error)
      toast.error("Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  const creditAccounts = useMemo(() => accounts.filter((a) => a.type === "credit"), [accounts])
  const currencies = useMemo(() => {
    const set = new Set<Currency>()
    for (const a of creditAccounts) set.add(a.currency)
    return Array.from(set)
  }, [creditAccounts])

  useEffect(() => {
    if (currencies.length === 0) return
    if (!currencies.includes(selectedCurrency)) setSelectedCurrency(currencies[0])
  }, [currencies, selectedCurrency])

  const debts = useMemo<DebtItem[]>(() => {
    return creditAccounts
      .filter((a) => a.currency === selectedCurrency)
      .map((a) => {
        const debtAmount = Math.max(0, -a.balance)
        return {
          id: a.id,
          name: a.name,
          currency: a.currency,
          balance: a.balance,
          creditLimit: a.creditLimit,
          remainingCredit: a.remainingCredit,
          remainingCreditAfterInstallments: a.remainingCreditAfterInstallments,
          installmentPrincipalRemaining: a.installmentPrincipalRemaining,
          debtAmount,
          minPayment: config.minPaymentsByAccountId[a.id] ?? 0,
        }
      })
      .sort((a, b) => a.debtAmount - b.debtAmount)
  }, [creditAccounts, selectedCurrency, config.minPaymentsByAccountId])

  const extraPayment = config.currencyBudgets[selectedCurrency]?.extraPayment ?? 0

  const snowball = useMemo(() => runSnowball(debts, extraPayment), [debts, extraPayment])
  const monthsToDebtFree = snowball.length
  const hasDebt = useMemo(() => debts.some((d) => d.debtAmount > 0), [debts])

  const totals = useMemo(() => {
    const totalDebt = debts.reduce((sum, d) => sum + d.debtAmount, 0)
    const totalMin = debts.reduce((sum, d) => sum + (d.debtAmount > 0 ? d.minPayment : 0), 0)
    const totalMonthly = totalMin + extraPayment
    return { totalDebt, totalMin, totalMonthly }
  }, [debts, extraPayment])

  const setMinPayment = (accountId: string, value: number) => {
    setConfig((prev) => ({
      ...prev,
      minPaymentsByAccountId: { ...prev.minPaymentsByAccountId, [accountId]: Math.max(0, value) },
    }))
  }

  const setExtraPayment = (value: number) => {
    setConfig((prev) => ({
      ...prev,
      currencyBudgets: {
        ...prev.currencyBudgets,
        [selectedCurrency]: { extraPayment: Math.max(0, value) },
      },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-4 lg:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading debt...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Debt Tracker</h2>
          <p className="text-sm text-muted-foreground">Snowball payoff plan for your credit accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Currency</Label>
          <Select value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as Currency)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(currencies.length ? currencies : ["MXN", "USD"]).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={section === "snowball" ? "default" : "outline"} className={section === "snowball" ? "" : "bg-transparent"} onClick={() => setSection("snowball")}>
          Snowball
        </Button>
        <Button variant={section === "installments" ? "default" : "outline"} className={section === "installments" ? "" : "bg-transparent"} onClick={() => setSection("installments")}>
          Installments
        </Button>
      </div>

      {section === "snowball" ? (
        <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive tabular-nums">{formatCurrency(totals.totalDebt, selectedCurrency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(totals.totalMonthly, selectedCurrency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Min: {formatCurrency(totals.totalMin, selectedCurrency)} + Extra: {formatCurrency(extraPayment, selectedCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Debt-Free In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold tabular-nums", monthsToDebtFree ? "text-foreground" : "text-muted-foreground")}>
              {hasDebt ? (monthsToDebtFree ? `${monthsToDebtFree} months` : "Set min payments") : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">No interest modeled yet.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snowball Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="extra">Extra payment per month</Label>
            <Input
              id="extra"
              type="number"
              step="0.01"
              value={String(extraPayment)}
              onChange={(e) => setExtraPayment(Number(e.target.value || 0))}
            />
          </div>
          <div className="flex items-end">
            <div className="flex gap-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setConfig(loadConfig())}>
                Reload saved
              </Button>
              <Button
                variant="outline"
                className="bg-transparent"
                onClick={() => {
                  setConfig(defaultConfig())
                  saveConfig(defaultConfig())
                  toast.success("Debt settings cleared")
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Credit Accounts</CardTitle>
          <Button variant="outline" className="bg-transparent" onClick={loadData}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debt</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Min / mo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((d) => {
                const creditLimit = coerceNumber(d.creditLimit)
                const rawRemaining =
                  d.remainingCredit ?? (creditLimit === null ? null : creditLimit + d.balance)
                const installmentPrincipalRemaining =
                  d.installmentPrincipalRemaining ??
                  installments
                    .filter((i) => i.accountId === d.id && i.monthsRemaining > 0)
                    .reduce((sum, i) => sum + (i.amount / Math.max(1, i.monthsTotal)) * i.monthsRemaining, 0)
                const remaining =
                  d.remainingCreditAfterInstallments ??
                  (rawRemaining === null ? null : rawRemaining - installmentPrincipalRemaining)
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(d.debtAmount, d.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {creditLimit === null ? "—" : formatCurrency(creditLimit, d.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {remaining === null ? "—" : formatCurrency(remaining, d.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 ml-auto"
                        value={String(d.minPayment)}
                        onChange={(e) => setMinPayment(d.id, Number(e.target.value || 0))}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No credit accounts found for {selectedCurrency}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payoff Schedule</CardTitle>
          <div className="text-sm text-muted-foreground">Showing first 24 months</div>
        </CardHeader>
        <CardContent className="space-y-3">
          {snowball.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Add minimum payments (and optionally an extra payment) to generate a plan.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Remaining Debt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snowball.slice(0, 24).map((m) => {
                  const remainingDebt = debts.reduce((sum, d) => sum + (m.remainingById[d.id] ?? d.debtAmount), 0)
                  return (
                    <TableRow key={m.monthIndex}>
                      <TableCell>{m.monthIndex}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(m.totalPaid, selectedCurrency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(remainingDebt, selectedCurrency)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </>
      ) : (
        <InstallmentsSection
          installments={installments}
          accounts={accounts}
          selectedCurrency={selectedCurrency}
          onRefresh={loadData}
        />
      )}
    </div>
  )
}

function InstallmentsSection({
  installments,
  accounts,
  selectedCurrency,
  onRefresh,
}: {
  installments: Installment[]
  accounts: Account[]
  selectedCurrency: Currency
  onRefresh: () => void
}) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [monthsTotal, setMonthsTotal] = useState("12")
  const [monthsRemaining, setMonthsRemaining] = useState("")
  const [hasInterest, setHasInterest] = useState(false)
  const [interestAmountPerMonth, setInterestAmountPerMonth] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState<string>("")
  const [saving, setSaving] = useState(false)

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const accountsForCurrency = useMemo(
    () => accounts.filter((a) => a.currency === selectedCurrency),
    [accounts, selectedCurrency]
  )
  const installmentsForCurrency = useMemo(
    () => installments.filter((i) => accountsById.get(i.accountId)?.currency === selectedCurrency),
    [installments, accountsById, selectedCurrency]
  )

  const perAccountMonthly = useMemo(() => {
    const monthlyByAccountId = new Map<string, number>()
    for (const installment of installmentsForCurrency) {
      if (installment.monthsRemaining <= 0) continue
      const monthlyPrincipal = installment.amount / Math.max(1, installment.monthsTotal)
      const monthlyInterest = installment.hasInterest ? installment.interestAmountPerMonth : 0
      const monthlyExpected = monthlyPrincipal + monthlyInterest
      monthlyByAccountId.set(
        installment.accountId,
        (monthlyByAccountId.get(installment.accountId) || 0) + monthlyExpected,
      )
    }
    const rows = Array.from(monthlyByAccountId.entries())
      .map(([accountId, monthlyExpected]) => ({
        accountId,
        accountName: accountsById.get(accountId)?.name || "Unknown",
        monthlyExpected,
      }))
      .sort((a, b) => b.monthlyExpected - a.monthlyExpected)
    return rows
  }, [installmentsForCurrency, accountsById])

  useEffect(() => {
    if (accountId) return
    if (accountsForCurrency.length) setAccountId(accountsForCurrency[0].id)
  }, [accountsForCurrency, accountId])

  const monthlyTotals = useMemo(() => {
    const base = installmentsForCurrency.reduce((sum, i) => sum + i.amount / Math.max(1, i.monthsTotal), 0)
    const interest = installmentsForCurrency.reduce((sum, i) => sum + (i.hasInterest ? i.interestAmountPerMonth : 0), 0)
    return { base, interest, total: base + interest }
  }, [installmentsForCurrency])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const mt = Number(monthsTotal)
      const mr = monthsRemaining ? Number(monthsRemaining) : undefined
      const interest = hasInterest ? Number(interestAmountPerMonth || 0) : 0
      await createInstallment({
        accountId,
        description,
        amount: Number(amount),
        monthsTotal: mt,
        monthsRemaining: mr,
        hasInterest,
        interestAmountPerMonth: interest,
        purchaseDate,
      })
      toast.success("Installment added")
      setDescription("")
      setAmount("")
      setMonthsRemaining("")
      setHasInterest(false)
      setInterestAmountPerMonth("")
      onRefresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to add installment")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteInstallment(id)
      toast.success("Installment deleted")
      onRefresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to delete installment")
    }
  }

  const handlePaidOneMonth = async (installment: Installment) => {
    if (installment.monthsRemaining <= 0) return
    try {
      await updateInstallment(installment.id, { monthsRemaining: installment.monthsRemaining - 1 })
      toast.success("Marked 1 month as paid")
      onRefresh()
    } catch (error) {
      console.error(error)
      toast.error("Failed to update installment")
    }
  }

  return (
    <>
      {perAccountMonthly.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {perAccountMonthly.slice(0, 6).map((row) => (
            <Card key={row.accountId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{row.accountName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCurrency(row.monthlyExpected, selectedCurrency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Expected per month</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Base (MXN)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(monthlyTotals.base, selectedCurrency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Amount / months_total (all items)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Interest (MXN)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(monthlyTotals.interest, selectedCurrency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Sum of interest_amount_per_month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Total (MXN)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(monthlyTotals.total, selectedCurrency)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>New Installment</CardTitle>
          <Button variant="outline" className="bg-transparent" onClick={onRefresh}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accountsForCurrency.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="MacBook / Phone / TV..." />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Purchase date</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Months total</Label>
            <Input type="number" value={monthsTotal} onChange={(e) => setMonthsTotal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Months remaining (optional)</Label>
            <Input type="number" value={monthsRemaining} onChange={(e) => setMonthsRemaining(e.target.value)} placeholder="defaults to total" />
          </div>
          <div className="space-y-2">
            <Label>Has interest?</Label>
            <Select value={hasInterest ? "yes" : "no"} onValueChange={(v) => setHasInterest(v === "yes")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Interest amount / month</Label>
            <Input
              type="number"
              step="0.01"
              value={interestAmountPerMonth}
              onChange={(e) => setInterestAmountPerMonth(e.target.value)}
              disabled={!hasInterest}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleAdd} disabled={saving || !accountId || !description || !amount || !monthsTotal || !purchaseDate}>
              {saving ? "Saving..." : "Add installment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Months</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Interest / mo</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installmentsForCurrency.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    {accountsById.get(i.accountId)?.name || "Unknown"}
                  </TableCell>
                  <TableCell className="font-medium">{i.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(i.amount, selectedCurrency)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(() => {
                      const monthlyPrincipal = i.amount / Math.max(1, i.monthsTotal)
                      const monthlyInterest = i.hasInterest ? i.interestAmountPerMonth : 0
                      const remaining = monthlyPrincipal * Math.max(0, i.monthsRemaining) + monthlyInterest * Math.max(0, i.monthsRemaining)
                      return formatCurrency(remaining, selectedCurrency)
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.monthsTotal}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.monthsRemaining}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.hasInterest ? formatCurrency(i.interestAmountPerMonth, selectedCurrency) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.purchaseDate}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        size="sm"
                        disabled={i.monthsRemaining <= 0}
                        onClick={() => handlePaidOneMonth(i)}
                      >
                        Paid 1
                      </Button>
                      <Button variant="outline" className="bg-transparent" size="sm" onClick={() => handleDelete(i.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {installmentsForCurrency.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No installments yet for {selectedCurrency}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
