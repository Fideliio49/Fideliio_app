# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a loyalty program mobile app (**Fideliio**) and an API server.

## Projects

### Fideliio — `artifacts/loyalty-app`
React Native (Expo) mobile loyalty program app supporting French, Arabic (RTL), and English.

**Brand colors:** Navy `#1a1a6e` → Terracotta `#C85A17` with Gold accent `#F9A602`

**Architecture:**
- Frontend-only with AsyncStorage (no backend required)
- `context/AppContext.tsx` — user, language, colorTheme, accentColor state
- `context/DataContext.tsx` — customers, merchants, transactions, rewards, redemptions
- `hooks/useColors.ts` — reads colorTheme + accentColor from AppContext; overrides `primary` with accentColor
- `constants/colors.ts` — light + dark palette tokens
- `components/` — shared UI (TransactionRow, PointsBar, RewardCard, etc.)

**Customer side screens:** `app/(customer)/home.tsx`, `merchants.tsx`, `scan.tsx`, `rewards.tsx`, `profile.tsx`
- Home: terracotta→orange→purple gradient header with zellige SVG overlay, gold points, gold progress bar
- Profile: Apparence section (dark mode toggle, 5 accent color swatches) + language picker

**Merchant side screens:** `app/(merchant)/` — separate 5-tab experience

**Theme system:**
- `colorTheme: 'light' | 'dark'` — persisted under `@customer_theme`
- `accentColor: string` — persisted under `@accent_color`; defaults to `#C85A17` (terracotta)
- `ACCENT_COLORS` exported from AppContext — 5 preset swatches (terracotta, majorelleBlue, gold, sageGreen, violet)
- `useColors()` always reflects current theme + accent instantly

### API Server — `artifacts/api-server`
Express 5 API with PostgreSQL + Drizzle ORM.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
