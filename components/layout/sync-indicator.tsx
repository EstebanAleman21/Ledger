"use client"

import { Cloud, CloudOff, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getRelativeTime } from "@/lib/utils/format"

interface SyncIndicatorProps {
  connected?: boolean
  syncing?: boolean
  lastSyncedAt?: string
}

export function SyncIndicator({
  connected = true,
  syncing = false,
  lastSyncedAt = new Date().toISOString(),
}: SyncIndicatorProps) {
  if (syncing) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Syncing...</span>
      </Badge>
    )
  }

  if (!connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1.5">
              <CloudOff className="h-3 w-3" />
              <span className="hidden sm:inline">Disconnected</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Google Sheets not connected</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1.5">
            <Cloud className="h-3 w-3 text-success" />
            <span className="hidden sm:inline">Synced</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Last synced {getRelativeTime(lastSyncedAt)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
