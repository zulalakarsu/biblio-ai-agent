import OpenAI from 'openai'
import config from '../config'
import { info, warn, error } from '../utils/logging'
import { ExtractedReference } from '../types-simple'

const openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null

const BATCH_EXTRACTION_SYSTEM_PROMPT = `You are an expert bibliographic reference parser. Extract COMPLETE information from academic references.
  You will be given a text with references. You will need to extract the information from the text and return it in the format below.

OUTPUT FORMAT (JSON):
{
  "references": [
    {
      "citationKey": "Hill '79",          // Keep EXACT format from PDF (with quotes, no brackets)
      "firstAuthor": "Banu Musa brothers", // First author as STRING
      "otherAuthors": "",                  // Other authors as STRING (empty if none)
      "title": "The book of ingenious devices (Kitab al-hiyal)", // Remove quotes, italics markers
      "year": "1979",
      "publisherJournal": "Springer",
      "volumeIssue": "",
      "pages": "p. 44",
      "extraNotes": "Translated by D. R. Hill; (9th century origin)",
      "isbn": "90-277-0833-9",
      "confidence": "high"
    }
  ]
}

CRITICAL RULES:
1. **Citation Key Format**: Extract EXACTLY as shown in PDF
   - "[Hill '79]" in PDF → "Hill '79" in JSON  
   
2. **Authors as STRINGS**: 
   - firstAuthor: STRING (not array)
   - otherAuthors: STRING with semicolons (not array)
   - Format: "Author1; Author2; Author3" (semicolon-separated)
   - Empty string "" if only one author

3. **Empty values**: Use empty string "" (not "—" or null)

4. Output ONLY valid JSON with "references" array

5. Identify and extract ONLY actual bibliographic references

6. IGNORE page headers, footers, chapter titles, "Chapter 2", "Skip lists:", etc.

7. Skip entries with no meaningful data (no "Unknown" entries)

8. **Confidence**: Your self-assessment
    - "high": All key fields extracted clearly
    - "medium": Missing some fields
    - "low": Ambiguous or poorly formatted

EXAMPLES OF WHAT TO EXTRACT:
✅ "[Bloom '70] B. H. Bloom (1970). Space/time trade-offs in hash coding..."
✅ "Wiener, N. (1948). Time, communication, and the nervous system..."
✅ "S. Schneider; A. Baevski; R. Collobert; M. Auli (2019). wav2vec: Unsupervised pre-training..."

EXAMPLES OF WHAT TO IGNORE:
❌ "Chapter 2"
❌ "Skip lists: a"
❌ "—————— Chapter 2 ——————"
❌ Page headers/footers
❌ Section titles

Return only the JSON array, no other text.`

export async function extractAllReferencesWithLLM(fullText: string): Promise<ExtractedReference[]> {
  if (!openai) {
    error('OpenAI API key not configured - LLM extraction is disabled')
    return []
  }

  info(`Extracting all references from text (${fullText.length} chars)...`)

  try {
    // For texts with many references, chunk into smaller pieces to avoid truncation
    const maxChars = 15000 // ~3.5k tokens input, leaves room for 12k tokens output
    
    if (fullText.length > maxChars) {
      warn(`Text is long (${fullText.length} chars), processing in chunks to avoid truncation...`)
      return await extractInChunks(fullText, maxChars)
    }
    
    let textToProcess = fullText

    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: BATCH_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Extract all bibliographic references from the following text:\n\n${textToProcess}`,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 16000, // Increased to handle more references
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from LLM')
    }

    // Parse the response
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      error('Failed to parse LLM response as JSON:', content.substring(0, 500))
      warn('Attempting to fix truncated JSON...')
      
      // Try to fix truncated JSON by adding closing brackets
      try {
        const fixed = content.trim() + ']}'
        parsed = JSON.parse(fixed)
        warn('Successfully recovered from truncated response')
      } catch (e2) {
        // If still fails, try just getting the array
        try {
          const match = content.match(/\[[\s\S]*\]/)?.[0]
          if (match) {
            parsed = { references: JSON.parse(match) }
            warn('Extracted partial array from response')
          } else {
            throw new Error('Could not recover truncated JSON')
          }
        } catch (e3) {
          throw new Error(`Invalid JSON response from LLM (tried recovery): ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    // Handle both direct array and wrapped object formats
    let referencesArray: any[] = []
    if (Array.isArray(parsed)) {
      referencesArray = parsed
    } else if (parsed.references && Array.isArray(parsed.references)) {
      referencesArray = parsed.references
    } else if (parsed.items && Array.isArray(parsed.items)) {
      referencesArray = parsed.items
    } else {
      error('LLM response is not an array:', parsed)
      throw new Error('LLM did not return an array of references')
    }

    info(`LLM extracted ${referencesArray.length} references`)

    // Map to ExtractedReference format
    const references: ExtractedReference[] = referencesArray.map((ref, index) => ({
      citationKey: ref.citationKey || ref.key || `Ref-${index + 1}`,
      firstAuthor: ref.firstAuthor || ref.first_author || '',
      otherAuthors: ref.otherAuthors || ref.other_authors || '',
      title: ref.title || '',
      year: ref.year || '',
      publisherJournal: ref.publisherJournal || ref.publisher || ref.journal || '',
      volumeIssue: ref.volumeIssue || ref.volume || '',
      pages: ref.pages || '',
      extraNotes: ref.extraNotes || ref.notes || '',
      isbn: ref.isbn || '',
      referenceRaw: ref.referenceRaw || ref.raw || '',
      confidence: 'high',
      extractionMethod: 'llm',
    }))

    // Filter out any invalid references
    const validReferences = references.filter(ref => 
      ref.citationKey && 
      !ref.citationKey.toLowerCase().includes('unknown') &&
      (ref.title || ref.firstAuthor) // Must have at least title or author
    )

    info(`Filtered to ${validReferences.length} valid references`)
    return validReferences

  } catch (err) {
    error(`LLM batch extraction failed: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

/**
 * Extract references in chunks for very long texts
 */
async function extractInChunks(fullText: string, chunkSize: number): Promise<ExtractedReference[]> {
  const chunks: string[] = []
  let currentPos = 0
  
  // Split text into chunks, trying to break at paragraph boundaries
  while (currentPos < fullText.length) {
    let endPos = Math.min(currentPos + chunkSize, fullText.length)
    
    // Try to break at a paragraph boundary (double newline)
    if (endPos < fullText.length) {
      const nextBreak = fullText.indexOf('\n\n', endPos - 500)
      if (nextBreak > endPos - 500 && nextBreak < endPos + 500) {
        endPos = nextBreak
      }
    }
    
    chunks.push(fullText.substring(currentPos, endPos))
    currentPos = endPos
  }
  
  info(`Processing ${chunks.length} chunks...`)
  
  // Extract from each chunk
  const allReferences: ExtractedReference[] = []
  for (let i = 0; i < chunks.length; i++) {
    info(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`)
    const chunkRefs = await extractAllReferencesWithLLM(chunks[i])
    allReferences.push(...chunkRefs)
  }
  
  // Deduplicate across chunks (same citation key or raw text)
  const seen = new Set<string>()
  const unique = allReferences.filter(ref => {
    const key = ref.citationKey.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  
  info(`Extracted ${allReferences.length} total, ${unique.length} unique after deduplication`)
  return unique
}

