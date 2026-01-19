"use client"

import { useState, useEffect, useMemo } from "react"
import { TrendingUp, Wallet, Target, ArrowUpRight, ArrowDownLeft, Search, Filter } from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CurrencyBadge } from "@/components/ui/currency-badge"
import { formatCurrency, formatDateShort } from "@/lib/utils/format"
import { getTransactions, getCategories, getAccounts } from "@/lib/api"
import type { Transaction, Category, Account } from "@/lib/types"
import { cn } from "@/lib/utils"

export function DashboardContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [txns, cats, accs] = await Promise.all([
        getTransactions(),
        getCategories(),
        getAccounts(),
      ])
      setTransactions(txns)
      setCategories(cats)
      setAccounts(accs)
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const { totalIncome, totalExpenses, netIncome, categorySpending, dailySpend } = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)

    // Group spending by category
    const spendingByCategory = new Map<string, number>()
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        if (!t.categoryId) return
        const current = spendingByCategory.get(t.categoryId) || 0
        spendingByCategory.set(t.categoryId, current + t.amount)
      })

    const categoryData = Array.from(spendingByCategory.entries())
      .map(([catId, value]) => {
        const cat = categories.find((c) => c.id === catId)
        return {
          name: cat?.name || "Uncategorized",
          value,
          color: cat?.color || "#64748b",
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    // Group by date for daily spend
    const spendByDate = new Map<string, number>()
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const current = spendByDate.get(t.date) || 0
        spendByDate.set(t.date, current + t.amount)
      })

    const dailyData = Array.from(spendByDate.entries())
      .map(([date, amount]) => ({ date: formatDateShort(date), amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8)

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netIncome: income - expenses,
      categorySpending: categoryData,
      dailySpend: dailyData,
    }
  }, [transactions, categories])

  const filteredTransactions = transactions.filter((txn) =>
    txn.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-4 lg:p-6">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalIncome, "MXN")}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalExpenses, "MXN")}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Income</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", netIncome >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(netIncome, "MXN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{transactions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categorySpending.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, "MXN")}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Spend Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Daily Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySpend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, "MXN")}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Chart - Show only if we have data */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: "This Month", income: totalIncome, expenses: totalExpenses }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, "MXN")}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTransactions.slice(0, 8).map((txn) => {
              const category = categories.find((c) => c.id === txn.categoryId)
              const account = accounts.find((a) => a.id === txn.accountId)
              return (
                <div
                  key={txn.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${category?.color}20` }}
                  >
                    {txn.type === "income" ? (
                      <ArrowDownLeft className="h-5 w-5" style={{ color: category?.color }} />
                    ) : txn.type === "expense" ? (
                      <ArrowUpRight className="h-5 w-5" style={{ color: category?.color }} />
                    ) : (
                      <TrendingUp className="h-5 w-5" style={{ color: category?.color }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{txn.description}</p>
                      {txn.needsReview && (
                        <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                          Review
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {category?.name} • {account?.name} • {formatDateShort(txn.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CurrencyBadge currency={txn.currency} />
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        txn.type === "income"
                          ? "text-success"
                          : txn.type === "expense"
                            ? "text-destructive"
                            : "text-foreground",
                      )}
                    >
                      {txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}
                      {formatCurrency(txn.amount, txn.currency)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
