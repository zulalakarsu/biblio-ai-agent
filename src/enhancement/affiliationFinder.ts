/**
 * Multi-Source Affiliation Finder
 * 
 * 3-Tier Hybrid System:
 * 1. Semantic Scholar API (fast, structured, free)
 * 2. Perplexity AI (smart, flexible, paid)
 * 3. OpenAlex API (fallback, free)
 * 
 * Expected accuracy: 85-90%
 * Cost: ~$0.02 per 50 references
 */

import { info, warn, error as logError } from '../utils/logging'
import config from '../config'

export interface AffiliationResult {
  affiliation: string | null
  confidence: 'high' | 'medium' | 'low'
  source: 'semantic-scholar' | 'perplexity' | 'openalex' | 'none' | 'error' | 'skipped-historical'
}

const SEMANTIC_SCHOLAR_BASE = 'https://api.semanticscholar.org/graph/v1'
const OPENALEX_BASE = 'https://api.openalex.org'
const PERPLEXITY_BASE = 'https://api.perplexity.ai/chat/completions'
const USER_AGENT = 'mailto:reference-extractor@example.com'

/**
 * Find affiliation using 3-tier hybrid approach
 */
export async function findAffiliation(
  authorName: string,
  paperTitle: string,
  year: string
): Promise<AffiliationResult> {
  if (!authorName || !paperTitle) {
    return { affiliation: null, confidence: 'low', source: 'openalex' }
  }

  // Skip historical works (before 1900) - likely historical figures, not modern academics
  const yearNum = parseInt(year)
  if (yearNum && yearNum < 1900) {
    info(`Skipping historical work from ${year} - no modern affiliation expected`)
    return { affiliation: null, confidence: 'low', source: 'skipped-historical' }
  }

  try {
    info(`Finding affiliation for: ${authorName} - ${paperTitle.substring(0, 50)}...`)
    
    // TIER 1: Semantic Scholar (fast, structured)
    info(`[Tier 1] Trying Semantic Scholar...`)
    const semanticResult = await searchSemanticScholar(authorName, paperTitle, year)
    if (semanticResult) {
      info(`✅ [Semantic Scholar] Found: ${semanticResult}`)
      return { affiliation: semanticResult, confidence: 'high', source: 'semantic-scholar' }
    }
    info(`[Tier 1] Semantic Scholar: not found`)
    
    // TIER 2: Perplexity AI (smart, expensive)
    if (config.PERPLEXITY_API_KEY) {
      info(`[Tier 2] Trying Perplexity AI...`)
      const perplexityResult = await searchPerplexity(authorName, paperTitle, year)
      if (perplexityResult) {
        info(`✅ [Perplexity AI] Found: ${perplexityResult}`)
        return { affiliation: perplexityResult, confidence: 'high', source: 'perplexity' }
      }
      info(`[Tier 2] Perplexity AI: not found`)
    } else {
      warn('[Perplexity] API key not configured, skipping tier 2')
    }
    
    // TIER 3: OpenAlex (fallback, broad)
    info(`[Tier 3] Trying OpenAlex...`)
    const openalexResult = await searchOpenAlex(authorName, paperTitle, year)
    if (openalexResult) {
      info(`✅ [OpenAlex] Found: ${openalexResult}`)
      return { affiliation: openalexResult, confidence: 'medium', source: 'openalex' }
    }
    info(`[Tier 3] OpenAlex: not found`)

    warn(`❌ No affiliation found for: ${authorName}`)
    return { affiliation: null, confidence: 'low', source: 'openalex' }
    
  } catch (err) {
    logError(`Error finding affiliation for ${authorName}:`, err)
    return { affiliation: null, confidence: 'low', source: 'openalex' }
  }
}

/**
 * TIER 1: Semantic Scholar API
 * Free, fast, good coverage for academic papers
 * Rate limit: 1 request per second (100 requests per 5 minutes)
 */
