/**
 * Enhancement Orchestrator
 * 
 * Coordinates the enhancement process:
 * 1. Load references from master table
 * 2. Find affiliations for each first author
 * 3. Update master table with results
 * 4. Track progress and status
 */

import { randomUUID } from 'crypto'
import { loadMasterTable, saveMasterTable } from '../extraction/masterTable'
import { findAffiliation, delay } from './affiliationFinder'
import { ExtractedReference } from '../types-simple'
import { info, warn, error as logError } from '../utils/logging'

export interface EnhancementJob {
  jobId: string
  status: 'processing' | 'completed' | 'failed'
  progress: number           // 0-100
  totalReferences: number
  processedReferences: number
  enhancedReferences: number
  error?: string
  createdAt: string
  completedAt?: string
}

// In-memory job tracking
const enhancementJobs = new Map<string, EnhancementJob>()

/**
 * Start enhancement process
 */
export function startEnhancement(): string {
  const jobId = randomUUID()
  
  const job: EnhancementJob = {
    jobId,
    status: 'processing',
    progress: 0,
    totalReferences: 0,
    processedReferences: 0,
    enhancedReferences: 0,
    createdAt: new Date().toISOString(),
  }
  
  enhancementJobs.set(jobId, job)
  
  // Start processing in background
  processEnhancement(jobId).catch(err => {
    logError(`Enhancement job ${jobId} failed:`, err)
    const job = enhancementJobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.error = err.message
      job.completedAt = new Date().toISOString()
    }
  })
  
  return jobId
}

/**
 * Get job status
 */
export function getEnhancementStatus(jobId: string): EnhancementJob | null {
  return enhancementJobs.get(jobId) || null
}

/**
 * Process enhancement job
 */
async function processEnhancement(jobId: string): Promise<void> {
  const job = enhancementJobs.get(jobId)
  if (!job) {
    throw new Error(`Job ${jobId} not found`)
  }
  
  try {
    info(`\n🚀 Starting enhancement job ${jobId}`)
    
    // Load master table
    const references = await loadMasterTable()
    job.totalReferences = references.length
    info(`📚 Loaded ${references.length} references from master table`)
    
    if (references.length === 0) {
      throw new Error('No references found in master table')
    }
    
    // Filter references that need affiliation enhancement
    const needsEnhancement = references.filter(ref => 
      !ref.firstAuthorAffiliation && ref.firstAuthor
    )
    
    info(`🔍 ${needsEnhancement.length} references need affiliation enhancement`)
    
    if (needsEnhancement.length === 0) {
      job.status = 'completed'
      job.progress = 100
      job.completedAt = new Date().toISOString()
      info('✅ No references need enhancement')
      return
    }
    
    // Process each reference
    let enhanced = 0
    for (let i = 0; i < needsEnhancement.length; i++) {
      const ref = needsEnhancement[i]
      
      info(`\n📖 [${i + 1}/${needsEnhancement.length}] Processing: ${ref.citationKey || ref.title?.substring(0, 50)}`)
      
      // Find affiliation
      const result = await findAffiliation(
        ref.firstAuthor,
        ref.title,
        ref.year
      )
      
      // Update reference in master table
      if (result.affiliation) {
        // Find by citation key (primary match)
        const refIndex = references.findIndex(r => 
          r.citationKey && ref.citationKey && r.citationKey === ref.citationKey
        )
        
        if (refIndex !== -1) {
          references[refIndex].firstAuthorAffiliation = result.affiliation
          enhanced++
          info(`✅ Added affiliation: ${result.affiliation}`)
        } else {
          warn(`Could not find reference to update: ${ref.citationKey}`)
        }
      }
      
      // Update progress
      job.processedReferences = i + 1
      job.enhancedReferences = enhanced
      job.progress = Math.round(((i + 1) / needsEnhancement.length) * 100)
      
      // No delay needed here - delays are in API calls themselves
    }
    
    // Save updated master table
    await saveMasterTable(references)
    
    // Mark job as completed
    job.status = 'completed'
    job.progress = 100
    job.completedAt = new Date().toISOString()
    
    info(`\n✅ Enhancement completed: ${enhanced}/${needsEnhancement.length} affiliations found`)
    
  } catch (err) {
    logError(`Enhancement job ${jobId} failed:`, err)
    job.status = 'failed'
    job.error = err instanceof Error ? err.message : 'Unknown error'
    job.completedAt = new Date().toISOString()
    throw err
  }
}

/**
 * Get all enhancement jobs
 */
export function getAllEnhancementJobs(): EnhancementJob[] {
  return Array.from(enhancementJobs.values())
}

