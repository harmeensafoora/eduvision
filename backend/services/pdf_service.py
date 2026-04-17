"""
PDF processing pipeline:
  1. Parse PDF text with PyMuPDF (fitz) — handles multi-column, tables
  2. Chunk text into overlapping windows
  3. Embed chunks with sentence-transformers (local, no API key needed)
  4. Cluster embeddings with k-means to identify topic groups
  5. Name each topic cluster with GPT-4o-mini
  6. Score each PDF's coverage per topic (cosine similarity)
"""
import json
import re
from pathlib import Path
from typing import Any

import numpy as np

_embedder = None  # lazy-loaded


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


# ── 1. Parse ──────────────────────────────────────────────────────────────────

def parse_pdf(path: str | Path) -> dict[str, Any]:
    """Extract text and metadata from a PDF file."""
    import fitz  # PyMuPDF

    path = Path(path)
    doc = fitz.open(str(path))
    pages = []
    full_text = []

    for page_num, page in enumerate(doc, 1):
        text = page.get_text("text")
        # Basic multi-column cleanup: collapse excessive whitespace
        text = re.sub(r" {3,}", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        pages.append({"page": page_num, "text": text})
        full_text.append(text)

    doc.close()
    return {
        "page_count": len(pages),
        "pages": pages,
        "full_text": "\n\n".join(full_text),
    }


# ── 2. Chunk ───────────────────────────────────────────────────────────────────

def chunk_text(pages: list[dict], chunk_size: int = 400, overlap: int = 80) -> list[dict]:
    """Split text into overlapping chunks, preserving page reference."""
    chunks = []
    for page_data in pages:
        text = page_data["text"].strip()
        words = text.split()
        i = 0
        while i < len(words):
            window = words[i : i + chunk_size]
            chunk_text_str = " ".join(window)
            if len(chunk_text_str) > 40:  # skip tiny fragments
                chunks.append({"text": chunk_text_str, "page": page_data["page"]})
            i += chunk_size - overlap
    return chunks


# ── 3. Embed ───────────────────────────────────────────────────────────────────

def embed_chunks(chunks: list[dict]) -> list[list[float]]:
    """Return list of embedding vectors (one per chunk)."""
    embedder = _get_embedder()
    texts = [c["text"] for c in chunks]
    if not texts:
        return []
    vecs = embedder.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    return vecs.tolist()


# ── 4. Cluster ─────────────────────────────────────────────────────────────────

def cluster_topics(embeddings: list[list[float]], n_topics: int | None = None) -> list[int]:
    """Cluster embeddings into topic groups; returns cluster label per chunk."""
    from sklearn.cluster import KMeans

    arr = np.array(embeddings)
    n = len(arr)
    if n == 0:
        return []
    if n_topics is None:
        n_topics = max(2, min(10, n // 8))  # heuristic: 1 topic per ~8 chunks
    n_topics = min(n_topics, n)
    km = KMeans(n_clusters=n_topics, random_state=42, n_init="auto")
    labels = km.fit_predict(arr)
    return labels.tolist()


# ── 5. Name topics via GPT ────────────────────────────────────────────────────

def name_topics(chunks: list[dict], labels: list[int]) -> dict[int, str]:
    """Given cluster labels, build a representative excerpt per cluster and ask GPT to name it."""
    from backend.services.ai_service import ai_service

    # Group chunks by cluster
    clusters: dict[int, list[str]] = {}
    for chunk, label in zip(chunks, labels):
        clusters.setdefault(label, []).append(chunk["text"])

    topic_names: dict[int, str] = {}
    for cluster_id, cluster_chunks in clusters.items():
        # Take up to 3 representative chunks
        sample = " ... ".join(cluster_chunks[:3])[:800]
        try:
            prompt = (
                f"Given these text excerpts from a study document, provide a short (2–5 word) "
                f"academic topic name that best describes the content. Reply with just the topic name.\n\n"
                f"Excerpts: {sample}"
            )
            name = ai_service.complete(prompt, max_tokens=20).strip().strip('"').strip("'")
            topic_names[cluster_id] = name if name else f"Topic {cluster_id + 1}"
        except Exception:
            topic_names[cluster_id] = f"Topic {cluster_id + 1}"

    return topic_names


# ── 6. Score coverage ─────────────────────────────────────────────────────────

def score_coverage(topic_embedding: list[float], chunk_embeddings: list[list[float]]) -> float:
    """Cosine similarity between topic centre and mean of chunk embeddings."""
    if not chunk_embeddings or not topic_embedding:
        return 0.0
    arr = np.array(chunk_embeddings)
    topic_vec = np.array(topic_embedding)
    # Dot product (vectors already normalised)
    sims = arr @ topic_vec
    return float(np.mean(sims))


# ── Main pipeline ─────────────────────────────────────────────────────────────

def process_pdf(file_path: str | Path) -> dict[str, Any]:
    """Full pipeline: parse → chunk → embed. Returns data ready to store."""
    parsed = parse_pdf(file_path)
    chunks = chunk_text(parsed["pages"])
    embeddings = embed_chunks(chunks)
    return {
        "page_count": parsed["page_count"],
        "chunks": chunks,
        "embeddings": embeddings,
    }
