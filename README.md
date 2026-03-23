# Deal Analyzer

Multifamily investment underwriting app — OM vs physical occupancy, REP tax analysis, 100% bonus depreciation (OBBBA), 1031 exchange.

Built with: React + TypeScript + Tailwind CSS + Supabase + Vite + Capacitor

---

## Deploy in 5 steps

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/RE-Analyzer-Pro.git
cd RE-Analyzer-Pro
npm install
```

### 2. Set up Supabase

1. Go to https://supabase.com → create a new project
2. In your project → **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. Go to **Settings → API** → copy your Project URL and anon key
4. In Supabase → **Authentication → Providers** → make sure Email is enabled
5. (Optional) Turn off email confirmation for personal use: **Auth → Settings → uncheck "Enable email confirmations"**

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_BASE_URL=/
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

**Important:** `VITE_BASE_URL` is set automatically by the GitHub Action to `/RE-Analyzer-Pro/` from your repo name. No action needed on your part.

---

## Add to iPhone (PWA)

1. Open your GitHub Pages URL in Safari on iPhone
2. Tap the **Share** button → **Add to Home Screen**
3. Done — it works like a native app, including offline

---

## iOS App via Capacitor + TestFlight

```bash
# One-time setup
npx cap add ios

# Every time you update
npm run cap:ios
# This builds, syncs, and opens Xcode
```

In Xcode:
1. Select your team (your Apple Developer account)
2. Set Bundle ID to match `capacitor.config.ts` (e.g. `com.yourname.dealanalyzer`)
3. **Product → Archive**
4. **Distribute App → TestFlight**

---

## Project structure

```
src/
  lib/
    calc.ts         ← pure calculation engine (no React, just math)
    supabase.ts     ← Supabase client
  types/
    index.ts        ← TypeScript types for inputs, outputs, DB models
  hooks/
    useAuth.ts      ← auth state
    useScenario.ts  ← property/scenario CRUD
  components/
    model/
      ModelCalculator.tsx  ← main underwriting UI (inputs + 4 tabs)
    pdf/
      PdfReport.tsx        ← @react-pdf/renderer PDF export
    layout/
      AppShell.tsx         ← nav shell
    ui/
      index.tsx            ← shared primitives (inputs, cards, alerts)
  pages/
    LoginPage.tsx
    PropertiesPage.tsx
    PropertyPage.tsx       ← scenarios list for one property
    ScenarioPage.tsx       ← loads and saves a scenario
    DemoPage.tsx           ← no-auth quick model
supabase/
  schema.sql         ← run this once in Supabase SQL editor
.github/workflows/
  deploy.yml         ← auto-deploys to GitHub Pages on push to main
```

---

## Expanding to multi-user (when ready)

The data model is already multi-tenant:
- Every row has a `user_id` enforced by Supabase RLS
- Adding new users requires zero schema changes
- Add Stripe billing and a landing page — nothing else changes

---

## Key defaults (OM as-presented)

All inputs default to the Marcus & Millichap OM figures:
- 8 units, 7 occupied, $1,957/mo avg rent, 4% vacancy
- $1,950,000 price, 6% IR, 67% LTV, 30yr amort
- $20,726 taxes, $1,800/door insurance, 5% prop mgmt
- 37% tax bracket, 20% land, 0% lender fee

To stress-test: adjust taxes to $39,000 (post-FL-reassessment), insurance to $2,500/door, PM to 6.5%, LTV to 80%.
