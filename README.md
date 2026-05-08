# Sales & Order Management

A simple, friendly web application to manage products, customers, and sales orders for a small or medium business in India. Built with React, Vite, Tailwind CSS, Node.js, Express, and MongoDB.

## What This App Can Do

- **Secure login & registration** — register your business and create accounts for your team. Passwords are hashed with bcrypt; sessions use httpOnly cookies and last 30 days.
- **Dashboard** — see total revenue, total orders, pending orders, outstanding payment, and low-stock count at a glance
- **Products & Inventory** — add, edit, and delete products with full inventory details: name, SKU, category, HSN code, unit of measurement, purchase & selling price, GST rate, stock quantity, and a low-stock alert level. Search by name or SKU, filter by category, and see low-stock items highlighted in amber. The top navigation shows a badge with the number of low-stock items.
- **Customers** — keep a tidy list of customers with phone, address, and GSTIN
- **Sales Orders** — the heart of the app:
  - Searchable customer and product dropdowns (type to filter by name, SKU, phone, or category)
  - Auto-fill price and GST rate from the chosen product
  - Live totals with subtotal, GST split, and grand total updating as you type
  - Save as **Draft** to come back later, or **Save & Confirm** to commit
  - Unique order number in the format `ORD-YYYY-MM-NNNN` generated automatically per business
  - **Status flow:** Draft → Confirmed → Delivered (Cancelled possible from any of those)
  - **Stock automation:** confirming an order reduces stock; cancelling restores it
  - **Indian GST rules:** if customer state matches business state, charges CGST + SGST (half each); if different, charges IGST instead
  - Filterable list (status, customer, date range) and a detail page with full breakdown
- **GST-compliant invoices** — once an order is Confirmed, click **Generate Invoice** to produce an official tax invoice numbered `INV-YYYY-YY-NNNN` based on the Indian financial year (April–March; the counter resets every April 1). The invoice page is print-ready on A4 and includes everything required by Indian GST law: business and customer details with GSTINs, place of supply, item-wise HSN/qty/taxable value, CGST+SGST or IGST breakdown, totals, **amount in words** (with lakh/crore), declaration, and signature space. Click **Download PDF** to save it via the browser's print-to-PDF.
- **Team members** — owners can add Managers and Staff with different permissions
- All amounts are shown in Indian Rupees (₹)

## User Roles

Each business gets three permission levels:

| Role | What they can do |
|------|------------------|
| **Owner** | Full access to everything, including adding/removing team members |
| **Manager** | Manage customers, products, orders, and payments (cannot manage users) |
| **Staff** | Create orders and view customers and products only |

When you register your business, your account is automatically created as the **Owner**. You can then invite Managers and Staff from the **Team** page.

## Folder Structure

```
Workshop-7th MAY/
├── client/        # React + Vite frontend (runs on port 5173)
├── server/        # Node.js + Express backend (runs on port 5000)
└── README.md      # This file
```

## Before You Start (One-Time Setup)

You need three things installed on your computer:

### 1. Node.js (version 18 or newer)

- Go to https://nodejs.org and download the **LTS** version
- Install it like any other program (just keep clicking Next)
- To check it worked, open a terminal and run:
  ```
  node --version
  ```
  You should see something like `v20.10.0`.

### 2. MongoDB (the database)

Pick one of these two options:

**Option A — Install MongoDB on your computer (easiest for beginners):**

- Go to https://www.mongodb.com/try/download/community
- Download and install **MongoDB Community Server**
- After installing, start MongoDB:
  - **Mac:** `brew services start mongodb-community`
  - **Windows:** It runs as a service automatically. If not, search "Services" in the Start Menu, find MongoDB, and click Start.
  - **Linux:** `sudo systemctl start mongod`

**Option B — Use MongoDB Atlas (free cloud database):**

- Sign up at https://www.mongodb.com/cloud/atlas
- Create a free cluster, then copy the connection string
- Open `server/.env` and replace the `MONGODB_URI` value with your cluster's connection string

### 3. A Code Editor (Recommended)

