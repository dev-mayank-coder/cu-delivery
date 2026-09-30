# Chandigarh University - Delivery Executives Portal 🛵

A dedicated, high-performance web dashboard exclusively engineered for delivery executives operating across Chandigarh University hostels. Built with React 19, Tailwind CSS, and direct Supabase Cloud database synchronization.

---

## 🚀 Features

- **Exclusive Delivery Executive Accounts**:
  - `zakir` (Password: `delivery123`): Locked to Zakir Block A, B, C, and D.
  - `nc` (Password: `delivery123`): Locked to Non-AC Hostels 1, 2, 3, and 4 (strictly excludes NC 5–11).
- **Direct Supabase Cloud Integration**:
  - Zero local backend or proxy dependencies.
  - Real-time order synchronization via Supabase PostgreSQL channels.
  - Automatic background fallback polling every 8 seconds.
- **Strict Order Territory Filtering**:
  - Zakir runner only sees Zakir orders (`CU-A-xxxxx`, `CU-B-xxxxx`, `CU-C-xxxxx`, `CU-D-xxxxx`).
  - NC runner only sees NC 1–4 orders (`CU-1-xxxxx`, `CU-2-xxxxx`, `CU-3-xxxxx`, `CU-4-xxxxx`).
- **Delivery Workflow & UX**:
  - Room number highlighted with high-contrast badge.
  - 1-Click WhatsApp customer chat & direct phone dialer.
  - Printable delivery slips with formatted item receipts.
  - One-tap "Mark Delivered" action updating Supabase cloud immediately.
  - Audio chimes for order actions and new incoming order notifications.
  - Fast search, status tabs (All, Active, Delivered), and hostel filter chips.

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
# http://localhost:5175
```

---

## 🌐 Deploy to Vercel / Netlify

This repository is ready for one-click deployment:

### Deploy on Vercel:
1. Push this repository to GitHub or run `vercel` in this directory.
2. In Project Settings > Environment Variables, add:
   - `VITE_SUPABASE_URL`: `https://mydctdkrfiwsmfouqkqj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZGN0ZGtyZml3c21mb3Vxa3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDIwNjQsImV4cCI6MjEwNTQ3ODA2NH0.Ti5_gfbs-bYJJRl_u3MLNwXaWkOMyB83liVAQiK0RLI`
3. Build Command: `npm run build`
4. Output Directory: `dist`

### SPA Routing:
- `vercel.json` and `public/_redirects` are already configured for single-page routing fallback.

---

## 🔐 Accounts

| Executive | Username | Password | Assigned Hostels | Order ID Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Zakir Executive** | `zakir_manager25` | `anshu83hope` | Zakir A, B, C, D | `CU-A-*`, `CU-B-*`, `CU-C-*`, `CU-D-*` |
| **NC Executive** | `NC_manager14` | `karan27light` | NC 1, 2, 3, 4 | `CU-1-*`, `CU-2-*`, `CU-3-*`, `CU-4-*` |
