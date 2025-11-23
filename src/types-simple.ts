/**
 * Simplified types for LLM-only extraction
 */

export interface ExtractedReference {
  citationKey: string        // e.g., "Hill '79", "Wiener '48"
  firstAuthor: string        // First/primary author
  otherAuthors: string       // Other authors (comma-separated or empty)
  title: string
  year: string
  publisherJournal: string   // Publisher or Journal name
  volumeIssue: string        // e.g., "Vol. 1", "13(2)"
  pages: string              // e.g., "p. 44", "197-219"
  extraNotes: string         // Any additional info
  isbn: string               // ISBN if available
  
  // Enhancement fields (Phase 2)
  firstAuthorAffiliation?: string  // Institution/university of first author
  
  // Metadata
  referenceRaw: string       // Original text
  confidence: 'high' | 'medium' | 'low'
  extractionMethod: 'llm'
}

export interface ExtractionJob {
  jobId: string
  status: 'processing' | 'completed' | 'failed'
  progress: number           // 0-100
  totalReferences: number
  extractedReferences: ExtractedReference[]
  error?: string
  createdAt: string
  completedAt?: string
}

export interface ExtractionRequest {
  pdfBuffer?: Buffer
  filePath?: string
  dois?: string[]
}

