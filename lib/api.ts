export type {
  Account,
  Category,
  Transaction,
  Budget,
  ExchangeRate,
  CategoryRule,
  Installment,
  MonthlyReport,
  YearlyReport,
  SyncStatus,
  SheetImportPreviewRow,
} from "./types"
import type {
  Account,
  Category,
  Transaction,
  Budget,
  ExchangeRate,
  CategoryRule,
  Installment,
  MonthlyReport,
  YearlyReport,
  SyncStatus,
  SheetImportPreviewRow,
} from "./types"
import {
  mockAccounts,
  mockCategories,
  mockTransactions,
  mockBudgets,
  mockExchangeRates,
  mockCategoryRules,
} from "./mock-data"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api"

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// In dev mode, use mock data
const USE_MOCK = false

// Convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// Convert camelCase to snake_case
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// Transform object keys from snake_case to camelCase
function transformResponse<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map(item => transformResponse(item)) as T
  }
  if (obj !== null && typeof obj === 'object') {
    const transformed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      transformed[snakeToCamel(key)] = transformResponse(value)
    }
    return transformed as T
  }
  return obj as T
}

// Transform object keys from camelCase to snake_case for requests
function transformRequest(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(item => transformRequest(item))
  }
  if (obj !== null && typeof obj === 'object') {
    const transformed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      transformed[camelToSnake(key)] = transformRequest(value)
    }
    return transformed
  }
  return obj
}

// Auth & Sheets
export async function googleLogin(): Promise<{ url: string }> {
  if (USE_MOCK) return { url: "/auth/google" }
  const res = await fetch(`${API_BASE}/auth/google/login`, { method: "POST" })
  return res.json()
}

export async function getSheetsList(): Promise<{ id: string; name: string }[]> {
  if (USE_MOCK) {
    await delay(500)
    return [
      { id: "sheet-1", name: "My Finance Tracker" },
      { id: "sheet-2", name: "Budget 2024" },
    ]
  }
  const res = await fetch(`${API_BASE}/sheets/list`)
  const data = await res.json()
  // Handle error responses
  if (!res.ok || data.detail) {
    console.error("Failed to list sheets:", data.detail)
    return []
  }
  return Array.isArray(data) ? data : []
}

