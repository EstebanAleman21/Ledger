"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatMonth, formatPercent } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { getMonthlyReport, getYearlyReport, getCategories, getBudgets, exportCSV } from "@/lib/api"
import type { Category, MonthlyReport, YearlyReport, Budget } from "@/lib/types"
import { toast } from "sonner"

const COLORS = ["#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e", "#64748b", "#ef4444", "#10b981", "#a855f7", "#6366f1", "#14b8a6"]

export function ReportsContent() {
  const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("monthly")
  const [currentMonth, setCurrentMonth] = useState("2026-01")
  const [currentYear, setCurrentYear] = useState("2026")
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null)
  const [yearlyReport, setYearlyReport] = useState<YearlyReport | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [previousMonthReport, setPreviousMonthReport] = useState<MonthlyReport | null>(null)

  useEffect(() => {
    loadData()
  }, [currentMonth, currentYear, activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      const cats = await getCategories()
      setCategories(cats)

      if (activeTab === "monthly") {
        const [report, buds] = await Promise.all([
          getMonthlyReport(currentMonth),
          getBudgets(currentMonth),
        ])
        setMonthlyReport(report)
        setBudgets(buds)

        // Get previous month for comparison
        const [year, month] = currentMonth.split("-").map(Number)
        const prevDate = new Date(year, month - 2, 1)
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
        const prevReport = await getMonthlyReport(prevMonth)
        setPreviousMonthReport(prevReport)
      } else {
        const report = await getYearlyReport(currentYear)
        setYearlyReport(report)
      }
    } catch (error) {
      console.error("Failed to load reports:", error)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: -1 | 1) => {
    const [year, month] = currentMonth.split("-").map(Number)
    const newDate = new Date(year, month - 1 + direction, 1)
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`)
  }

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || "Unknown"
  }

  const getCategoryColor = (categoryId: string, index: number) => {
    return categories.find((c) => c.id === categoryId)?.color || COLORS[index % COLORS.length]
  }

  // Process monthly data for charts
  const byCategoryChart = useMemo(() => {
    if (!monthlyReport) return []
    return monthlyReport.byCategory.map((item, index) => ({
      name: getCategoryName(item.categoryId),
      value: item.amount,
      color: getCategoryColor(item.categoryId, index),
    }))
  }, [monthlyReport, categories])

  const dailySpendChart = useMemo(() => {
    if (!monthlyReport) return []
    return monthlyReport.dailySpend.map((item) => ({
      day: new Date(item.date).getDate(),
      amount: item.amount,
    }))
  }, [monthlyReport])

  const budgetVsActualChart = useMemo(() => {
    if (!monthlyReport || !budgets.length) return []
    return budgets.map((budget) => {
      const actual = monthlyReport.byCategory.find((c) => c.categoryId === budget.categoryId)?.amount || 0
      return {
        category: getCategoryName(budget.categoryId),
        budget: budget.amount,
        actual: actual,
      }
    })
  }, [monthlyReport, budgets, categories])

  // Process yearly data
  const yearlyMonthlyChart = useMemo(() => {
    if (!yearlyReport) return []
    return yearlyReport.monthlyTotals.map((item) => ({
      month: new Date(item.month + "-01").toLocaleDateString("en-US", { month: "short" }),
      income: item.income,
      expenses: item.expenses,
      net: item.net,
    }))
  }, [yearlyReport])

  const yearlyCategoryChart = useMemo(() => {
    if (!yearlyReport) return []
    return yearlyReport.categoryTotals.map((item, index) => ({
      name: getCategoryName(item.categoryId),
      value: item.amount,
      color: getCategoryColor(item.categoryId, index),
    }))
  }, [yearlyReport, categories])

  const handleExport = async () => {
    try {
      const blob = await exportCSV()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `transactions-${activeTab === "monthly" ? currentMonth : currentYear}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch (error) {
      toast.error("Failed to export")
    }
  }

  const incomeChange = previousMonthReport && monthlyReport
    ? ((monthlyReport.income - previousMonthReport.income) / (previousMonthReport.income || 1)) * 100
    : 0
  const expenseChange = previousMonthReport && monthlyReport
    ? ((monthlyReport.expenses - previousMonthReport.expenses) / (previousMonthReport.expenses || 1)) * 100
    : 0

  const yearlyIncome = yearlyReport?.monthlyTotals.reduce((sum, m) => sum + m.income, 0) || 0
  const yearlyExpenses = yearlyReport?.monthlyTotals.reduce((sum, m) => sum + m.expenses, 0) || 0
  const yearlyNet = yearlyIncome - yearlyExpenses

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "monthly" | "yearly")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>

          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* MONTHLY VIEW */}
        <TabsContent value="monthly" className="space-y-6 mt-6">
          {/* Month Navigator */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold text-foreground min-w-[160px] text-center">
              {formatMonth(currentMonth)}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(monthlyReport?.income || 0, "MXN")}</div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm mt-1",
                    incomeChange >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {incomeChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{formatPercent(incomeChange)} vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(monthlyReport?.expenses || 0, "MXN")}</div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm mt-1",
                    expenseChange <= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {expenseChange <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  <span>{formatPercent(expenseChange)} vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn("text-2xl font-bold", monthlyReport?.net || 0 >= 0 ? "text-foreground" : "text-destructive")}
                >
                  {formatCurrency(monthlyReport?.net || 0, "MXN")}
                </div>
                <div className="flex items-center gap-1 text-sm mt-1 text-muted-foreground">
                  <span>{(((monthlyReport?.net || 0) / (monthlyReport?.income || 1)) * 100).toFixed(0)}% savings rate</span>
                </div>
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
                        data={byCategoryChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {byCategoryChart.map((entry) => (
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

            {/* Budget vs Actual */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Budget vs Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetVsActualChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => `$${v / 1000}k`}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, "MXN")}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Spending */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Daily Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySpendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, "MXN")}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {byCategoryChart.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-4">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {((cat.value / (monthlyReport?.expenses || 1)) * 100).toFixed(1)}%
                    </span>
                    <span className="text-sm font-medium tabular-nums text-foreground min-w-[100px] text-right">
                      {formatCurrency(cat.value, "MXN")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* YEARLY VIEW */}
        <TabsContent value="yearly" className="space-y-6 mt-6">
          {/* Year Selector */}
          <div className="flex items-center justify-center">
            <Select value={currentYear} onValueChange={setCurrentYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(yearlyIncome, "MXN")}</div>
                <p className="text-sm text-muted-foreground mt-1">Avg {formatCurrency(yearlyIncome / 12, "MXN")}/mo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(yearlyExpenses, "MXN")}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Avg {formatCurrency(yearlyExpenses / 12, "MXN")}/mo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", yearlyNet >= 0 ? "text-foreground" : "text-destructive")}>
                  {formatCurrency(yearlyNet, "MXN")}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {((yearlyNet / yearlyIncome) * 100).toFixed(0)}% savings rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Income vs Expenses by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyMonthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v / 1000}k`} />
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

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Net Worth Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Net Worth Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => `$${v / 1000}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, "MXN")}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Annual Category Totals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Annual Category Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={yearlyCategoryChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {yearlyCategoryChart.map((entry) => (
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
          </div>

          {/* Savings Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Monthly Net Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyMonthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v / 1000}k`} />
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
                      dataKey="net"
                      name="Net Savings"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
