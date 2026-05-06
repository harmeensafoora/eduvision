# EduVision

An AI-powered adaptive learning platform that transforms uploaded PDFs into personalised quizzes, learning roadmaps, summaries, and knowledge visualisations. The UI adapts to individual learner profiles (dyslexic, ADHD, autistic, visual, verbal, auditory, and more).

## Features

- **PDF Upload & Processing** — Upload lecture notes or textbooks; the backend extracts text, embeds chunks with sentence-transformers, and clusters them into topics
- **AI-Generated Summaries** — Quick, structured, and detailed AI-written summaries per topic with language switching (9 languages) and RTL support
- **Adaptive Quizzes** — MCQ, True/False, open word, open sentence, and matching questions generated from your material via Azure OpenAI
- **Spaced Repetition** — Wrong answers are tracked and surfaced in "Study Mistakes" revision mode
- **Learning Roadmap** — Auto-generated topic roadmap with three depth levels (exam / solid / expert)
- **Mindscape Gallery** — Animated SVG topic visualisations matched to your learner profile
- **Knowledge Concept Map** — Interactive concept graph built from quiz performance
- **Dashboard** — Stats, strengths/weaknesses, streak counter, and AI observations
- **Badges** — Earned by scoring 100% on a topic quiz
- **Google OAuth + Dev Login** — Sign in with Google or via email/name (dev mode)
- **Learner Profiles** — 10 accessibility modes: visual, ADHD, dyslexia, autism, auditory, verbal, kinaesthetic, non-native, reading/writing, dyscalculia

## Tech Stack

**Backend**
- Python 3.11+ · FastAPI · SQLAlchemy · SQLite (dev) / PostgreSQL (prod)
- Azure OpenAI `gpt-4o-mini` · Sentence Transformers (`all-MiniLM-L6-v2`) · scikit-learn KMeans
- PyMuPDF (primary) / pdfplumber (fallback) for PDF parsing
- Azure Blob Storage (optional, defaults to local filesystem)
- Azure Translator (optional, passthrough if not configured)
- slowapi for rate limiting

**Frontend**
- Vanilla JS modular SPA · HTML · CSS (no build step)
- Hash-based routing — open `frontend/index.html` directly or serve statically

## Project Structure

```
eduvision_final/
├── backend/
│   ├── main.py              # FastAPI app, routers, CORS, rate limiting
│   ├── config.py            # Settings (env-driven, SQLite/local fallbacks)
│   ├── database.py          # SQLAlchemy engine and session factory
│   ├── models/              # ORM models (user, session, pdf, topic, quiz, roadmap…)
│   ├── routers/             # auth, session, summary, quiz, roadmap, badge, dashboard, user, visualization
│   ├── schemas/             # Pydantic request/response models
│   ├── services/            # ai_service, pdf_service, storage_service, translation_service
│   ├── utils/               # auth_utils (JWT), cache (Redis / in-memory fallback)
│   ├── .env                 # Your local secrets (not committed)
│   ├── .env.example         # Template — copy this to .env
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Landing / login page
│   ├── app.html             # Main SPA shell
│   ├── auth/callback.html   # Google OAuth callback handler
│   ├── js/
│   │   ├── config.js        # API_BASE (auto-detects dev vs prod)
│   │   ├── api.js           # apiFetch, apiUpload, auto token-refresh on 401
│   │   ├── app.js           # Global state S{}, navigate(), showLoader
│   │   ├── auth.js          # googleLogin, devLogin, logout, onboarding
│   │   ├── upload.js        # Drag-drop upload, session list, PDF library
│   │   ├── summary.js       # Topic sidebar, depth tabs, lang pills, doc panel
│   │   ├── quiz.js          # Setup → active (all types) → results, revision mode
│   │   ├── roadmap.js       # Step track, depth tabs, drawer
│   │   ├── dashboard.js     # Stats, strengths/weaknesses, concept map, badges
│   │   ├── visualise.js     # Mindscape gallery, learner-type SVG animations, visual modal
│   │   └── diagram.js       # SVG hotspot diagram question type
│   └── styles/
│       ├── main.css         # Design tokens, buttons, nav, animations
│       ├── app.css          # View-specific styles
│       └── mindscape.css    # Mindscape gallery and visual modal styles
└── start.py                 # Dev server launcher (wraps uvicorn)
```

