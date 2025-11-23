/**
 * Configuration for LLM-only extraction
 */

import { config as loadEnv } from 'dotenv'

// Load .env file
loadEnv()

export default {
  // OpenAI (for extraction)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  
  // Perplexity (for enhancement - optional)
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
  
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',
  
  // File limits
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
}