async function searchSemanticScholar(
  authorName: string,
  title: string,
  year: string
): Promise<string | null> {
  try {
    const cleanTitle = cleanText(title).substring(0, 200)
    
    // Search for paper by title
    const searchUrl = `${SEMANTIC_SCHOLAR_BASE}/paper/search?query=${encodeURIComponent(cleanTitle)}&limit=5&fields=title,authors,year`
    
    // Add delay to respect rate limits (1 req/sec)
    await delay(1000)
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })
    
    if (!response.ok) {
      warn(`[Semantic Scholar] API error: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    
    if (!data.data || data.data.length === 0) {
      return null
    }
    
    for (const paper of data.data) {
      // Check year match
      if (year && paper.year && Math.abs(parseInt(year) - paper.year) > 1) {
        continue
      }
      
      // Check if author is in paper
      if (paper.authors) {
        for (const author of paper.authors) {
          if (authorsMatch(authorName, author.name || '')) {
            // Found matching paper! Get author details with affiliation
            const affiliation = await getSemanticScholarAuthorAffiliation(author.authorId)
            if (affiliation) {
              return affiliation
            }
          }
        }
      }
    }
    
    return null
  } catch (err) {
    logError('[Semantic Scholar] Error:', err)
    return null
  }
}

/**
 * Get author affiliation from Semantic Scholar author endpoint
 */
async function getSemanticScholarAuthorAffiliation(authorId: string): Promise<string | null> {
  if (!authorId) return null
  
  try {
    const authorUrl = `${SEMANTIC_SCHOLAR_BASE}/author/${authorId}?fields=affiliations,name`
    
    const response = await fetch(authorUrl, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })
    
    if (!response.ok) return null
    
    const author = await response.json()
    
    if (author.affiliations && author.affiliations.length > 0) {
      // Return the most recent affiliation
      return author.affiliations[0]
    }
    
    return null
  } catch (err) {
    return null
  }
}

/**
 * TIER 2: Perplexity AI
 * Smart AI search with web access, great for edge cases
 */
async function searchPerplexity(
  authorName: string,
  title: string,
  year: string
): Promise<string | null> {
  try {
    if (!config.PERPLEXITY_API_KEY) {
      return null
    }
    
    // Construct a precise query for Perplexity
    const query = `Find the institutional affiliation of "${authorName}" in ${year} when publishing "${title}" in ${year}.
Answer format: "Institution Name (Country)" only. Example: "MIT (US)" or "Vienna University of Technology (AT)".
If not found: "Unknown"`
    
    const response = await fetch(PERPLEXITY_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a bibliographic assistant. Respond ONLY with: "Institution Name (Country Code)" format. No explanations, citations, or extra text.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.0,
        max_tokens: 50,
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      warn(`[Perplexity] API error: ${response.status} - ${errorText.substring(0, 200)}`)
      return null
    }
    
    const data = await response.json()
    let answer = data.choices?.[0]?.message?.content?.trim()
    
    if (!answer || answer === 'Unknown' || answer.includes('not found') || answer.includes('cannot')) {
      return null
    }
    
    // Extract institution from verbose answers
    // Pattern: "...was Google Brain (US)" or "...is MIT (US)"
    const wasMatch = answer.match(/\bwas\s+([^.]+\([A-Z]{2}\))/i)
    if (wasMatch) {
      answer = wasMatch[1].trim()
    } else {
      const isMatch = answer.match(/\bis\s+([^.]+\([A-Z]{2}\))/i)
      if (isMatch) {
        answer = isMatch[1].trim()
      }
    }
    
    // Remove citations like [1][2] or [2][8]
    answer = answer.replace(/\[\d+\](\[\d+\])*/g, '').trim()
    
    // Clean up common prefixes
    let affiliation = answer
      .replace(/^(The affiliation is|Answer:|Institution:)/i, '')
      .replace(/\.$/, '')
      .trim()
    
    // Validate format (should have institution name with country code)
    if (affiliation.length > 5 && affiliation.length < 200 && affiliation.match(/\([A-Z]{2}\)/)) {
      return affiliation
    }
    
    return null
  } catch (err) {
    logError('[Perplexity] Error:', err)
    return null
  }
}

/**
 * TIER 3: OpenAlex API (fallback)
 */
async function searchOpenAlex(
  authorName: string,
  title: string,
  year: string
): Promise<string | null> {
  try {
    const cleanTitle = cleanText(title)
    
    // Build search URL
    const searchUrl = new URL(`${OPENALEX_BASE}/works`)
    searchUrl.searchParams.set('search', cleanTitle)
    if (year) {
      searchUrl.searchParams.set('filter', `publication_year:${year}`)
    }
    searchUrl.searchParams.set('per-page', '1')
    
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return null
    }
    
    // Get the first result's author affiliations
    const work = data.results[0]
    return extractAffiliationFromWork(work, authorName)
  } catch (err) {
    return null
  }
}

/**
 * Extract affiliation from OpenAlex work metadata
 */
function extractAffiliationFromWork(work: any, targetAuthor: string): string | null {
  if (!work.authorships || work.authorships.length === 0) {
    return null
  }
  
  const normalizedTarget = normalizeAuthorName(targetAuthor)
  
  for (const authorship of work.authorships) {
    const authorName = authorship.author?.display_name || ''
    
    // Check if this is the target author using smart matching
    if (authorsMatch(targetAuthor, authorName)) {
      if (authorship.institutions && authorship.institutions.length > 0) {
        const institution = authorship.institutions[0]
        const institutionName = institution.display_name
        const country = institution.country_code ? ` (${institution.country_code})` : ''
        return `${institutionName}${country}`
      }
    }
  }
  
  // IMPORTANT: Only return affiliation if author name matched!
  // Don't grab random affiliations from wrong papers
  warn(`[OpenAlex] Author name mismatch: searched for "${targetAuthor}" but work has different authors`)
  return null
}

/**
 * Clean text for search queries
 */
function cleanText(text: string): string {
  return text
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize author name for matching
 */
function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Smart author name matching - handles initials, full names, etc.
 * Returns true if names likely refer to the same person
 */
function authorsMatch(name1: string, name2: string): boolean {
  const n1 = normalizeAuthorName(name1)
  const n2 = normalizeAuthorName(name2)
  
  // Exact match
  if (n1 === n2) return true
  
  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true
  
  // Extract last names (last word)
  const parts1 = n1.split(' ')
  const parts2 = n2.split(' ')
  const lastName1 = parts1[parts1.length - 1]
  const lastName2 = parts2[parts2.length - 1]
  
  // Last names must match
  if (lastName1 !== lastName2) return false
  
  // If last names match, check first initials
  const firstInit1 = parts1[0]?.[0] || ''
  const firstInit2 = parts2[0]?.[0] || ''
  
  // First initials must match (or one is empty)
  if (firstInit1 && firstInit2 && firstInit1 !== firstInit2) {
    return false
  }
  
  // Last name matches + first initial matches (or one has no first name)
  return true
}

/**
 * Rate limiting helper
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
