'use client'

import { useState, useRef, useEffect } from "react"
import { Upload, FileText, Download, Loader2, Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"

type AppState = "idle" | "processing" | "completed" | "enhancing"

interface ExtractedReference {
  citationKey: string
  firstAuthor: string
  otherAuthors: string
  firstAuthorAffiliation?: string  // Phase 2: Enhancement
  title: string
  year: string
  publisherJournal: string
  volumeIssue: string
  pages: string
  extraNotes: string
  isbn: string
  confidence: 'high' | 'medium' | 'low'
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const [results, setResults] = useState<ExtractedReference[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [stats, setStats] = useState<{ added: number; duplicates: number } | null>(null)
  const [enhancementJobId, setEnhancementJobId] = useState<string | null>(null)
  const [enhancementProgress, setEnhancementProgress] = useState(0)
  const [enhancementStats, setEnhancementStats] = useState<{ processed: number; enhanced: number } | null>(null)
  const uploadSectionRef = useRef<HTMLDivElement>(null)

  // Load master table on mount
  useEffect(() => {
    loadMasterTable()
  }, [])

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadMasterTable = async () => {
    try {
      console.log('[FRONTEND] Loading master table...')
      const response = await fetch('/api/master')
      if (response.ok) {
        const data = await response.json()
        setResults(data.references || [])
        if (data.references && data.references.length > 0) {
          setAppState("completed")
          console.log(`[FRONTEND] Loaded ${data.references.length} references from master table`)
        }
      }
    } catch (err) {
      console.warn('[FRONTEND] Could not load master table:', err)
    }
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleClearTable = async () => {
    if (!confirm('⚠️ This will delete all references from your master table. Are you sure?')) {
      return
    }

    try {
      const response = await fetch('/api/master', {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setResults([])
        setAppState("idle")
        alert('✅ Master table cleared! You can now start fresh.')
      } else {
        throw new Error('Failed to clear table')
      }
    } catch (error) {
      alert('❌ Failed to clear table: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile) return

    setAppState("processing")
    setProgress(0)
    setError(null)
    setResults([])

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      console.log('[FRONTEND] Uploading PDF...')
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      if (!data.jobId) {
        throw new Error('No job ID returned')
      }

      setJobId(data.jobId)
      await pollJobStatus(data.jobId)
    } catch (error) {
      console.error('[FRONTEND] Error:', error)
      setError(error instanceof Error ? error.message : 'Failed to process PDF')
      setAppState("idle")
      setTimeout(() => setError(null), 5000)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 300
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Processing timeout')
        setAppState("idle")
        return
      }

      try {
        const response = await fetch(`/api/status/${jobId}`)
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`)
        }

        const status = await response.json()
        
        setProgress(status.progress || 0)

        if (status.status === 'completed') {
          // Get job results to capture stats
          let extractedCount = 0
          const resultsResponse = await fetch(`/api/results/${jobId}`)
          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json()
            extractedCount = resultsData.extractedReferences?.length || 0
            console.log(`[FRONTEND] Job completed: ${extractedCount} references extracted`)
          }
          
          // Load master table (includes all references + new ones)
          const masterBefore = results.length
          await loadMasterTable()
          const masterResponse = await fetch('/api/master')
          const masterData = await masterResponse.json()
          const masterAfter = masterData.total || 0
          
          // Calculate stats
          const added = Math.max(0, masterAfter - masterBefore)
          const duplicates = Math.max(0, extractedCount - added)
          
          setStats({ added, duplicates })
          setAppState("completed")
          return
        }

        if (status.status === 'failed') {
          setError(status.error || 'Extraction failed')
          setAppState("idle")
          return
        }

        attempts++
        setTimeout(poll, 2000)
      } catch (error) {
        console.error('[FRONTEND] Polling error:', error)
        attempts++
        setTimeout(poll, 2000)
      }
    }

    poll()
  }

  const downloadCSV = async () => {
    window.open(`/api/master/download/csv`, '_blank')
  }

  const downloadExcel = async () => {
    window.open(`/api/master/download/excel`, '_blank')
  }

  const handleEnhance = async () => {
    if (appState !== "completed") return

    setAppState("enhancing")
    setEnhancementProgress(0)
    setError(null)

    try {
      console.log('[FRONTEND] Starting enhancement...')
      
      const response = await fetch('/api/enhance', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Enhancement failed')
      }

      const data = await response.json()
      if (!data.jobId) {
        throw new Error('No job ID returned')
      }

      setEnhancementJobId(data.jobId)
      await pollEnhancementStatus(data.jobId)
    } catch (error) {
      console.error('[FRONTEND] Enhancement error:', error)
      setError(error instanceof Error ? error.message : 'Failed to enhance results')
      setAppState("completed")
      setTimeout(() => setError(null), 5000)
    }
  }

  const pollEnhancementStatus = async (jobId: string) => {
    const maxAttempts = 600  // 10 minutes max
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Enhancement timeout')
        setAppState("completed")
        return
      }

      try {
        const response = await fetch(`/api/enhance/status/${jobId}`)
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`)
        }

        const status = await response.json()
        
        setEnhancementProgress(status.progress || 0)
        setEnhancementStats({
          processed: status.processedReferences || 0,
          enhanced: status.enhancedReferences || 0,
        })

        if (status.status === 'completed') {
          console.log('[FRONTEND] Enhancement completed!')
          
          // Reload master table to show updated affiliations
          await loadMasterTable()
          
          setAppState("completed")
          return
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Enhancement failed')
        }

        attempts++
        setTimeout(poll, 1000)  // Poll every second
      } catch (error) {
        console.error('[FRONTEND] Enhancement polling error:', error)
        setError(error instanceof Error ? error.message : 'Enhancement status check failed')
        setAppState("completed")
      }
    }

    poll()
  }

  const totalPages = Math.ceil(results.length / rowsPerPage)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-black">Biblio AI</h1>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-5xl font-bold text-black mb-6">
          AI Agent for Reference Extraction
        </h2>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Extract bibliographic data from PDFs.
          The AI understands reference structure and extracts citation keys, authors, titles, and more - export to Excel in minutes.
        </p>
        <button
          onClick={scrollToUpload}
          className="bg-black text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors"
        >
          Get Started
        </button>
      </section>

      {/* Main Content */}
      <div ref={uploadSectionRef} className="max-w-4xl mx-auto px-6 pb-20">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">{error}</p>
            <p className="text-sm text-red-600 mt-1">
              Make sure the backend server is running: <code className="bg-red-100 px-2 py-1 rounded">npm run server</code>
            </p>
          </div>
        )}

        {/* Upload Section */}
        {appState === "idle" && (
          <div className="bg-white border-2 border-gray-200 rounded-lg p-8">
            {/* Header with status */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-black">Upload PDF</h3>
                {results.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    📊 Master table has <span className="font-semibold text-black">{results.length} references</span>
                  </p>
                )}
              </div>
              {results.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleClearTable}
                    className="text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg transition-colors"
                  >
                    Clear Table & Start Fresh
                  </button>
                </div>
              )}
            </div>

            {/* Info banner */}
            {results.length > 0 ? (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">➕ Add More Mode:</span> Uploading a new PDF will add references to your existing master table. Duplicates will be automatically skipped.
                </p>
              </div>
            ) : (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-900">
                  <span className="font-semibold">🎉 Welcome!</span> Your first upload will create a new master references table. All future uploads will add to this table automatically.
                </p>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file && file.type === "application/pdf") {
                  handleFileSelect(file)
                }
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.pdf'
                input.onchange = (e: any) => {
                  const file = e.target.files[0]
                  if (file) handleFileSelect(file)
                }
                input.click()
              }}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-4">
                  <FileText className="w-12 h-12 text-black" />
                  <div>
                    <p className="font-medium text-black">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div>
                    <p className="font-medium text-black mb-1">
                      Drop your PDF here or click to browse
                    </p>
                    <p className="text-sm text-gray-500">Maximum file size: 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {selectedFile && (
              <button
                onClick={handleSubmit}
                className="w-full mt-6 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors"
              >
                Extract References
              </button>
            )}
          </div>
        )}

        {/* Processing */}
        {appState === "processing" && (
          <div className="bg-white border-2 border-gray-200 rounded-lg p-8">
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="w-16 h-16 text-black animate-spin" />
              <div className="text-center">
                <h3 className="text-xl font-semibold text-black mb-2">Processing Bibliography</h3>
                <p className="text-gray-600">Extracting references with AI...</p>
              </div>
              <div className="w-full max-w-md">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-black h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhancing */}
        {appState === "enhancing" && (
          <div className="bg-white border-2 border-purple-200 rounded-lg p-8">
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="w-16 h-16 text-purple-600 animate-spin" />
              <div className="text-center">
                <h3 className="text-xl font-semibold text-black mb-2">Finding Author Affiliations</h3>
                <p className="text-gray-600">Searching web and databases...</p>
                {enhancementStats && (
                  <p className="text-sm text-gray-500 mt-2">
                    {enhancementStats.processed} processed • {enhancementStats.enhanced} found
                  </p>
                )}
              </div>
              <div className="w-full max-w-md">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{enhancementProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${enhancementProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {(appState === "completed" || appState === "enhancing") && results.length > 0 && (
          <div className="space-y-6">
            {/* Progress Stepper */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between max-w-3xl mx-auto">
                {/* Upload */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center mb-2">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-black">Upload</span>
                </div>
                <div className="flex-1 h-0.5 bg-black -mx-2"></div>
                {/* Extract */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center mb-2">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-black">Extract</span>
                </div>
                <div className={`flex-1 h-0.5 -mx-2 ${results.some(r => r.firstAuthorAffiliation) ? 'bg-black' : 'bg-gray-300'}`}></div>
                {/* Enhance */}
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                    results.some(r => r.firstAuthorAffiliation) ? 'bg-black' : 'bg-gray-300'
                  }`}>
                    {results.some(r => r.firstAuthorAffiliation) ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    results.some(r => r.firstAuthorAffiliation) ? 'text-black' : 'text-gray-500'
                  }`}>Enhance</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-300 -mx-2"></div>
                {/* Export */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                    <Download className="h-5 w-5 text-gray-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Export</span>
                </div>
              </div>
            </div>

            {/* Header with Actions */}
            <div className="flex items-center justify-between bg-white border-2 border-gray-200 rounded-lg p-6">
              <div>
                <h3 className="text-2xl font-semibold text-black">Master References Table</h3>
                <p className="text-gray-600 mt-1">
                  {results.length} references total
                  {stats && (
                    <span className="text-green-700 font-medium ml-2">
                      ({stats.added} new, {stats.duplicates} duplicates skipped)
                    </span>
                  )}
                  {results.some(r => r.firstAuthorAffiliation) && (
                    <span className="text-black font-medium ml-2">
                      • {results.filter(r => r.firstAuthorAffiliation).length} affiliations found
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAppState("idle")
                    setSelectedFile(null)
                    scrollToUpload()
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 bg-transparent text-black rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add More
                </button>
                <button
                  onClick={handleEnhance}
                  disabled={appState === "enhancing" || results.every(r => r.firstAuthorAffiliation)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 bg-transparent text-black rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enhance
                </button>
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-black hover:bg-gray-50 transition-colors"
                >
                  <Download className="mr-1 h-3 w-3" />
                  CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-32">Citation Key</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-40">First Author</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-60">Other Authors</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-56">Affiliation</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider min-w-[300px]">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-20">Year</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-48">Publisher / Journal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-28">Vol / Issue</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-28">Pages</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-32">ISBN</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider w-48">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {results
                      .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                      .map((ref, index) => {
                        const globalIndex = (currentPage - 1) * rowsPerPage + index
                        
                        return (
                          <tr key={globalIndex} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{globalIndex + 1}</td>
                            <td className="px-4 py-3 text-sm font-mono text-black whitespace-nowrap">{ref.citationKey}</td>
                            <td className="px-4 py-3 text-sm text-black">{ref.firstAuthor}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{ref.otherAuthors}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {ref.firstAuthorAffiliation ? (
                                <span className="text-blue-700">{ref.firstAuthorAffiliation}</span>
                              ) : (
                                <span className="text-gray-400 italic">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-black">{ref.title}</td>
                            <td className="px-4 py-3 text-sm text-black whitespace-nowrap">{ref.year}</td>
                            <td className="px-4 py-3 text-sm text-black">{ref.publisherJournal}</td>
                            <td className="px-4 py-3 text-sm text-black whitespace-nowrap">{ref.volumeIssue}</td>
                            <td className="px-4 py-3 text-sm text-black whitespace-nowrap">{ref.pages}</td>
                            <td className="px-4 py-3 text-sm text-black whitespace-nowrap font-mono text-xs">{ref.isbn}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{ref.extraNotes}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t-2 border-gray-200 px-6 py-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
