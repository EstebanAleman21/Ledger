import os
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from supabase import create_client
except ImportError:
    create_client = None


class SupabaseStore:
    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.client = create_client(url, key) if create_client and url and key else None

    def is_ready(self) -> bool:
        return self.client is not None

    def _execute(self, query):
        result = query.execute()
        error = getattr(result, "error", None)
        if error:
            raise ValueError(str(error))
        return getattr(result, "data", None) or []

    def list_transactions(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        query = self.client.table("transactions").select("*")
        if filters.get("search"):
            query = query.ilike("description", f"%{filters['search']}%")
        if filters.get("category_id"):
            query = query.eq("category_id", filters["category_id"])
        if filters.get("account_id"):
            query = query.eq("account_id", filters["account_id"])
        if filters.get("type"):
            query = query.eq("type", filters["type"])
        if filters.get("currency"):
            query = query.eq("currency", filters["currency"])
        if filters.get("min_amount") is not None:
            query = query.gte("amount", filters["min_amount"])
        if filters.get("max_amount") is not None:
            query = query.lte("amount", filters["max_amount"])
        if filters.get("start_date"):
            query = query.gte("date", filters["start_date"])
        if filters.get("end_date"):
            query = query.lte("date", filters["end_date"])
        query = query.order("date", desc=True)
        return self._execute(query)

    def create_transaction(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("transactions").insert(data))[0]

    def update_transaction(self, transaction_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("transactions").update(data).eq("id", transaction_id)
        )
        return rows[0] if rows else None

    def delete_transaction(self, transaction_id: str) -> bool:
        self._execute(self.client.table("transactions").delete().eq("id", transaction_id))
        return True

    def bulk_update_transactions(self, ids: List[str], data: Dict[str, Any]) -> List[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("transactions").update(data).in_("id", ids)
        )
        return rows

    def list_accounts(self) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("accounts").select("*"))

    def create_account(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("accounts").insert(data))[0]

    def update_account(self, account_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("accounts").update(data).eq("id", account_id)
        )
        return rows[0] if rows else None

    def list_categories(self) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("categories").select("*"))

    def create_category(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("categories").insert(data))[0]

    def update_category(self, category_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("categories").update(data).eq("id", category_id)
        )
        return rows[0] if rows else None

    def delete_category(self, category_id: str) -> bool:
        self._execute(self.client.table("categories").delete().eq("id", category_id))
        return True

    def list_budgets(self, month: Optional[str] = None) -> List[Dict[str, Any]]:
        query = self.client.table("budgets").select("*")
        if month:
            query = query.eq("month", month)
        return self._execute(query)

    def create_budget(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("budgets").insert(data))[0]

    def update_budget(self, budget_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("budgets").update(data).eq("id", budget_id)
        )
        return rows[0] if rows else None

    def list_rates(self) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("rates").select("*"))

    def create_rate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("rates").insert(data))[0]

    def update_rate(self, rate_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("rates").update(data).eq("id", rate_id)
        )
        return rows[0] if rows else None

    def list_rules(self) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("rules").select("*"))

    def create_rule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("rules").insert(data))[0]

    def delete_rule(self, rule_id: str) -> bool:
        self._execute(self.client.table("rules").delete().eq("id", rule_id))
        return True

    def list_settings(self) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("settings").select("*"))

    def upsert_settings(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("settings").upsert(data))

    def list_transactions_by_hash(self, hashes: List[str]) -> List[Dict[str, Any]]:
        if not hashes:
            return []
        return self._execute(
            self.client.table("transactions").select("import_hash").in_("import_hash", hashes)
        )

    def insert_transactions_ignore_duplicates(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not rows:
            return []
        return self._execute(
            self.client.table("transactions").upsert(
                rows, on_conflict="import_hash", ignore_duplicates=True
            )
        )

    def list_installments(self) -> List[Dict[str, Any]]:
        return self._execute(self.client.table("installments").select("*").order("purchase_date", desc=True))

    def create_installment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute(self.client.table("installments").insert(data))[0]

    def update_installment(self, installment_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            self.client.table("installments").update(data).eq("id", installment_id)
        )
        return rows[0] if rows else None

    def delete_installment(self, installment_id: str) -> bool:
        self._execute(self.client.table("installments").delete().eq("id", installment_id))
        return True


class InMemoryStore:
    def __init__(self):
        self.transactions: List[Dict[str, Any]] = []
        self.accounts: List[Dict[str, Any]] = []
        self.categories: List[Dict[str, Any]] = []
        self.budgets: List[Dict[str, Any]] = []
        self.rates: List[Dict[str, Any]] = []
        self.rules: List[Dict[str, Any]] = []
        self.settings: List[Dict[str, Any]] = []
        self.installments: List[Dict[str, Any]] = []

    def list_transactions(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = list(self.transactions)
        if filters.get("search"):
            term = filters["search"].lower()
            results = [t for t in results if term in t["description"].lower()]
        if filters.get("category_id"):
            results = [t for t in results if t.get("category_id") == filters["category_id"]]
        if filters.get("account_id"):
            results = [t for t in results if t.get("account_id") == filters["account_id"]]
        if filters.get("type"):
            results = [t for t in results if t.get("type") == filters["type"]]
        if filters.get("currency"):
            results = [t for t in results if t.get("currency") == filters["currency"]]
        if filters.get("min_amount") is not None:
            results = [t for t in results if t.get("amount", 0) >= filters["min_amount"]]
        if filters.get("max_amount") is not None:
            results = [t for t in results if t.get("amount", 0) <= filters["max_amount"]]
        if filters.get("start_date"):
            results = [t for t in results if t.get("date") >= filters["start_date"]]
        if filters.get("end_date"):
            results = [t for t in results if t.get("date") <= filters["end_date"]]
        return sorted(results, key=lambda t: t.get("date", ""), reverse=True)

    def create_transaction(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"txn-{int(datetime.now().timestamp() * 1000)}"
        self.transactions.append(data)
        return data

    def update_transaction(self, transaction_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for idx, txn in enumerate(self.transactions):
            if txn.get("id") == transaction_id:
                updated = {**txn, **data}
                self.transactions[idx] = updated
                return updated
        return None

    def delete_transaction(self, transaction_id: str) -> bool:
        self.transactions = [t for t in self.transactions if t.get("id") != transaction_id]
        return True

    def bulk_update_transactions(self, ids: List[str], data: Dict[str, Any]) -> List[Dict[str, Any]]:
        updated = []
        for idx, txn in enumerate(self.transactions):
            if txn.get("id") in ids:
                merged = {**txn, **data}
                self.transactions[idx] = merged
                updated.append(merged)
        return updated

    def list_accounts(self) -> List[Dict[str, Any]]:
        return list(self.accounts)

    def create_account(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"acc-{int(datetime.now().timestamp() * 1000)}"
        self.accounts.append(data)
        return data

    def update_account(self, account_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for idx, acc in enumerate(self.accounts):
            if acc.get("id") == account_id:
                updated = {**acc, **data}
                self.accounts[idx] = updated
                return updated
        return None

    def list_categories(self) -> List[Dict[str, Any]]:
        return list(self.categories)

    def create_category(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"cat-{int(datetime.now().timestamp() * 1000)}"
        self.categories.append(data)
        return data

    def update_category(self, category_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for idx, cat in enumerate(self.categories):
            if cat.get("id") == category_id:
                updated = {**cat, **data}
                self.categories[idx] = updated
                return updated
        return None

    def delete_category(self, category_id: str) -> bool:
        self.categories = [c for c in self.categories if c.get("id") != category_id]
        return True

    def list_budgets(self, month: Optional[str] = None) -> List[Dict[str, Any]]:
        if month:
            return [b for b in self.budgets if b.get("month") == month]
        return list(self.budgets)

    def create_budget(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"bud-{int(datetime.now().timestamp() * 1000)}"
        self.budgets.append(data)
        return data

    def update_budget(self, budget_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for idx, bud in enumerate(self.budgets):
            if bud.get("id") == budget_id:
                updated = {**bud, **data}
                self.budgets[idx] = updated
                return updated
        return None

    def list_rates(self) -> List[Dict[str, Any]]:
        return list(self.rates)

    def create_rate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"rate-{int(datetime.now().timestamp() * 1000)}"
        self.rates.append(data)
        return data

    def update_rate(self, rate_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for idx, rate in enumerate(self.rates):
            if rate.get("id") == rate_id:
                updated = {**rate, **data}
                self.rates[idx] = updated
                return updated
        return None

    def list_rules(self) -> List[Dict[str, Any]]:
        return list(self.rules)

    def create_rule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"rule-{int(datetime.now().timestamp() * 1000)}"
        self.rules.append(data)
        return data

    def delete_rule(self, rule_id: str) -> bool:
        self.rules = [r for r in self.rules if r.get("id") != rule_id]
        return True

    def list_settings(self) -> List[Dict[str, Any]]:
        return list(self.settings)

    def upsert_settings(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        settings_map = {s.get("key"): s for s in self.settings if s.get("key")}
        for item in data:
            key = item.get("key")
            if not key:
                continue
            settings_map[key] = item
        self.settings = list(settings_map.values())
        return self.settings

    def list_transactions_by_hash(self, hashes: List[str]) -> List[Dict[str, Any]]:
        return [t for t in self.transactions if t.get("import_hash") in hashes]

    def insert_transactions_ignore_duplicates(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        existing = {t.get("import_hash") for t in self.transactions if t.get("import_hash")}
        inserted = []
        for row in rows:
            if row.get("import_hash") in existing:
                continue
            self.transactions.append(row)
            inserted.append(row)
        return inserted

    def list_installments(self) -> List[Dict[str, Any]]:
        return sorted(self.installments, key=lambda i: i.get("purchase_date", ""), reverse=True)

    def create_installment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        data["id"] = data.get("id") or f"inst-{int(datetime.now().timestamp() * 1000)}"
        self.installments.append(data)
        return data

    def update_installment(self, installment_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for idx, inst in enumerate(self.installments):
            if inst.get("id") == installment_id:
                updated = {**inst, **data}
                self.installments[idx] = updated
                return updated
        return None

    def delete_installment(self, installment_id: str) -> bool:
        self.installments = [i for i in self.installments if i.get("id") != installment_id]
        return True


def get_store():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or os.getenv("SUPABASE_ANON_KEY", "").strip()
    supabase_store = SupabaseStore(url, key)
    if supabase_store.is_ready():
        return supabase_store
    return InMemoryStore()
