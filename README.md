# EduVision

An AI-powered adaptive learning platform that transforms uploaded study material into personalised quizzes, learning roadmaps, summaries, and knowledge visualisations. The UI adapts to individual learner profiles (dyslexic, autistic, visual, verbal).

## Features

- **PDF Upload & Processing** — Upload lecture notes or textbooks; the backend extracts and indexes content
- **AI-Generated Quizzes** — Adaptive quizzes (MCQ, True/False, open word, match, diagram) generated from your material using Azure OpenAI
- **Learning Roadmap** — Auto-generated topic roadmap based on uploaded content
- **Summaries** — Quick, structured, and detailed AI-written summaries per topic
- **Knowledge Visualisation** — Interactive concept maps showing topic relationships
- **Spaced Repetition (SRS)** — Smart review scheduling based on performance
- **Learner Profiles** — Accessibility-first UI modes for dyslexic, autistic, visual, and verbal learners
- **Text-to-Speech** — TTS for summaries and quiz questions
- **Badges & Progress** — Gamified progress tracking
- **Google OAuth** — Sign in with Google

## Tech Stack

**Backend**
- Python · FastAPI · SQLAlchemy · SQLite (dev) / PostgreSQL (prod)
- Azure OpenAI (GPT-4o) · Azure Blob Storage · Azure Translator
- PyMuPDF / pdfplumber for PDF parsing
- Sentence Transformers + scikit-learn for semantic search

**Frontend**
- Vanilla JS (modular SPA) · HTML · CSS
- No build step — open directly in a browser or serve statically

## Project Structure

```
eduvision/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings (env-driven)
│   ├── database.py          # SQLAlchemy setup
│   ├── models/              # ORM models
│   ├── routers/             # API route handlers (auth, quiz, roadmap, etc.)
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/            # AI, PDF, storage, translation logic
│   ├── utils/               # Auth helpers, caching
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Landing / login page
│   ├── app.html             # Main app shell
│   ├── js/                  # Modular JS (auth, quiz, roadmap, dashboard, etc.)
│   └── styles/              # CSS
└── start.py                 # Dev server launcher
```

## Getting Started

### Prerequisites

- Python 3.11+
- Azure OpenAI API key and deployment

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/harmeensafoora/eduvision.git
   cd eduvision
   ```

2. **Create a virtual environment and install dependencies**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

3. **Configure environment variables**

   Copy the example and fill in your values:
   ```bash
   cp backend/.env.example backend/.env
   ```

   Key variables:
   ```
   AZURE_OPENAI_ENDPOINT=
   AZURE_OPENAI_API_KEY=
   AZURE_OPENAI_DEPLOYMENT=
   JWT_SECRET=
   ```

4. **Run the backend**
   ```bash
   python start.py
   # or: uvicorn backend.main:app --reload
   ```

   API at `http://localhost:8000` · Swagger docs at `http://localhost:8000/docs`

5. **Open the frontend**

   ```bash
   cd frontend && python -m http.server 8080
   ```
   Then open `http://localhost:8080/index.html` — or open `frontend/index.html` directly in a browser.

   > Click **"Try the demo"** on the landing page for instant access with no credentials.

## API Overview

| Router | Prefix | Description |
|--------|--------|-------------|
| auth | `/auth` | Register, login, Google OAuth, dev login |
| user | `/users` | Profile and learner preferences |
| session | `/sessions` | Upload PDFs, manage study sessions |
| quiz | `/quiz` | Generate and submit quizzes |
| roadmap | `/roadmap` | Topic roadmap generation |
| summary | `/summary` | AI summaries (quick / structured / detailed) |
| visualization | `/visualization` | Concept graph data |
| dashboard | `/dashboard` | Progress overview and stats |
| badge | `/badges` | Achievement badges |

## Learner Profile Classes

Applied to `<body>` to activate accessibility modes:

| Class | Effect |
|-------|--------|
| `profile-dyslexic` | OpenDyslexic font, increased letter spacing |
| `profile-autistic` | Reduced animations, larger touch targets |
| `profile-visual` | Concept maps shown alongside text |
| `profile-verbal` | TTS controls always visible |

## License

MIT
