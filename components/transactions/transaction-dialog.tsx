"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { CalendarIcon, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { TransactionType, Currency, Category, Account } from "@/lib/types"
import { createTransaction, updateTransaction, getCategories, getAccounts } from "@/lib/api"
import { toast } from "sonner"

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
  transaction?: {
    id?: string
    date?: string
    description?: string
    amount?: number
    type?: TransactionType
    categoryId?: string
    accountId?: string
    toAccountId?: string
    currency?: Currency
    notes?: string
    tags?: string[]
  }
}

export function TransactionDialog({ open, onOpenChange, onSave, transaction }: TransactionDialogProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<TransactionType>(transaction?.type || "expense")
  const [date, setDate] = useState<Date>(() => {
    if (transaction?.date) {
      // Parse date string as local date to avoid timezone issues
      const [year, month, day] = transaction.date.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    return new Date()
  })
  const [description, setDescription] = useState(transaction?.description || "")
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "")
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || "")
  const [accountId, setAccountId] = useState(transaction?.accountId || "")
  const [toAccountId, setToAccountId] = useState(transaction?.toAccountId || "")
  const [currency, setCurrency] = useState<Currency>(transaction?.currency || "MXN")
  const [notes, setNotes] = useState(transaction?.notes || "")

  const isEditing = !!transaction?.id

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    try {
      const [cats, accs] = await Promise.all([getCategories(), getAccounts()])
      setCategories(cats)
      setAccounts(accs)
    } catch (error) {
      console.error("Failed to load data:", error)
    }
  }

  const filteredCategories = categories.filter(
    (cat) => cat.type === "both" || cat.type === type || type === "transfer",
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        type,
        date: format(date, "yyyy-MM-dd"),
        description,
        amount: Number.parseFloat(amount),
        categoryId: type === "transfer" ? "" : categoryId,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : undefined,
        currency,
        notes,
        tags: [],
      }

      if (isEditing && transaction?.id) {
        await updateTransaction(transaction.id, data)
        toast.success("Transaction updated")
      } else {
        await createTransaction(data)
        toast.success("Transaction created")
      }

      onSave?.()
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to save transaction")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              className={cn(
                "flex-col gap-1 h-auto py-3",
                type === "expense" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              onClick={() => setType("expense")}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs">Expense</span>
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              className={cn(
                "flex-col gap-1 h-auto py-3",
                type === "income" && "bg-success text-success-foreground hover:bg-success/90",
              )}
              onClick={() => setType("income")}
            >
              <ArrowDownLeft className="h-4 w-4" />
              <span className="text-xs">Income</span>
            </Button>
            <Button
              type="button"
              variant={type === "transfer" ? "default" : "outline"}
              className={cn("flex-col gap-1 h-auto py-3", type === "transfer" && "bg-primary")}
              onClick={() => setType("transfer")}
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="text-xs">Transfer</span>
            </Button>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-medium"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label htmlFor="account">{type === "transfer" ? "From Account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <span className="flex items-center gap-2">
                      {acc.name}
                      <span className="text-xs text-muted-foreground">({acc.currency})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Account (for transfers) */}
          {type === "transfer" && (
            <div className="space-y-2">
              <Label htmlFor="toAccount">To Account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger id="toAccount">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((acc) => acc.id !== accountId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <span className="flex items-center gap-2">
                          {acc.name}
                          <span className="text-xs text-muted-foreground">({acc.currency})</span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          {type !== "transfer" && (
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
