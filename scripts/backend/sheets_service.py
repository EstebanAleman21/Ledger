"""
Google Sheets Service for Ledger Finance Tracker

Handles all Google Sheets operations including:
- OAuth authentication
- Reading/writing data
- Schema management
"""

import os
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Import sheet (single input tab)
IMPORT_TABS = {
    'transactions': 'Transactions',
}

# Export sheets (read-only snapshots)
EXPORT_TABS = {
    'export_transactions': 'export_transactions',
    'export_accounts': 'export_accounts',
    'export_categories': 'export_categories',
    'export_budgets': 'export_budgets',
    'export_rates': 'export_rates',
    'export_settings': 'export_settings',
    'export_rules': 'export_rules',
    'export_installments': 'export_installments',
    'export_debt_accounts': 'export_debt_accounts',
    'export_debt_summary': 'export_debt_summary',
}

# Column mappings for import tab (matching schema.sql)
IMPORT_COLUMNS = {
    'transactions': ['date', 'description', 'type', 'amount', 'category', 'account', 'currency'],
}

# Column mappings for export tabs (matching schema.sql)
EXPORT_COLUMNS = {
    'export_transactions': ['id', 'date', 'description', 'amount', 'type', 'category_id',
                            'account_id', 'to_account_id', 'currency', 'converted_amount',
                            'conversion_rate', 'tags', 'notes', 'needs_review', 'import_hash',
                            'source', 'created_at', 'updated_at'],
    'export_accounts': ['id', 'label', 'name', 'type', 'currency', 'balance', 'opening_balance',
                        'credit_limit', 'color', 'icon', 'created_at', 'updated_at'],
    'export_categories': ['id', 'label', 'name', 'icon', 'color', 'parent_id', 'type', 'budget',
                          'created_at', 'updated_at'],
    'export_budgets': ['id', 'category_id', 'month', 'amount', 'rollover', 'rollover_amount',
                       'created_at', 'updated_at'],
    'export_rates': ['id', 'from_currency', 'to_currency', 'rate', 'date', 'source',
                     'created_at', 'updated_at'],
    'export_settings': ['key', 'value'],
    'export_rules': ['id', 'category_id', 'field', 'operator', 'value', 'created_at', 'updated_at'],
    'export_installments': ['id', 'account_id', 'description', 'amount', 'months_total', 'months_remaining',
                            'has_interest', 'interest_amount_per_month', 'purchase_date', 'created_at', 'updated_at'],
    'export_debt_accounts': ['account_id', 'account_name', 'currency', 'balance', 'debt_amount', 'credit_limit',
                             'remaining_credit', 'installment_monthly_expected', 'installment_remaining_balance',
                             'updated_at'],
    'export_debt_summary': ['currency', 'total_credit_debt', 'total_installment_remaining',
                            'total_installment_monthly_expected', 'total_debt_combined', 'updated_at'],
}

