/**
 * Simplified server for LLM-only extraction
 */

import Fastify from 'fastify'
import fastifyMultipart from '@fastify/multipart'
import cors from '@fastify/cors'
import { registerExtractionRoutes } from './routes'
import { initStorage } from './storage'
import config from '../config'

export async function startSimpleServer() {
  // Initialize storage
  await initStorage()

  // Create Fastify instance
  const fastify = Fastify({
    logger: false,
    bodyLimit: config.MAX_FILE_SIZE,
  })

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  })

  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: config.MAX_FILE_SIZE,
    },
  })

  // Register routes
  await registerExtractionRoutes(fastify)

  // Start server
  try {
    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
    })

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`)
    console.log(`║                                                                ║`)
    console.log(`║   📚 Reference Extraction API (LLM-Only Mode)                 ║`)
    console.log(`║                                                                ║`)
    console.log(`╚════════════════════════════════════════════════════════════════╝`)
    console.log(`\n✅ Server listening on http://${config.HOST}:${config.PORT}`)
    console.log(`\n📡 Endpoints:`)
    console.log(`   POST   /extract              - Upload PDF for extraction`)
    console.log(`   GET    /status/:jobId        - Check job status`)
    console.log(`   GET    /results/:jobId       - Get extraction results`)
    console.log(`   GET    /download/:jobId.csv  - Download CSV`)
    console.log(`   GET    /download/:jobId.xlsx - Download Excel`)
    console.log(`   GET    /jobs                 - List all jobs`)
    console.log(`   DELETE /jobs/:jobId          - Delete a job`)
    console.log(`   GET    /health               - Health check`)
    console.log(`\n🧠 Extraction Method: LLM-Only (GPT-4o-mini)`)
    console.log(`📊 Fields: Citation Key, Authors, Title, Year, Publisher/Journal,`)
    console.log(`           Volume/Issue, Pages, Extra Notes, ISBN`)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

    return fastify
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Start server if run directly
if (require.main === module) {
  startSimpleServer()
}

