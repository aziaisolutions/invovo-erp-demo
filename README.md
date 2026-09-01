# Invovo ERP - Enterprise Cloud POS & ERP System

![Invovo ERP Banner](https://via.placeholder.com/1200x400/0f172a/ffffff?text=Smart+Hisab+ERP+%26+POS)

> A modern, multi-tenant SaaS application for managing point-of-sale operations, inventory, customers, suppliers, accounting ledgers, and financial reporting.

## 🌟 Overview & Features

Invovo ERP is built for small to medium-sized retail businesses. It allows owners to operate smoothly both online and offline while providing enterprise-grade analytics and ledger integrity.

*   **Multi-Tenancy:** True multi-tenant architecture with isolated shops. Run a single store or scale to an entire SaaS marketplace.
*   **Dynamic Currency Engine:** Fully configurable default currency formats (`PKR`, `USD`, `EUR`, `AED`, `GBP`, `INR`, `SAR`).
*   **Intelligent POS & Invoices:** Thermal and A4 printing support, partial refunds, discounts, tax application, and auto-inventory deduction.
*   **Inventory Management:** Real-time stock alerts, dynamic profit margin tracking, and batch updates.
*   **Automated Ledgers (Khata):** Automatically syncs customer credit (receivables) and supplier payables with every transaction.
*   **Enterprise Reports:** Drill-down P&L statements, transaction histories, and graphical dashboards.
*   **RLS Security:** Bulletproof PostgreSQL Row-Level Security ensuring staff only see their authorized store data.

---

## 🛠 Tech Stack

*   **Frontend Framework:** React 19 + Vite (High-speed HMR)
*   **Styling:** Tailwind CSS (Utility-first, highly responsive)
*   **Database & Auth:** Supabase (PostgreSQL, GoTrue Auth, Storage)
*   **Icons & Charts:** Lucide React, Recharts
*   **Document Generation:** jsPDF, html2canvas

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (Version 18.0.0 or higher)
*   A [Supabase](https://supabase.com/) Account (Free tier is perfectly fine)

---

## 🚀 5-Minute Quickstart Guide

Follow these simple steps to deploy Invovo ERP locally.

### Step 1: Clone / Unzip & Install Dependencies
Unzip the downloaded package, open your terminal in the root directory, and run:
```bash
npm install
```

### Step 2: Supabase Database Setup
1. Create a new project in your Supabase Dashboard.
2. Go to the **SQL Editor**.
3. Open `supabase_schema.sql` from the root of this repository, copy its contents, and run it in the Supabase SQL Editor. This will instantly create all tables, policies, and triggers.

### Step 3: Configure Environment Variables
1. Rename the `.env.example` file to `.env.local` (or create a new `.env.local` file).
2. Go to your Supabase Dashboard -> **Project Settings** -> **API**.
3. Copy your `Project URL` and `anon public` key and paste them into `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_DEFAULT_CURRENCY=USD
```

### Step 4: (Optional) Demo Data Seeding
If you want to instantly see how the app looks with data:
1. Start the app via `npm run dev` and open it in your browser.
2. Go to the Sign Up page and create an account (e.g., Email: **demo@invovoerp.com**, Password: **demo12345**).
3. Open `supabase_seed.sql` in the Supabase SQL Editor and run it. It will automatically detect your user and inject demo data into your dashboard.

### Step 5: Launch the Application
Start the Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. You're ready to go!

---

## 🌐 Production Deployment Guide

Deploying Invovo ERP to the edge is incredibly easy.

**Vercel / Netlify / Cloudflare Pages:**
1. Push this repository to your GitHub account.
2. Connect your GitHub repository to Vercel/Netlify.
3. Set the **Build Command** to `npm run build` and **Output Directory** to `dist`.
4. **Crucial:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Environment Variables section in the Vercel/Netlify dashboard before deploying.
5. Click **Deploy**.

---

## 📁 Project Structure Breakdown

```text
├── src/
│   ├── assets/       # Static images and icons
│   ├── components/   # Reusable UI components (Modals, Guards, Layout)
│   ├── config/       # App configurations (appConfig.js for currency/branding)
│   ├── contexts/     # React Context APIs (Auth, Offline Sync)
│   ├── hooks/        # Custom React hooks (useRole)
│   ├── lib/          # External service configurations (supabase.js)
│   ├── pages/        # Main application views (Dashboard, Invoices, Settings)
│   └── utils/        # Helper functions (Math, Data formatting)
├── archive_migrations/ # Legacy SQL migrations (Ignored in production)
├── docs/             # Offline HTML Documentation
├── supabase_schema.sql # Core database schema setup
├── supabase_seed.sql   # Optional dummy data generator
└── .env.example        # Environment variable template
```

---

## 📜 License & Support

This software is provided under a commercial license. You are allowed to use it for your business or customize it for your clients. You may not resell the uncompiled source code as your own product.

For support, feature requests, or custom modifications, please consult the `docs/index.html` documentation or contact the developer via the marketplace where you purchased this software.