class SheetsService:
    """Service for Google Sheets operations"""
    
    def __init__(self):
        self.credentials: Optional[Credentials] = None
        self.spreadsheet_id: Optional[str] = None
        self.service = None
        
    def get_oauth_url(self, client_id: str, client_secret: str, redirect_uri: str) -> str:
        """Generate OAuth URL for Google login"""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=[
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ]
        )
        flow.redirect_uri = redirect_uri
        auth_url, _ = flow.authorization_url(prompt='consent')
        return auth_url
    
    def exchange_code(self, code: str, client_id: str, client_secret: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens"""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=[
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ]
        )
        flow.redirect_uri = redirect_uri
        flow.fetch_token(code=code)
        self.credentials = flow.credentials
        self._init_service()
        
        return {
            'token': self.credentials.token,
            'refresh_token': self.credentials.refresh_token,
            'expiry': self.credentials.expiry.isoformat() if self.credentials.expiry else None
        }
    
    def set_credentials(self, token: str, refresh_token: str, client_id: str, client_secret: str):
        """Set credentials from stored tokens"""
        self.credentials = Credentials(
            token=token,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=client_id,
            client_secret=client_secret,
            scopes=[
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ]
        )
        if self.credentials.expired:
            self.credentials.refresh(Request())
        self._init_service()
    
    def _init_service(self):
        """Initialize the Sheets API service"""
        if self.credentials:
            self.service = build('sheets', 'v4', credentials=self.credentials)
    
    def set_spreadsheet(self, spreadsheet_id: str):
        """Set the active spreadsheet"""
        self.spreadsheet_id = spreadsheet_id
    
    def list_spreadsheets(self) -> List[Dict[str, str]]:
        """List user's spreadsheets"""
        if not self.credentials:
            raise ValueError("Not authenticated")
        
        drive_service = build('drive', 'v3', credentials=self.credentials)
        results = drive_service.files().list(
            q="mimeType='application/vnd.google-apps.spreadsheet'",
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        return [{'id': f['id'], 'name': f['name']} for f in results.get('files', [])]
    
    def create_spreadsheet(self, title: str = "Ledger Finance Tracker") -> str:
        """Create a new spreadsheet with the schema"""
        if not self.service:
            raise ValueError("Not authenticated")
        
        # Create spreadsheet with all tabs
        spreadsheet = {
            'properties': {'title': title},
            'sheets': [
                {'properties': {'title': name}}
                for name in list(IMPORT_TABS.values()) + list(EXPORT_TABS.values())
            ]
        }
        
        result = self.service.spreadsheets().create(body=spreadsheet).execute()
        self.spreadsheet_id = result['spreadsheetId']
        
        # Add headers to each tab
        self._initialize_headers()
        self._apply_import_validations()
        
        return self.spreadsheet_id
    
    def _initialize_headers(self):
        """Add column headers to all tabs"""
        if not self.service or not self.spreadsheet_id:
            return
        
        batch_data = []
        for tab_key, tab_name in IMPORT_TABS.items():
            if tab_key in IMPORT_COLUMNS:
                batch_data.append({
                    'range': f"'{tab_name}'!A1",
                    'values': [IMPORT_COLUMNS[tab_key]]
                })
        for tab_key, tab_name in EXPORT_TABS.items():
            if tab_key in EXPORT_COLUMNS:
                batch_data.append({
                    'range': f"'{tab_name}'!A1",
                    'values': [EXPORT_COLUMNS[tab_key]]
                })
        
        if batch_data:
            self.service.spreadsheets().values().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={'valueInputOption': 'RAW', 'data': batch_data}
            ).execute()

    def _apply_import_validations(self):
        """Apply data validation dropdowns to the import sheet"""
        if not self.service or not self.spreadsheet_id:
            return
        tab_name = IMPORT_TABS['transactions']
        export_categories = EXPORT_TABS['export_categories']
        export_accounts = EXPORT_TABS['export_accounts']

        spreadsheet = self.service.spreadsheets().get(
            spreadsheetId=self.spreadsheet_id
        ).execute()
        sheet_id = None
        for sheet in spreadsheet['sheets']:
            if sheet['properties']['title'] == tab_name:
                sheet_id = sheet['properties']['sheetId']
                break
        if sheet_id is None:
            return

        requests = [
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 2,
                        'endColumnIndex': 3
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_LIST',
                            'values': [{'userEnteredValue': 'income'},
                                       {'userEnteredValue': 'expense'}]
                        },
                        'showCustomUi': True,
                        'strict': True
                    }
                }
            },
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 4,
                        'endColumnIndex': 5
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_RANGE',
                            'values': [{'userEnteredValue': f"'{export_categories}'!B2:B"}]
                        },
                        'showCustomUi': True,
                        'strict': True
                    }
                }
            },
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 5,
                        'endColumnIndex': 6
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_RANGE',
                            'values': [{'userEnteredValue': f"'{export_accounts}'!B2:B"}]
                        },
                        'showCustomUi': True,
                        'strict': True
                    }
                }
            },
            {
                'setDataValidation': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 1,
                        'startColumnIndex': 6,
                        'endColumnIndex': 7
                    },
                    'rule': {
                        'condition': {
                            'type': 'ONE_OF_LIST',
                            'values': [{'userEnteredValue': 'MXN'},
                                       {'userEnteredValue': 'USD'}]
                        },
                        'showCustomUi': True,
                        'strict': True
                    }
                }
            }
        ]

        self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body={'requests': requests}
        ).execute()
    
    def get_spreadsheet_name(self) -> Optional[str]:
        """Get the name of the current spreadsheet"""
        if not self.service or not self.spreadsheet_id:
            return None
        
        result = self.service.spreadsheets().get(
            spreadsheetId=self.spreadsheet_id,
            fields='properties.title'
        ).execute()
        return result['properties']['title']
    
    # ==========================================
    # CRUD Operations
    # ==========================================
    
    def _clear_tab(self, tab_key: str):
        """Clear all data rows from a tab (keeps headers)"""
        if not self.service or not self.spreadsheet_id:
            return
        
        tab_name = IMPORT_TABS.get(tab_key) or EXPORT_TABS.get(tab_key)
        if not tab_name:
            return
        
        # Clear all data except first row (headers)
        self.service.spreadsheets().values().clear(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A2:Z10000"
        ).execute()
    
    def _get_all_rows(self, tab_key: str) -> List[Dict[str, Any]]:
        """Get all rows from a tab as dictionaries"""
        if not self.service or not self.spreadsheet_id:
            return []
        
        tab_name = IMPORT_TABS.get(tab_key)
        columns = IMPORT_COLUMNS.get(tab_key, [])
        
        if not tab_name or not columns:
            return []
        
        result = self.service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A:Z"
        ).execute()
        
        rows = result.get('values', [])
        if len(rows) < 2:  # No data rows
            return []
        
        # Skip header row
        data = []
        for row in rows[1:]:
            item = {}
            for i, col in enumerate(columns):
                value = row[i] if i < len(row) else None
                # Type conversion
                if value == '':
                    value = None
                elif col in ['amount']:
                    try:
                        value = float(value) if value else None
                    except (ValueError, TypeError):
                        value = None
                item[col] = value
            if any(item.values()):
                data.append(item)
        
        return data

    def get_import_rows_with_index(self) -> List[Dict[str, Any]]:
        """Get all import rows with 1-based row indices"""
        if not self.service or not self.spreadsheet_id:
            return []
        tab_name = IMPORT_TABS.get('transactions')
        columns = IMPORT_COLUMNS.get('transactions', [])
        if not tab_name or not columns:
            return []
        result = self.service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A:Z"
        ).execute()
        rows = result.get('values', [])
        if len(rows) < 2:
            return []
        data = []
        for idx, row in enumerate(rows[1:], start=2):
            item = {'row_number': idx}
            for i, col in enumerate(columns):
                value = row[i] if i < len(row) else None
                item[col] = value if value is not None else ''
            if any(v for k, v in item.items() if k != 'row_number'):
                data.append(item)
        return data

    def delete_import_rows(self, row_numbers: List[int]) -> int:
        """Delete specific rows from the import sheet (1-based indices)"""
        if not self.service or not self.spreadsheet_id or not row_numbers:
            return 0
        tab_name = IMPORT_TABS.get('transactions')
        spreadsheet = self.service.spreadsheets().get(
            spreadsheetId=self.spreadsheet_id
        ).execute()
        sheet_id = None
        for sheet in spreadsheet['sheets']:
            if sheet['properties']['title'] == tab_name:
                sheet_id = sheet['properties']['sheetId']
                break
        if sheet_id is None:
            return 0
        requests = []
        for row_number in sorted(set(row_numbers), reverse=True):
            requests.append({
                'deleteDimension': {
                    'range': {
                        'sheetId': sheet_id,
                        'dimension': 'ROWS',
                        'startIndex': row_number - 1,
                        'endIndex': row_number
                    }
                }
            })
        self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body={'requests': requests}
        ).execute()
        return len(requests)
    
    def _append_row(self, tab_key: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Append a row to a tab"""
        if not self.service or not self.spreadsheet_id:
            raise ValueError("Not connected to spreadsheet")
        
        tab_name = IMPORT_TABS.get(tab_key) or EXPORT_TABS.get(tab_key)
        columns = IMPORT_COLUMNS.get(tab_key) or EXPORT_COLUMNS.get(tab_key, [])
        
        if not tab_name:
            raise ValueError(f"Unknown tab: {tab_key}")
        
        # Convert dict to row values
        row = []
        for col in columns:
            value = data.get(col)
            if isinstance(value, list):
                value = ','.join(str(v) for v in value)
            elif isinstance(value, bool):
                value = str(value).lower()
            elif value is None:
                value = ''
            elif hasattr(value, 'value'):  # Handle enums
                value = value.value
            row.append(str(value) if value is not None else '')
        
        self.service.spreadsheets().values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A:A",
            valueInputOption='RAW',
            insertDataOption='INSERT_ROWS',
            body={'values': [row]}
        ).execute()
        
        return data
    
    def _append_rows_batch(self, tab_key: str, data_list: List[Dict[str, Any]]) -> int:
        """Append multiple rows to a tab in a single API call"""
        if not self.service or not self.spreadsheet_id:
            raise ValueError("Not connected to spreadsheet")
        
        if not data_list:
            return 0
        
        tab_name = IMPORT_TABS.get(tab_key) or EXPORT_TABS.get(tab_key)
        columns = IMPORT_COLUMNS.get(tab_key) or EXPORT_COLUMNS.get(tab_key, [])
        
        if not tab_name:
            raise ValueError(f"Unknown tab: {tab_key}")
        
        # Convert all dicts to rows
        rows = []
        for data in data_list:
            row = []
            for col in columns:
                value = data.get(col)
                if isinstance(value, list):
                    value = ','.join(str(v) for v in value)
                elif isinstance(value, bool):
                    value = str(value).lower()
                elif value is None:
                    value = ''
                elif hasattr(value, 'value'):  # Handle enums
                    value = value.value
                row.append(str(value) if value is not None else '')
            rows.append(row)
        
        self.service.spreadsheets().values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A:A",
            valueInputOption='RAW',
            insertDataOption='INSERT_ROWS',
            body={'values': rows}
        ).execute()
        
        return len(rows)
    
    def _update_row(self, tab_key: str, row_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a specific row by ID"""
        if not self.service or not self.spreadsheet_id:
            return None
        
        tab_name = IMPORT_TABS.get(tab_key) or EXPORT_TABS.get(tab_key)
        columns = IMPORT_COLUMNS.get(tab_key) or EXPORT_COLUMNS.get(tab_key, [])
        
        # Find the row number
        result = self.service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A:A"
        ).execute()
        
        rows = result.get('values', [])
        row_num = None
        for i, row in enumerate(rows):
            if row and row[0] == row_id:
                row_num = i + 1  # 1-indexed
                break
        
        if not row_num:
            return None
        
        # Convert dict to row values
        row = []
        for col in columns:
            value = data.get(col)
            if isinstance(value, list):
                value = ','.join(str(v) for v in value)
            elif isinstance(value, bool):
                value = str(value).lower()
            elif value is None:
                value = ''
            row.append(str(value) if value is not None else '')
        
        self.service.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A{row_num}",
            valueInputOption='RAW',
            body={'values': [row]}
        ).execute()
        
        return data
    
    def _delete_row(self, tab_key: str, row_id: str) -> bool:
        """Delete a row by ID"""
        if not self.service or not self.spreadsheet_id:
            return False
        
        tab_name = IMPORT_TABS.get(tab_key) or EXPORT_TABS.get(tab_key)
        
        # Find sheet ID
        spreadsheet = self.service.spreadsheets().get(
            spreadsheetId=self.spreadsheet_id
        ).execute()
        
        sheet_id = None
        for sheet in spreadsheet['sheets']:
            if sheet['properties']['title'] == tab_name:
                sheet_id = sheet['properties']['sheetId']
                break
        
        if sheet_id is None:
            return False
        
        # Find the row number
        result = self.service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{tab_name}'!A:A"
        ).execute()
        
        rows = result.get('values', [])
        row_num = None
        for i, row in enumerate(rows):
            if row and row[0] == row_id:
                row_num = i
                break
        
        if row_num is None:
            return False
        
        # Delete the row
        self.service.spreadsheets().batchUpdate(
            spreadsheetId=self.spreadsheet_id,
            body={
                'requests': [{
                    'deleteDimension': {
                        'range': {
                            'sheetId': sheet_id,
                            'dimension': 'ROWS',
                            'startIndex': row_num,
                            'endIndex': row_num + 1
                        }
                    }
                }]
            }
        ).execute()
        
        return True
    
    def write_export_tab(self, tab_key: str, rows: List[Dict[str, Any]]) -> int:
        """Overwrite an export tab with provided rows"""
        if not self.service or not self.spreadsheet_id:
            raise ValueError("Not connected to spreadsheet")
        if tab_key not in EXPORT_TABS:
            raise ValueError(f"Unknown export tab: {tab_key}")
        self._clear_tab(tab_key)
        if not rows:
            return 0
        return self._append_rows_batch(tab_key, rows)


# Global instance
sheets_service = SheetsService()
