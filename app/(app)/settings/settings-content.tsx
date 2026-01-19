"use client"

import { useState, useEffect } from "react"
import {
  Cloud,
  CloudOff,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  Plus,
  Trash2,
  Loader2,
  Check,
  Landmark,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatCurrency, getRelativeTime } from "@/lib/utils/format"
import { getExchangeRates, getSyncStatus, updateExchangeRate } from "@/lib/api"
import type { Currency, ExchangeRate, SyncStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ImportPreviewDialog } from "@/components/sheets/import-preview-dialog"

export function SettingsContent() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [baseCurrency, setBaseCurrency] = useState<Currency>("MXN")
  const [usdToMxnRate, setUsdToMxnRate] = useState("17.15")
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isConnectingBank, setIsConnectingBank] = useState(false)
  const [skipToChoose, setSkipToChoose] = useState(false)
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false)

  useEffect(() => {
    loadData()
    
    // Check for OAuth callback result
    const params = new URLSearchParams(window.location.search)
    const authResult = params.get('auth')
    const error = params.get('error')
    
    if (authResult === 'success') {
      toast.success('Connected to Google Sheets!')
      // Open the dialog to choose/create sheet, skipping the connect step
      setSkipToChoose(true)
      setIsOnboardingOpen(true)
      // Clean up URL
      window.history.replaceState({}, '', '/settings')
    } else if (error) {
      toast.error(`Authentication failed: ${error}`)
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [status, rates] = await Promise.all([
        getSyncStatus(),
        getExchangeRates(),
      ])
      setSyncStatus(status)
      setExchangeRates(rates)
      const usdRate = rates.find((r) => r.fromCurrency === "USD" && r.toCurrency === "MXN")
      if (usdRate) setUsdToMxnRate(usdRate.rate.toString())
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setIsImportPreviewOpen(true)
  }

  const handlePushToSheets = async () => {
    setIsSyncing(true)
    try {
      const { syncPush } = await import("@/lib/api")
      const result = await syncPush()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error("Push failed")
      }
    } catch (error) {
      console.error("Push failed:", error)
      toast.error("Failed to push to Google Sheets")
    }
    await loadData()
    setIsSyncing(false)
  }

  const handleDisconnect = () => {
    setSyncStatus(null)
  }

  const handleConnect = () => {
    setIsOnboardingOpen(true)
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-2xl">
      {/* Google Sheets Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Google Sheets Connection
          </CardTitle>
          <CardDescription>Connect your Google Sheets spreadsheet to sync your financial data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncStatus?.connected ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                    <Cloud className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{syncStatus.spreadsheetName || "Finance Tracker"}</p>
                    <p className="text-sm text-muted-foreground">Last synced {syncStatus.lastSyncedAt ? getRelativeTime(syncStatus.lastSyncedAt) : "never"}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3 text-success" />
                  Connected
                </Badge>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Pull from Sheets
                    </>
                  )}
                </Button>
                <Button variant="outline" className="flex-1 bg-transparent" onClick={handlePushToSheets} disabled={isSyncing}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Pushing...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Push to Sheets
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${syncStatus.spreadsheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-transparent"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Sheet
                  </a>
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Disconnect spreadsheet</p>
                  <p className="text-sm text-muted-foreground">Your data will remain in the spreadsheet</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
              <CloudOff className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Not Connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect to Google Sheets to sync your financial data across devices
              </p>
              <Button onClick={handleConnect}>
                <Cloud className="h-4 w-4 mr-2" />
                Connect Google Sheets
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ImportPreviewDialog
        open={isImportPreviewOpen}
        onOpenChange={setIsImportPreviewOpen}
        onImported={loadData}
      />

      {/* Currency Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency Settings
          </CardTitle>
          <CardDescription>Configure your base currency and exchange rates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseCurrency">Base Currency</Label>
            <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as Currency)}>
              <SelectTrigger id="baseCurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">All totals and reports will be shown in this currency</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Exchange Rates</Label>
              <Button variant="ghost" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Fetch Latest
              </Button>
            </div>

            <div className="space-y-3">
              {exchangeRates.map((rate) => (
                <div key={rate.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {rate.fromCurrency} → {rate.toCurrency}
                    </p>
                    <p className="text-xs text-muted-foreground">Updated {getRelativeTime(rate.updatedAt)}</p>
                  </div>
                  <Input
                    type="number"
                    step="0.0001"
                    value={
                      rate.fromCurrency === "USD" ? usdToMxnRate : (1 / Number.parseFloat(usdToMxnRate)).toFixed(4)
                    }
                    onChange={(e) => {
                      if (rate.fromCurrency === "USD") {
                        setUsdToMxnRate(e.target.value)
                      }
                    }}
                    className="w-28 text-right"
                  />
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Example:</span> 1 USD ={" "}
                {formatCurrency(Number.parseFloat(usdToMxnRate), "MXN")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Connections (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Bank Connections
          </CardTitle>
          <CardDescription>Connect your bank accounts for automatic transaction import</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Automatic bank sync will be available in a future update
            </p>
            <Button variant="outline" disabled>
              <Plus className="h-4 w-4 mr-2" />
              Connect Bank
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or manage your financial data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50">
            <div>
              <p className="font-medium text-foreground">Export All Data</p>
              <p className="text-sm text-muted-foreground">Download all transactions as CSV</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50">
            <div>
              <p className="font-medium text-foreground">Copy to New Sheet</p>
              <p className="text-sm text-muted-foreground">Create a backup copy in Google Sheets</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Clear All Data</p>
              <p className="text-sm text-muted-foreground">This action cannot be undone</p>
            </div>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Dialog */}
      <OnboardingDialog
        open={isOnboardingOpen}
        onOpenChange={(open) => {
          setIsOnboardingOpen(open)
          if (!open) setSkipToChoose(false)
        }}
        startAtChoose={skipToChoose}
        onComplete={async () => {
          // Reload sync status from API to get actual values
          await loadData()
          setIsOnboardingOpen(false)
          setSkipToChoose(false)
        }}
      />
    </div>
  )
}