export async function selectSheet(sheetId: string): Promise<SyncStatus> {
  if (USE_MOCK) {
    await delay(500)
    return {
      connected: true,
      spreadsheetId: sheetId,
      spreadsheetName: "My Finance Tracker",
      lastSyncedAt: new Date().toISOString(),
      syncing: false,
    }
  }
  const res = await fetch(`${API_BASE}/sheets/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetId }),
  })
  return res.json()
}

export async function createTemplateSheet(): Promise<SyncStatus> {
  if (USE_MOCK) {
    await delay(1000)
    return {
      connected: true,
      spreadsheetId: "new-sheet-id",
      spreadsheetName: "Ledger Finance Tracker",
      lastSyncedAt: new Date().toISOString(),
      syncing: false,
    }
  }
  const res = await fetch(`${API_BASE}/sheets/create-template`, { method: "POST" })
  return res.json()
}

export async function migrateSchema(): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await delay(500)
    return { success: true }
  }
  const res = await fetch(`${API_BASE}/sheets/migrate`, { method: "POST" })
  return res.json()
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (USE_MOCK) {
    await delay(300)
    return {
      connected: true,
      spreadsheetId: "sheet-1",
      spreadsheetName: "My Finance Tracker",
      lastSyncedAt: new Date().toISOString(),
      syncing: false,
    }
  }
  const res = await fetch(`${API_BASE}/sync/status`)
  const data = await res.json()
  return transformResponse(data) as SyncStatus
}

export async function syncPull(): Promise<{ success: boolean; imported: number; deleted_rows: number }> {
  if (USE_MOCK) {
    await delay(1000)
    return { success: true, imported: 0, deleted_rows: 0 }
  }
  const res = await fetch(`${API_BASE}/sync/pull`, { method: "POST" })
  return res.json()
}

export async function previewSheetImport(): Promise<{ rows: SheetImportPreviewRow[] }> {
  if (USE_MOCK) {
    await delay(400)
    return {
      rows: [
        {
          rowNumber: 2,
          data: {
            date: "2024-02-01",
            description: "Coffee",
            type: "expense",
            amount: 4.5,
            categoryId: "cat-1",
            accountId: "acc-1",
            currency: "USD",
          },
          errors: [],
          importHash: "mock",
          status: "valid",
        },
      ],
    }
  }
  const res = await fetch(`${API_BASE}/sheets/import/preview`, { method: "POST" })
  return res.json()
}

export async function confirmSheetImport(): Promise<{ success: boolean; imported: number; deleted_rows: number }> {
  if (USE_MOCK) {
    await delay(800)
    return { success: true, imported: 1, deleted_rows: 1 }
  }
  const res = await fetch(`${API_BASE}/sheets/import/confirm`, { method: "POST" })
  return res.json()
}

export async function syncPush(): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
  if (USE_MOCK) {
    await delay(1000)
    return { success: true, message: "Mock sync", counts: {} }
  }
  const res = await fetch(`${API_BASE}/sync/push`, { method: "POST" })
  return res.json()
}

// Transactions
export async function getTransactions(filters?: {
  startDate?: string
  endDate?: string
  categoryId?: string
  accountId?: string
  type?: string
  minAmount?: number
  maxAmount?: number
  currency?: string
  search?: string
}): Promise<Transaction[]> {
  if (USE_MOCK) {
    await delay(300)
    let filtered = [...mockTransactions]
    if (filters?.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter((t) => t.description.toLowerCase().includes(search))
    }
    if (filters?.categoryId) {
      filtered = filtered.filter((t) => t.categoryId === filters.categoryId)
    }
    if (filters?.accountId) {
      filtered = filtered.filter((t) => t.accountId === filters.accountId)
    }
    if (filters?.type) {
      filtered = filtered.filter((t) => t.type === filters.type)
    }
    return filtered
  }
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })
  }
  const res = await fetch(`${API_BASE}/transactions?${params}`)
  if (!res.ok) {
    console.error('Failed to fetch transactions:', res.status)
    return []
  }
  const data = await res.json()
  return transformResponse<Transaction[]>(data)
}

export async function createTransaction(data: Partial<Transaction>): Promise<Transaction> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `txn-${Date.now()}`,
      date: data.date || new Date().toISOString().split("T")[0],
      description: data.description || "",
      amount: data.amount || 0,
      type: data.type || "expense",
      categoryId: data.type === "adjustment" ? undefined : (data.categoryId || "cat-11"),
      accountId: data.accountId || "acc-1",
      currency: data.currency || "MXN",
      tags: data.tags || [],
      needsReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Transaction
  }
  const res = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Transaction>(result)
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
  if (USE_MOCK) {
    await delay(300)
    const existing = mockTransactions.find((t) => t.id === id)
    return { ...existing, ...data, updatedAt: new Date().toISOString() } as Transaction
  }
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Transaction>(result)
}

export async function deleteTransaction(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    return
  }
  await fetch(`${API_BASE}/transactions/${id}`, { method: "DELETE" })
}

export async function bulkUpdateTransactions(ids: string[], data: Partial<Transaction>): Promise<Transaction[]> {
  if (USE_MOCK) {
    await delay(500)
    return ids.map((id) => {
      const existing = mockTransactions.find((t) => t.id === id)
      return { ...existing, ...data, updatedAt: new Date().toISOString() } as Transaction
    })
  }
  const res = await fetch(`${API_BASE}/transactions/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, data }),
  })
  return res.json()
}

