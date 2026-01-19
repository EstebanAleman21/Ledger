# Ledger - Personal Finance Tracker

A clean, modern personal finance tracker that uses Google Sheets as a data source/storage with a Python FastAPI backend.

## Features

- **Dashboard**: Monthly summary cards, spending charts, recent transactions
- **Transactions**: Full CRUD with advanced filtering, bulk actions, CSV/paste import
- **Budgeting**: Monthly budgets by category with rollover support
- **Categories**: Category management with auto-categorization rules
- **Accounts**: Multi-account support (cash, debit, credit, savings, investment)
- **Reports**: Monthly and yearly overviews with comprehensive charts
- **Multi-Currency**: Support for MXN and USD with configurable exchange rates
- **Google Sheets Sync**: Real-time sync with your Google Sheets spreadsheet

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Recharts for data visualization

### Backend
- Python FastAPI
- Pydantic models
- Google Sheets API integration

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Google Cloud Console project with Sheets API enabled

### Frontend Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Backend Setup

```bash
# Navigate to backend directory
cd scripts/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn google-auth google-auth-oauthlib google-api-python-client python-multipart

# Run the server
uvicorn main:app --reload
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google OAuth (for production)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Supabase (source of truth)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs
6. Copy Client ID and Client Secret to your environment variables

## Google Sheets Template

Sheets are used for import/export only. The app expects:

| Tab | Description |
|-----|-------------|
| Transactions | Import-only: new transactions to ingest |
| export_transactions | Read-only snapshot from DB |
| export_accounts | Read-only snapshot from DB |
| export_categories | Read-only snapshot from DB |
| export_budgets | Read-only snapshot from DB |
| export_rates | Read-only snapshot from DB |
| export_settings | Read-only snapshot from DB |
| export_rules | Read-only snapshot from DB |

See `scripts/schema.sql` for detailed column definitions.

## Sheets Import/Export Flow

1. Use `POST /sync/push` to export DB snapshots into the export tabs.
2. Add new rows to the `Transactions` import tab (dropdowns come from export tabs).
3. Use `POST /sync/pull` to import valid rows into Supabase; imported rows are deleted from the sheet.

## Testing Checklist

- Create a new template sheet via `POST /sheets/create-template`.
- Run `POST /sync/push` and confirm export tabs populate.
- Add a transaction row in `Transactions` using dropdowns.
- Run `POST /sync/pull` and verify the row is imported and removed.

## Installments Migration Note

- If you created the `installments` table earlier without `account_id`, update it to include an `account_id` foreign key to `accounts(id)` (see `scripts/supabase_schema.sql`).

## API Endpoints

### Authentication & Sheets
- `POST /auth/google/login` - Initiate Google OAuth
- `POST /auth/google/callback` - Handle OAuth callback
- `GET /sheets/list` - List user's spreadsheets
- `POST /sheets/select` - Select spreadsheet
- `POST /sheets/create-template` - Create new from template

### Transactions
- `GET /transactions` - List transactions (with filters)
- `POST /transactions` - Create transaction
- `PUT /transactions/{id}` - Update transaction
- `DELETE /transactions/{id}` - Delete transaction
- `POST /transactions/bulk` - Bulk update
- `POST /transactions/import/csv` - Import from CSV
- `POST /transactions/import/paste` - Import from paste

### Accounts, Categories, Budgets
- Full CRUD for each resource

### Reports
- `GET /reports/monthly?month=YYYY-MM` - Monthly report
- `GET /reports/yearly?year=YYYY` - Yearly report

## Project Structure

```
├── app/
│   ├── (app)/              # App routes with layout
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── budget/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── reports/
│   │   └── settings/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── layout/             # App shell, sidebar, nav
│   ├── transactions/       # Transaction dialogs
│   └── ui/                 # shadcn components
├── lib/
│   ├── api.ts              # API client
│   ├── mock-data.ts        # Development data
│   ├── types.ts            # TypeScript types
│   └── utils/              # Utility functions
├── scripts/
│   ├── backend/            # FastAPI backend
│   │   └── main.py
│   └── schema.sql          # Sheets schema docs
└── README.md
```

## Development Mode

The frontend includes a mock API layer (`USE_MOCK = true` in `lib/api.ts`) that simulates all backend operations. This allows frontend development without running the Python backend.

To switch to the real backend:
1. Start the FastAPI server
2. Set `USE_MOCK = false` in `lib/api.ts`
3. Configure `NEXT_PUBLIC_API_URL` in your environment

## License

MIT
