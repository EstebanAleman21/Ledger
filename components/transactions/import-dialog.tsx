"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileText, X, ArrowRight, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/api"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
}

type ImportStep = "upload" | "mapping" | "preview" | "complete"

interface ParsedRow {
  date: string
  description: string
  amount: number
  type: "income" | "expense"
  categoryId?: string
  valid: boolean
  error?: string
}

export function ImportDialog({ open, onOpenChange, accounts }: ImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [importType, setImportType] = useState<"csv" | "paste">("csv")
  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState("")
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [selectedAccount, setSelectedAccount] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === "text/csv") {
      setFile(droppedFile)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleParse = () => {
    // Mock parsing
    const mockParsed: ParsedRow[] = [
      { date: "2024-01-15", description: "Uber Eats - Order #12345", amount: 285.5, type: "expense", valid: true },
      { date: "2024-01-14", description: "Amazon MX - Electronics", amount: 1599.0, type: "expense", valid: true },
      { date: "2024-01-13", description: "Salary Deposit", amount: 45000.0, type: "income", valid: true },
      { date: "2024-01-12", description: "Netflix Monthly", amount: 299.0, type: "expense", valid: true },
      {
        date: "invalid",
        description: "Bad Row",
        amount: 0,
        type: "expense",
        valid: false,
        error: "Invalid date format",
      },
    ]
    setParsedRows(mockParsed)
    setStep("mapping")
  }

  const handleImport = () => {
    console.log(
      "Importing:",
      parsedRows.filter((r) => r.valid),
    )
    setStep("complete")
  }

  const resetDialog = () => {
    setStep("upload")
    setFile(null)
    setPasteText("")
    setParsedRows([])
    setSelectedAccount("")
    onOpenChange(false)
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const invalidCount = parsedRows.filter((r) => !r.valid).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <Tabs value={importType} onValueChange={(v) => setImportType(v as "csv" | "paste")} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              <TabsTrigger value="paste">Paste Text</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="mt-4 space-y-4">
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 transition-colors",
                  isDragging && "border-primary bg-primary/5",
                  file && "border-success bg-success/5",
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-success" />
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">Drop your CSV file here</p>
                    <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                    <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleFileChange} />
                    <Button variant="outline" asChild>
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        Select File
                      </label>
                    </Button>
                  </>
                )}
              </div>

              {file && (
                <Button className="w-full" onClick={handleParse}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-4">
              <Textarea
                placeholder="Paste your bank statement or transaction data here...&#10;&#10;Example:&#10;01/15/2024, Uber Eats, -285.50&#10;01/14/2024, Amazon, -1599.00&#10;01/13/2024, Salary, +45000.00"
                className="min-h-[200px] font-mono text-sm"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />

              {pasteText && (
                <Button className="w-full" onClick={handleParse}>
                  Parse & Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </TabsContent>
          </Tabs>
        )}

        {step === "mapping" && (
          <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Account</label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account for imported transactions" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3 text-success" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} errors
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 rounded-lg border border-border">
              <div className="p-4 space-y-2">
                {parsedRows.map((row, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3",
                      row.valid ? "border-border bg-card" : "border-destructive/50 bg-destructive/5",
                    )}
                  >
                    {row.valid ? (
                      <Check className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{row.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.date} • {row.type}
                      </p>
                      {row.error && <p className="text-sm text-destructive mt-1">{row.error}</p>}
                    </div>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        row.type === "income" ? "text-success" : "text-destructive",
                      )}
                    >
                      {row.type === "income" ? "+" : "-"}${row.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleImport} disabled={validCount === 0 || !selectedAccount}>
                Import {validCount} Transactions
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Import Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Successfully imported {validCount} transactions
              {invalidCount > 0 && `, ${invalidCount} skipped due to errors`}
            </p>
            <Button onClick={resetDialog}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
