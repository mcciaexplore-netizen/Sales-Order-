# Sales & Order Management

A friendly web application for small and medium businesses in India to manage products, customers, sales orders, and GST-compliant invoices. Currently runs **frontend-only** — all data is stored in the browser's local storage, so the entire app can be deployed as a static site (e.g. on Vercel) with no database or backend to set up.

> **Heads up:** the previous version had an Express + MongoDB backend. It has been temporarily removed so the app can be deployed in one click. When you outgrow local-storage limits (single browser, no multi-device sync, no real auth security), you can wire the backend back in — every page already calls a small `api.js` shim that mirrors the old REST shape, so re-introducing a server is mostly a swap of that file.

## What This App Can Do

- **Secure-ish login & registration** — passwords are hashed with bcrypt (yes, even client-side) and stored in local storage. Multi-user team accounts per business with three roles. Forgot-password flow shows the reset link directly on screen since there's no email backend.
- **Dashboard** — total revenue, today's sales, this month's sales, outstanding payment, draft count, customer count, sales line chart for the last 30 days, and top customers/products.
- **Products & Inventory** — full CRUD with name, SKU, category, HSN code, unit (Pieces/Kilograms/Litres/Boxes/Metres), purchase & selling price, GST rate, stock, and a low-stock alert level. Search, category filter, low-stock highlighting, and a navigation badge with the live low-stock count.
- **Customers** — name, phone, email, billing address, city, state (Indian state dropdown), and GSTIN.
- **Sales Orders** — searchable customer/product pickers, auto-fill price + GST per line, live totals (CGST+SGST or IGST based on state match), Save as Draft or Save & Confirm, status flow (Draft → Confirmed → Delivered, Cancelled from any), payment status (Unpaid / Partial / Paid), unique order numbers `ORD-YYYY-MM-NNNN` per business.
- **GST-compliant invoices** — `INV-YYYY-YY-NNNN` numbering on the Indian financial year (April–March, resets every April 1). A4 print-ready preview with business + customer GSTINs, place of supply, item-wise HSN/qty/taxable value, full CGST+SGST or IGST breakdown, totals, **amount in words** (lakh/crore), declaration, and signature space. Click **Download PDF** to save it via your browser's print-to-PDF.
- **Reports** — sales report and GST report with date-range filtering and CSV export.
- **Payments** — view orders by payment status and update payment state.
- **Settings** — edit business details (name, GSTIN, address, state, contact); seed sample data.
- **Team management (Owner only)** — add Manager and Staff accounts.

## User Roles

| Role | What they can do |
|------|------------------|
| **Owner** | Full access including business settings and team management |
| **Manager** | Manage customers, products, orders, payments, generate invoices |
| **Staff** | Create orders, view customers and products |

## Folder Structure

```
Workshop-7th MAY/
├── client/        # React + Vite frontend (the entire app)
├── vercel.json    # Vercel deployment config
└── README.md
```

## Running Locally

You need **Node.js 18+** installed. Get it from https://nodejs.org if you don't have it.

```bash
cd client
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

That's it. No database, no backend, no environment variables. Your data lives in your browser's local storage — clearing site data wipes everything.

## Deploying to Vercel

The repository is already configured. Connect this repo to Vercel and it will deploy with zero further config.

1. Push the repo to GitHub (already done).
2. On https://vercel.com → **Add New Project** → import the repo.
3. Vercel reads [vercel.json](vercel.json), which:
   - Builds with `cd client && npm install && npm run build`
   - Serves `client/dist`
   - Rewrites all non-asset paths to `/index.html` (needed for client-side routing)
4. Click **Deploy**. Done.

No environment variables needed.

### How invoices are numbered (Indian FY)

- Format: `INV-<FY-start>-<YY>-NNNN`
- The Indian financial year runs **April 1 → March 31**, so May 2025 → `INV-2025-26-0001`, March 2026 → still `INV-2025-26-NNNN`, April 1, 2026 → resets to `INV-2026-27-0001`.
- The counter is per-business (each business has its own series).
- Once an invoice is generated, it's immutable — even if you edit the business or customer afterwards, the invoice still shows what was true at the time it was issued.

### How GST is calculated

Each product has its own GST rate (0% / 5% / 12% / 18% / 28%). For each order line: `line GST = price × quantity × (rate / 100)`. Then:

- **Intra-state** (customer state matches business state): total GST is split 50/50 into **CGST** and **SGST**.
- **Inter-state** (different states): total GST is charged entirely as **IGST**.

The customer's state is captured at order time — changing it later won't retroactively change earlier orders' GST treatment.

## Limitations of frontend-only mode

You should know what you're trading away by storing everything in the browser:

- **Single device, single browser.** Your data lives in *this* browser's storage. Logging in from another device or even another browser starts fresh.
- **No real auth security.** Passwords are bcrypt-hashed but stored client-side, so the protection is only as strong as the user's device. Don't put real customer data here without revisiting the architecture.
- **Storage is finite.** Browsers cap local storage at 5–10 MB per origin, which is plenty for hundreds of orders but not unbounded.
- **Clearing browser data wipes the app.** Same for incognito/private windows.

When any of those become real problems, reintroduce the Express + MongoDB backend (the old `client/src/api.js` would just need to call axios against a real server again).

## Tech Stack

- **React 18**, **Vite 5**, **React Router 6**
- **Tailwind CSS 3**
- **bcryptjs** for password hashing
- Pure client-side data layer — no server, no database

## Common Issues

### Blank page after pulling new code

Hard-refresh the browser (Cmd/Ctrl + Shift + R). Vite's HMR can occasionally leave a stale module loaded.

### "Can't log in after I cleared my browser data"

That's expected — clearing browser storage wipes the app's data. Register a new account.

### Want to wipe the app and start fresh?

Open DevTools → Application → Local Storage → select your origin → **Clear**.
