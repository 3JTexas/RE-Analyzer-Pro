# RE Analyzer Pro

Multifamily investment underwriting app — broker vs corrected analysis, REP tax strategy, 100% bonus depreciation (OBBBA), 1031 exchange, LOI generation.

Built with: React 18 + TypeScript + Tailwind CSS + Supabase + Vite + Capacitor (iOS)

---

## Deploy in 5 steps

### 1. Clone and install

```bash
git clone https://github.com/3JTexas/RE-Analyzer-Pro.git
cd RE-Analyzer-Pro
npm install
```

### 2. Set up Supabase

1. Go to https://supabase.com — create a new project
2. In your project → **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. Go to **Settings → API** → copy your Project URL and anon key
4. In Supabase → **Authentication → Providers** → make sure Email is enabled
5. (Optional) Turn off email confirmation for personal use: **Auth → Settings → uncheck "Enable email confirmations"**
6. Create a Storage bucket named `property-images` with public access

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173 — create an account and start analyzing deals.

### 5. Deploy to GitHub Pages

1. Push your repo to GitHub
2. Go to your repo → **Settings → Secrets and variables → Actions**
3. Add two secrets:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Go to **Settings → Pages** → set Source to **GitHub Actions**
5. Push to `main` — the action deploys automatically

Your app will be live at `https://YOUR_USERNAME.github.io/RE-Analyzer-Pro`

---

## Features

### 6-Tab Underwriting UI
1. **Broker** — read-only broker as-presented figures, unlock to edit
2. **Flags** — auto-computed age-adjusted benchmarks (tax reassessment, vacancy, insurance, R&M, reserves) + stressed scenario card + county tax PDF import
3. **Inputs** — buyer's underwriting (income with per-unit rent roll, financing, itemized or collapsed expenses, sub-metering toggles, $/unit property management)
4. **P&L** — full income statement, Cash-on-Cash return, bidirectional offer calculator
5. **Tax** — tax strategy inputs, 1031 exchange analysis with apply-excess-to-down, bonus depreciation, 27.5yr SL schedule, 5-year benefit bank, ROE metrics
6. **Compare** — up to 4-column side-by-side scenario comparison with save/load layout

### Exports
- **PDF report** — per-tab export dropdown (Full Report, P&L, Tax, Flags, Broker, Inputs) with preview modal
- **Excel workbook** — 4 sheets with live formulas (Inputs, P&L, Financing, Tax Analysis)
- **LOI generator** — Simple and Buyer-Friendly templates, auto-populated from scenario

### Other
- AI broker PDF extraction via Supabase Edge Function (Claude Sonnet 4)
- County tax assessor PDF import
- Property photo upload
- Drag-to-reorder properties
- User defaults (Settings modal)
- Crexi listing URL
- Password reset flow

---

## iOS App via Capacitor + TestFlight

```bash
npm run cap:ios
# Builds, syncs, and opens Xcode — then Archive → Distribute → TestFlight
```

---

## Multi-tenant ready

The data model is already multi-tenant:
- Every row has a `user_id` enforced by Supabase RLS
- Adding new users requires zero schema changes
