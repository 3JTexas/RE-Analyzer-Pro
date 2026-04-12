# CLAUDE.md — RE-Analyzer-Pro

## Project Overview
Real estate deal analysis tool for underwriting, projections, and comparatives. Helps investors analyze properties, model hold scenarios, and generate professional PDF reports.

Owner: Andrew Schildcrout
GitHub: 3JTexas/RE-Analyzer-Pro

## Tech Stack
- Framework: React 18, Vite 5, React Router 6
- Language: TypeScript
- Styling: Tailwind CSS 3
- Mobile: Capacitor 6 (iOS via Xcode)
- Backend: Supabase (auth + Postgres)
- Maps: Leaflet + react-leaflet v4 (downgraded for React 18 compat)
- Charts: Chart.js + react-chartjs-2
- PDF: @react-pdf/renderer, jsPDF, html2canvas
- Excel: ExcelJS
- Icons: Lucide React
- Deployment: Vercel (web) + TestFlight (iOS via Capacitor)

## Critical Rules

### Code Changes
- Always read the file before editing it
- Make targeted edits only — do not rewrite files
- Never remove existing functionality unless explicitly instructed
- Run `tsc && vite build` to verify after changes (Vercel uses strict TS)

### Git
- Commit with clear messages after changes
- Push so the other machine stays current
- Never commit .env files

### Communication
- Be direct, don't summarize unless asked
- Don't suggest stopping — keep working until the task is done

## Project Structure
```
src/
  App.tsx              — Root component + routing
  main.tsx             — Entry point

  pages/
    DemoPage.tsx       — Demo/showcase
    LoginPage.tsx      — Auth login
    PipelinePage.tsx   — Deal pipeline view
    PropertiesPage.tsx — Property list
    PropertyPage.tsx   — Single property detail + analysis
    ResetPasswordPage.tsx
    ScenarioPage.tsx   — Scenario modeling

  components/
    layout/            — App shell, nav, sidebar
    model/             — Financial model components
    pdf/               — PDF export components
    pipeline/          — Pipeline management UI
    selling/           — Properties I'm Selling section
    loi/               — Letter of Intent components
    ui/                — Shared UI primitives
    OMSetupFlow.tsx    — Offering Memorandum setup wizard
    ProfileModal.tsx   — User profile
    SettingsModal.tsx  — App settings
    TaxRecordImport.tsx — Tax record import

  hooks/
    useAuth.ts         — Supabase auth
    useCustomRoles.ts  — Role-based access
    usePipeline.ts     — Pipeline data + operations
    useScenario.ts     — Scenario modeling state
    useSellingProperties.ts — Selling properties data
    useUserDefaults.ts — User preference persistence

  lib/
    calc.ts            — Financial calculation engine
    excelExport.ts     — Excel export logic
    supabase.ts        — Supabase client
    uiState.ts         — UI state management

  types/
    index.ts           — Core type definitions
    loi.ts             — LOI types
    pipeline.ts        — Pipeline types
    selling.ts         — Selling property types
```

## Key Features
- **Deal Terms:** Property analysis with PSA auto-population, key dates
- **P&L Projections:** 5-year hold analysis, Cap X, annualized per-unit fields
- **1031 Exchange:** Buy-side auto-fill from linked sales
- **Crime Maps:** Crimeometer API + Leaflet visualization
- **PDF Export:** Comparative and Actuals report modes via dropdown
- **Pipeline:** Deal tracking and stage management
- **Properties I'm Selling:** Linked to 1031 exchange analysis

## Development
```bash
npm run dev          # Vite dev server
npm run build        # Production build (tsc + vite)
npm run preview      # Preview production build
npm run cap:sync     # Build + sync to Capacitor
npm run cap:ios      # Build + open in Xcode
```

## Known Constraints
- react-leaflet pinned to v4 for React 18 compatibility (v5 requires React 19)
- Vercel build uses strict TypeScript — fix all TS errors before pushing
- Capacitor iOS builds require Xcode on Mac
