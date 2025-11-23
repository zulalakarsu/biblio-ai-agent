/**
 * Local storage for extraction results
 * Stores results in JSON files for persistence
 */

import fs from 'fs/promises'
import path from 'path'
import { ExtractionJob } from '../types-simple'

const STORAGE_DIR = path.join(process.cwd(), 'extraction-results')

// Ensure storage directory exists
export async function initStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    console.log(`[Storage] Initialized: ${STORAGE_DIR}`)
  } catch (error) {
    console.error('[Storage] Failed to initialize:', error)
  }
}

/**
 * Save extraction job to disk
 */
export async function saveJob(job: ExtractionJob): Promise<void> {
  const filePath = path.join(STORAGE_DIR, `${job.jobId}.json`)
  
  try {
    await fs.writeFile(filePath, JSON.stringify(job, null, 2), 'utf-8')
    console.log(`[Storage] Saved job ${job.jobId}`)
  } catch (error) {
    console.error(`[Storage] Failed to save job ${job.jobId}:`, error)
    throw error
  }
}

/**
 * Load extraction job from disk
 */
export async function loadJob(jobId: string): Promise<ExtractionJob | null> {
  const filePath = path.join(STORAGE_DIR, `${jobId}.json`)
  
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as ExtractionJob
  } catch (error) {
    console.error(`[Storage] Failed to load job ${jobId}:`, error)
    return null
  }
}

/**
 * List all extraction jobs
 */
export async function listJobs(): Promise<string[]> {
  try {
    const files = await fs.readdir(STORAGE_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort((a, b) => b.localeCompare(a)) // Most recent first
  } catch (error) {
    console.error('[Storage] Failed to list jobs:', error)
    return []
  }
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, `${jobId}.json`)
  
  try {
    await fs.unlink(filePath)
    console.log(`[Storage] Deleted job ${jobId}`)
  } catch (error) {
    console.error(`[Storage] Failed to delete job ${jobId}:`, error)
    throw error
  }
}

/**
 * Get job statistics
 */
export async function getJobStats(jobId: string): Promise<{
  totalReferences: number
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
} | null> {
  const job = await loadJob(jobId)
  if (!job) return null

  const stats = {
    totalReferences: job.extractedReferences.length,
    highConfidence: job.extractedReferences.filter(r => r.confidence === 'high').length,
    mediumConfidence: job.extractedReferences.filter(r => r.confidence === 'medium').length,
    lowConfidence: job.extractedReferences.filter(r => r.confidence === 'low').length,
  }

  return stats
}

