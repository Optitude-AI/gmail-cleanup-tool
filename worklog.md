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