[VS Code](https://code.visualstudio.com/) is a great free choice if you don't have one already.

## Step-by-Step Setup

You will need to run **two terminal windows** — one for the backend, one for the frontend.

### Step 1 — Install Backend Dependencies

Open a terminal, go into the `server` folder, and install:

```
cd server
npm install
```

This downloads all the libraries the backend needs. It only has to be done once (or whenever the dependencies change).

### Step 2 — Install Frontend Dependencies

In the **same** terminal (or a new one), go into the `client` folder and install:

```
cd ../client
npm install
```

### Step 3 — Start the Backend

In one terminal:

```
cd server
npm start
```

You should see:

```
MongoDB connected successfully

Server is running on http://localhost:5000
```

If MongoDB is not running, you will see a clear message explaining what to do. The server will keep running, but database features won't work until MongoDB is started.

### Step 4 — Start the Frontend

Open a **second** terminal window:

```
cd client
npm run dev
```

You should see:

```
VITE v5.x  ready in 500 ms

➜  Local:   http://localhost:5173/
```

### Step 5 — Open the App

Open your browser and visit:

**http://localhost:5173**

That's it! 🎉

## How to Use the App

1. **Register your business** — when you first visit the app, click "Register your business". Fill in your details (name, email, password, business name, phone, **state**, **address**) and optionally your GST number. The state drives the GST split (CGST/SGST vs IGST). The address and GST number are printed on every invoice you generate, so make sure they're accurate. You'll be logged in automatically as the **Owner**.
2. **Add some products** — go to the Products page and add items with full details: name, SKU, category, HSN code (for GST), unit (Pieces / Kilograms / Litres / Boxes / Metres), purchase price, selling price, GST rate (0% / 5% / 12% / 18% / 28%), current stock, and a low-stock alert level. Once you have several products, use the search bar to find items quickly and the category dropdown to narrow the list down.
3. **Add some customers** — go to the Customers page and add at least one customer. Pick their **state** from the dropdown — it determines whether orders for them are intra-state (CGST + SGST) or inter-state (IGST).
4. **Create an order** — click "+ New Order" from the Dashboard or Orders page. Search-and-select a customer; the page tells you whether it'll be CGST + SGST or IGST. Search-and-select products; the price and GST rate fill in automatically. Enter quantities and watch totals update live. Add notes if needed, then either **Save as Draft** (no stock change) or **Save & Confirm** (stock is reduced).
5. **Track orders** — open any order to see the full breakdown. Owners and Managers can:
   - Confirm a Draft (decrements stock)
   - Mark a Confirmed order Delivered
   - Cancel from any state (restores stock if it was previously deducted)
   - Update payment status (Unpaid / Partial / Paid)
   - **Generate the GST invoice** once the order is Confirmed or Delivered (one invoice per order, immutable thereafter)
   - Re-open the invoice and click **Download PDF** any time to save it
6. **Find orders later** — the Orders page lets you filter by status, customer, and date range. Cancelled and Draft orders are excluded from revenue and outstanding payment totals.
6. **Watch for low stock** — products at or below their alert level are highlighted in amber on the Products page, and a badge in the top navigation shows the total number of low-stock items.
7. **(Optional) Invite your team** — Owners can go to the **Team** page to add Managers and Staff. Share the temporary password with them so they can log in.

You'll stay logged in for 30 days, even if you close the browser. Click your name in the top right and choose **Log out** when you're done.

### About product storage

Products are saved in the **browser's local storage** (per business). This means:

- ✅ Products load instantly with no network round-trip
- ✅ Each business sees only its own catalog
- ⚠️ Products are tied to the browser. If you log in from a different computer or browser (or clear your browser data), you'll need to re-enter products there. Customers and orders, by contrast, are stored on the server and follow you across devices.
- ⚠️ Stock changes made by one user on their device are not seen by other users until they re-add or sync the catalog manually.

For a single-device deployment (one shopkeeper using one machine), this works well. For multi-device use, plan to extend the app to sync products to the server.

### How GST is calculated

The app follows Indian GST rules:

1. Each product has its own **GST rate** (0%, 5%, 12%, 18%, or 28%).
2. For each line in an order: `line GST = price × quantity × (rate / 100)`.
3. The order's total GST is the sum of all line GSTs.
4. **Intra-state** sale (customer's state matches business's state): total GST is split equally into **CGST** and **SGST**.
5. **Inter-state** sale (different states): total GST is charged entirely as **IGST**.

The customer's state is captured at order time (snapshotted on the order document), so changing a customer's state later won't retroactively change earlier orders' GST treatment.

### How invoices are numbered

Indian GST law requires sequential invoice numbers per financial year, with the counter reset every April 1.

- **Format:** `INV-<FY-start>-<YY>-NNNN`
- **Indian financial year:** April 1 → March 31. So an invoice raised in May 2025 is in FY 2025–26 → `INV-2025-26-0001`. An invoice raised in March 2026 is still FY 2025–26 → `INV-2025-26-NNNN`. The first invoice on April 1, 2026 → `INV-2026-27-0001`.
- The counter is per-business (each business has its own series).
- An invoice is generated atomically: clicking **Generate Invoice** assigns the next number and snapshots the business name, address, GSTIN, and contact details, plus the customer's name, address, GSTIN, and state, into the invoice document. **Once generated, the invoice is immutable** — even if you change your business or customer details later, the printed invoice still shows what was true at the time it was issued.

### Downloading the invoice as a PDF

The invoice page is sized for A4 and styled for printing. Click **Download PDF** to open your browser's print dialog, then choose **Save as PDF** as the destination. This gives you a real PDF with selectable text (not a screenshot), and matches what you see on screen.

## Common Issues

### "Port 5000 is already in use" (macOS users)

macOS uses port 5000 for AirPlay Receiver by default. Either:
- Turn it off: **System Settings → General → AirDrop & Handoff → AirPlay Receiver → Off**, or
- Change `PORT=5000` to `PORT=5050` in `server/.env`, then update the proxy target in `client/vite.config.js` to `http://localhost:5050`.

### "MongoDB connection failed"

Make sure MongoDB is running (see "Before You Start" above). The backend will print a friendly message with platform-specific instructions.

### The frontend can't talk to the backend

- Make sure both are running (two terminals open)
- The frontend uses Vite's proxy, so requests to `/api/*` are forwarded to the backend automatically — no CORS setup needed during development

## Configuration

The backend reads settings from `server/.env`. A starter file is already included; edit it if needed:

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/sales_order_db
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret-string-in-production
JWT_EXPIRES_IN=30d
```

> **Important:** Before going to production, replace `JWT_SECRET` with a long random string. This is the key used to sign login tokens — anyone who knows it can forge logins. You can generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## API Endpoints (For Developers)

The backend exposes a simple REST API at `http://localhost:5000/api`:

All endpoints below (except `/health`, `/auth/register`, `/auth/login`, `/auth/logout`) require an authenticated session cookie.

| Method | Endpoint                  | Required role         | Purpose                          |
|--------|---------------------------|-----------------------|----------------------------------|
| GET    | `/health`                 | —                     | Server health check              |
| POST   | `/auth/register`          | —                     | Register a new business + Owner  |
| POST   | `/auth/login`             | —                     | Log in                           |
| POST   | `/auth/logout`            | —                     | Log out                          |
| GET    | `/auth/me`                | any                   | Current user info                |
| GET    | `/users`                  | Owner                 | List team members                |
| POST   | `/users`                  | Owner                 | Add a Manager or Staff           |
| DELETE | `/users/:id`              | Owner                 | Remove a team member             |
| GET    | `/products`               | any                   | (Legacy) — products now live in browser localStorage |
| GET    | `/customers`              | any                   | List customers                   |
| POST   | `/customers`              | Owner, Manager        | Create a customer                |
| PUT    | `/customers/:id`          | Owner, Manager        | Update a customer                |
| DELETE | `/customers/:id`          | Owner, Manager        | Delete a customer                |
| GET    | `/orders`                 | any                   | List orders                      |
| GET    | `/orders/summary`         | any                   | Dashboard stats                  |
| GET    | `/orders/:id`             | any                   | Get a single order               |
| POST   | `/orders`                 | any                   | Create a new order (Draft or Confirmed); generates `ORD-YYYY-MM-NNNN`, splits GST into CGST/SGST or IGST |
| PATCH  | `/orders/:id/status`      | Owner, Manager        | Change order status (only allowed transitions) |
| PATCH  | `/orders/:id/payment`     | Owner, Manager        | Update payment status            |
| POST   | `/orders/:id/invoice`     | Owner, Manager        | Generate `INV-YYYY-YY-NNNN` (Indian FY); snapshots business + customer details |
| DELETE | `/orders/:id`             | Owner, Manager        | Delete an order                  |

## Tech Stack

- **Frontend:** React 18, Vite 5, React Router 6, Tailwind CSS 3, Axios
- **Backend:** Node.js, Express 4, Mongoose 8, JSON Web Tokens, bcryptjs, cookie-parser
- **Database:** MongoDB

## Security Notes

- **Passwords** are hashed with bcrypt (12 salt rounds) before being stored. Plain-text passwords are never saved.
- **Sessions** use signed JWTs delivered as `httpOnly` cookies, so JavaScript on the page cannot read them — this protects against most XSS-driven session theft.
- **Cookies** are `sameSite=lax`, which prevents most cross-site request forgery (CSRF) attacks. They are also marked `secure` automatically when `NODE_ENV=production`.
- **Multi-tenant isolation:** every product, customer, and order is tied to a business. Users from one business can never see data from another business — the API filters by `business` on every query.
- **Role enforcement** happens on the server (in middleware) — even if the UI is bypassed, the backend rejects unauthorized actions.
