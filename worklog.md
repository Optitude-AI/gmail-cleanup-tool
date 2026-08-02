# MVC Refactoring Worklog

## Summary

Broke the monolithic 742-line `src/app/page.tsx` into 14 modular components plus a shared types/constants module. The orchestrator `page.tsx` is now 382 lines (down from 742, a 49% reduction), containing only state management and handler functions.

## Files Created

### Shared Modules

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/types.ts` | 225 | All TypeScript interfaces, UI mapping constants (GMAIL_CATEGORIES, FILE_ICONS, SEVERITY_STYLES, RISK_COLORS), and utility functions (formatBytes, getFileType) |
| `src/components/app/types.ts` | 1 | Re-exports types from `@/lib/types` |
| `src/components/app/constants.ts` | 1 | Re-exports UI constants from `@/lib/types` |

### View Components (src/components/app/)

| File | Lines | Extracted From | Description |
|------|-------|---------------|-------------|
| `LoadingSpinner.tsx` | 24 | Lines 93-103 | Animated scan-in-progress indicator |
| `AuthScreen.tsx` | 70 | Lines 288-335 | OAuth connection UI + feature showcase |
| `AppHeader.tsx` | 23 | Lines 339-348 | Sticky top header bar with disconnect |
| `OverviewTab.tsx` | 100 | Lines 370-437 | Storage gauge, forecast, quick actions |
| `GmailTab.tsx` | 96 | Lines 439-482 | Gmail scan, stats, category filter, email list |
| `DriveTab.tsx` | 96 | Lines 484-527 | Drive scan, suggestions, file list with filters |
| `PhotosTab.tsx` | 60 | Lines 529-555 | Photos scan, stats, thumbnail grid |
| `WizardTab.tsx` | 72 | Lines 557-605 | Smart cleanup wizard with plan steps |
| `ToolsTab.tsx` | 126 | Lines 607-694 | Dedup, shared files, AI scoring, schedules |
| `HistoryTab.tsx` | 31 | Lines 696-713 | Cleanup history reports list |
| `DeleteConfirmDialog.tsx` | 39 | Lines 717-727 | Delete confirmation modal |
| `BackupDialog.tsx` | 34 | Lines 729-739 | Backup ZIP download modal |

## Files Modified

| File | Before | After | Change |
|------|--------|-------|--------|
| `src/app/page.tsx` | 742 lines | 382 lines | Removed all JSX/View code; imports 12 sub-components; retains state + handlers + computed values |

## Architecture

```
src/
├── app/page.tsx          ← Thin orchestrator (state + handlers + composition)
├── lib/types.ts          ← Shared types, constants, utilities
└── components/app/
    ├── types.ts           ← Re-exports types
    ├── constants.ts       ← Re-exports constants
    ├── LoadingSpinner.tsx ← Shared loading component
    ├── AuthScreen.tsx     ← Pre-auth view
    ├── AppHeader.tsx      ← App shell header
    ├── OverviewTab.tsx    ← Tab: unified storage
    ├── GmailTab.tsx       ← Tab: Gmail management
    ├── DriveTab.tsx       ← Tab: Drive management
    ├── PhotosTab.tsx      ← Tab: Photos management
    ├── WizardTab.tsx      ← Tab: AI wizard
    ├── ToolsTab.tsx       ← Tab: tools grid
    ├── HistoryTab.tsx     ← Tab: cleanup history
    ├── DeleteConfirmDialog.tsx ← Modal: delete confirm
    └── BackupDialog.tsx   ← Modal: backup confirm
