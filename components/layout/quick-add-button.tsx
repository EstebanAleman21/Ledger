"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TransactionDialog } from "@/components/transactions/transaction-dialog"

interface QuickAddButtonProps {
  className?: string
}

export function QuickAddButton({ className }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="icon"
        className={cn("fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg", className)}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Add transaction</span>
      </Button>
      <TransactionDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
