/**
 * OCR detection and processing for scanned PDFs
 */

import pdfParse from 'pdf-parse'
import { createWorker, Worker } from 'tesseract.js'
import { info, warn } from '../utils/logging'

let worker: Worker | null = null

/**
 * Initialize Tesseract worker (reusable)
 */
async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker('eng')
    info('Tesseract OCR worker initialized')
  }
  return worker
}

/**
 * Calculate character density (chars per line)
 */
function charDensity(text: string): number {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return 0
  
  const totalChars = text.replace(/\s/g, '').length
  return totalChars / lines.length
}

/**
 * Normalize text (dehyphenate, clean spaces)
 */
function normalize(text: string): string {
  return text
    .replace(/-\n/g, '')          // dehyphenate line breaks
    .replace(/\s+\n/g, '\n')      // clean trailing spaces before newlines
    .replace(/[^\S\r\n]{2,}/g, ' ') // collapse multiple spaces
    .trim()
}

/**
 * Check if PDF appears to be scanned (low text density)
 */
export function isScannedPDF(text: string, minCharsPerLine: number = 50): boolean {
  const density = charDensity(text)
  return density < minCharsPerLine
}

/**
 * OCR a page from PDF buffer
 */
async function ocrPage(pdfBuffer: Buffer, pageNumber: number): Promise<string> {
  try {
    info(`Running OCR on page ${pageNumber}...`)
    const worker = await getWorker()
    
    // For now, OCR the whole PDF buffer
    // TODO: Extract individual page images for better accuracy
    const { data } = await worker.recognize(pdfBuffer)
    
    info(`OCR completed for page ${pageNumber}: ${data.text.length} chars`)
    return data.text
  } catch (error) {
    warn(`OCR failed for page ${pageNumber}:`, error)
    return ''
  }
}

/**
 * Extract PDF with smart OCR fallback
 * Returns array of pages with text
 */
export async function extractPdfSmart(pdfBuffer: Buffer): Promise<{ page: number; text: string; isOcr: boolean }[]> {
  info('Starting smart PDF extraction...')
  
  // Parse PDF with pdf-parse
  const data = await pdfParse(pdfBuffer)
  const fullText = data.text || ''
  
  // Split by form feed character (page break)
  const pages = fullText.split('\f')
  const results: { page: number; text: string; isOcr: boolean }[] = []
  
  info(`Extracted ${pages.length} pages from PDF`)
  
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i] || ''
    const density = charDensity(pageText)
    
    info(`Page ${i + 1}: density = ${density.toFixed(2)} chars/line`)
    
    // If density is too low, page is likely scanned
    if (density < 15) {
      warn(`Page ${i + 1} appears to be scanned (low text density), running OCR...`)
      const ocrText = await ocrPage(pdfBuffer, i + 1)
      results.push({
        page: i + 1,
        text: normalize(ocrText || pageText),
        isOcr: true,
      })
    } else {
      results.push({
        page: i + 1,
        text: normalize(pageText),
        isOcr: false,
      })
    }
  }
  
  info(`Smart extraction complete: ${results.length} pages (${results.filter(r => r.isOcr).length} OCR'd)`)
  
  return results
}

/**
 * Cleanup Tesseract worker
 */
export async function cleanupOCR(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
    info('Tesseract OCR worker terminated')
  }
}