```

## Key Decisions

1. **Types + constants in `@/lib/types`** — Both types and UI mapping constants (GMAIL_CATEGORIES, FILE_ICONS, etc.) live in a single file since they're closely coupled (constants contain JSX elements and need React).
2. **Filtered/computed data passed as props** — `gmailFiltered` and `driveFiltered` are computed in the orchestrator via `useMemo` and passed down, keeping view components purely presentational.
3. **All sub-components are `'use client'`** — They either use hooks (useState, useEffect) or receive interactivity callbacks.
4. **No visual changes** — This is purely structural refactoring; every pixel rendered should be identical.
5. **Lint clean** — Zero errors/warnings after refactoring.

---

## Phase 2: Backend MVC + Red Team Fixes

### Bugs Found & Fixed

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `formatBytes()` duplicated 10 times across lib files | 🔴 High | Centralized in `src/lib/utils.ts`, all 9 other copies removed |
| 2 | Token refresh logic duplicated in scan/delete routes | 🔴 High | Replaced with `getValidTokens(accountId)` from google-auth.ts |
| 3 | `gmail.ts` had duplicate auth functions (SCOPES, getOAuth2Client, getAuthUrl, getTokens, refreshAccessToken) | 🟡 Medium | Removed from gmail.ts, consolidated in google-auth.ts |
| 4 | `callback/route.ts` built OAuth client inline | 🟡 Medium | Extracted `exchangeCodeAndUserInfo()` into google-auth.ts |
| 5 | `storage-unified.ts` called `drive.about.get` twice per request | 🟡 Medium | Fixed with `getDriveQuota()` called once, passed through |
| 6 | Prisma schema had broken `@@index(ashSignature])` | 🔴 High | Fixed to `@@index([hashSignature])` |
| 7 | Unused `User`/`Post` Prisma models | 🟢 Low | Removed |
| 8 | 6 `any` types in page.tsx state declarations | 🟢 Low | Replaced with proper typed interfaces |
| 9 | Unused API stub `src/app/api/route.ts` | 🟢 Low | Removed |
| 10 | GMAIL_CATEGORIES type missing `bg`, `border`, `icon` props | 🟡 Medium | Added missing properties to match component usage |

### Files Modified (Backend)

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Added `formatBytes()`, `extractSenderEmail()`, `extractSenderName()` |
| `src/lib/google-auth.ts` | Added `exchangeCodeAndUserInfo()`, now single source of truth for auth |
| `src/lib/gmail.ts` | Removed 5 duplicate auth functions, imports from google-auth.ts + utils.ts |
| `src/lib/drive.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/photos.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/attachment-sync.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/cleanup-reports.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/cleanup-scheduler.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/shared-with-me.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/smart-wizard.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/storage-forecast.ts` | Removed local `formatBytes`, imports from utils.ts |
| `src/lib/storage-unified.ts` | Removed local `formatBytes`, imports from utils.ts; fixed double API call |
| `src/app/api/gmail/scan/route.ts` | Replaced inline token refresh with `getValidTokens()` (150→124 lines) |
| `src/app/api/gmail/delete/route.ts` | Replaced inline token refresh with `getValidTokens()` (106→81 lines) |
| `src/app/api/gmail/callback/route.ts` | Uses `exchangeCodeAndUserInfo()` from google-auth.ts |
| `prisma/schema.prisma` | Removed User/Post models, fixed broken index annotations |

### MVC Architecture (Final)

```
src/
├── app/                          ← Controllers (API routes)
│   ├── api/gmail/               ← Thin: validate → call service → return JSON
│   ├── api/drive/               ← Thin: validate → call service → return JSON
│   ├── api/photos/              ← Thin: validate → call service → return JSON
│   ├── api/storage/             ← Thin: validate → call service → return JSON
│   ├── api/wizard/              ← Thin
│   ├── api/dedup/               ← Thin
│   ├── api/schedules/           ← Thin
│   ├── api/reports/             ← Thin
│   └── page.tsx                 ← Orchestrator (state + handlers)
│
├── lib/                         ← Models + Services
│   ├── types.ts                 ← Shared interfaces + UI constants
│   ├── utils.ts                 ← formatBytes, cn, extractSender*
│   ├── google-auth.ts           ← Auth (single source of truth)
│   ├── gmail.ts                 ← Gmail service (scan, delete, categorize)
│   ├── drive.ts                 ← Drive service (scan, suggestions, download)
│   ├── photos.ts                ← Photos service
│   ├── ai-scoring.ts            ← AI importance scoring
│   ├── attachment-sync.ts       ← Gmail → Drive sync
│   ├── backup.ts                ← ZIP backup creation
│   ├── cleanup-reports.ts       ← Report generation
│   ├── cleanup-scheduler.ts     ← Scheduled cleanup rules
│   ├── cross-dedup.ts           ← Cross-service dedup
│   ├── shared-with-me.ts        ← Shared file detection
│   ├── smart-wizard.ts          ← Cleanup wizard engine
│   ├── storage-forecast.ts      ← Storage growth projection
│   ├── storage-unified.ts       ← Unified storage aggregation
│   └── db.ts                    ← Prisma client singleton
│
└── components/
    ├── ui/                      ← shadcn/ui primitives (12 used)
    └── app/                     ← Views (12 components)
        ├── AuthScreen.tsx
        ├── AppHeader.tsx
        ├── LoadingSpinner.tsx
        ├── OverviewTab.tsx
        ├── GmailTab.tsx
        ├── DriveTab.tsx
        ├── PhotosTab.tsx
        ├── WizardTab.tsx
        ├── ToolsTab.tsx
        ├── HistoryTab.tsx
        ├── DeleteConfirmDialog.tsx
        └── BackupDialog.tsx
