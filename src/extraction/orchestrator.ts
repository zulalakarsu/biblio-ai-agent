/**
 * Simplified orchestrator for LLM-only batch extraction
 * Steps: PDF → Extract Text → LLM Extract All → Store
 */

import { randomUUID } from 'crypto'
import { ExtractionJob, ExtractionRequest } from '../types-simple'
import { extractPdfSmart } from '../pipeline/ocr'
import { extractAllReferencesWithLLM } from './llmBatchExtractor'
import { saveJob, loadJob } from './storage'
import { addToMasterTable } from './masterTable'
import { info, error as logError } from '../utils/logging'

// In-memory progress tracking
const jobProgress = new Map<string, {
  status: ExtractionJob['status']
  progress: number
  currentStep: string
}>()

/**
 * Start extraction job - new simplified flow
 */
export async function startExtraction(request: ExtractionRequest): Promise<string> {
  const jobId = randomUUID()
  
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`)
  console.log(`║  🚀 Starting LLM Batch Extraction                            ║`)
  console.log(`║  Job ID: ${jobId}                        ║`)
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`)

  // Initialize job
  const job: ExtractionJob = {
    jobId,
    status: 'processing',
    progress: 0,
    totalReferences: 0,
    extractedReferences: [],
    createdAt: new Date().toISOString(),
  }

  // Save initial state
  await saveJob(job)
  
  // Update progress tracker
  jobProgress.set(jobId, {
    status: 'processing',
    progress: 0,
    currentStep: 'initializing',
  })

  // Run extraction in background
  processExtraction(jobId, request).catch(async (err) => {
    logError(`Extraction failed for job ${jobId}:`, err)
    updateJobProgress(jobId, 'failed', 100, 'error')
    const failedJob = await loadJob(jobId)
    if (failedJob) {
      failedJob.status = 'failed'
      failedJob.error = err instanceof Error ? err.message : String(err)
      failedJob.completedAt = new Date().toISOString()
      await saveJob(failedJob)
    }
  })

  return jobId
}

/**
 * Process extraction in background
 */
async function processExtraction(jobId: string, request: ExtractionRequest): Promise<void> {
  const startTime = Date.now()
  
  try {
    // Step 1: Extract text from PDF
    info(`[${jobId}] Step 1: Extracting text from PDF...`)
    updateJobProgress(jobId, 'processing', 10, 'extracting text from PDF')
    
    if (!request.pdfBuffer) {
      throw new Error('No PDF buffer provided')
    }

    const pages = await extractPdfSmart(request.pdfBuffer)
    const fullText = pages.map(p => p.text).join('\n\n')
    
    info(`[${jobId}] Extracted ${fullText.length} characters from ${pages.length} pages`)
    updateJobProgress(jobId, 'processing', 30, 'text extraction complete')

    // Step 2: LLM extracts all references at once
    info(`[${jobId}] Step 2: LLM extracting all references...`)
    updateJobProgress(jobId, 'processing', 40, 'LLM processing references')
    
    const references = await extractAllReferencesWithLLM(fullText)
    
    if (references.length === 0) {
      throw new Error('No references were extracted from the text')
    }

    info(`[${jobId}] LLM extracted ${references.length} references`)
    updateJobProgress(jobId, 'processing', 90, 'extraction complete')

    // Step 3: Add to master table (with deduplication)
    info(`[${jobId}] Adding to master references table...`)
    const masterStats = await addToMasterTable(references)
    info(`[${jobId}] Master table: ${masterStats.added} new, ${masterStats.duplicates} duplicates, ${masterStats.total} total`)

    // Step 4: Save job results
    const job = await loadJob(jobId)
    if (job) {
      job.totalReferences = masterStats.total
      job.extractedReferences = references
      job.status = 'completed'
      job.progress = 100
      job.completedAt = new Date().toISOString()
      await saveJob(job)
    }

    updateJobProgress(jobId, 'completed', 100, 'done')

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`)
    console.log(`║  ✅ Extraction Complete                                       ║`)
    console.log(`║  Job ID: ${jobId}                        ║`)
    console.log(`║  Extracted: ${references.length.toString().padEnd(46)} ║`)
    console.log(`║  Added to Master: ${masterStats.added.toString().padEnd(40)} ║`)
    console.log(`║  Duplicates: ${masterStats.duplicates.toString().padEnd(44)} ║`)
    console.log(`║  Total in Master: ${masterStats.total.toString().padEnd(40)} ║`)
    console.log(`║  Duration: ${duration}s${' '.repeat(48 - duration.length)} ║`)
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`)

  } catch (err) {
    logError(`[${jobId}] Extraction failed:`, err)
    throw err
  }
}

/**
 * Update job progress
 */
function updateJobProgress(
  jobId: string,
  status: ExtractionJob['status'],
  progress: number,
  step: string
): void {
  jobProgress.set(jobId, { status, progress, currentStep: step })
  info(`[${jobId}] Progress: ${progress}% - ${step}`)
}

/**
 * Get job progress (for polling)
 */
export function getProgress(jobId: string): {
  status: ExtractionJob['status']
  progress: number
  currentStep: string
} | null {
  return jobProgress.get(jobId) || null
}

/**
 * Get job result
 */
export async function getResult(jobId: string): Promise<ExtractionJob | null> {
  return await loadJob(jobId)
}

/**
 * List all jobs
 */
export function listJobs(): ExtractionJob[] {
  // This would load from storage in production
  // For now, just return empty array
  return []
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<boolean> {
  jobProgress.delete(jobId)
  // Would also delete from storage
  return true
}