interface OnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  startAtChoose?: boolean
}

function OnboardingDialog({ open, onOpenChange, onComplete, startAtChoose = false }: OnboardingDialogProps) {
  const [step, setStep] = useState<"connect" | "choose" | "setup" | "complete">(startAtChoose ? "choose" : "connect")
  const [isConnecting, setIsConnecting] = useState(false)
  const [selectedOption, setSelectedOption] = useState<"existing" | "new" | null>(null)
  const [selectedSheet, setSelectedSheet] = useState("")
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([])

  // Reset step when startAtChoose changes
  useEffect(() => {
    if (open && startAtChoose) {
      setStep("choose")
    }
  }, [open, startAtChoose])

  const handleGoogleConnect = async () => {
    setIsConnecting(true)
    try {
      // Call the API to get the Google OAuth URL
      const { googleLogin } = await import("@/lib/api")
      const { url } = await googleLogin()
      
      if (url && url !== "/auth/google" && url !== "/auth/mock") {
        // Redirect to Google OAuth
        window.location.href = url
      } else {
        // Mock mode or not configured - just proceed to next step
        toast.info("Google OAuth not configured, using mock mode")
        setStep("choose")
      }
    } catch (error) {
      console.error("Failed to get OAuth URL:", error)
      toast.error("Failed to connect to Google")
    } finally {
      setIsConnecting(false)
    }
  }

  const loadSheets = async () => {
    try {
      const { getSheetsList } = await import("@/lib/api")
      const sheetList = await getSheetsList()
      setSheets(sheetList)
    } catch (error) {
      console.error("Failed to load sheets:", error)
      // Use mock data if API fails
      setSheets([
        { id: "sheet-1", name: "My Finance Tracker" },
        { id: "sheet-2", name: "Budget 2024" },
      ])
    }
  }

  // Load sheets when we get to the choose step
  useEffect(() => {
    if (step === "choose") {
      loadSheets()
    }
  }, [step])

  const handleCreateNew = async () => {
    setIsConnecting(true)
    try {
      const { createTemplateSheet } = await import("@/lib/api")
      await createTemplateSheet()
      setStep("complete")
    } catch (error) {
      console.error("Failed to create sheet:", error)
      toast.error("Failed to create spreadsheet")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSelectExisting = async () => {
    if (!selectedSheet) return
    setIsConnecting(true)
    try {
      const { selectSheet } = await import("@/lib/api")
      await selectSheet(selectedSheet)
      setStep("complete")
    } catch (error) {
      console.error("Failed to select sheet:", error)
      toast.error("Failed to connect to spreadsheet")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleClose = () => {
    setStep("connect")
    setSelectedOption(null)
    setSelectedSheet("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "connect" && (
          <>
            <DialogHeader>
              <DialogTitle>Connect to Google</DialogTitle>
              <DialogDescription>Sign in with your Google account to sync your data</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Cloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <Button onClick={handleGoogleConnect} disabled={isConnecting} className="w-full">
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Spreadsheet</DialogTitle>
              <DialogDescription>Select an existing spreadsheet or create a new one</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors",
                  selectedOption === "new" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50",
                )}
                onClick={() => {
                  setSelectedOption("new")
                  setSelectedSheet("")
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                  <Plus className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Create New Spreadsheet</p>
                  <p className="text-sm text-muted-foreground">Start fresh with our template</p>
                </div>
              </button>

              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors",
                  selectedOption === "existing"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50",
                )}
                onClick={() => setSelectedOption("existing")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Use Existing Spreadsheet</p>
                  <p className="text-sm text-muted-foreground">Connect to a spreadsheet you already have</p>
                </div>
              </button>

              {selectedOption === "existing" && (
                <div className="space-y-2 pl-14">
                  <Label htmlFor="sheet">Select Spreadsheet</Label>
                  <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                    <SelectTrigger id="sheet">
                      <SelectValue placeholder="Choose a spreadsheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheets.map((sheet) => (
                        <SelectItem key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep("connect")}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={selectedOption === "new" ? handleCreateNew : handleSelectExisting}
                  disabled={isConnecting || !selectedOption || (selectedOption === "existing" && !selectedSheet)}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {selectedOption === "new" ? "Creating..." : "Connecting..."}
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "complete" && (
          <>
            <DialogHeader>
              <DialogTitle>You're all set!</DialogTitle>
              <DialogDescription>Your Google Sheets is now connected</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <p className="text-center text-sm text-muted-foreground mb-6">
                Your financial data will now sync automatically with your Google Sheets spreadsheet.
              </p>
              <Button onClick={onComplete} className="w-full">
                Get Started
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
