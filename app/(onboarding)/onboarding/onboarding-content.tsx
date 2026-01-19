"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, ChevronLeft, ChevronRight, DollarSign, FileSpreadsheet, Wallet } from "lucide-react"

const steps = [
  { id: "welcome", title: "Welcome" },
  { id: "currency", title: "Currency" },
  { id: "accounts", title: "Accounts" },
  { id: "sheets", title: "Connect" },
]

export function OnboardingContent() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [primaryCurrency, setPrimaryCurrency] = useState("MXN")
  const [accounts, setAccounts] = useState([{ name: "", type: "debit", balance: "" }])
  const [sheetsConnected, setSheetsConnected] = useState(false)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      router.push("/dashboard")
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const addAccount = () => {
    setAccounts([...accounts, { name: "", type: "debit", balance: "" }])
  }

  const updateAccount = (index: number, field: string, value: string) => {
    const updated = [...accounts]
    updated[index] = { ...updated[index], [field]: value }
    setAccounts(updated)
  }

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Wallet className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Welcome to Ledger</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your personal finance tracker. Let&apos;s get you set up in just a few steps.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium">Track Expenses</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium">Sync to Sheets</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium">Set Budgets</p>
              </div>
            </div>
          </div>
        )

      case "currency":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Primary Currency</h2>
              <p className="text-muted-foreground">
                Choose your main currency. You can still track multiple currencies.
              </p>
            </div>
            <div className="max-w-xs mx-auto">
              <Label htmlFor="currency">Currency</Label>
              <Select value={primaryCurrency} onValueChange={setPrimaryCurrency}>
                <SelectTrigger id="currency" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "accounts":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Your Accounts</h2>
              <p className="text-muted-foreground">Add your bank accounts, credit cards, or cash.</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              {accounts.map((account, index) => (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label>Account Name</Label>
                      <Input
                        placeholder="e.g., BBVA Debit"
                        value={account.name}
                        onChange={(e) => updateAccount(index, "name", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Type</Label>
                        <Select value={account.type} onValueChange={(v) => updateAccount(index, "type", v)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="debit">Debit</SelectItem>
                            <SelectItem value="credit">Credit Card</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Starting Balance</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={account.balance}
                          onChange={(e) => updateAccount(index, "balance", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addAccount} className="w-full bg-transparent">
                Add Another Account
              </Button>
            </div>
          </div>
        )

      case "sheets":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Connect Google Sheets</h2>
              <p className="text-muted-foreground">
                Your data syncs to Google Sheets for full control and portability.
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              {sheetsConnected ? (
                <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="pt-6 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">Connected to Google Sheets</p>
                    <p className="text-sm text-muted-foreground">Ledger Finance Tracker</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Button className="w-full" size="lg" onClick={() => setSheetsConnected(true)}>
                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                    Connect Google Sheets
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={handleNext}>
                    Skip for now
                  </Button>
                </>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-1 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          <CardTitle className="sr-only">{steps[currentStep].title}</CardTitle>
          <CardDescription className="sr-only">
            Step {currentStep + 1} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">{renderStep()}</CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button onClick={handleNext}>
            {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
