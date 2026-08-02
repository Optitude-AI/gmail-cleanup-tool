import { z } from 'zod'

// Common
export const accountIdSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
})

// Gmail
export const gmailScanSchema = accountIdSchema
export const gmailDeleteSchema = z.object({
  accountId: z.string().min(1),
  scanResultIds: z.array(z.string()).optional(),
  allInCategory: z.boolean().optional(),
  category: z.string().optional(),
}).refine(d => d.scanResultIds || d.allInCategory, {
  message: 'Provide scanResultIds or allInCategory',
})
export const gmailCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  userId: z.string().optional(),
})

// Drive
export const driveScanSchema = accountIdSchema
export const driveStatsSchema = accountIdSchema
export const driveDeleteSchema = z.object({
  accountId: z.string().min(1),
  fileIds: z.array(z.string()).min(1, 'At least one file ID required'),
  permanent: z.boolean().optional().default(false),
})
export const driveDownloadSchema = z.object({
  accountId: z.string().min(1),
  fileId: z.string().min(1, 'File ID is required'),
})
export const driveSuggestionsSchema = accountIdSchema

// Photos
export const photosScanSchema = accountIdSchema
export const photosStatsSchema = accountIdSchema
export const photosDownloadSchema = z.object({
  accountId: z.string().min(1),
  photoId: z.string().min(1, 'Photo ID is required'),
  baseUrl: z.string().optional(),
})

// Storage
export const storageUnifiedSchema = accountIdSchema
export const storageForecastSchema = accountIdSchema

// Wizard
export const wizardPlanSchema = z.object({
  accountId: z.string().min(1),
  targetGB: z.number().positive().min(0.1).max(100),
})

// Dedup
export const dedupSchema = accountIdSchema

// AI Score
export const aiScoreSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    service: z.enum(['gmail', 'drive', 'photos']),
    name: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
    senderEmail: z.string().optional(),
    subject: z.string().optional(),
    createdAt: z.string().optional(),
  })).min(1, 'At least one item required'),
})

// Schedules
export const scheduleGetSchema = z.object({
  accountId: z.string().min(1),
}).passthrough() // allow action + other params via query string
export const scheduleActionSchema = z.object({
  action: z.enum(['create', 'toggle', 'delete', 'run']),
  accountId: z.string().min(1),
}).passthrough()

// Reports
export const reportGetSchema = z.object({
  accountId: z.string().min(1),
}).optional()
export const reportCreateSchema = z.object({
  accountId: z.string().min(1),
  data: z.object({
    emailsDeleted: z.number().optional(),
    emailsSizeEstimate: z.number().optional(),
    driveFilesDeleted: z.number().optional(),
    driveSpaceFreed: z.number().optional(),
    photosDeleted: z.number().optional(),
    photoSpaceFreed: z.number().optional(),
  }),
})

// Shared
export const sharedFindSchema = z.object({
  accountId: z.string().min(1),
  daysThreshold: z.number().min(1).optional().default(30),
})

// Backup
export const backupCreateSchema = z.object({
  accountId: z.string().min(1),
  items: z.array(z.object({
    fileId: z.string(),
    fileName: z.string(),
    service: z.enum(['drive', 'photos', 'gmail']),
  })).min(1, 'At least one item required'),
})

// Attachment sync
export const attachmentFindSchema = z.object({
  accountId: z.string().min(1),
  minSizeKB: z.number().min(1).optional().default(1024),
})
export const attachmentSyncSchema = z.object({
  accountId: z.string().min(1),
  attachments: z.array(z.object({
    messageId: z.string(),
    threadId: z.string(),
    attachmentId: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
  })).min(1),
  folderName: z.string().optional().default('Gmail Attachments'),
})

/** Helper: validate request body against a Zod schema. Returns parsed data or error response. */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data?: T; error?: { status: number; message: string } } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return { error: { status: 400, message: result.error.issues[0].message } }
  }
  return { data: result.data }
}