export async function importTransactionsCSV(file: File): Promise<{ preview: Partial<Transaction>[] }> {
  if (USE_MOCK) {
    await delay(1000)
    return {
      preview: [
        { date: "2024-01-15", description: "Sample Import 1", amount: 500, type: "expense" },
        { date: "2024-01-14", description: "Sample Import 2", amount: 1200, type: "income" },
      ],
    }
  }
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/transactions/import/csv`, {
    method: "POST",
    body: formData,
  })
  return res.json()
}

export async function importTransactionsPaste(text: string): Promise<{ preview: Partial<Transaction>[] }> {
  if (USE_MOCK) {
    await delay(500)
    const lines = text.trim().split("\n")
    return {
      preview: lines.slice(0, 10).map((line, i) => ({
        date: new Date().toISOString().split("T")[0],
        description: line.substring(0, 50),
        amount: Math.random() * 1000,
        type: "expense" as const,
      })),
    }
  }
  const res = await fetch(`${API_BASE}/transactions/import/paste`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  return res.json()
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
  if (USE_MOCK) {
    await delay(300)
    return mockAccounts
  }
  const res = await fetch(`${API_BASE}/accounts`)
  if (!res.ok) {
    console.error('Failed to fetch accounts:', res.status)
    return []
  }
  const data = await res.json()
  return transformResponse<Account[]>(data)
}

export async function createAccount(data: Partial<Account>): Promise<Account> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `acc-${Date.now()}`,
      name: data.name || "New Account",
      type: data.type || "debit",
      currency: data.currency || "MXN",
      balance: data.openingBalance || 0,
      openingBalance: data.openingBalance || 0,
      statementDay: data.statementDay,
      color: data.color || "#6b7280",
      icon: data.icon || "wallet",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Account
  }
  const res = await fetch(`${API_BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Account>(result)
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  if (USE_MOCK) {
    await delay(300)
    const existing = mockAccounts.find((a) => a.id === id)
    return { ...existing, ...data, updatedAt: new Date().toISOString() } as Account
  }
  const res = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Account>(result)
}

// Categories
export async function getCategories(): Promise<Category[]> {
  if (USE_MOCK) {
    await delay(300)
    return mockCategories
  }
  const res = await fetch(`${API_BASE}/categories`)
  if (!res.ok) {
    console.error('Failed to fetch categories:', res.status)
    return []
  }
  const data = await res.json()
  return transformResponse<Category[]>(data)
}

// Installments (separate from transactions)
export async function getInstallments(): Promise<Installment[]> {
  if (USE_MOCK) {
    await delay(300)
    return []
  }
  const res = await fetch(`${API_BASE}/installments`)
  if (!res.ok) {
    console.error("Failed to fetch installments:", res.status)
    return []
  }
  const data = await res.json()
  return transformResponse<Installment[]>(data)
}

export async function createInstallment(data: Partial<Installment>): Promise<Installment> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `inst-${Date.now()}`,
      accountId: data.accountId || "acc-1",
      description: data.description || "Installment",
      amount: data.amount || 0,
      monthsTotal: data.monthsTotal || 1,
      monthsRemaining: data.monthsRemaining ?? (data.monthsTotal || 1),
      hasInterest: !!data.hasInterest,
      interestAmountPerMonth: data.interestAmountPerMonth || 0,
      purchaseDate: data.purchaseDate || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const res = await fetch(`${API_BASE}/installments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Installment>(result)
}

export async function updateInstallment(id: string, data: Partial<Installment>): Promise<Installment> {
  if (USE_MOCK) {
    await delay(300)
    return { ...(data as Installment), id, updatedAt: new Date().toISOString() }
  }
  const res = await fetch(`${API_BASE}/installments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Installment>(result)
}

export async function deleteInstallment(id: string): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await delay(200)
    return { success: true }
  }
  const res = await fetch(`${API_BASE}/installments/${id}`, { method: "DELETE" })
  return res.json()
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `cat-${Date.now()}`,
      name: data.name || "New Category",
      icon: data.icon || "folder",
      color: data.color || "#6b7280",
      type: data.type || "expense",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Category
  }
  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Category>(result)
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  if (USE_MOCK) {
    await delay(300)
    const existing = mockCategories.find((c) => c.id === id)
    return { ...existing, ...data, updatedAt: new Date().toISOString() } as Category
  }
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Category>(result)
}

export async function deleteCategory(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    return
  }
  await fetch(`${API_BASE}/categories/${id}`, { method: "DELETE" })
}

// Category Rules
export async function getCategoryRules(): Promise<CategoryRule[]> {
  if (USE_MOCK) {
    await delay(300)
    return mockCategoryRules
  }
  const res = await fetch(`${API_BASE}/categories/rules`)
  const data = await res.json()
  return transformResponse<CategoryRule[]>(data)
}

