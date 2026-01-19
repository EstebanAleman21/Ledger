"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Moon, Sun, RefreshCw, Menu, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"
import { SyncIndicator } from "./sync-indicator"
import { getSyncStatus } from "@/lib/api"
import { toast } from "sonner"
import type { SyncStatus } from "@/lib/types"
import { ImportPreviewDialog } from "@/components/sheets/import-preview-dialog"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transactions",
  "/budget": "Budget",
  "/reports": "Reports",
  "/accounts": "Accounts",
  "/debt": "Debt",
  "/categories": "Categories",
  "/settings": "Settings",
}

export function Header() {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false)

  const title = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] || "Ledger"

  useEffect(() => {
    loadSyncStatus()
  }, [])

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus()
      setSyncStatus(status)
    } catch (error) {
      console.error("Failed to load sync status:", error)
    }
  }

  const handleSync = async () => {
    if (!syncStatus?.connected) {
      toast.error("Not connected to Google Sheets. Go to Settings to connect.")
      return
    }
    setIsImportPreviewOpen(true)
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-6">
      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar className="flex" />
        </SheetContent>
      </Sheet>

      {/* Page Title */}
      <h1 className="text-lg font-semibold text-foreground lg:text-xl">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sync Status */}
      <SyncIndicator 
        connected={syncStatus?.connected}
        syncing={isSyncing}
        lastSyncedAt={syncStatus?.lastSyncedAt}
      />

      {/* Refresh/Sync Button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="hidden sm:flex"
        onClick={handleSync}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        <span className="sr-only">Sync data</span>
      </Button>

      {/* Theme Toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportPreviewDialog
        open={isImportPreviewOpen}
        onOpenChange={setIsImportPreviewOpen}
        onImported={() => {
          loadSyncStatus()
          window.location.reload()
        }}
      />
    </header>
  )
}
