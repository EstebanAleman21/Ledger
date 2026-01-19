"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Tags,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Laptop,
  Utensils,
  Car,
  ShoppingBag,
  Gamepad2,
  HeartPulse,
  Home,
  TrendingUp,
  HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { getCategories, getTransactions, getCategoryRules, createCategory, updateCategory, deleteCategory, createCategoryRule, deleteCategoryRule } from "@/lib/api"
import type { Category, CategoryRule, Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const iconOptions = [
  { name: "briefcase", icon: Briefcase },
  { name: "laptop", icon: Laptop },
  { name: "utensils", icon: Utensils },
  { name: "car", icon: Car },
  { name: "shopping-bag", icon: ShoppingBag },
  { name: "gamepad-2", icon: Gamepad2 },
  { name: "zap", icon: Zap },
  { name: "heart-pulse", icon: HeartPulse },
  { name: "home", icon: Home },
  { name: "trending-up", icon: TrendingUp },
  { name: "help-circle", icon: HelpCircle },
]

const colorOptions = ["#22c55e", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#64748b"]

export function CategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"categories" | "rules">("categories")
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [cats, txns, rules] = await Promise.all([
        getCategories(),
        getTransactions(),
        getCategoryRules(),
      ])
      setCategories(cats)
      setTransactions(txns)
      setCategoryRules(rules)
    } catch (error) {
      toast.error("Failed to load categories")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySaved = () => {
    loadData()
    setIsAddCategoryOpen(false)
    setEditingCategory(null)
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id)
      toast.success("Category deleted")
      loadData()
    } catch (error) {
      toast.error("Failed to delete category")
      console.error(error)
    }
  }

  const incomeCategories = categories.filter((c) => c.type === "income")
  const expenseCategories = categories.filter((c) => c.type === "expense")
  const bothCategories = categories.filter((c) => c.type === "both")

  const getCategoryTransactionCount = (categoryId: string) => {
    return transactions.filter((t) => t.categoryId === categoryId).length
  }

  const getIconComponent = (iconName: string) => {
    const found = iconOptions.find((o) => o.name === iconName)
    return found ? found.icon : HelpCircle
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-4 lg:p-6">
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "categories" | "rules")}>
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="rules">Auto-Rules</TabsTrigger>
          </TabsList>

          {activeTab === "categories" ? (
            <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <CategoryDialog categories={categories} onClose={() => setIsAddCategoryOpen(false)} onSave={handleCategorySaved} />
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <RuleDialog categories={categories} onClose={() => setIsAddRuleOpen(false)} onSave={() => loadData()} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <TabsContent value="categories" className="space-y-6">
          {/* Income Categories */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-success" />
              <h3 className="font-medium text-foreground">Income</h3>
              <Badge variant="secondary" className="text-xs">
                {incomeCategories.length}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {incomeCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  transactionCount={getCategoryTransactionCount(category.id)}
                  getIconComponent={getIconComponent}
                  onEdit={() => setEditingCategory(category)}
                  onDelete={() => handleDeleteCategory(category.id)}
                />
              ))}
            </div>
          </div>

          {/* Expense Categories */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-destructive" />
              <h3 className="font-medium text-foreground">Expense</h3>
              <Badge variant="secondary" className="text-xs">
                {expenseCategories.length}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {expenseCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  transactionCount={getCategoryTransactionCount(category.id)}
                  getIconComponent={getIconComponent}
                  onEdit={() => setEditingCategory(category)}
                  onDelete={() => handleDeleteCategory(category.id)}
                />
              ))}
            </div>
          </div>

          {/* Both Categories */}
          {bothCategories.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-foreground">Both</h3>
                <Badge variant="secondary" className="text-xs">
                  {bothCategories.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bothCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={getCategoryTransactionCount(category.id)}
                    getIconComponent={getIconComponent}
                    onEdit={() => setEditingCategory(category)}
                    onDelete={() => handleDeleteCategory(category.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          {categoryRules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No auto-rules yet"
              description="Create rules to automatically categorize transactions based on patterns"
              action={
                <Button onClick={() => setIsAddRuleOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {categoryRules.map((rule) => {
                const category = categories.find((c) => c.id === rule.categoryId)
                return (
                  <Card key={rule.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Zap className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          If {rule.field}{" "}
                          <span className="text-muted-foreground">{rule.operator.replace(/([A-Z])/g, " $1")}</span>{" "}
                          <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{rule.value}</span>
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                          Assign to{" "}
                          <span
                            className="inline-flex items-center gap-1 font-medium"
                            style={{ color: category?.color }}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category?.color }} />
                            {category?.name}
                          </span>
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={async () => {
                              try {
                                await deleteCategoryRule(rule.id)
                                toast.success("Rule deleted")
                                loadData()
                              } catch (error) {
                                toast.error("Failed to delete rule")
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent>
            <CategoryDialog category={editingCategory} categories={categories} onClose={() => setEditingCategory(null)} onSave={handleCategorySaved} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface CategoryCardProps {
  category: Category
  transactionCount: number
  getIconComponent: (name: string) => React.ElementType
  onEdit: () => void
  onDelete: () => void
}

function CategoryCard({ category, transactionCount, getIconComponent, onEdit, onDelete }: CategoryCardProps) {
  const IconComponent = getIconComponent(category.icon)

  return (
    <Card className="transition-colors hover:bg-muted/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${category.color}20` }}
        >
          <IconComponent className="h-5 w-5" style={{ color: category.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{category.name}</p>
          <p className="text-sm text-muted-foreground">{transactionCount} transactions</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  )
}

interface CategoryDialogProps {
  category?: Category
  categories: Category[]
  onClose: () => void
  onSave?: () => void
}

function CategoryDialog({ category, categories, onClose, onSave }: CategoryDialogProps) {
  const [name, setName] = useState(category?.name || "")
  const [type, setType] = useState<"income" | "expense" | "both">(category?.type || "expense")
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || "help-circle")
  const [selectedColor, setSelectedColor] = useState(category?.color || colorOptions[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = { name, type, icon: selectedIcon, color: selectedColor }

      if (category?.id) {
        await updateCategory(category.id, data)
        toast.success("Category updated")
      } else {
        await createCategory(data)
        toast.success("Category created")
      }

      onSave?.()
      onClose()
    } catch (error) {
      toast.error("Failed to save category")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "income" | "expense" | "both")}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-2">
            {iconOptions.map((option) => {
              const IconComp = option.icon
              return (
                <button
                  key={option.name}
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                    selectedIcon === option.name
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted",
                  )}
                  onClick={() => setSelectedIcon(option.name)}
                >
                  <IconComp className="h-5 w-5" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-all",
                  selectedColor === color ? "border-foreground scale-110" : "border-transparent",
                )}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Saving..." : category ? "Save Changes" : "Add Category"}
          </Button>
        </div>
      </form>
    </>
  )
}

interface RuleDialogProps {
  rule?: CategoryRule
  categories: Category[]
  onClose: () => void
  onSave: () => void
}

function RuleDialog({ rule, categories, onClose, onSave }: RuleDialogProps) {
  const [field, setField] = useState<"description" | "amount" | "tags">(rule?.field || "description")
  const [operator, setOperator] = useState<"contains" | "equals" | "startsWith" | "endsWith" | "greaterThan" | "lessThan">(rule?.operator || "contains")
  const [value, setValue] = useState(rule?.value || "")
  const [categoryId, setCategoryId] = useState(rule?.categoryId || "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryId) {
      toast.error("Please select a category")
      return
    }
    
    setLoading(true)
    try {
      await createCategoryRule({ field, operator, value, categoryId })
      toast.success("Rule created")
      onSave()
      onClose()
    } catch (error) {
      toast.error("Failed to create rule")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{rule ? "Edit Rule" : "Add Rule"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="field">Field</Label>
          <Select value={field} onValueChange={(v) => setField(v as "description" | "amount" | "tags")}>
            <SelectTrigger id="field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="description">Description</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="tags">Tags</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operator">Condition</Label>
          <Select value={operator} onValueChange={(v) => setOperator(v as typeof operator)}>
            <SelectTrigger id="operator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="startsWith">Starts with</SelectItem>
              <SelectItem value="endsWith">Ends with</SelectItem>
              {field === "amount" && (
                <>
                  <SelectItem value="greaterThan">Greater than</SelectItem>
                  <SelectItem value="lessThan">Less than</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field === "amount" ? "Enter amount" : "Enter text to match"}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Assign to Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
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

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Saving..." : rule ? "Save Changes" : "Add Rule"}
          </Button>
        </div>
      </form>
    </>
  )
}
