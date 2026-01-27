export type Currency = "MXN" | "USD"

export type TransactionType = "income" | "expense" | "transfer"

export type AccountType = "cash" | "debit" | "credit" | "savings" | "investment"

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: Currency
  balance: number
  openingBalance: number
  creditLimit?: number
  remainingCredit?: number
  installmentPrincipalRemaining?: number
  remainingCreditAfterInstallments?: number
  color: string
  icon: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  parentId?: string
  type: "income" | "expense" | "both"
  budget?: number
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: TransactionType
  categoryId?: string
  accountId: string
  toAccountId?: string
  currency: Currency
  convertedAmount?: number
  conversionRate?: number
  tags: string[]
  notes?: string
  needsReview: boolean
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  categoryId: string
  month: string
  amount: number
  rollover: boolean
  rolloverAmount?: number
  createdAt: string
  updatedAt: string
}

export interface ExchangeRate {
  id: string
  fromCurrency: Currency
  toCurrency: Currency
  rate: number
  date: string
  source: "manual" | "api"
  createdAt: string
  updatedAt: string
}

export interface CategoryRule {
  id: string
  categoryId: string
  field: "description" | "amount" | "tags"
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "greaterThan" | "lessThan"
  value: string
  createdAt: string
  updatedAt: string
}

export interface Installment {
  id: string
  accountId: string
  description: string
  amount: number
  monthsTotal: number
  monthsRemaining: number
  hasInterest: boolean
  interestAmountPerMonth: number
  purchaseDate: string
  createdAt: string
  updatedAt: string
}

export interface SyncStatus {
  connected: boolean
  spreadsheetId?: string
  spreadsheetName?: string
  lastSyncedAt?: string
  syncing: boolean
}

export type SheetImportStatus = "valid" | "invalid" | "duplicate"

export interface SheetImportPreviewRow {
  rowNumber: number
  data: {
    date: string
    description: string
    type: TransactionType
    amount: number
    categoryId?: string
    accountId?: string
    currency: Currency
  }
  errors: string[]
  importHash?: string
  status: SheetImportStatus
}

export interface MonthlyReport {
  month: string
  income: number
  expenses: number
  net: number
  byCategory: { categoryId: string; amount: number }[]
  byAccount: { accountId: string; balance: number }[]
  dailySpend: { date: string; amount: number }[]
}

export interface YearlyReport {
  year: string
  monthlyTotals: { month: string; income: number; expenses: number; net: number }[]
  categoryTotals: { categoryId: string; amount: number }[]
  accountBalances: { accountId: string; balance: number }[]
}
