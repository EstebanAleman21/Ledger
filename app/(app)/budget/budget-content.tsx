"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatMonth } from "@/lib/utils/format"
import { getCategories, getBudgets, getTransactions, createBudget, updateBudget } from "@/lib/api"
import type { Category, Budget, Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface BudgetItem {
  categoryId: string
  categoryName: string
  categoryColor: string
  budgetAmount: number
  spentAmount: number
  rollover: boolean
  rolloverAmount?: number
}

export function BudgetContent() {
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null)

  useEffect(() => {
    loadData()
  }, [currentMonth])

  const loadData = async () => {
    try {
      setLoading(true)
      const [cats, buds, txns] = await Promise.all([
        getCategories(),
        getBudgets(currentMonth),
        getTransactions(),
      ])
      setCategories(cats)
      setBudgets(buds)
      setTransactions(txns)
    } catch (error) {
      toast.error("Failed to load budget data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleBudgetSaved = () => {
    loadData()
    setIsAddDialogOpen(false)
    setEditingBudget(null)
  }

  // Calculate budget data
  const budgetItems: BudgetItem[] = budgets
    .map((budget) => {
      const category = categories.find((c) => c.id === budget.categoryId)
      const spent = transactions
        .filter((t) => t.categoryId === budget.categoryId && t.type === "expense" && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        categoryId: budget.categoryId,
        categoryName: category?.name || "Unknown",
        categoryColor: category?.color || "#6b7280",
        budgetAmount: budget.amount + (budget.rolloverAmount || 0),
        spentAmount: spent,
        rollover: budget.rollover,
        rolloverAmount: budget.rolloverAmount,
      }
    })

  const totalBudget = budgetItems.reduce((sum, b) => sum + b.budgetAmount, 0)
  const totalSpent = budgetItems.reduce((sum, b) => sum + b.spentAmount, 0)
  const totalRemaining = totalBudget - totalSpent

  const overBudgetCount = budgetItems.filter((b) => b.spentAmount > b.budgetAmount).length
  const nearBudgetCount = budgetItems.filter(
    (b) => b.spentAmount >= b.budgetAmount * 0.8 && b.spentAmount <= b.budgetAmount,
  ).length

  const navigateMonth = (direction: -1 | 1) => {
    const [year, month] = currentMonth.split("-").map(Number)
    const newDate = new Date(year, month - 1 + direction, 1)
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`)
  }

  const getStatusColor = (spent: number, budget: number) => {
    const percentage = (spent / budget) * 100
    if (percentage >= 100) return "destructive"
    if (percentage >= 80) return "warning"
    return "success"
  }

  const getStatusIcon = (spent: number, budget: number) => {
    const percentage = (spent / budget) * 100
    if (percentage >= 100) return <AlertTriangle className="h-4 w-4" />
    if (percentage >= 80) return <TrendingUp className="h-4 w-4" />
    return <CheckCircle2 className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-4 lg:p-6">
        <div className="text-muted-foreground">Loading budget...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Month Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold text-foreground">{formatMonth(currentMonth)}</h2>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalBudget, "MXN")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalSpent, "MXN")}</div>
            <Progress value={(totalSpent / totalBudget) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", totalRemaining >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(totalRemaining, "MXN")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(overBudgetCount > 0 || nearBudgetCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {overBudgetCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {overBudgetCount} over budget
            </Badge>
          )}
          {nearBudgetCount > 0 && (
            <Badge variant="outline" className="gap-1 border-warning/50 bg-warning/10 text-warning">
              <TrendingUp className="h-3 w-3" />
              {nearBudgetCount} near limit
            </Badge>
          )}
        </div>
      )}

      {/* Budget List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Category Budgets</h3>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <BudgetDialog categories={categories} currentMonth={currentMonth} onClose={() => setIsAddDialogOpen(false)} onSave={handleBudgetSaved} />
            </DialogContent>
          </Dialog>
        </div>

        {budgetItems.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No budgets set"
            description="Create budgets to track your spending by category"
            action={
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {budgetItems.map((item) => {
              const percentage = Math.min((item.spentAmount / item.budgetAmount) * 100, 100)
              const status = getStatusColor(item.spentAmount, item.budgetAmount)

              return (
                <Card
                  key={item.categoryId}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setEditingBudget(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.categoryColor }}
                          aria-hidden
                        />
                        <span className="font-medium text-foreground">{item.categoryName}</span>
                        {item.rollover && item.rolloverAmount && item.rolloverAmount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{formatCurrency(item.rolloverAmount, "MXN")} rollover
                          </Badge>
                        )}
                      </div>
                      <div className={cn("flex items-center gap-1", `text-${status}`)}>
                        {getStatusIcon(item.spentAmount, item.budgetAmount)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatCurrency(item.spentAmount, "MXN")} of {formatCurrency(item.budgetAmount, "MXN")}
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            item.budgetAmount - item.spentAmount >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {formatCurrency(item.budgetAmount - item.spentAmount, "MXN")} left
                        </span>
                      </div>
                      <Progress
                        value={percentage}
                        className={cn(
                          "h-2",
                          status === "destructive" && "[&>div]:bg-destructive",
                          status === "warning" && "[&>div]:bg-warning",
                          status === "success" && "[&>div]:bg-success",
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Budget Dialog */}
      {editingBudget && (
        <Dialog open={!!editingBudget} onOpenChange={() => setEditingBudget(null)}>
          <DialogContent>
            <BudgetDialog budget={editingBudget} categories={categories} currentMonth={currentMonth} onClose={() => setEditingBudget(null)} onSave={handleBudgetSaved} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface BudgetDialogProps {
  budget?: BudgetItem
  categories: Category[]
  currentMonth: string
  onClose: () => void
  onSave?: () => void
}

function BudgetDialog({ budget, categories, currentMonth, onClose, onSave }: BudgetDialogProps) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId || "")
  const [amount, setAmount] = useState(budget?.budgetAmount.toString() || "")
  const [rollover, setRollover] = useState(budget?.rollover || false)
  const [loading, setLoading] = useState(false)

  const expenseCategories = categories.filter((c) => c.type === "expense" || c.type === "both")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        categoryId,
        month: currentMonth,
        amount: Number.parseFloat(amount),
        rollover,
      }

      await createBudget(data)
      toast.success(budget ? "Budget updated" : "Budget created")
      onSave?.()
      onClose()
    } catch (error) {
      toast.error("Failed to save budget")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{budget ? "Edit Budget" : "Add Budget"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={!!budget}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monthly Budget (MXN)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="rollover">Rollover unused budget</Label>
            <p className="text-sm text-muted-foreground">Carry over remaining balance to next month</p>
          </div>
          <Switch id="rollover" checked={rollover} onCheckedChange={setRollover} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Saving..." : budget ? "Save Changes" : "Add Budget"}
          </Button>
        </div>
      </form>
    </>
  )
}
