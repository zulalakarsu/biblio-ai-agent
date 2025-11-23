/**
 * Master References Table - Persistent storage across sessions
 * 
 * This maintains a single source of truth for all extracted references.
 * - Persists to disk (JSON + CSV)
 * - Deduplicates by citation key or raw text
 * - Supports incremental additions
 * - Can be enhanced in Phase 2 (emails, affiliations, etc.)
 */

import fs from 'fs/promises'
import path from 'path'
import { ExtractedReference } from '../types-simple'
import { info, warn, error as logError } from '../utils/logging'
import ExcelJS from 'exceljs'
import { Parser } from 'json2csv'

const MASTER_TABLE_DIR = path.join(process.cwd(), 'master-references')
const MASTER_TABLE_JSON = path.join(MASTER_TABLE_DIR, 'references.json')
const MASTER_TABLE_CSV = path.join(MASTER_TABLE_DIR, 'references.csv')
const MASTER_TABLE_XLSX = path.join(MASTER_TABLE_DIR, 'references.xlsx')

// Ensure directory exists
async function ensureDir() {
  try {
    await fs.mkdir(MASTER_TABLE_DIR, { recursive: true })
  } catch (err) {
    logError('Failed to create master table directory:', err)
  }
}

/**
 * Load all references from master table
 */
export async function loadMasterTable(): Promise<ExtractedReference[]> {
  await ensureDir()
  
  try {
    const data = await fs.readFile(MASTER_TABLE_JSON, 'utf-8')
    const references = JSON.parse(data) as ExtractedReference[]
    info(`Loaded ${references.length} references from master table`)
    return references
  } catch (err) {
    // File doesn't exist yet, return empty array
    info('Master table not found, starting fresh')
    return []
  }
}

/**
 * Save references to master table (JSON + CSV + Excel)
 */
export async function saveMasterTable(references: ExtractedReference[]): Promise<void> {
  await ensureDir()
  
  try {
    // Save JSON
    await fs.writeFile(MASTER_TABLE_JSON, JSON.stringify(references, null, 2), 'utf-8')
    info(`Saved ${references.length} references to master table (JSON)`)
    
    // Save CSV
    if (references.length > 0) {
      const parser = new Parser({
        fields: [
          'citationKey',
          'firstAuthor',
          'otherAuthors',
          'firstAuthorAffiliation',
          'title',
          'year',
          'publisherJournal',
          'volumeIssue',
          'pages',
          'extraNotes',
          'isbn',
        ],
      })
      const csv = parser.parse(references)
      await fs.writeFile(MASTER_TABLE_CSV, csv, 'utf-8')
      info(`Saved master table (CSV)`)
      
      // Save Excel
      await saveAsExcel(references)
      info(`Saved master table (Excel)`)
    }
  } catch (err) {
    logError('Failed to save master table:', err)
    throw err
  }
}

/**
 * Add new references to master table (with deduplication)
 */
export async function addToMasterTable(newReferences: ExtractedReference[]): Promise<{
  added: number
  duplicates: number
  total: number
}> {
  const existing = await loadMasterTable()
  
  // Build a set of existing reference identifiers for fast lookup
  const existingKeys = new Set<string>()
  const existingRawTexts = new Set<string>()
  
  existing.forEach(ref => {
    if (ref.citationKey) {
      existingKeys.add(ref.citationKey.toLowerCase())
    }
    if (ref.referenceRaw) {
      existingRawTexts.add(normalizeText(ref.referenceRaw))
    }
  })
  
  // Filter out duplicates
  let added = 0
  let duplicates = 0
  
  for (const newRef of newReferences) {
    const isDuplicate = 
      (newRef.citationKey && existingKeys.has(newRef.citationKey.toLowerCase())) ||
      (newRef.referenceRaw && existingRawTexts.has(normalizeText(newRef.referenceRaw)))
    
    if (isDuplicate) {
      duplicates++
      warn(`Skipping duplicate: ${newRef.citationKey || newRef.title}`)
    } else {
      existing.push(newRef)
      added++
      if (newRef.citationKey) {
        existingKeys.add(newRef.citationKey.toLowerCase())
      }
      if (newRef.referenceRaw) {
        existingRawTexts.add(normalizeText(newRef.referenceRaw))
      }
    }
  }
  
  // Save updated table
  await saveMasterTable(existing)
  
  info(`Master table updated: ${added} added, ${duplicates} duplicates skipped, ${existing.length} total`)
  
  return {
    added,
    duplicates,
    total: existing.length,
  }
}

/**
 * Update a specific reference in master table (for Phase 2 enhancement)
 */
export async function updateReference(
  citationKey: string,
  updates: Partial<ExtractedReference>
): Promise<boolean> {
  const references = await loadMasterTable()
  const index = references.findIndex(
    ref => ref.citationKey.toLowerCase() === citationKey.toLowerCase()
  )
  
  if (index === -1) {
    warn(`Reference not found for update: ${citationKey}`)
    return false
  }
  
  // Merge updates
  references[index] = {
    ...references[index],
    ...updates,
  }
  
  await saveMasterTable(references)
  info(`Updated reference: ${citationKey}`)
  return true
}

/**
 * Clear master table (for testing or reset)
 */
export async function clearMasterTable(): Promise<void> {
  await ensureDir()
  await fs.writeFile(MASTER_TABLE_JSON, '[]', 'utf-8')
  info('Master table cleared')
}

/**
 * Get statistics about master table
 */
export async function getMasterTableStats(): Promise<{
  total: number
  withEmails: number
  withAffiliations: number
  needsEnhancement: number
}> {
  const references = await loadMasterTable()
  
  return {
    total: references.length,
    withEmails: references.filter(r => r.extraNotes?.includes('@')).length,
    withAffiliations: references.filter(r => r.extraNotes?.includes('University') || r.extraNotes?.includes('Institute')).length,
    needsEnhancement: references.filter(r => !r.extraNotes || r.extraNotes === '').length,
  }
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

/**
 * Save as Excel file
 */
async function saveAsExcel(references: ExtractedReference[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('References')
  
  // Define columns
  worksheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Citation Key', key: 'citationKey', width: 15 },
    { header: 'First Author', key: 'firstAuthor', width: 20 },
    { header: 'Other Authors', key: 'otherAuthors', width: 30 },
    { header: 'Affiliation', key: 'firstAuthorAffiliation', width: 35 },
    { header: 'Title', key: 'title', width: 50 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Publisher / Journal', key: 'publisherJournal', width: 30 },
    { header: 'Volume / Issue', key: 'volumeIssue', width: 15 },
    { header: 'Pages', key: 'pages', width: 15 },
    { header: 'ISBN', key: 'isbn', width: 15 },
    { header: 'Extra Notes', key: 'extraNotes', width: 40 },
  ]
  
  // Add data
  references.forEach((ref, index) => {
    worksheet.addRow({
      index: index + 1,
      citationKey: ref.citationKey,
      firstAuthor: ref.firstAuthor,
      otherAuthors: ref.otherAuthors,
      firstAuthorAffiliation: ref.firstAuthorAffiliation || '',
      title: ref.title,
      year: ref.year,
      publisherJournal: ref.publisherJournal,
      volumeIssue: ref.volumeIssue,
      pages: ref.pages,
      isbn: ref.isbn,
      extraNotes: ref.extraNotes,
    })
  })
  
  // Style header row
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }
  
  await workbook.xlsx.writeFile(MASTER_TABLE_XLSX)
}