export async function createCategoryRule(data: Partial<CategoryRule>): Promise<CategoryRule> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `rule-${Date.now()}`,
      categoryId: data.categoryId || "",
      field: data.field || "description",
      operator: data.operator || "contains",
      value: data.value || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as CategoryRule
  }
  const res = await fetch(`${API_BASE}/categories/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<CategoryRule>(result)
}

export async function deleteCategoryRule(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    return
  }
  await fetch(`${API_BASE}/categories/rules/${id}`, { method: "DELETE" })
}

// Budgets
export async function getBudgets(month?: string): Promise<Budget[]> {
  if (USE_MOCK) {
    await delay(300)
    if (month) {
      return mockBudgets.filter((b) => b.month === month)
    }
    return mockBudgets
  }
  const params = month ? `?month=${month}` : ""
  const res = await fetch(`${API_BASE}/budgets${params}`)
  const data = await res.json()
  return transformResponse<Budget[]>(data)
}

export async function createBudget(data: Partial<Budget>): Promise<Budget> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `bud-${Date.now()}`,
      categoryId: data.categoryId || "",
      month: data.month || new Date().toISOString().substring(0, 7),
      amount: data.amount || 0,
      rollover: data.rollover || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Budget
  }
  const res = await fetch(`${API_BASE}/budgets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Budget>(result)
}

export async function updateBudget(id: string, data: Partial<Budget>): Promise<Budget> {
  if (USE_MOCK) {
    await delay(300)
    const existing = mockBudgets.find((b) => b.id === id)
    return { ...existing, ...data, updatedAt: new Date().toISOString() } as Budget
  }
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<Budget>(result)
}

// Exchange Rates
export async function getExchangeRates(): Promise<ExchangeRate[]> {
  if (USE_MOCK) {
    await delay(300)
    return mockExchangeRates
  }
  const res = await fetch(`${API_BASE}/rates`)
  const data = await res.json()
  return transformResponse<ExchangeRate[]>(data)
}

export async function updateExchangeRate(data: Partial<ExchangeRate>): Promise<ExchangeRate> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `rate-${Date.now()}`,
      fromCurrency: data.fromCurrency || "USD",
      toCurrency: data.toCurrency || "MXN",
      rate: data.rate || 17.0,
      date: new Date().toISOString().split("T")[0],
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ExchangeRate
  }
  const res = await fetch(`${API_BASE}/rates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transformRequest(data)),
  })
  const result = await res.json()
  return transformResponse<ExchangeRate>(result)
}

// Reports
export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  if (USE_MOCK) {
    await delay(500)
    const income = 45850
    const expenses = 15440
    return {
      month,
      income,
      expenses,
      net: income - expenses,
      byCategory: [
        { categoryId: "cat-3", amount: 806.5 },
        { categoryId: "cat-4", amount: 185.5 },
        { categoryId: "cat-5", amount: 1299 },
        { categoryId: "cat-6", amount: 299 },
        { categoryId: "cat-7", amount: 850 },
        { categoryId: "cat-9", amount: 12000 },
      ],
      byAccount: mockAccounts.map((a) => ({ accountId: a.id, balance: a.balance })),
      dailySpend: Array.from({ length: 15 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        amount: Math.random() * 2000 + 200,
      })),
    }
  }
  const res = await fetch(`${API_BASE}/reports/monthly?month=${month}`)
  const data = await res.json()
  return transformResponse<MonthlyReport>(data)
}

export async function getYearlyReport(year: string): Promise<YearlyReport> {
  if (USE_MOCK) {
    await delay(500)
    return {
      year,
      monthlyTotals: Array.from({ length: 12 }, (_, i) => ({
        month: `${year}-${String(i + 1).padStart(2, "0")}`,
        income: 40000 + Math.random() * 10000,
        expenses: 15000 + Math.random() * 8000,
        net: 25000 + Math.random() * 5000,
      })),
      categoryTotals: mockCategories
        .filter((c) => c.type === "expense")
        .map((c) => ({
          categoryId: c.id,
          amount: Math.random() * 50000 + 10000,
        })),
      accountBalances: mockAccounts.map((a) => ({
        accountId: a.id,
        balance: a.balance,
      })),
    }
  }
  const res = await fetch(`${API_BASE}/reports/yearly?year=${year}`)
  const data = await res.json()
  return transformResponse<YearlyReport>(data)
}

// Export
export async function exportCSV(filters?: Record<string, string>): Promise<Blob> {
  if (USE_MOCK) {
    await delay(500)
    const csv = "date,description,amount,type,category,account\n2024-01-15,Sample,100,expense,Food,Main"
    return new Blob([csv], { type: "text/csv" })
  }
  const params = new URLSearchParams(filters)
  const res = await fetch(`${API_BASE}/export/csv?${params}`)
  return res.blob()
}
