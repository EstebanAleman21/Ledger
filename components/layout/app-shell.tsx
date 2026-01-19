"use client"

import type React from "react"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"
import { Header } from "./header"
import { QuickAddButton } from "./quick-add-button"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar - Fixed */}
      <Sidebar className="hidden lg:flex flex-shrink-0" />

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto pb-20 lg:pb-6">{children}</main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav className="lg:hidden" />

      {/* Floating Quick Add Button (Mobile) */}
      <QuickAddButton className="lg:hidden" />
    </div>
  )
}
