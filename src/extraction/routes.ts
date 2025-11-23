/**
 * Simplified API routes for LLM-only extraction
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { startExtraction, getResult, getProgress } from './orchestrator'
import { loadJob, listJobs, deleteJob } from './storage'
import { loadMasterTable, clearMasterTable, getMasterTableStats } from './masterTable'
import { startEnhancement, getEnhancementStatus, getAllEnhancementJobs } from '../enhancement/orchestrator'
import ExcelJS from 'exceljs'
import { Parser } from 'json2csv'

/**
 * Register extraction routes
 */
export async function registerExtractionRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), mode: 'llm-only' }
  })

  // Extract references from PDF
  fastify.post('/extract', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data: any = await request.file()
      
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' })
      }

      const buffer = await data.toBuffer()
      
      console.log(`[API] Received PDF upload: ${data.filename} (${buffer.length} bytes)`)

      const jobId = await startExtraction({ pdfBuffer: buffer })

      return reply.send({ jobId })
    } catch (error) {
      console.error('[API] Upload failed:', error)
      return reply.code(500).send({
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Get extraction status
  fastify.get('/status/:jobId', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params

    const job = await loadJob(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    const progress = getProgress(jobId)

    return reply.send({
      jobId,
      status: job.status,
      progress: job.progress,
      totalReferences: job.totalReferences,
      extractedCount: job.extractedReferences.length,
      currentStep: progress?.currentStep || 'unknown',
      error: job.error,
    })
  })

  // Get extraction results
  fastify.get('/results/:jobId', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params

    const job = await loadJob(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    return reply.send(job)
  })

  // Download CSV
  fastify.get('/download/:jobId.csv', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params

    const job = await loadJob(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    if (job.status !== 'completed') {
      return reply.code(400).send({ error: 'Job not completed yet' })
    }

    // Convert to CSV format
    const fields = [
      { label: 'Citation Key', value: 'citationKey' },
      { label: 'Authors', value: (row: any) => row.authors.join('; ') },
      { label: 'Title', value: 'title' },
      { label: 'Year', value: 'year' },
      { label: 'Publisher / Journal', value: 'publisherJournal' },
      { label: 'Volume / Issue', value: 'volumeIssue' },
      { label: 'Pages', value: 'pages' },
      { label: 'Extra Notes', value: 'extraNotes' },
      { label: 'ISBN', value: 'isbn' },
      { label: 'Confidence', value: 'confidence' },
    ]

    const parser = new Parser({ fields })
    const csv = parser.parse(job.extractedReferences)

    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', `attachment; filename="references-${jobId}.csv"`)
    return reply.send(csv)
  })

  // Download Excel
  fastify.get('/download/:jobId.xlsx', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params

    const job = await loadJob(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    if (job.status !== 'completed') {
      return reply.code(400).send({ error: 'Job not completed yet' })
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('References')

    // Add headers
    worksheet.columns = [
      { header: 'Citation Key', key: 'citationKey', width: 15 },
      { header: 'Authors', key: 'authors', width: 30 },
      { header: 'Title', key: 'title', width: 50 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Publisher / Journal', key: 'publisherJournal', width: 30 },
      { header: 'Volume / Issue', key: 'volumeIssue', width: 15 },
      { header: 'Pages', key: 'pages', width: 15 },
      { header: 'Extra Notes', key: 'extraNotes', width: 40 },
      { header: 'ISBN', key: 'isbn', width: 20 },
      { header: 'Confidence', key: 'confidence', width: 12 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // Add data
    job.extractedReferences.forEach(ref => {
      const authors = ref.otherAuthors 
        ? `${ref.firstAuthor}; ${ref.otherAuthors}` 
        : ref.firstAuthor
      worksheet.addRow({
        citationKey: ref.citationKey,
        authors: authors,
        title: ref.title,
        year: ref.year,
        publisherJournal: ref.publisherJournal,
        volumeIssue: ref.volumeIssue,
        pages: ref.pages,
        extraNotes: ref.extraNotes,
        isbn: ref.isbn,
        confidence: ref.confidence,
      })
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', `attachment; filename="references-${jobId}.xlsx"`)
    return reply.send(buffer)
  })

  // List all jobs
  fastify.get('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const jobIds = await listJobs()
    
    const jobs = await Promise.all(
      jobIds.map(async id => {
        const job = await loadJob(id)
        return job ? {
          jobId: job.jobId,
          status: job.status,
          totalReferences: job.totalReferences,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        } : null
      })
    )

    return reply.send(jobs.filter(j => j !== null))
  })

  // Delete a job
  fastify.delete('/jobs/:jobId', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params

    try {
      await deleteJob(jobId)
      return reply.send({ message: 'Job deleted' })
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to delete job' })
    }
  })

  // ===========================================
  // MASTER TABLE ROUTES (Persistent Storage)
  // ===========================================

  // Get master references table
  fastify.get('/master', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const references = await loadMasterTable()
      return reply.send({
        total: references.length,
        references,
      })
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to load master table' })
    }
  })

  // Get master table statistics
  fastify.get('/master/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getMasterTableStats()
      return reply.send(stats)
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to load stats' })
    }
  })

  // Download master table as CSV
  fastify.get('/master/download/csv', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const references = await loadMasterTable()
      
      if (references.length === 0) {
        return reply.code(404).send({ error: 'Master table is empty' })
      }

      const fields = [
        { label: 'Citation Key', value: 'citationKey' },
        { label: 'First Author', value: 'firstAuthor' },
        { label: 'Other Authors', value: 'otherAuthors' },
        { label: 'Affiliation', value: 'firstAuthorAffiliation' },
        { label: 'Title', value: 'title' },
        { label: 'Year', value: 'year' },
        { label: 'Publisher / Journal', value: 'publisherJournal' },
        { label: 'Volume / Issue', value: 'volumeIssue' },
        { label: 'Pages', value: 'pages' },
        { label: 'Extra Notes', value: 'extraNotes' },
        { label: 'ISBN', value: 'isbn' },
      ]

      const parser = new Parser({ fields })
      const csv = parser.parse(references)

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="references-master.csv"')
      return reply.send(csv)
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to export CSV' })
    }
  })

  // Download master table as Excel
  fastify.get('/master/download/excel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const references = await loadMasterTable()
      
      if (references.length === 0) {
        return reply.code(404).send({ error: 'Master table is empty' })
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('References')

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

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      const buffer = await workbook.xlsx.writeBuffer()

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', 'attachment; filename="references-master.xlsx"')
      return reply.send(buffer)
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to export Excel' })
    }
  })

  // Clear master table (for testing/reset)
  fastify.delete('/master', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await clearMasterTable()
      return reply.send({ message: 'Master table cleared' })
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to clear master table' })
    }
  })

  // ===========================================
  // ENHANCEMENT ROUTES (Phase 2)
  // ===========================================

  // Start enhancement process (find affiliations)
  fastify.post('/enhance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const jobId = startEnhancement()
      return reply.send({ jobId, message: 'Enhancement started' })
    } catch (error) {
      console.error('[API] Enhancement failed:', error)
      return reply.code(500).send({
        error: 'Failed to start enhancement',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Get enhancement status
  fastify.get('/enhance/status/:jobId', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { jobId } = request.params

    const job = getEnhancementStatus(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Enhancement job not found' })
    }

    return reply.send(job)
  })

  // List all enhancement jobs
  fastify.get('/enhance/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const jobs = getAllEnhancementJobs()
    return reply.send(jobs)
  })

  console.log('[Routes] ✅ Extraction routes registered')
}

