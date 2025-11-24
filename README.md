# 📚 BiblioAI - AI-Powered Reference Extraction & Enhancement

**Intelligent bibliographic reference extraction and enhancement system powered by LLMs**

Extract and enhance academic references from PDFs using GPT-4o-mini with automatic affiliation finding via Semantic Scholar, Perplexity AI, and OpenAlex.

---

## ✨ Features

- 🤖 **LLM-Powered Extraction** - GPT-4o-mini extracts all bibliographic fields in one pass
- 🌐 **Smart Affiliation Finding** - 3-tier hybrid system (Semantic Scholar → Perplexity AI → OpenAlex)
- 📄 **OCR Support** - Handles scanned PDFs with Tesseract.js
- 🎯 **Complete Data** - Citation keys, authors, titles, years, publishers, volumes, pages, ISBN, affiliations
- 💾 **Persistent Master Table** - Deduplicated references stored locally
- 📊 **CSV Export** - Download clean, formatted results
- 🎨 **Modern UI** - Drag-and-drop upload with progress tracking
- 🔄 **Incremental Updates** - Add more PDFs without duplicates

---
## Demo

### 1. Extracting References from pdf 
<img width="1126" height="810" alt="Image" src="https://github.com/user-attachments/assets/888f13bc-dba8-49bc-92bb-420e715b0135" />

### 2. Enhancing resultst with first author affiliation 
<img width="948" height="484" alt="Image" src="https://github.com/user-attachments/assets/9ac5a904-e15f-4d3b-b82b-b693c44bccab" />

### 3. Extracted 596 references
<img width="901" height="801" alt="Image" src="https://github.com/user-attachments/assets/a697868e-49fe-4c6e-b70a-d06d77806efa" />

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
```

Edit `.env`:
```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (for affiliation enhancement)
PERPLEXITY_API_KEY=pplx-...
SEMANTIC_SCHOLAR_API_KEY=...

# Optional settings
OPENAI_MODEL=gpt-4o-mini
PORT=3001
HOST=0.0.0.0
```

### 3. Start Backend
```bash
npm run server
```

### 4. Start Frontend
```bash
# In a separate terminal
npm run dev
```

### 5. Open Browser
```
http://localhost:3000
```

---

## 📁 Project Structure

```
biblio-ai/
├── app/
│   ├── page.tsx              # Main UI
│   ├── layout.tsx            # Layout wrapper
│   └── globals.css           # Styles
│
├── src/
│   ├── extraction/           # Reference extraction
│   │   ├── server.ts         # Fastify server
│   │   ├── routes.ts         # API endpoints
│   │   ├── orchestrator.ts   # Job management
│   │   ├── llmBatchExtractor.ts  # LLM extraction
│   │   ├── masterTable.ts    # Master table (deduplicated)
│   │   └── storage.ts        # Job persistence
│   │
│   ├── enhancement/          # Affiliation finding
│   │   ├── orchestrator.ts   # Enhancement jobs
│   │   └── affiliationFinder.ts  # 3-tier API system
│   │
│   ├── pipeline/             # PDF processing
│   │   └── ocr.ts            # PDF text + OCR extraction
│   │
│   ├── utils/                # Utilities
│   │   └── logging.ts        # Structured logging
│   │
│   ├── types-simple.ts       # TypeScript types
│   └── config.ts             # Configuration
│
├── master-references/        # Master table (created at runtime)
├── extraction-results/       # Job history (created at runtime)
└── package.json
```

---

## 🔌 API Endpoints

### Extraction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/extract` | Upload PDF for extraction |
| `GET` | `/status/:jobId` | Check job progress |
| `GET` | `/results/:jobId` | Get extraction results |
| `DELETE` | `/jobs/:jobId` | Delete a job |

### Master Table
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/master` | Get all references |
| `GET` | `/master/stats` | Get table statistics |
| `GET` | `/master/download/csv` | Download master CSV |
| `DELETE` | `/master` | Clear master table |

### Enhancement
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/enhance` | Start affiliation enhancement |
| `GET` | `/enhance/status/:jobId` | Check enhancement progress |
| `DELETE` | `/master/affiliations` | Clear all affiliations |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |

---

## 📊 Extracted Fields

| Field | Description | Example |
|-------|-------------|---------|
| **Citation Key** | Reference identifier | `Hill '79`, `Wiener '48` |
| **First Author** | Primary author | `T.M. Mitchell` |
| **Other Authors** | Co-authors | `Y. Bengio; A. Courville` |
| **Affiliation** | First author institution | `Carnegie Mellon University (US)` |
| **Title** | Full paper/book title | `"Machine Learning"` |
| **Year** | Publication year | `1997` |
| **Publisher / Journal** | Publisher or journal name | `McGraw Hill` |
| **Volume / Issue** | Volume and issue numbers | `50 (4)` |
| **Pages** | Page numbers | `p. 44` or `197-219` |
| **Extra Notes** | Additional context | `"Translated by D. R. Hill"` |
| **ISBN** | ISBN if available | `90-277-0833-9` |

---

## 🎯 How It Works

### Phase 1: Extraction
```
1. Upload PDF
   ↓
2. Extract Full Text (OCR fallback for scanned PDFs)
   ↓
3. LLM Batch Processing (entire document at once)
   ↓
4. Parse & Validate References
   ↓
5. Add to Master Table (deduplicated)
   ↓
6. Display Results
```

