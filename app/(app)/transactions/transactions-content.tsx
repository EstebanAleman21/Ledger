"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Trash2,
  Tags,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  SlidersHorizontal,
  ChevronDown,
  X,
  ClipboardPaste,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CurrencyBadge } from "@/components/ui/currency-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { TransactionDialog } from "@/components/transactions/transaction-dialog"
import { ImportDialog } from "@/components/transactions/import-dialog"
import { formatCurrency, formatDateShort } from "@/lib/utils/format"
import { getTransactions, getCategories, getAccounts, deleteTransaction, bulkUpdateTransactions } from "@/lib/api"
import type { Transaction, TransactionType, Currency, Category, Account } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc"

function toDateKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed
}

export function TransactionsContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<TransactionType | "all">("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [reviewOnly, setReviewOnly] = useState(false)
  const [sort, setSort] = useState<SortOption>("date_desc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Load data
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
      toast.error("Failed to load data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleTransactionSaved = () => {
    loadData()
    setIsAddDialogOpen(false)
    setEditingTransaction(null)
  }

  const visibleTransactions = useMemo(() => {
    const filtered = transactions.filter((txn) => {
      if (searchQuery && !txn.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (selectedType !== "all" && txn.type !== selectedType) return false
      if (selectedCategory !== "all" && txn.categoryId !== selectedCategory) return false
      if (selectedAccount !== "all" && txn.accountId !== selectedAccount) return false
      if (selectedCurrency !== "all" && txn.currency !== selectedCurrency) return false
      if (reviewOnly && !txn.needsReview) return false

      const txnDateKey = toDateKey(txn.date)
      if (dateFrom && txnDateKey && txnDateKey < dateFrom) return false
      if (dateTo && txnDateKey && txnDateKey > dateTo) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sort === "amount_desc") return b.amount - a.amount
      if (sort === "amount_asc") return a.amount - b.amount
      const aDate = toDateKey(a.date)
      const bDate = toDateKey(b.date)
      if (sort === "date_asc") return aDate.localeCompare(bDate)
      return bDate.localeCompare(aDate)
    })
  }, [
    transactions,
    searchQuery,
    selectedType,
    selectedCategory,
    selectedAccount,
    selectedCurrency,
    reviewOnly,
    dateFrom,
    dateTo,
    sort,
  ])

  useEffect(() => {
    const visibleIds = new Set(visibleTransactions.map((t) => t.id))
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)))
  }, [visibleTransactions])

  const hasActiveFilters =
    selectedType !== "all" ||
    selectedCategory !== "all" ||
    selectedAccount !== "all" ||
    selectedCurrency !== "all" ||
    !!dateFrom ||
    !!dateTo ||
    reviewOnly ||
    sort !== "date_desc"

  const clearFilters = () => {
    setSelectedType("all")
    setSelectedCategory("all")
    setSelectedAccount("all")
    setSelectedCurrency("all")
    setDateFrom("")
    setDateTo("")
    setReviewOnly(false)
    setSort("date_desc")
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === visibleTransactions.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(visibleTransactions.map((t) => t.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map((id) => deleteTransaction(id)))
      toast.success(`Deleted ${selectedIds.length} transaction${selectedIds.length > 1 ? "s" : ""}`)
      setSelectedIds([])
      loadData()
    } catch (error) {
      toast.error("Failed to delete transactions")
      console.error(error)
    }
  }

  const handleBulkRecategorize = async (categoryId: string) => {
    try {
      await bulkUpdateTransactions(selectedIds, { categoryId })
      toast.success(`Updated ${selectedIds.length} transaction${selectedIds.length > 1 ? "s" : ""}`)
      setSelectedIds([])
      loadData()
    } catch (error) {
      toast.error("Failed to update transactions")
      console.error(error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id)
      toast.success("Transaction deleted")
      loadData()
    } catch (error) {
      toast.error("Failed to delete transaction")
      console.error(error)
    }
  }

  const handleExport = () => {
    console.log("Exporting transactions...")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-border bg-card p-4 lg:p-6">
        {/* Search and Actions Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative bg-transparent">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      !
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[360px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Filters</div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFilterOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">From</label>
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">To</label>
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Sort</label>
                    <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">Date (newest)</SelectItem>
                        <SelectItem value="date_asc">Date (oldest)</SelectItem>
                        <SelectItem value="amount_desc">Amount (high → low)</SelectItem>
                        <SelectItem value="amount_asc">Amount (low → high)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <Select value={selectedType} onValueChange={(v) => setSelectedType(v as TransactionType | "all")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Account</label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Currency</label>
                    <Select value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as Currency | "all")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Currencies</SelectItem>
                        <SelectItem value="MXN">MXN</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox checked={reviewOnly} onCheckedChange={(v) => setReviewOnly(!!v)} />
                    <span className="text-sm">Needs review only</span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 bg-transparent" onClick={clearFilters}>
                      Clear
                    </Button>
                    <Button className="flex-1" onClick={() => setIsFilterOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Paste from clipboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {/* Active Filters Pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {selectedType !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Type: {selectedType}
                <button onClick={() => setSelectedType("all")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {sort !== "date_desc" && (
              <Badge variant="secondary" className="gap-1">
                Sort:{" "}
                {sort === "date_asc"
                  ? "Date (oldest)"
                  : sort === "amount_desc"
                    ? "Amount (high → low)"
                    : "Amount (low → high)"}
                <button onClick={() => setSort("date_desc")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {reviewOnly && (
              <Badge variant="secondary" className="gap-1">
                Review only
                <button onClick={() => setReviewOnly(false)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1">
                From: {dateFrom}
                <button onClick={() => setDateFrom("")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1">
                To: {dateTo}
                <button onClick={() => setDateTo("")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCategory !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Category: {categories.find((c) => c.id === selectedCategory)?.name}
                <button onClick={() => setSelectedCategory("all")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedAccount !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Account: {accounts.find((a) => a.id === selectedAccount)?.name}
                <button onClick={() => setSelectedAccount("all")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCurrency !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Currency: {selectedCurrency}
                <button onClick={() => setSelectedCurrency("all")}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-4 rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tags className="h-4 w-4 mr-2" />
                    Recategorize
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {categories.map((cat) => (
                    <DropdownMenuItem key={cat.id} onClick={() => handleBulkRecategorize(cat.id)}>
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="ml-auto">
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading transactions...</div>
          </div>
        ) : visibleTransactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description={
              searchQuery || hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Add your first transaction to get started"
            }
            action={
              !searchQuery && !hasActiveFilters ? (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {/* Select All Header */}
            <div className="flex items-center gap-4 px-3 py-2">
              <Checkbox checked={selectedIds.length === visibleTransactions.length} onCheckedChange={toggleSelectAll} />
              <span className="text-sm text-muted-foreground">
                {visibleTransactions.length} transaction{visibleTransactions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Transactions */}
            {visibleTransactions.map((txn) => {
              const category = categories.find((c) => c.id === txn.categoryId)
              const account = accounts.find((a) => a.id === txn.accountId)
              const toAccount = txn.toAccountId ? accounts.find((a) => a.id === txn.toAccountId) : null
              const isSelected = selectedIds.includes(txn.id)
              const color = category?.color || "#64748b"
              const subtitle =
                txn.type === "transfer"
                  ? "Transfer"
                  : txn.type === "adjustment"
                    ? "Adjustment"
                    : (category?.name || "Uncategorized")
              const amountSign = txn.type === "income" ? "+" : txn.type === "expense" ? "-" : txn.type === "adjustment" && txn.amount > 0 ? "+" : ""
              const amountClass =
                txn.type === "income"
                  ? "text-success"
                  : txn.type === "expense"
                    ? "text-destructive"
                    : txn.type === "adjustment"
                      ? txn.amount > 0
                        ? "text-success"
                        : txn.amount < 0
                          ? "text-destructive"
                          : "text-foreground"
                      : "text-foreground"

              return (
                <div
                  key={txn.id}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50",
                    isSelected && "border-primary bg-primary/5",
                  )}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(txn.id)} />

                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    {txn.type === "income" ? (
                      <ArrowDownLeft className="h-5 w-5" style={{ color }} />
                    ) : txn.type === "expense" ? (
                      <ArrowUpRight className="h-5 w-5" style={{ color }} />
                    ) : txn.type === "adjustment" ? (
                      <SlidersHorizontal className="h-5 w-5" style={{ color }} />
                    ) : (
                      <ArrowLeftRight className="h-5 w-5" style={{ color }} />
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
                    <p className="text-sm text-muted-foreground truncate">
                      {subtitle}
                      {txn.type === "transfer" && toAccount ? ` → ${toAccount.name}` : ` • ${account?.name}`}
                      {" • "}
                      {formatDateShort(txn.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <CurrencyBadge currency={txn.currency} />
                    <span
                      className={cn(
                        "font-semibold tabular-nums min-w-[80px] text-right",
                        amountClass,
                      )}
                    >
                      {amountSign}
                      {formatCurrency(txn.amount, txn.currency)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTransaction(txn)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(txn.id)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <TransactionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSave={handleTransactionSaved}
      />
      {editingTransaction && (
        <TransactionDialog
          open={!!editingTransaction}
          onOpenChange={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onSave={handleTransactionSaved}
        />
      )}
      <ImportDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} accounts={accounts} />
    </div>
  )
}
