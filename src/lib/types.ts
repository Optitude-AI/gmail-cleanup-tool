import React from 'react'

// ── Account Type ──
export interface GmailAccount {
  id: string
  email: string
  createdAt: string
}

// ── Gmail Types ──
export interface GmailStats {
  total: number
  subscriptions: number
  promotions: number
  sales: number
  junk: number
  totalEmails: number
  withUnsubscribe: number
}

export interface GmailScanResult {
  id: string
  category: string
  senderEmail: string
  senderName: string
  subject: string | null
  threadId: string
  messageIds: string[]
  emailCount: number
  lastReceived: string | null
  unsubscribeUrl: string | null
  importanceScore: number | null
  scannedAt: string
}

// ── Drive Types ──
export interface DriveStats {
  totalFiles: number
  totalSize: number
  totalSizeFormatted: string
  trashedSize: number
  trashedSizeFormatted: string
  byType: Record<string, { count: number; size: number }>
}

export interface DriveFileItem {
  id: string
  name: string
  mimeType: string
  size: string
  sizeBytes: number
  type: string
  created: string
  modified: string
  trashed: boolean
  webViewLink: string
  sharedWithMe: boolean
  owner?: string
  importanceScore?: number
}

export interface SpaceSuggestion {
  id: string
  type: 'empty_trash' | 'large_files' | 'duplicates' | 'old_files' | 'google_docs_export'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  potentialSavings: number
  potentialSavingsFormatted: string
  itemCount: number
  fileIds?: string[]
  actions?: Array<{ label: string; fileIds: string[] }>
}

// ── Photos Types ──
export interface PhotoStats {
  totalPhotos: number
  totalSize: number
  totalSizeFormatted: string
}

export interface PhotoItem {
  id: string
  filename: string
  mimeType: string
  size: string
  sizeBytes: number
  width: number
  height: number
  baseUrl: string
  creationTime: string
  isFavorite: boolean
  isScreenshot: boolean
}

// ── Unified Storage Types ──
export interface StorageService {
  used: number
  limit: number
  percentUsed: number
  formatted: string
}

export interface UnifiedStorageData {
  gmail: StorageService
  drive: StorageService
  photos: StorageService
  total: StorageService
}

// ── Forecast Types ──
export interface StorageForecast {
  severity: 'low' | 'medium' | 'high' | 'critical'
  daysRemaining: number
  projectedFullDate: string
  weeklyGrowth: number
  weeklyGrowthFormatted: string
  recommendation: string
}

// ── Wizard Types ──
export interface WizardCleanupStep {
  id: string
  service: string
  action: string
  description: string
  spaceFreed: number
  spaceFreedFormatted: string
  itemCount: number
  fileIds?: string[]
  order?: number
  risk?: 'safe' | 'low' | 'medium' | 'high'
  riskExplanation?: string
  filesAffected?: number
  estimatedTime?: string
}

export interface WizardPlan {
  steps: WizardCleanupStep[]
  totalCanBeFreed: number
  totalCanBeFreedFormatted: string
  targetFormatted: string
  confidence: number
  estimatedTime?: string
}

// ── Dedup Types ──
export interface DedupResult {
  hashSignature: string
  fileName: string
  fileSize: number
  services: string[]
  items: Array<{ service: string; id: string; name: string }>
  spaceRecoverable?: number
}

// ── Schedule Types ──
export interface CleanupSchedule {
  id: string
  name: string
  enabled: boolean
  frequency: string
  rules: string
  lastRunAt: string | null
  nextRunAt: string | null
  totalCleaned: number
  totalSaved: number
}

// ── Report Types ──
export interface CleanupReport {
  id: string
  reportType: string
  title: string
  summary: string
  stats: string
  createdAt: string
}

// ── AI Score Types ──
export interface ImportanceScore {
  id: string
  score: number
  level: 'critical' | 'high' | 'medium' | 'low'
  reasons: string[]
}

// ── Attachment Sync Types ──
export interface LargeAttachment {
  messageId: string
  threadId: string
  from: string
  subject: string
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  sizeFormatted: string
}

// ── Shared Files Types ──
export interface SharedFile {
  id: string
  name: string
  mimeType: string
  size: number
  sizeFormatted: string
  owner: string
  ownerEmail?: string
  lastViewedByMeTime: string | null
  webViewLink: string
  lastAccessedDays?: number
}

// ── Tab / UI Constants ──
export const GMAIL_CATEGORIES: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  subscription: { label: 'Subscriptions', color: 'text-blue-800 dark:text-blue-200', bg: 'bg-blue-100 dark:bg-blue-900', border: 'border-blue-200', icon: '📧' },
  promotion: { label: 'Promotions', color: 'text-purple-800 dark:text-purple-200', bg: 'bg-purple-100 dark:bg-purple-900', border: 'border-purple-200', icon: '📢' },
  sales: { label: 'Sales', color: 'text-orange-800 dark:text-orange-200', bg: 'bg-orange-100 dark:bg-orange-900', border: 'border-orange-200', icon: '🛒' },
  junk: { label: 'Junk/Spam', color: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', border: 'border-red-200', icon: '⛔' },
}

export const FILE_ICONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  default: 'file',
}

export const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  low: { bg: 'border-green-200 bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-400', icon: null },
  medium: { bg: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-400', icon: null },
  high: { bg: 'border-orange-200 bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-400', icon: null },
  critical: { bg: 'border-red-200 bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', icon: null },
}

export const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

// ── Convenience Aliases (used by components) ──
export type GmailResult = GmailScanResult
export type DriveFile = DriveFileItem
export type UnifiedStorage = UnifiedStorageData
export type CleanupStep = WizardCleanupStep

/** Get a human-readable file type category from MIME type */
export function getFileType(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('slides')) return 'presentation'
  if (mimeType.includes('image')) return 'image'
  if (mimeType.includes('video')) return 'video'
  if (mimeType.includes('audio')) return 'audio'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive'
  if (mimeType.includes('folder')) return 'folder'
  return 'other'
}