### Phase 2: Enhancement (Optional)
```
1. Click "Enhance" Button
   ↓
2. For Each Reference:
   │
   ├─► Tier 1: Semantic Scholar (fast, structured)
   │   └─► Found? → Done ✓
   │
   ├─► Tier 2: Perplexity AI (smart, comprehensive)
   │   └─► Found? → Done ✓
   │
   └─► Tier 3: OpenAlex (fallback, broad)
       └─► Found? → Done ✓
   ↓
3. Update Master Table
   ↓
4. Display Enhanced Results
```

---

## 💡 Workflow

### Progress Stepper
The UI shows 4 clear steps:
- ✅ **Upload** - PDF uploaded
- ✅ **Extract** - References extracted
- ✅ **Enhance** - Affiliations found (optional)
- ⏳ **Export** - Download results

### Button Actions
- **Add More** - Add another PDF to existing table
- **✨ Enhance** - Find author affiliations
- **CSV** - Download master table

---

## 💰 Cost Estimate

### Extraction (GPT-4o-mini)
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens
- **~100 references**: $0.10 - $0.15

### Enhancement
- **Semantic Scholar**: Free ✓
- **Perplexity AI**: ~$0.001 per query
- **OpenAlex**: Free ✓
- **~100 references**: $0.05 - $0.10 (if using Perplexity)

**Total for 100 references**: ~$0.15 - $0.25

---

## 🔧 Configuration

### Required
```bash
OPENAI_API_KEY=sk-...
```

### Optional (Affiliation Enhancement)
```bash
PERPLEXITY_API_KEY=pplx-...       # For Tier 2 (best accuracy)
SEMANTIC_SCHOLAR_API_KEY=...      # Optional (public API works fine)
```

### Server Settings
```bash
OPENAI_MODEL=gpt-4o-mini
PORT=3001
HOST=0.0.0.0
MAX_FILE_SIZE=10485760
```

---

## 🧪 Testing

### 1. Test Extraction
1. Start backend: `npm run server`
2. Start frontend: `npm run dev`
3. Upload a PDF with bibliography
4. Wait for extraction (~30s - 2min)
5. View results in table

### 2. Test Enhancement
1. After extraction, click **✨ Enhance** button
2. Wait for affiliation finding (~2-5min for 50 refs)
3. View affiliations in blue text

### 3. Test Export
1. Click **CSV** button
2. Open downloaded file
3. Verify all fields present

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Kill existing process
lsof -ti:3001 | xargs kill -9

# Restart
npm run server
```

### No references extracted
- Check `OPENAI_API_KEY` in `.env`
- Check backend logs for LLM errors
- Verify PDF has text (not just images)

### Affiliations not found
- Add `PERPLEXITY_API_KEY` for better results
- Check backend logs: `tail -f /tmp/backend*.log`
- Some historical papers (pre-1900) are skipped intentionally

### OCR not working
```bash
# Mac
brew install tesseract

# Ubuntu
sudo apt-get install tesseract-ocr
```

---

## 📝 Example Output

### Input PDF:
```
[Mitchell '97] T.M. Mitchell (1997). Machine Learning. McGraw Hill.

[Kagermann '11] H. Kagermann, W. D. Lukas, W. Wahlster (2011). 
Industrie 4.0: Mit dem Internet der Dinge auf dem Weg zur 4. 
industriellen Revolution. VDI nachrichten, 13(1), 2-3.
```

### Output Table:

| Citation Key | First Author | Other Authors | Affiliation | Title | Year | Publisher |
|-------------|--------------|---------------|-------------|-------|------|-----------|
| Mitchell '97 | T.M. Mitchell | — | Carnegie Mellon University (US) | Machine Learning | 1997 | McGraw Hill |
| Kagermann '11 | H. Kagermann | W. D. Lukas; W. Wahlster | acatech – National Academy of Science and Engineering (DE) | Industrie 4.0... | 2011 | VDI nachrichten |

---

## 🎨 UI Features

- **Progress Stepper** - Visual workflow (Upload → Extract → Enhance → Export)
- **Real-time Progress** - Live updates during extraction/enhancement
- **Smart Status** - "Enhance" button disabled when complete
- **Clean Design** - Black/gray/white minimalist theme
- **Pagination** - 25/50/100 rows per page
- **Persistent State** - Results survive page refresh

---

## 🛠️ Built With

- **Frontend**: Next.js 15, React 19, TailwindCSS, Lucide Icons
- **Backend**: Fastify, TypeScript, tsx
- **AI**: OpenAI GPT-4o-mini, Perplexity AI
- **APIs**: Semantic Scholar, OpenAlex
- **PDF**: pdf-parse, Tesseract.js (OCR)
- **Export**: json2csv, ExcelJS

---

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- OpenAI API key

### Production Build
```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Start production servers
npm run server &        # Backend on :3001
npm start              # Frontend on :3000
```

---

## 📄 License

MIT

---

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📧 Support

For issues or questions, open a GitHub issue at:
https://github.com/zulalakarsu/biblio-ai-agent

---

## 🙏 Acknowledgments

- OpenAI for GPT-4o-mini
- Semantic Scholar API for academic data
- Perplexity AI for smart search
- OpenAlex for open bibliographic data

---

**Made with ❤️ for academic researchers**