```

---

## Phase 3: Dependency & Component Cleanup

### Removed 45 npm dependencies

Reduced `package.json` dependencies from 70 to 25 by removing all unused packages.

**Removed non-Radix packages (26):**
@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @hookform/resolvers, @mdxeditor/editor, @reactuses/core, @tanstack/react-query, @tanstack/react-table, cmdk, embla-carousel-react, framer-motion, input-otp, next-auth, next-intl, next-themes, react-day-picker, react-hook-form, react-markdown, react-resizable-panels, react-syntax-highlighter, recharts, sharp, sonner, vaul, z-ai-web-dev-sdk, zustand, date-fns-tz

**Removed @radix-ui packages (19):**
@radix-ui/react-accordion, @radix-ui/react-alert-dialog, @radix-ui/react-aspect-ratio, @radix-ui/react-avatar, @radix-ui/react-collapsible, @radix-ui/react-context-menu, @radix-ui/react-dropdown-menu, @radix-ui/react-hover-card, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-popover, @radix-ui/react-radio-group, @radix-ui/react-select, @radix-ui/react-slider, @radix-ui/react-switch, @radix-ui/react-toggle, @radix-ui/react-toggle-group, @radix-ui/react-tooltip

**Remaining dependencies (25):**
@prisma/client, @radix-ui/react-checkbox, @radix-ui/react-dialog, @radix-ui/react-label, @radix-ui/react-progress, @radix-ui/react-scroll-area, @radix-ui/react-separator, @radix-ui/react-slot, @radix-ui/react-tabs, @radix-ui/react-toast, archiver, class-variance-authority, clsx, date-fns, google-auth-library, googleapis, lucide-react, next, prisma, react, react-dom, tailwind-merge, tailwindcss-animate, uuid, zod

### Deleted 34 unused shadcn/ui component files

Kept 14 files in `src/components/ui/` that are actually imported:
- **Directly used by app:** alert.tsx, badge.tsx, button.tsx, card.tsx, checkbox.tsx, dialog.tsx, input.tsx, label.tsx, progress.tsx, scroll-area.tsx, separator.tsx, tabs.tsx
- **Indirectly needed (toast system):** toast.tsx, toaster.tsx

Deleted 34 files:
accordion.tsx, alert-dialog.tsx, aspect-ratio.tsx, avatar.tsx, breadcrumb.tsx, calendar.tsx, carousel.tsx, chart.tsx, collapsible.tsx, command.tsx, context-menu.tsx, drawer.tsx, dropdown-menu.tsx, form.tsx, hover-card.tsx, input-otp.tsx, menubar.tsx, navigation-menu.tsx, pagination.tsx, popover.tsx, radio-group.tsx, resizable.tsx, select.tsx, sheet.tsx, sidebar.tsx, skeleton.tsx, slider.tsx, sonner.tsx, switch.tsx, table.tsx, textarea.tsx, toggle-group.tsx, toggle.tsx, tooltip.tsx

### Verification
- `bun run lint` — 0 errors
- Dev server compiled successfully, `GET /` returned 200 OK

---

## Phase 4: Eliminate All `any` Types

### Summary

Removed every `any` type annotation from the codebase, replacing them with proper TypeScript types. This covered 9 files with 60+ `any` occurrences across component props, function parameters, API error handling, and library interfaces.

### Changes by File

| File | `any` Removed | What Changed |
|------|---------------|-------------|
| `src/lib/types.ts` | 0 (added fields) | Added `order`, `risk`, `riskExplanation`, `filesAffected`, `estimatedTime` to `WizardCleanupStep`; added `estimatedTime` to `WizardPlan`; added `spaceRecoverable?: number` to `DedupResult`; added `ownerEmail?: string` and `lastAccessedDays?: number` to `SharedFile` |
| `src/lib/smart-wizard.ts` | 17 | Created local `GmailMessageSummary` interface; typed `gmailResults` and `photoItems` params; removed `(e: any)` and `(p: any)` annotations (now inferred); changed `p.size` → `p.sizeBytes` for numeric comparisons |
| `src/components/app/ToolsTab.tsx` | 5 | Imported `DedupResult`, `SharedFile`, `CleanupSchedule` from types; typed `dedupResults`, `sharedFiles`, `schedules` props; removed `(s: any)`, `(g: any)`, `(f: any)` annotations; changed `g.services` → `g.services.join(', ')` |
| `src/components/app/HistoryTab.tsx` | 2 | Imported `CleanupReport`; typed `reports` prop; removed `(r: any)` annotation |
| `src/components/app/WizardTab.tsx` | 1 | Imported `WizardPlan`; typed `wizardPlan` prop |
| `src/app/page.tsx` | 3 | Typed `backupItems` state as `Array<{ fileId: string; fileName: string; service: string }>`; typed `startBackup` params with explicit inline type |
| `src/app/api/ai-score/route.ts` | 6 | Created `ScoreableItem` and `ScoredItem` interfaces; replaced `(item as any)`, `(a: any, b: any)`, `(a as any)` casts |
| `src/lib/gmail.ts` | 2 | Created `GmailPayload` and `GmailMimePart` interfaces; typed `extractUnsubscribeLinks(payload)` and `traverseParts(parts)` |
| `src/lib/drive.ts` | 1 | Typed `response` as `{ data: unknown }` instead of `any` |
| `src/app/api/schedules/route.ts` | 5 | Replaced `params as any` with proper inline type casts `{ name?: string; frequency?: string; rules?: string[]; scheduleId?: string; enabled?: boolean }` |
| `src/lib/photos.ts` | 1 | Replaced `(f as any).imageMediaMetadata` with `(f as { imageMediaMetadata?: { width?: number; height?: number } }).imageMediaMetadata` |
| `src/lib/storage-unified.ts` | 4 | Replaced `(data as any).resultSizeEstimate` and `(data as any).storageQuota` with proper typed casts |
| `src/app/api/attachment-sync/sync/route.ts` | 1 | `catch (error: any)` → `catch (error: unknown)` with type narrowing, removed `details: error.message` |
| `src/app/api/attachment-sync/find/route.ts` | 1 | Same pattern as above |
| `src/app/api/shared/find/route.ts` | 1 | Same pattern |
| **26 API route files** | 26+ | All `catch (error: any)` → `catch (error: unknown)`; all `details: error.message` removed (info leak fix) |

### Security Fix: API Error Message Leakage

All 26 API routes were leaking internal error details via `details: error.message` in 500 responses. Changed to:
```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  console.error('Route error:', error);
  return NextResponse.json({ error: 'Generic message' }, { status: 500 });
}
```
Server-side logging preserved via `console.error`; client only sees generic messages.

### Verification
- `bun run lint` — 0 errors, 0 warnings
- `rg ':\s*any\b|as\s+any\b|<any>' src/` — 0 matches (only `any` in comments/strings)

