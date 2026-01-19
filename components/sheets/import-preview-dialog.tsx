"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { confirmSheetImport, previewSheetImport } from "@/lib/api"
import type { SheetImportPreviewRow } from "@/lib/types"
import { toast } from "sonner"

interface ImportPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

export function ImportPreviewDialog({ open, onOpenChange, onImported }: ImportPreviewDialogProps) {
  const [rows, setRows] = useState<SheetImportPreviewRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    previewSheetImport()
      .then((result) => setRows(result.rows))
      .catch((error) => {
        console.error("Failed to load import preview:", error)
        toast.error("Failed to load import preview")
      })
      .finally(() => setIsLoading(false))
  }, [open])

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1
        acc[row.status] += 1
        return acc
      },
      { total: 0, valid: 0, invalid: 0, duplicate: 0 }
    )
  }, [rows])

  const handleConfirm = async () => {
    setIsImporting(true)
    try {
      const result = await confirmSheetImport()
      if (result.success) {
        toast.success(`Imported ${result.imported} transaction(s)`)
        onOpenChange(false)
        onImported?.()
      } else {
        toast.error("Import failed")
      }
    } catch (error) {
      console.error("Import failed:", error)
      toast.error("Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const statusVariant = (status: SheetImportPreviewRow["status"]) => {
    if (status === "valid") return "secondary"
    if (status === "duplicate") return "outline"
    return "destructive"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sheet Import Preview</DialogTitle>
          <DialogDescription>
            Review new transactions before importing. Only valid rows will be imported.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading preview...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Total: {counts.total}</Badge>
              <Badge variant="secondary">Valid: {counts.valid}</Badge>
              <Badge variant="outline">Duplicates: {counts.duplicate}</Badge>
              <Badge variant="destructive">Invalid: {counts.invalid}</Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.rowNumber}-${row.importHash || row.status}`}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.data.description || "-"}</TableCell>
                    <TableCell>{row.data.amount ?? "-"}</TableCell>
                    <TableCell>{row.data.type || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                      {row.errors?.length ? row.errors.join(", ") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No rows found in the import sheet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={counts.valid === 0 || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${counts.valid} Transaction${counts.valid === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
