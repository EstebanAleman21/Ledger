"""
Ledger Finance Tracker - FastAPI Backend

This is the Python FastAPI backend skeleton for the Ledger app.
It handles Google Sheets integration and exposes REST APIs.
"""

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import os
from pathlib import Path
from storage import get_store, SupabaseStore, InMemoryStore

# Load .env file from project root
def load_dotenv():
    """Load environment variables from .env file"""
    env_paths = [
        Path(__file__).parent.parent.parent / '.env',  # project root
        Path(__file__).parent / '.env',  # backend folder
    ]
    for env_path in env_paths:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ.setdefault(key.strip(), value.strip())
            break

load_dotenv()

# Try to import sheets service (may fail if google libs not installed)
try:
    from sheets_service import sheets_service, SheetsService
    SHEETS_AVAILABLE = True
except ImportError as e:
    print(f"Google Sheets not available: {e}")
    SHEETS_AVAILABLE = False
    sheets_service = None

# Environment variables
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI')

print(f"Google Sheets config: CLIENT_ID={'set' if GOOGLE_CLIENT_ID else 'missing'}, SECRET={'set' if GOOGLE_CLIENT_SECRET else 'missing'}, SHEETS_AVAILABLE={SHEETS_AVAILABLE}")

# Use Google Sheets as backend if configured
USE_SHEETS = SHEETS_AVAILABLE and GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