## Getting Started

### Prerequisites

- Python 3.11+
- Azure OpenAI resource with a `gpt-4o-mini` deployment

### 1. Clone and set up Python environment

```bash
git clone https://github.com/harmeensafoora/eduvision.git
cd eduvision_final

python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r backend/requirements.txt
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your Azure OpenAI credentials:

```env
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Required for the email login form to work in dev
ENABLE_DEV_LOGIN=true
```

JWT secrets are **auto-generated** on first run if you leave them blank — no action needed.

### 3. Start the backend

```bash
python start.py
```

- API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Press **Ctrl+C** to stop

Optional flags:
```bash
python start.py --port 9000      # change port
python start.py --no-reload      # disable file-watching
```

### 4. Open the frontend

Serve the frontend with Python's built-in server (needed so `fetch()` works correctly):

```bash
cd frontend
python -m http.server 8080
```

Then open **`http://localhost:8080/index.html`** in your browser.

> Alternatively, open `g 4  ` directly as a `file://` URL — CORS is configured to accept all origins including `null`.

### 5. Sign in

- **Dev login** — Enter any email and name on the login screen and click **Sign in**. This requires `ENABLE_DEV_LOGIN=true` in your `.env`.
- **Google OAuth** — Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. The callback URL must match `GOOGLE_REDIRECT_URI` (default: `http://localhost:8000/api/auth/callback`).

### 6. Use the app

1. Go to **Upload** — drag-and-drop one or more PDFs and click **Analyse**
2. Wait for processing (typically 10–30 seconds per PDF)
3. Navigate to **Summary** to read AI-generated summaries per topic
4. Go to **Quiz** to generate and take adaptive quizzes
5. Visit **Roadmap** for your personalised learning path
6. Open **Mindscape** for animated visual explainers per topic
7. Check **Dashboard** for stats, performance, and badges

## API Reference

All endpoints are prefixed with `/api`.

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| auth | `/api/auth` | `POST /dev-login`, `GET /login` (Google), `GET /callback`, `POST /refresh`, `POST /logout` |
| session | `/api/session` | `POST /upload`, `GET /list`, `GET /{id}`, `GET /{id}/status` |
| summary | `/api/summary` | `GET /{session_id}/{topic_id}?depth=quick\|structured\|detailed&lang=en` |
| quiz | `/api/quiz` | `POST /generate`, `POST /submit`, `GET /history`, `GET /wrong-answers/{topic_id}` |
| roadmap | `/api/roadmap` | `GET /{session_id}?depth=exam\|solid\|expert`, `POST /{session_id}/regenerate`, `PATCH /{session_id}/node/{node_id}/complete` |
| dashboard | `/api/dashboard` | `GET /`, `GET /observation` |
| badge | `/api/badge` | `POST /award`, `GET /list` |
| user | `/api/user` | `GET /me`, `POST /profile`, `GET /export`, `DELETE /me` |
| visualization | `/api/summary` | `GET /{session_id}/{topic_id}/visualization?mode=diagram` |

## Learner Profile Modes

Selected during onboarding and applied as CSS body classes:

| Mode | Effect |
|------|--------|
| Visual | Concept maps shown alongside summaries |
| ADHD | Bite-sized chunks, progress dots, kinetic animations |
| Dyslexia | High contrast, generous spacing, colour-coded text |
| Autism Spectrum | Predictable grids, muted palette, reduced motion |
| Auditory | Waveform visualisations, prominent TTS controls |
| Verbal | Word clouds, definition tooltips, rich typography |
| Kinaesthetic | Interactive drag-and-drop practice questions |
| Non-Native Speaker | One-click translation, simplified phrasing |
| Reading / Writing | Notebook-style layout, highlight mode |
| Dyscalculia | Icon-based progress bars, shapes instead of numbers |

## License

MIT