# Initialize FastAPI app
app = FastAPI(
    title="Ledger Finance Tracker API",
    description="Personal finance tracker with Google Sheets backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# ENUMS
# ============================================

class Currency(str, Enum):
    MXN = "MXN"
    USD = "USD"

class TransactionType(str, Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"
    adjustment = "adjustment"

class AccountType(str, Enum):
    cash = "cash"
    debit = "debit"
    credit = "credit"
    savings = "savings"
    investment = "investment"

class CategoryType(str, Enum):
    income = "income"
    expense = "expense"
    both = "both"

class RuleOperator(str, Enum):
    contains = "contains"
    equals = "equals"
    startsWith = "startsWith"
    endsWith = "endsWith"
    greaterThan = "greaterThan"
    lessThan = "lessThan"

class RuleField(str, Enum):
    description = "description"
    amount = "amount"
    tags = "tags"

# ============================================
# MODELS
# ============================================

class Transaction(BaseModel):
    id: Optional[str] = None
    date: str
    description: str
    amount: float
    type: TransactionType
    category_id: Optional[str] = None
    account_id: str
    to_account_id: Optional[str] = None
    currency: Currency
    converted_amount: Optional[float] = None
    conversion_rate: Optional[float] = None
    tags: List[str] = []
    notes: Optional[str] = None
    needs_review: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    type: TransactionType
    category_id: Optional[str] = None  # Optional, can be auto-assigned by rules
    account_id: str
    to_account_id: Optional[str] = None
    currency: Currency
    converted_amount: Optional[float] = None
    conversion_rate: Optional[float] = None
    tags: List[str] = []
    notes: Optional[str] = None
    needs_review: Optional[bool] = None

class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[TransactionType] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    currency: Optional[Currency] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    needs_review: Optional[bool] = None

class BulkTransactionUpdate(BaseModel):
    ids: List[str]
    data: TransactionUpdate

class Account(BaseModel):
    id: Optional[str] = None
    name: str
    type: AccountType
    currency: Currency
    balance: float = 0
    opening_balance: float = 0
    credit_limit: Optional[float] = None
    statement_day: Optional[int] = None
    remaining_credit: Optional[float] = None
    installment_principal_remaining: float = 0
    remaining_credit_after_installments: Optional[float] = None
    color: str = "#6b7280"
    icon: str = "wallet"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class AccountCreate(BaseModel):
    name: str
    type: AccountType
    currency: Currency
    opening_balance: float = 0
    credit_limit: Optional[float] = None
    statement_day: Optional[int] = None
    color: str = "#6b7280"
    icon: str = "wallet"

class Category(BaseModel):
    id: Optional[str] = None
    name: str
    icon: str
    color: str
    parent_id: Optional[str] = None
    type: CategoryType
    budget: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    icon: str = "folder"
    color: str = "#6b7280"
    parent_id: Optional[str] = None
    type: CategoryType = CategoryType.expense
    budget: Optional[float] = None

class Budget(BaseModel):
    id: Optional[str] = None
    category_id: str
    month: str
    amount: float
    rollover: bool = False
    rollover_amount: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class BudgetCreate(BaseModel):
    category_id: str
    month: str
    amount: float
    rollover: bool = False

class ExchangeRate(BaseModel):
    id: Optional[str] = None
    from_currency: Currency
    to_currency: Currency
    rate: float
    date: str
    source: str = "manual"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ExchangeRateCreate(BaseModel):
    from_currency: Currency
    to_currency: Currency
    rate: float

class CategoryRule(BaseModel):
    id: Optional[str] = None
    category_id: str
    field: RuleField
    operator: RuleOperator
    value: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class SyncStatus(BaseModel):
    connected: bool
    spreadsheet_id: Optional[str] = None
    spreadsheet_name: Optional[str] = None
    last_synced_at: Optional[str] = None
    syncing: bool = False

class MonthlyReport(BaseModel):
    month: str
    income: float
    expenses: float
    net: float
    by_category: List[dict]
    by_account: List[dict]
    daily_spend: List[dict]

class YearlyReport(BaseModel):
    year: str
    monthly_totals: List[dict]
    category_totals: List[dict]
    account_balances: List[dict]

# ============================================
# INSTALLMENTS (Separate from transactions)
# ============================================

class Installment(BaseModel):
    id: Optional[str] = None
    account_id: str
    description: str
    amount: float
    months_total: int
    months_remaining: int
    has_interest: bool = False
    interest_amount_per_month: float = 0
    purchase_date: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class InstallmentCreate(BaseModel):
    account_id: str
    description: str
    amount: float
    months_total: int
    months_remaining: Optional[int] = None
    has_interest: bool = False
    interest_amount_per_month: float = 0
    purchase_date: str

class InstallmentUpdate(BaseModel):
    account_id: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    months_total: Optional[int] = None
    months_remaining: Optional[int] = None
    has_interest: Optional[bool] = None
    interest_amount_per_month: Optional[float] = None
    purchase_date: Optional[str] = None

# ============================================
# STORAGE (Supabase preferred, in-memory fallback)
# ============================================

store = get_store()


def now_iso() -> str:
    return datetime.now().isoformat()


def normalize_label(value: str) -> str:
    return value.strip().lower()


def parse_name_type(label: str) -> Optional[Dict[str, str]]:
    value = label.strip()
    if not value:
        return None
    if value.endswith(")") and "(" in value:
        name, type_part = value.rsplit("(", 1)
        return {"name": name.strip(), "type": type_part.rstrip(")").strip()}
    if " - " in value:
        name, type_part = value.split(" - ", 1)
        return {"name": name.strip(), "type": type_part.strip()}
    return None


def build_named_map(rows: List[Dict[str, Any]], type_key: str) -> Dict[str, str]:
    mapped = {}
    for row in rows:
        name = row.get("name", "")
        row_type = row.get(type_key, "")
        if not name or not row_type:
            continue
        label = f"{name} ({row_type})"
        mapped[normalize_label(label)] = row.get("id")
    return mapped


def compute_import_hash(data: Dict[str, Any]) -> str:
    import hashlib

    normalized = "|".join([
        data.get("date", ""),
        data.get("description", "").strip().lower(),
        data.get("type", ""),
        f"{data.get('amount', ''):.2f}" if isinstance(data.get("amount"), (int, float)) else str(data.get("amount", "")),
        data.get("category_id", ""),
        data.get("account_id", ""),
        data.get("currency", ""),
    ])
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def normalize_enums(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {key: (value.value if isinstance(value, Enum) else value) for key, value in payload.items()}


def empty_string_to_none(value: Any) -> Any:
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def normalize_uuid_inputs(payload: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
    normalized = payload.copy()
    for key in keys:
        if key in normalized:
            normalized[key] = empty_string_to_none(normalized[key])
    return normalized


def apply_computed_account_balances(
    accounts: List[Dict[str, Any]],
    transactions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    balances: Dict[str, float] = {acc.get("id"): acc.get("opening_balance", 0) or 0 for acc in accounts}

    for txn in transactions:
        txn_type = txn.get("type")
        amount = txn.get("amount") or 0
        account_id = txn.get("account_id")
        to_account_id = txn.get("to_account_id")

        if txn_type == "transfer":
            if account_id:
                balances[account_id] = balances.get(account_id, 0) - amount
            if to_account_id:
                balances[to_account_id] = balances.get(to_account_id, 0) + amount
        elif txn_type == "income":
            if account_id:
                balances[account_id] = balances.get(account_id, 0) + amount
        elif txn_type == "expense":
            if account_id:
                balances[account_id] = balances.get(account_id, 0) - amount
        elif txn_type == "adjustment":
            if account_id:
                balances[account_id] = balances.get(account_id, 0) + amount

    computed = []
    for acc in accounts:
        acc_id = acc.get("id")
        computed.append({**acc, "balance": balances.get(acc_id, 0)})
    return computed


def compute_credit_account_availability(
    accounts: List[Dict[str, Any]],
    installments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    principal_remaining_by_account: Dict[str, float] = {}
    for inst in installments:
        account_id = inst.get("account_id")
        if not account_id:
            continue
        months_remaining = float(inst.get("months_remaining") or 0)
        if months_remaining <= 0:
            continue
        months_total = float(inst.get("months_total") or 1)
        amount = float(inst.get("amount") or 0)
        monthly_principal = amount / max(1.0, months_total)
        principal_remaining_by_account[account_id] = principal_remaining_by_account.get(account_id, 0.0) + (
            monthly_principal * months_remaining
        )

    computed: List[Dict[str, Any]] = []
    for acc in accounts:
        if acc.get("type") != "credit":
            computed.append(acc)
            continue

        balance = float(acc.get("balance") or 0)
        credit_limit = acc.get("credit_limit")
        remaining_credit = None
        try:
            if credit_limit is not None and str(credit_limit).strip() != "":
                remaining_credit = float(credit_limit) + balance
        except (TypeError, ValueError):
            remaining_credit = None

        installment_principal_remaining = principal_remaining_by_account.get(acc.get("id"), 0.0)
        remaining_after = None if remaining_credit is None else remaining_credit - installment_principal_remaining

        computed.append({
            **acc,
            "remaining_credit": remaining_credit,
            "installment_principal_remaining": installment_principal_remaining,
            "remaining_credit_after_installments": remaining_after,
        })

    return computed


def normalize_transaction_row(row: Dict[str, Any]) -> Dict[str, Any]:
    normalized = row.copy()
    if normalized.get("tags") is None:
        normalized["tags"] = []
    if normalized.get("needs_review") is None:
        normalized["needs_review"] = False
    return normalized


def parse_sheet_transaction(
    row: Dict[str, Any],
    category_map: Dict[str, str],
    account_map: Dict[str, str]
) -> Dict[str, Any]:
    errors = []
    date_value = str(row.get("date") or "").strip()
    description = str(row.get("description") or "").strip()
    type_value = str(row.get("type") or "").strip().lower()
    amount_raw = str(row.get("amount") or "").strip()
    category_label = str(row.get("category") or "").strip()
    account_label = str(row.get("account") or "").strip()
    currency_value = str(row.get("currency") or "").strip().upper()

    if not date_value:
        errors.append("Missing date")
    else:
        try:
            datetime.strptime(date_value, "%Y-%m-%d")
        except ValueError:
            errors.append("Invalid date format (expected YYYY-MM-DD)")

    if not description:
        errors.append("Missing description")

    if type_value not in ["income", "expense"]:
        errors.append("Invalid type (expected income or expense)")

    try:
        amount_value = float(amount_raw)
    except (TypeError, ValueError):
        amount_value = None
        errors.append("Invalid amount")

    if currency_value not in ["MXN", "USD"]:
        errors.append("Invalid currency (expected MXN or USD)")

    category_id = None
    if category_label:
        parsed = parse_name_type(category_label)
        if not parsed:
            errors.append("Category must include type (e.g., Groceries (expense))")
        else:
            lookup = normalize_label(f"{parsed['name']} ({parsed['type']})")
            category_id = category_map.get(lookup)
            if not category_id:
                errors.append("Category not found")
    else:
        errors.append("Missing category")

    account_id = None
    if account_label:
        parsed = parse_name_type(account_label)
        if not parsed:
            errors.append("Account must include type (e.g., Main Checking (debit))")
        else:
            lookup = normalize_label(f"{parsed['name']} ({parsed['type']})")
            account_id = account_map.get(lookup)
            if not account_id:
                errors.append("Account not found")
    else:
        errors.append("Missing account")

    data = {
        "date": date_value,
        "description": description,
        "type": type_value,
        "amount": amount_value,
        "category_id": category_id,
        "account_id": account_id,
        "currency": currency_value,
    }

    return {"data": data, "errors": errors}

# ============================================
# AUTH & SHEETS ENDPOINTS
# ============================================

# Store for user session (in production use proper session management)
user_session = {
    'authenticated': False,
    'token': None,
    'refresh_token': None,
    'spreadsheet_id': None,
    'spreadsheet_name': None,
    'last_synced_at': None
}

@app.post("/auth/google/login")
async def google_login():
    """Initiate Google OAuth flow"""
    if USE_SHEETS and sheets_service:
        url = sheets_service.get_oauth_url(
            GOOGLE_CLIENT_ID, 
            GOOGLE_CLIENT_SECRET, 
            GOOGLE_REDIRECT_URI
        )
        return {"url": url}
    return {"url": "/auth/mock", "message": "Google Sheets not configured"}

@app.post("/auth/google/callback")
async def google_callback(code: str):
    """Handle Google OAuth callback"""
    if USE_SHEETS and sheets_service:
        try:
            tokens = sheets_service.exchange_code(
                code,
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                GOOGLE_REDIRECT_URI
            )
            user_session['authenticated'] = True
            user_session['token'] = tokens['token']
            user_session['refresh_token'] = tokens['refresh_token']
            return {"success": True, "token": tokens['token']}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "token": "mock_token"}

@app.get("/sheets/list")
async def list_sheets():
    """List user's Google Sheets"""
    if USE_SHEETS and sheets_service and user_session['authenticated']:
        try:
            return sheets_service.list_spreadsheets()
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    return [
        {"id": "sheet-1", "name": "My Finance Tracker"},
        {"id": "sheet-2", "name": "Budget 2024"},
    ]

class SheetSelectRequest(BaseModel):
    sheetId: str

@app.post("/sheets/select")
async def select_sheet(data: SheetSelectRequest):
    """Select a spreadsheet to use"""
    sheet_id = data.sheetId
    if USE_SHEETS and sheets_service and user_session['authenticated']:
        sheets_service.set_spreadsheet(sheet_id)
        user_session['spreadsheet_id'] = sheet_id
        name = sheets_service.get_spreadsheet_name() or "Finance Tracker"
        user_session['spreadsheet_name'] = name
        user_session['last_synced_at'] = datetime.now().isoformat()
        return SyncStatus(
            connected=True,
            spreadsheet_id=sheet_id,
            spreadsheet_name=name,
            last_synced_at=user_session['last_synced_at'],
            syncing=False
        )
    user_session['spreadsheet_id'] = sheet_id
    user_session['spreadsheet_name'] = "My Finance Tracker"
    user_session['last_synced_at'] = datetime.now().isoformat()
    return SyncStatus(
        connected=True,
        spreadsheet_id=sheet_id,
        spreadsheet_name="My Finance Tracker",
        last_synced_at=user_session['last_synced_at'],
        syncing=False
    )

@app.post("/sheets/create-template")
async def create_template():
    """Create a new spreadsheet from template"""
    if USE_SHEETS and sheets_service and user_session['authenticated']:
        try:
            spreadsheet_id = sheets_service.create_spreadsheet("Ledger Finance Tracker")
            user_session['spreadsheet_id'] = spreadsheet_id
            user_session['spreadsheet_name'] = "Ledger Finance Tracker"
            user_session['last_synced_at'] = datetime.now().isoformat()
            return SyncStatus(
                connected=True,
                spreadsheet_id=spreadsheet_id,
                spreadsheet_name="Ledger Finance Tracker",
                last_synced_at=user_session['last_synced_at'],
                syncing=False
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    user_session['spreadsheet_id'] = "new-sheet-id"
    user_session['spreadsheet_name'] = "Ledger Finance Tracker"
    user_session['last_synced_at'] = datetime.now().isoformat()
    return SyncStatus(
        connected=True,
        spreadsheet_id="new-sheet-id",
        spreadsheet_name="Ledger Finance Tracker",
        last_synced_at=user_session['last_synced_at'],
        syncing=False
    )

@app.post("/sheets/migrate")
async def migrate_schema():
    """Ensure spreadsheet has correct schema"""
    if USE_SHEETS and sheets_service and user_session['spreadsheet_id']:
        try:
            sheets_service._initialize_headers()
            sheets_service._apply_import_validations()
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    return {"success": True}

@app.get("/sync/status")
async def get_sync_status():
    """Get current sync status"""
    connected = user_session.get('spreadsheet_id') is not None
    return SyncStatus(
        connected=connected,
        spreadsheet_id=user_session.get('spreadsheet_id'),
        spreadsheet_name=user_session.get('spreadsheet_name') if connected else None,
        last_synced_at=user_session.get('last_synced_at') if connected else None,
        syncing=False
    )

@app.post("/sheets/import/preview")
async def sheets_import_preview():
    """Preview transaction rows from Google Sheets before import"""
    if not USE_SHEETS or not sheets_service or not user_session.get('spreadsheet_id'):
        raise HTTPException(status_code=400, detail="Not connected to Google Sheets")

    sheets_service.set_spreadsheet(user_session['spreadsheet_id'])
    rows = sheets_service.get_import_rows_with_index()
    categories = store.list_categories()
    accounts = store.list_accounts()
    category_map = build_named_map(categories, "type")
    account_map = build_named_map(accounts, "type")

    previews = []
    candidates = []
    for row in rows:
        parsed = parse_sheet_transaction(row, category_map, account_map)
        data = parsed["data"]
        errors = parsed["errors"]
        import_hash = compute_import_hash(data) if not errors else None
        preview = {
            "row_number": row["row_number"],
            "data": data,
            "errors": errors,
            "import_hash": import_hash,
            "status": "invalid" if errors else "valid"
        }
        previews.append(preview)
        if import_hash:
            candidates.append(import_hash)

    existing = store.list_transactions_by_hash(candidates)
    existing_hashes = {item.get("import_hash") for item in existing}
    for preview in previews:
        if preview["status"] == "valid" and preview["import_hash"] in existing_hashes:
            preview["status"] = "duplicate"
            preview["errors"] = ["Duplicate import_hash"]

    return {"rows": previews}

@app.post("/sheets/import/confirm")
async def sheets_import_confirm():
    """Import transaction rows from Google Sheets into the database"""
    if not USE_SHEETS or not sheets_service or not user_session.get('spreadsheet_id'):
        raise HTTPException(status_code=400, detail="Not connected to Google Sheets")

    sheets_service.set_spreadsheet(user_session['spreadsheet_id'])
    rows = sheets_service.get_import_rows_with_index()
    categories = store.list_categories()
    accounts = store.list_accounts()
    category_map = build_named_map(categories, "type")
    account_map = build_named_map(accounts, "type")

    candidates = []
    row_lookup = {}
    for row in rows:
        parsed = parse_sheet_transaction(row, category_map, account_map)
        if parsed["errors"]:
            continue
        data = parsed["data"]
        data["source"] = "sheet"
        data["created_at"] = now_iso()
        data["import_hash"] = compute_import_hash(data)
        candidates.append(data)
        row_lookup[data["import_hash"]] = row["row_number"]

    existing = store.list_transactions_by_hash([c["import_hash"] for c in candidates])
    existing_hashes = {item.get("import_hash") for item in existing}
    to_insert = [c for c in candidates if c["import_hash"] not in existing_hashes]
    inserted = store.insert_transactions_ignore_duplicates(to_insert)

    inserted_hashes = {row.get("import_hash") for row in inserted}
    rows_to_delete = [row_lookup[h] for h in inserted_hashes if h in row_lookup]
    deleted_count = sheets_service.delete_import_rows(rows_to_delete)

    user_session['last_synced_at'] = now_iso()
    return {
        "success": True,
        "imported": len(inserted),
        "deleted_rows": deleted_count
    }

@app.post("/sync/pull")
async def sync_pull():
    """Pull (import) transactions from Sheets into the database"""
    return await sheets_import_confirm()

@app.post("/sync/push")
async def sync_push():
    """Push (export) database snapshots to Google Sheets"""
    if not USE_SHEETS or not sheets_service or not user_session.get('spreadsheet_id'):
        raise HTTPException(status_code=400, detail="Not connected to Google Sheets")

    try:
        sheets_service.set_spreadsheet(user_session['spreadsheet_id'])
        transactions = store.list_transactions({})
        accounts = store.list_accounts()
        categories = store.list_categories()
        budgets = store.list_budgets()
        rates = store.list_rates()
        rules = store.list_rules()
        settings = store.list_settings()
        installments = store.list_installments()

        accounts_with_balances = apply_computed_account_balances(accounts, transactions)

        export_accounts = []
        for account in accounts_with_balances:
            label = f"{account.get('name')} ({account.get('type')})"
            export_accounts.append({**account, "label": label})

        export_categories = []
        for category in categories:
            label = f"{category.get('name')} ({category.get('type')})"
            export_categories.append({**category, "label": label})

        # Debt tracker exports (derived)
        installment_monthly_by_account: Dict[str, float] = {}
        installment_remaining_by_account: Dict[str, float] = {}
        for inst in installments:
            account_id = inst.get("account_id")
            if not account_id:
                continue
            months_total = float(inst.get("months_total") or 1)
            months_remaining = float(inst.get("months_remaining") or 0)
            if months_remaining <= 0:
                continue
            amount = float(inst.get("amount") or 0)
            monthly_principal = amount / max(1.0, months_total)
            monthly_interest = float(inst.get("interest_amount_per_month") or 0) if inst.get("has_interest") else 0.0
            monthly_expected = monthly_principal + monthly_interest
            installment_monthly_by_account[account_id] = installment_monthly_by_account.get(account_id, 0.0) + monthly_expected
            installment_remaining_by_account[account_id] = installment_remaining_by_account.get(account_id, 0.0) + (monthly_expected * months_remaining)

        export_debt_accounts = []
        debt_summary_by_currency: Dict[str, Dict[str, float]] = {}
        for account in accounts_with_balances:
            if account.get("type") != "credit":
                continue
            currency = account.get("currency") or "MXN"
            balance = float(account.get("balance") or 0)
            debt_amount = max(0.0, -balance)
            credit_limit = account.get("credit_limit")
            remaining_credit = None
            try:
                if credit_limit is not None and str(credit_limit) != "":
                    remaining_credit = float(credit_limit) + balance
            except (TypeError, ValueError):
                remaining_credit = None

            monthly_expected = installment_monthly_by_account.get(account.get("id"), 0.0)
            remaining_installments = installment_remaining_by_account.get(account.get("id"), 0.0)

            export_debt_accounts.append({
                "account_id": account.get("id"),
                "account_name": account.get("name"),
                "currency": currency,
                "balance": balance,
                "debt_amount": debt_amount,
                "credit_limit": credit_limit,
                "remaining_credit": remaining_credit,
                "installment_monthly_expected": monthly_expected,
                "installment_remaining_balance": remaining_installments,
                "updated_at": now_iso(),
            })

            summary = debt_summary_by_currency.setdefault(str(currency), {
                "total_credit_debt": 0.0,
                "total_installment_remaining": 0.0,
                "total_installment_monthly_expected": 0.0,
            })
            summary["total_credit_debt"] += debt_amount
            summary["total_installment_remaining"] += remaining_installments
            summary["total_installment_monthly_expected"] += monthly_expected

        export_debt_summary = []
        for currency, summary in sorted(debt_summary_by_currency.items()):
            export_debt_summary.append({
                "currency": currency,
                "total_credit_debt": summary["total_credit_debt"],
                "total_installment_remaining": summary["total_installment_remaining"],
                "total_installment_monthly_expected": summary["total_installment_monthly_expected"],
                "total_debt_combined": summary["total_credit_debt"] + summary["total_installment_remaining"],
                "updated_at": now_iso(),
            })

        sheets_service.write_export_tab('export_transactions', transactions)
        sheets_service.write_export_tab('export_accounts', export_accounts)
        sheets_service.write_export_tab('export_categories', export_categories)
        sheets_service.write_export_tab('export_budgets', budgets)
        sheets_service.write_export_tab('export_rates', rates)
        sheets_service.write_export_tab('export_rules', rules)
        sheets_service.write_export_tab('export_settings', settings)
        sheets_service.write_export_tab('export_installments', installments)
        sheets_service.write_export_tab('export_debt_accounts', export_debt_accounts)
        sheets_service.write_export_tab('export_debt_summary', export_debt_summary)

        user_session['last_synced_at'] = now_iso()
        return {
            "success": True,
            "message": "Exported database snapshots to Sheets",
            "counts": {
                "transactions": len(transactions),
                "accounts": len(accounts),
                "categories": len(categories),
                "budgets": len(budgets),
                "rates": len(rates),
                "rules": len(rules),
                "installments": len(installments)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# TRANSACTIONS ENDPOINTS
# ============================================

@app.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    account_id: Optional[str] = None,
    type: Optional[TransactionType] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    currency: Optional[Currency] = None,
    search: Optional[str] = None,
):
    """Get transactions with optional filters"""
    filters = {
        "search": search,
        "category_id": category_id,
        "account_id": account_id,
        "type": type.value if isinstance(type, TransactionType) else type,
        "currency": currency.value if isinstance(currency, Currency) else currency,
        "min_amount": min_amount,
        "max_amount": max_amount,
        "start_date": start_date,
        "end_date": end_date,
    }
    rows = store.list_transactions(filters)
    return [Transaction(**normalize_transaction_row(row)) for row in rows]

@app.post("/transactions", response_model=Transaction)
async def create_transaction(data: TransactionCreate):
    """Create a new transaction, applying category rules if no category provided"""
    txn_type = data.type.value if isinstance(data.type, TransactionType) else data.type
    # Apply category rules if no category specified
    category_id = data.category_id
    if txn_type == "adjustment":
        category_id = None
    elif not category_id and data.description:
        for rule in store.list_rules():
            matched = False
            rule_field = rule.get("field") if isinstance(rule, dict) else rule.field
            rule_operator = rule.get("operator") if isinstance(rule, dict) else rule.operator
            rule_value = rule.get("value") if isinstance(rule, dict) else rule.value
            rule_category = rule.get("category_id") if isinstance(rule, dict) else rule.category_id
            if rule_field == "description":
                desc_lower = data.description.lower()
                value_lower = str(rule_value).lower()
                if rule_operator == "contains" and value_lower in desc_lower:
                    matched = True
                elif rule_operator == "equals" and desc_lower == value_lower:
                    matched = True
                elif rule_operator == "startsWith" and desc_lower.startswith(value_lower):
                    matched = True
                elif rule_operator == "endsWith" and desc_lower.endswith(value_lower):
                    matched = True
            elif rule_field == "amount" and data.amount:
                try:
                    rule_amount = float(rule_value)
                    if rule_operator == "equals" and data.amount == rule_amount:
                        matched = True
                    elif rule_operator == "greaterThan" and data.amount > rule_amount:
                        matched = True
                    elif rule_operator == "lessThan" and data.amount < rule_amount:
                        matched = True
                except ValueError:
                    pass
            
            if matched:
                category_id = rule_category
                break
    
    transaction_data = {
        "date": data.date,
        "description": data.description,
        "amount": data.amount,
        "type": txn_type,
        "category_id": category_id,
        "account_id": data.account_id,
        "to_account_id": data.to_account_id,
        "currency": data.currency.value if isinstance(data.currency, Currency) else data.currency,
        "converted_amount": data.converted_amount,
        "conversion_rate": data.conversion_rate,
        "tags": data.tags or [],
        "notes": data.notes,
        "needs_review": data.needs_review if data.needs_review is not None else (False if txn_type == "adjustment" else (not category_id)),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "source": "app"
    }
    transaction_data = normalize_uuid_inputs(transaction_data, ["category_id", "account_id", "to_account_id"])
    if not transaction_data.get("account_id"):
        raise HTTPException(status_code=400, detail="account_id is required")
    if transaction_data.get("type") == "transfer" and not transaction_data.get("to_account_id"):
        raise HTTPException(status_code=400, detail="to_account_id is required for transfers")
    if transaction_data.get("type") == "adjustment" and transaction_data.get("to_account_id"):
        raise HTTPException(status_code=400, detail="to_account_id must be empty for adjustments")
    created = store.create_transaction(transaction_data)
    return Transaction(**normalize_transaction_row(created))

@app.put("/transactions/{id}", response_model=Transaction)
async def update_transaction(id: str, data: TransactionUpdate):
    """Update an existing transaction"""
    updated_data = {}
    for key, value in data.dict(exclude_unset=True).items():
        if value is not None:
            if isinstance(value, Enum):
                updated_data[key] = value.value
            else:
                updated_data[key] = value
    updated_data["updated_at"] = now_iso()
    updated_data = normalize_uuid_inputs(updated_data, ["category_id", "account_id", "to_account_id"])
    updated = store.update_transaction(id, updated_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return Transaction(**normalize_transaction_row(updated))

@app.delete("/transactions/{id}")
async def delete_transaction(id: str):
    """Delete a transaction"""
    store.delete_transaction(id)
    return {"success": True}

@app.post("/transactions/bulk", response_model=List[Transaction])
async def bulk_update_transactions(data: BulkTransactionUpdate):
    """Bulk update multiple transactions"""
    updated_data = {}
    for key, value in data.data.dict(exclude_unset=True).items():
        if value is not None:
            updated_data[key] = value.value if isinstance(value, Enum) else value
    updated_data["updated_at"] = now_iso()
    updated_rows = store.bulk_update_transactions(data.ids, updated_data)
    return [Transaction(**normalize_transaction_row(row)) for row in updated_rows]

@app.post("/transactions/import/csv")
async def import_csv(file: UploadFile = File(...)):
    """Import transactions from CSV file"""
    import csv
    import io
    
    content = await file.read()
    text = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(text))
    
    preview = []
    for row in reader:
        # Map common CSV headers to our fields
        preview.append({
            'date': row.get('date', row.get('Date', '')),
            'description': row.get('description', row.get('Description', row.get('memo', row.get('Memo', '')))),
            'amount': float(row.get('amount', row.get('Amount', 0))),
            'type': row.get('type', row.get('Type', 'expense')).lower(),
            'category_id': row.get('category_id', row.get('category', '')),
            'account_id': row.get('account_id', row.get('account', '')),
            'currency': row.get('currency', row.get('Currency', 'MXN')),
        })
    
    return {"preview": preview}

@app.post("/transactions/import/paste")
async def import_paste(text: str):
    """Import transactions from pasted text"""
    import csv
    import io
    
    # Try to parse as CSV
    reader = csv.DictReader(io.StringIO(text))
    
    preview = []
    try:
        for row in reader:
            preview.append({
                'date': row.get('date', row.get('Date', '')),
                'description': row.get('description', row.get('Description', '')),
                'amount': float(row.get('amount', row.get('Amount', 0))),
                'type': row.get('type', row.get('Type', 'expense')).lower(),
                'category_id': row.get('category_id', ''),
                'account_id': row.get('account_id', ''),
                'currency': row.get('currency', 'MXN'),
            })
    except Exception:
        # Fall back to line-by-line parsing
        lines = text.strip().split('\n')
        for line in lines:
            parts = line.split(',')
            if len(parts) >= 3:
                preview.append({
                    'date': parts[0].strip(),
                    'description': parts[1].strip(),
                    'amount': float(parts[2].strip()) if parts[2].strip() else 0,
                    'type': 'expense',
                    'category_id': '',
                    'account_id': '',
                    'currency': 'MXN',
                })
    
    return {"preview": preview}

@app.post("/transactions/import/confirm")
async def import_confirm(transactions: List[TransactionCreate]):
    """Confirm and save imported transactions"""
    created = []
    for data in transactions:
        # Apply category rules if no category specified
        category_id = data.category_id
        if not category_id and data.description:
            for rule in store.list_rules():
                matched = False
                rule_field = rule.get("field") if isinstance(rule, dict) else rule.field
                rule_operator = rule.get("operator") if isinstance(rule, dict) else rule.operator
                rule_value = rule.get("value") if isinstance(rule, dict) else rule.value
                rule_category = rule.get("category_id") if isinstance(rule, dict) else rule.category_id
                if rule_field == "description":
                    desc_lower = data.description.lower()
                    value_lower = str(rule_value).lower()
                    if rule_operator == "contains" and value_lower in desc_lower:
                        matched = True
                    elif rule_operator == "equals" and desc_lower == value_lower:
                        matched = True
                    elif rule_operator == "startsWith" and desc_lower.startswith(value_lower):
                        matched = True
                    elif rule_operator == "endsWith" and desc_lower.endswith(value_lower):
                        matched = True
                if matched:
                    category_id = rule_category
                    break
        
        transaction_data = {
            "date": data.date,
            "description": data.description,
            "amount": data.amount,
            "type": data.type.value if isinstance(data.type, TransactionType) else data.type,
            "category_id": category_id,
            "account_id": data.account_id,
            "to_account_id": data.to_account_id,
            "currency": data.currency.value if isinstance(data.currency, Currency) else data.currency,
            "converted_amount": data.converted_amount,
            "conversion_rate": data.conversion_rate,
            "tags": data.tags or [],
            "notes": data.notes,
            "needs_review": data.needs_review if data.needs_review is not None else (not category_id),
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "source": "app"
        }
        transaction_data = normalize_uuid_inputs(transaction_data, ["category_id", "account_id", "to_account_id"])
        created_row = store.create_transaction(transaction_data)
        created.append(Transaction(**normalize_transaction_row(created_row)))
    
    return {"imported": len(created), "transactions": created}

# ============================================
# ACCOUNTS ENDPOINTS
# ============================================

@app.get("/accounts", response_model=List[Account])
async def get_accounts():
    """Get all accounts"""
    accounts = store.list_accounts()
    transactions = store.list_transactions({})
    installments = store.list_installments()
    accounts_with_balances = apply_computed_account_balances(accounts, transactions)
    accounts_with_balances = compute_credit_account_availability(accounts_with_balances, installments)
    return [Account(**row) for row in accounts_with_balances]

@app.post("/accounts", response_model=Account)
async def create_account(data: AccountCreate):
    """Create a new account"""
    if data.statement_day is not None and (data.statement_day < 1 or data.statement_day > 31):
        raise HTTPException(status_code=400, detail="statement_day must be between 1 and 31")
    account_data = {
        **normalize_enums(data.dict()),
        "balance": data.opening_balance,
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    created = store.create_account(account_data)
    return Account(**created)

@app.put("/accounts/{id}", response_model=Account)
async def update_account(id: str, data: AccountCreate):
    """Update an account"""
    if data.statement_day is not None and (data.statement_day < 1 or data.statement_day > 31):
        raise HTTPException(status_code=400, detail="statement_day must be between 1 and 31")
    updated = store.update_account(id, {
        **normalize_enums(data.dict()),
        "balance": data.opening_balance,
        "updated_at": now_iso()
    })
    if not updated:
        raise HTTPException(status_code=404, detail="Account not found")
    return Account(**updated)

# ============================================
# CATEGORIES ENDPOINTS
# ============================================

@app.get("/categories", response_model=List[Category])
async def get_categories():
    """Get all categories"""
    return [Category(**row) for row in store.list_categories()]

@app.post("/categories", response_model=Category)
async def create_category(data: CategoryCreate):
    """Create a new category"""
    category_data = {
        **normalize_enums(data.dict()),
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    created = store.create_category(category_data)
    return Category(**created)

@app.put("/categories/{id}", response_model=Category)
async def update_category(id: str, data: CategoryCreate):
    """Update a category"""
    updated = store.update_category(id, {
        **normalize_enums(data.dict()),
        "updated_at": now_iso()
    })
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found")
    return Category(**updated)

@app.delete("/categories/{id}")
async def delete_category(id: str):
    """Delete a category"""
    store.delete_category(id)
    return {"success": True}

# ============================================
# BUDGETS ENDPOINTS
# ============================================

@app.get("/budgets", response_model=List[Budget])
async def get_budgets(month: Optional[str] = None):
    """Get budgets, optionally filtered by month"""
    rows = store.list_budgets(month)
    return [Budget(**row) for row in rows]

@app.post("/budgets", response_model=Budget)
async def create_budget(data: BudgetCreate):
    """Create a new budget"""
    budget_data = {
        "category_id": data.category_id,
        "month": data.month,
        "amount": data.amount,
        "rollover": data.rollover,
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    created = store.create_budget(budget_data)
    return Budget(**created)

@app.put("/budgets/{id}", response_model=Budget)
async def update_budget(id: str, data: BudgetCreate):
    """Update a budget"""
    updated = store.update_budget(id, {
        "category_id": data.category_id,
        "month": data.month,
        "amount": data.amount,
        "rollover": data.rollover,
        "updated_at": now_iso()
    })
    if not updated:
        raise HTTPException(status_code=404, detail="Budget not found")
    return Budget(**updated)

# ============================================
# RATES ENDPOINTS
# ============================================

@app.get("/rates", response_model=List[ExchangeRate])
async def get_rates():
    """Get all exchange rates"""
    return [ExchangeRate(**row) for row in store.list_rates()]

@app.post("/rates", response_model=ExchangeRate)
async def create_or_update_rate(data: ExchangeRateCreate):
    """Create or update an exchange rate"""
    # Check if rate exists
    for r in store.list_rates():
        if r.get("from_currency") == data.from_currency.value and r.get("to_currency") == data.to_currency.value:
            updated = store.update_rate(r["id"], {
                "from_currency": data.from_currency.value,
                "to_currency": data.to_currency.value,
                "rate": data.rate,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "source": "manual",
                "updated_at": now_iso()
            })
            if not updated:
                raise HTTPException(status_code=404, detail="Rate not found")
            return ExchangeRate(**updated)
    
    # Create new rate
    new_rate = store.create_rate({
        "from_currency": data.from_currency.value,
        "to_currency": data.to_currency.value,
        "rate": data.rate,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "source": "manual",
        "created_at": now_iso(),
        "updated_at": now_iso()
    })
    return ExchangeRate(**new_rate)

# ============================================
# REPORTS ENDPOINTS
# ============================================

@app.get("/reports/monthly", response_model=MonthlyReport)
async def get_monthly_report(month: str):
    """Get monthly report"""
    # Filter transactions for this month
    transactions = store.list_transactions({"start_date": f"{month}-01", "end_date": f"{month}-31"})
    month_txns = [Transaction(**normalize_transaction_row(t)) for t in transactions if t.get("date", "").startswith(month)]
    
    income = sum(t.amount for t in month_txns if t.type == TransactionType.income)
    expenses = sum(t.amount for t in month_txns if t.type == TransactionType.expense)
    
    # Group by category
    category_totals = {}
    for t in month_txns:
        if t.type == TransactionType.expense and t.category_id:
            category_totals[t.category_id] = category_totals.get(t.category_id, 0) + t.amount
    
    by_category = [{"category_id": k, "amount": v} for k, v in category_totals.items()]
    
    # Account balances
    accounts_raw = store.list_accounts()
    accounts_with_balances = apply_computed_account_balances(accounts_raw, transactions)
    accounts = [Account(**a) for a in accounts_with_balances]
    by_account = [{"account_id": a.id, "balance": a.balance} for a in accounts]
    
    # Daily spend
    daily_totals = {}
    for t in month_txns:
        if t.type == TransactionType.expense:
            daily_totals[t.date] = daily_totals.get(t.date, 0) + t.amount
    daily_spend = [{"date": k, "amount": v} for k, v in sorted(daily_totals.items())]
    
    return MonthlyReport(
        month=month,
        income=income,
        expenses=expenses,
        net=income - expenses,
        by_category=by_category,
        by_account=by_account,
        daily_spend=daily_spend
    )

@app.get("/reports/yearly", response_model=YearlyReport)
async def get_yearly_report(year: str):
    """Get yearly report"""
    # Filter transactions for this year
    transactions = store.list_transactions({"start_date": f"{year}-01-01", "end_date": f"{year}-12-31"})
    year_txns = [Transaction(**normalize_transaction_row(t)) for t in transactions if t.get("date", "").startswith(year)]
    
    # Group by month
    monthly_data = {}
    for t in year_txns:
        month = t.date[:7]
        if month not in monthly_data:
            monthly_data[month] = {"income": 0, "expenses": 0}
        if t.type == TransactionType.income:
            monthly_data[month]["income"] += t.amount
        elif t.type == TransactionType.expense:
            monthly_data[month]["expenses"] += t.amount
    
    monthly_totals = [
        {"month": m, "income": d["income"], "expenses": d["expenses"], "net": d["income"] - d["expenses"]}
        for m, d in sorted(monthly_data.items())
    ]
    
    # Category totals for year
    cat_totals = {}
    for t in year_txns:
        if t.type == TransactionType.expense and t.category_id:
            cat_totals[t.category_id] = cat_totals.get(t.category_id, 0) + t.amount
    category_totals = [{"category_id": k, "amount": v} for k, v in cat_totals.items()]
    
    # Account balances
    accounts_raw = store.list_accounts()
    accounts_with_balances = apply_computed_account_balances(accounts_raw, transactions)
    accounts = [Account(**a) for a in accounts_with_balances]
    account_balances = [{"account_id": a.id, "balance": a.balance} for a in accounts]
    
    return YearlyReport(
        year=year,
        monthly_totals=monthly_totals,
        category_totals=category_totals,
        account_balances=account_balances
    )

# ============================================
# EXPORT ENDPOINT
# ============================================

@app.get("/export/csv")
async def export_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Export transactions as CSV"""
    import io
    output = io.StringIO()
    output.write("date,description,amount,type,category_id,account_id,currency\n")
    
    filters = {"start_date": start_date, "end_date": end_date}
    filtered = [Transaction(**normalize_transaction_row(t)) for t in store.list_transactions(filters)]
    
    for t in filtered:
        output.write(f"{t.date},{t.description},{t.amount},{t.type.value},{t.category_id or ''},{t.account_id},{t.currency.value}\n")
    
    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"}
    )

# ============================================
# CATEGORY RULES ENDPOINTS
# ============================================

@app.get("/categories/rules", response_model=List[CategoryRule])
async def get_category_rules():
    """Get all category rules"""
    return [CategoryRule(**row) for row in store.list_rules()]

@app.post("/categories/rules", response_model=CategoryRule)
async def create_category_rule(data: CategoryRule):
    """Create a new category rule"""
    rule_data = {
        "category_id": data.category_id,
        "field": data.field.value if isinstance(data.field, RuleField) else data.field,
        "operator": data.operator.value if isinstance(data.operator, RuleOperator) else data.operator,
        "value": data.value,
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    created = store.create_rule(rule_data)
    return CategoryRule(**created)

@app.delete("/categories/rules/{id}")
async def delete_category_rule(id: str):
    """Delete a category rule"""
    store.delete_rule(id)
    return {"success": True}

# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ============================================
# INSTALLMENTS ENDPOINTS (Separate from transactions)
# ============================================

@app.get("/installments", response_model=List[Installment])
async def get_installments():
    rows = store.list_installments()
    return [Installment(**row) for row in rows]

@app.post("/installments", response_model=Installment)
async def create_installment(data: InstallmentCreate):
    if data.months_total <= 0:
        raise HTTPException(status_code=400, detail="months_total must be > 0")
    months_remaining = data.months_remaining if data.months_remaining is not None else data.months_total
    if months_remaining < 0 or months_remaining > data.months_total:
        raise HTTPException(status_code=400, detail="months_remaining must be between 0 and months_total")
    try:
        datetime.strptime(data.purchase_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="purchase_date must be YYYY-MM-DD")
    payload = {
        "account_id": data.account_id,
        "description": data.description,
        "amount": data.amount,
        "months_total": data.months_total,
        "months_remaining": months_remaining,
        "has_interest": data.has_interest,
        "interest_amount_per_month": data.interest_amount_per_month,
        "purchase_date": data.purchase_date,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    created = store.create_installment(payload)
    return Installment(**created)

@app.put("/installments/{id}", response_model=Installment)
async def update_installment(id: str, data: InstallmentUpdate):
    updates: Dict[str, Any] = {}
    for key, value in data.dict(exclude_unset=True).items():
        if value is not None:
            updates[key] = value
    if "purchase_date" in updates:
        try:
            datetime.strptime(updates["purchase_date"], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="purchase_date must be YYYY-MM-DD")
    updates = normalize_uuid_inputs(updates, ["account_id"])
    # Validate month constraints if present
    existing = None
    for row in store.list_installments():
        if row.get("id") == id:
            existing = row
            break
    if existing is None:
        raise HTTPException(status_code=404, detail="Installment not found")
    months_total = updates.get("months_total", existing.get("months_total"))
    months_remaining = updates.get("months_remaining", existing.get("months_remaining"))
    if months_total is not None and months_total <= 0:
        raise HTTPException(status_code=400, detail="months_total must be > 0")
    if months_remaining is not None and (months_remaining < 0 or months_remaining > months_total):
        raise HTTPException(status_code=400, detail="months_remaining must be between 0 and months_total")
    updates["updated_at"] = now_iso()
    updated = store.update_installment(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Installment not found")
    return Installment(**updated)

@app.delete("/installments/{id}")
async def delete_installment(id: str):
    store.delete_installment(id)
    return {"success": True}

# ============================================
# STARTUP - SEED DATA
# ============================================

@app.on_event("startup")
async def startup_seed_data():
    """Seed initial data for testing - 3 months of realistic data"""
    if not isinstance(store, InMemoryStore):
        return

    now = now_iso()

    def normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        for key, value in record.items():
            if isinstance(value, Enum):
                normalized[key] = value.value
            else:
                normalized[key] = value
        return normalized

    # Add categories
    categories = [
        Category(id="cat-1", name="Groceries", icon="shopping-cart", color="#10b981",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-2", name="Restaurants", icon="utensils", color="#f59e0b",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-3", name="Transport", icon="car", color="#3b82f6",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-4", name="Salary", icon="briefcase", color="#8b5cf6",
            type=CategoryType.income, created_at=now, updated_at=now),
        Category(id="cat-5", name="Entertainment", icon="gamepad-2", color="#ec4899",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-6", name="Shopping", icon="shopping-bag", color="#06b6d4",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-7", name="Utilities", icon="zap", color="#64748b",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-8", name="Housing", icon="home", color="#a855f7",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-9", name="Freelance", icon="laptop", color="#22c55e",
            type=CategoryType.income, created_at=now, updated_at=now),
        Category(id="cat-10", name="Healthcare", icon="heart-pulse", color="#ef4444",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-11", name="Subscriptions", icon="repeat", color="#6366f1",
            type=CategoryType.expense, created_at=now, updated_at=now),
        Category(id="cat-12", name="Investments", icon="trending-up", color="#14b8a6",
            type=CategoryType.income, created_at=now, updated_at=now),
    ]
    for category in categories:
        store.create_category(normalize_record(category.dict()))

    # Add accounts
    accounts = [
        Account(id="acc-1", name="Main Checking", type=AccountType.debit,
            currency=Currency.MXN, balance=67500, opening_balance=30000,
            color="#3b82f6", icon="wallet", created_at=now, updated_at=now),
        Account(id="acc-2", name="Savings", type=AccountType.savings,
            currency=Currency.MXN, balance=185000, opening_balance=150000,
            color="#10b981", icon="piggy-bank", created_at=now, updated_at=now),
        Account(id="acc-3", name="Credit Card", type=AccountType.credit,
            currency=Currency.MXN, balance=-12450, opening_balance=0,
            credit_limit=50000, color="#ef4444", icon="credit-card",
            created_at=now, updated_at=now),
        Account(id="acc-4", name="USD Account", type=AccountType.debit,
            currency=Currency.USD, balance=2150, opening_balance=1500,
            color="#8b5cf6", icon="dollar-sign", created_at=now, updated_at=now),
    ]
    for account in accounts:
        store.create_account(normalize_record(account.dict()))

    # Transactions
    transactions = [
        Transaction(id="txn-n1", date="2025-11-01", description="November Salary",
            amount=45000.00, type=TransactionType.income, category_id="cat-4",
            account_id="acc-1", currency=Currency.MXN, tags=["salary"], created_at=now, updated_at=now),
        Transaction(id="txn-n2", date="2025-11-15", description="Freelance - Website Project",
            amount=12000.00, type=TransactionType.income, category_id="cat-9",
            account_id="acc-1", currency=Currency.MXN, tags=["freelance"], created_at=now, updated_at=now),
        Transaction(id="txn-n3", date="2025-11-01", description="November Rent",
            amount=12000.00, type=TransactionType.expense, category_id="cat-8",
            account_id="acc-1", currency=Currency.MXN, tags=["rent"], created_at=now, updated_at=now),
        Transaction(id="txn-n4", date="2025-11-03", description="Costco Weekly Shopping",
            amount=2850.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-n5", date="2025-11-10", description="Walmart Groceries",
            amount=1650.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-3", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-n6", date="2025-11-17", description="HEB Supermarket",
            amount=980.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-n7", date="2025-11-24", description="Soriana Groceries",
            amount=1420.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-n8", date="2025-11-05", description="Starbucks Coffee",
            amount=185.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["coffee"], created_at=now, updated_at=now),
        Transaction(id="txn-n9", date="2025-11-12", description="Sushi Restaurant",
            amount=890.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["dining"], created_at=now, updated_at=now),
        Transaction(id="txn-n10", date="2025-11-20", description="Italian Restaurant",
            amount=1250.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["dining"], created_at=now, updated_at=now),
        Transaction(id="txn-n11", date="2025-11-28", description="Thanksgiving Dinner Out",
            amount=2100.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-1", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-n12", date="2025-11-02", description="Gas Station - Shell",
            amount=950.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-1", currency=Currency.MXN, tags=["fuel"], created_at=now, updated_at=now),
        Transaction(id="txn-n13", date="2025-11-15", description="Uber Rides",
            amount=420.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-3", currency=Currency.MXN, tags=["rideshare"], created_at=now, updated_at=now),
        Transaction(id="txn-n14", date="2025-11-22", description="Gas Station - Pemex",
            amount=880.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-1", currency=Currency.MXN, tags=["fuel"], created_at=now, updated_at=now),
        Transaction(id="txn-n15", date="2025-11-05", description="Electric Bill - CFE",
            amount=780.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-n16", date="2025-11-08", description="Internet - Telmex",
            amount=599.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-n17", date="2025-11-10", description="Mobile Phone",
            amount=499.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-n18", date="2025-11-01", description="Netflix",
            amount=299.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-n19", date="2025-11-01", description="Spotify",
            amount=179.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-n20", date="2025-11-15", description="Amazon Prime",
            amount=99.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-n21", date="2025-11-08", description="Cinema Tickets",
            amount=380.00, type=TransactionType.expense, category_id="cat-5",
            account_id="acc-3", currency=Currency.MXN, tags=["movies"], created_at=now, updated_at=now),
        Transaction(id="txn-n22", date="2025-11-25", description="Concert Tickets",
            amount=1800.00, type=TransactionType.expense, category_id="cat-5",
            account_id="acc-3", currency=Currency.MXN, tags=["concert"], created_at=now, updated_at=now),
        Transaction(id="txn-n23", date="2025-11-11", description="Amazon - Electronics",
            amount=2500.00, type=TransactionType.expense, category_id="cat-6",
            account_id="acc-3", currency=Currency.MXN, tags=["online"], created_at=now, updated_at=now),
        Transaction(id="txn-n24", date="2025-11-29", description="Black Friday Shopping",
            amount=4500.00, type=TransactionType.expense, category_id="cat-6",
            account_id="acc-3", currency=Currency.MXN, tags=["sale"], created_at=now, updated_at=now),
        Transaction(id="txn-n25", date="2025-11-18", description="Pharmacy - Medicine",
            amount=650.00, type=TransactionType.expense, category_id="cat-10",
            account_id="acc-1", currency=Currency.MXN, tags=["health"], created_at=now, updated_at=now),
        Transaction(id="txn-d1", date="2025-12-01", description="December Salary",
            amount=45000.00, type=TransactionType.income, category_id="cat-4",
            account_id="acc-1", currency=Currency.MXN, tags=["salary"], created_at=now, updated_at=now),
        Transaction(id="txn-d2", date="2025-12-15", description="Christmas Bonus",
            amount=45000.00, type=TransactionType.income, category_id="cat-4",
            account_id="acc-1", currency=Currency.MXN, tags=["bonus"], created_at=now, updated_at=now),
        Transaction(id="txn-d3", date="2025-12-20", description="Freelance - App Development",
            amount=18000.00, type=TransactionType.income, category_id="cat-9",
            account_id="acc-1", currency=Currency.MXN, tags=["freelance"], created_at=now, updated_at=now),
        Transaction(id="txn-d4", date="2025-12-28", description="Investment Dividends",
            amount=3500.00, type=TransactionType.income, category_id="cat-12",
            account_id="acc-2", currency=Currency.MXN, tags=["investment"], created_at=now, updated_at=now),
        Transaction(id="txn-d5", date="2025-12-01", description="December Rent",
            amount=12000.00, type=TransactionType.expense, category_id="cat-8",
            account_id="acc-1", currency=Currency.MXN, tags=["rent"], created_at=now, updated_at=now),
        Transaction(id="txn-d6", date="2025-12-05", description="Costco Holiday Shopping",
            amount=4200.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-d7", date="2025-12-12", description="Walmart Weekly",
            amount=1890.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-3", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-d8", date="2025-12-20", description="Christmas Groceries",
            amount=3500.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-d9", date="2025-12-28", description="New Year Groceries",
            amount=2100.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-d10", date="2025-12-07", description="Brunch with Friends",
            amount=780.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["social"], created_at=now, updated_at=now),
        Transaction(id="txn-d11", date="2025-12-14", description="Office Christmas Party",
            amount=1500.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["work"], created_at=now, updated_at=now),
        Transaction(id="txn-d12", date="2025-12-24", description="Christmas Eve Dinner",
            amount=3200.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-1", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-d13", date="2025-12-31", description="New Year's Eve Restaurant",
            amount=4500.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-1", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-d14", date="2025-12-03", description="Gas Station",
            amount=1100.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-1", currency=Currency.MXN, tags=["fuel"], created_at=now, updated_at=now),
        Transaction(id="txn-d15", date="2025-12-18", description="Holiday Travel Gas",
            amount=1500.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-1", currency=Currency.MXN, tags=["travel"], created_at=now, updated_at=now),
        Transaction(id="txn-d16", date="2025-12-22", description="Uber Holiday Week",
            amount=680.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-3", currency=Currency.MXN, tags=["rideshare"], created_at=now, updated_at=now),
        Transaction(id="txn-d17", date="2025-12-05", description="Electric Bill - CFE",
            amount=920.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-d18", date="2025-12-08", description="Internet - Telmex",
            amount=599.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-d19", date="2025-12-10", description="Mobile Phone",
            amount=499.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-d20", date="2025-12-12", description="Gas Bill - Naturgy",
            amount=450.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-d21", date="2025-12-01", description="Netflix",
            amount=299.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-d22", date="2025-12-01", description="Spotify",
            amount=179.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-d23", date="2025-12-15", description="Disney+",
            amount=199.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-d24", date="2025-12-10", description="Video Games",
            amount=1200.00, type=TransactionType.expense, category_id="cat-5",
            account_id="acc-3", currency=Currency.MXN, tags=["gaming"], created_at=now, updated_at=now),
        Transaction(id="txn-d25", date="2025-12-21", description="Theme Park Tickets",
            amount=2800.00, type=TransactionType.expense, category_id="cat-5",
            account_id="acc-3", currency=Currency.MXN, tags=["family"], created_at=now, updated_at=now),
        Transaction(id="txn-d26", date="2025-12-08", description="Christmas Gifts - Family",
            amount=8500.00, type=TransactionType.expense, category_id="cat-6",
            account_id="acc-3", currency=Currency.MXN, tags=["gifts"], created_at=now, updated_at=now),
        Transaction(id="txn-d27", date="2025-12-15", description="Christmas Decorations",
            amount=1800.00, type=TransactionType.expense, category_id="cat-6",
            account_id="acc-3", currency=Currency.MXN, tags=["holiday"], created_at=now, updated_at=now),
        Transaction(id="txn-d28", date="2025-12-18", description="Christmas Gifts - Friends",
            amount=3200.00, type=TransactionType.expense, category_id="cat-6",
            account_id="acc-3", currency=Currency.MXN, tags=["gifts"], created_at=now, updated_at=now),
        Transaction(id="txn-d29", date="2025-12-05", description="Doctor Visit",
            amount=800.00, type=TransactionType.expense, category_id="cat-10",
            account_id="acc-1", currency=Currency.MXN, tags=["health"], created_at=now, updated_at=now),
        Transaction(id="txn-d30", date="2025-12-20", description="Pharmacy",
            amount=520.00, type=TransactionType.expense, category_id="cat-10",
            account_id="acc-1", currency=Currency.MXN, tags=["health"], created_at=now, updated_at=now),
        Transaction(id="txn-j1", date="2026-01-01", description="January Salary",
            amount=45000.00, type=TransactionType.income, category_id="cat-4",
            account_id="acc-1", currency=Currency.MXN, tags=["salary"], created_at=now, updated_at=now),
        Transaction(id="txn-j2", date="2026-01-10", description="Freelance - Consulting",
            amount=9500.00, type=TransactionType.income, category_id="cat-9",
            account_id="acc-1", currency=Currency.MXN, tags=["freelance"], created_at=now, updated_at=now),
        Transaction(id="txn-j3", date="2026-01-01", description="January Rent",
            amount=12000.00, type=TransactionType.expense, category_id="cat-8",
            account_id="acc-1", currency=Currency.MXN, tags=["rent"], created_at=now, updated_at=now),
        Transaction(id="txn-j4", date="2026-01-04", description="Costco Weekly",
            amount=2100.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-1", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-j5", date="2026-01-11", description="Walmart Groceries",
            amount=1450.00, type=TransactionType.expense, category_id="cat-1",
            account_id="acc-3", currency=Currency.MXN, tags=["weekly"], created_at=now, updated_at=now),
        Transaction(id="txn-j6", date="2026-01-06", description="Coffee Shop",
            amount=165.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["coffee"], created_at=now, updated_at=now),
        Transaction(id="txn-j7", date="2026-01-09", description="Lunch Meeting",
            amount=580.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["work"], created_at=now, updated_at=now),
        Transaction(id="txn-j8", date="2026-01-14", description="Pizza Night",
            amount=420.00, type=TransactionType.expense, category_id="cat-2",
            account_id="acc-3", currency=Currency.MXN, tags=["dining"], created_at=now, updated_at=now),
        Transaction(id="txn-j9", date="2026-01-05", description="Gas Station - Shell",
            amount=980.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-1", currency=Currency.MXN, tags=["fuel"], created_at=now, updated_at=now),
        Transaction(id="txn-j10", date="2026-01-12", description="Uber Rides",
            amount=350.00, type=TransactionType.expense, category_id="cat-3",
            account_id="acc-3", currency=Currency.MXN, tags=["rideshare"], created_at=now, updated_at=now),
        Transaction(id="txn-j11", date="2026-01-05", description="Electric Bill - CFE",
            amount=850.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-j12", date="2026-01-08", description="Internet - Telmex",
            amount=599.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-j13", date="2026-01-10", description="Mobile Phone",
            amount=499.00, type=TransactionType.expense, category_id="cat-7",
            account_id="acc-1", currency=Currency.MXN, tags=["bills"], created_at=now, updated_at=now),
        Transaction(id="txn-j14", date="2026-01-01", description="Netflix",
            amount=299.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-j15", date="2026-01-01", description="Spotify",
            amount=179.00, type=TransactionType.expense, category_id="cat-11",
            account_id="acc-3", currency=Currency.MXN, tags=["subscription"], created_at=now, updated_at=now),
        Transaction(id="txn-j16", date="2026-01-08", description="Cinema",
            amount=320.00, type=TransactionType.expense, category_id="cat-5",
            account_id="acc-3", currency=Currency.MXN, tags=["movies"], created_at=now, updated_at=now),
        Transaction(id="txn-j17", date="2026-01-07", description="Amazon - Books",
            amount=650.00, type=TransactionType.expense, category_id="cat-6",
            account_id="acc-3", currency=Currency.MXN, tags=["online"], created_at=now, updated_at=now),
        Transaction(id="txn-j18", date="2026-01-13", description="Pharmacy",
            amount=380.00, type=TransactionType.expense, category_id="cat-10",
            account_id="acc-1", currency=Currency.MXN, tags=["health"], created_at=now, updated_at=now),
    ]
    for transaction in transactions:
        store.create_transaction(normalize_record(transaction.dict()))

    # Add budgets for current month (January 2026)
    budgets = [
        Budget(id="bud-1", category_id="cat-1", month="2026-01", amount=8000,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-2", category_id="cat-2", month="2026-01", amount=3000,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-3", category_id="cat-3", month="2026-01", amount=2500,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-4", category_id="cat-5", month="2026-01", amount=2000,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-5", category_id="cat-6", month="2026-01", amount=3000,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-6", category_id="cat-7", month="2026-01", amount=3000,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-7", category_id="cat-8", month="2026-01", amount=12000,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-8", category_id="cat-10", month="2026-01", amount=1500,
            rollover=False, created_at=now, updated_at=now),
        Budget(id="bud-9", category_id="cat-11", month="2026-01", amount=1000,
            rollover=False, created_at=now, updated_at=now),
    ]
    for budget in budgets:
        store.create_budget(normalize_record(budget.dict()))

    # Add category rules
    rules = [
        CategoryRule(id="rule-1", category_id="cat-2", field="description",
            operator="contains", value="Starbucks", created_at=now, updated_at=now),
        CategoryRule(id="rule-2", category_id="cat-3", field="description",
            operator="contains", value="Uber", created_at=now, updated_at=now),
        CategoryRule(id="rule-3", category_id="cat-11", field="description",
            operator="contains", value="Netflix", created_at=now, updated_at=now),
        CategoryRule(id="rule-4", category_id="cat-1", field="description",
            operator="contains", value="Costco", created_at=now, updated_at=now),
    ]
    for rule in rules:
        store.create_rule(normalize_record(rule.dict()))

    # Add exchange rate
    store.create_rate({
        "id": "rate-1",
        "from_currency": Currency.USD.value,
        "to_currency": Currency.MXN.value,
        "rate": 17.25,
        "date": "2026-01-15",
        "source": "manual",
        "created_at": now,
        "updated_at": now
    })

    print("✓ Seeded in-memory data for development")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
