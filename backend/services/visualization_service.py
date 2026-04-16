"""
Visualization service.

Provides two modes:
  labelled — extract first image from PDF via PyMuPDF + AI annotations
  diagram  — AI-generated concept map (nodes + edges) from topic excerpts
"""
import base64
from typing import Any

from sqlalchemy.orm import Session as DBSession

from backend.models.pdf_model import PDF
from backend.models.topic import Topic
from backend.services.ai_service import ai_service


def _get_topic_excerpts(topic: Topic, db: DBSession, max_chars: int = 3000) -> str:
    """Build representative excerpt string for a topic (mirrors summary router pattern)."""
    pdfs = db.query(PDF).filter(PDF.session_id == topic.session_id).all()
    excerpts = []
    for pdf in pdfs:
        if not pdf.chunks:
            continue
        topic_lower = topic.name.lower()
        relevant = [c["text"] for c in pdf.chunks if topic_lower in c["text"].lower()]
        if not relevant:
            relevant = [c["text"] for c in pdf.chunks[:4]]
        excerpts.extend(relevant[:6])
        if sum(len(e) for e in excerpts) > max_chars:
            break
    return "\n\n---\n\n".join(excerpts)[:max_chars]


def _extract_first_image(pdf_file_path: str) -> dict | None:
    """Extract the first image from a PDF file using PyMuPDF.
    Returns: {image_b64: str, width: int, height: int, description: str} or None.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return None

    try:
        doc = fitz.open(pdf_file_path)
        for page_num in range(min(len(doc), 20)):  # Search first 20 pages
            page = doc[page_num]
            image_list = page.get_images(full=True)
            if not image_list:
                continue
            xref = image_list[0][0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            width = base_image.get("width", 0)
            height = base_image.get("height", 0)
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            # Simple textual description for annotation generation
            description = f"Diagram from page {page_num + 1} of the PDF, dimensions {width}x{height}px."
            doc.close()
            return {
                "image_b64": image_b64,
                "width": width,
                "height": height,
                "description": description,
            }
        doc.close()
        return None
    except Exception:
        return None


class VisualizationService:

    def get_labelled(self, topic: Topic, db: DBSession) -> dict[str, Any]:
        """Return labelled image visualization."""
        excerpts = _get_topic_excerpts(topic, db)

        # Find the best PDF file path for this topic using the confirmed blob_url field
        pdf_file_path = None
        if topic.best_pdf_id:
            pdf = db.query(PDF).filter(PDF.id == topic.best_pdf_id).first()
            if pdf:
                pdf_file_path = pdf.blob_url  # confirmed field name from pdf_model.py

        if not pdf_file_path:
            return {
                "mode": "labelled",
                "image_b64": None,
                "width": 0,
                "height": 0,
                "annotations": [],
                "message": "No diagrams found in this topic's source PDF",
            }

        image_data = _extract_first_image(pdf_file_path)
        if not image_data:
            return {
                "mode": "labelled",
                "image_b64": None,
                "width": 0,
                "height": 0,
                "annotations": [],
                "message": "No diagrams found in this topic's source PDF",
            }

        annotations = []
        if excerpts:
            annotations = ai_service.generate_image_annotations(
                topic_name=topic.name,
                image_description=image_data["description"],
                excerpts=excerpts,
            )

        return {
            "mode": "labelled",
            "image_b64": image_data["image_b64"],
            "width": image_data["width"],
            "height": image_data["height"],
            "annotations": annotations,
        }

    def get_diagram(self, topic: Topic, db: DBSession) -> dict[str, Any]:
        """Return AI-generated concept map (nodes + edges)."""
        excerpts = _get_topic_excerpts(topic, db)

        if not excerpts:
            return {
                "mode": "diagram",
                "nodes": [],
                "edges": [],
                "message": "No content found for this topic",
            }

        result = ai_service.generate_diagram(
            topic_name=topic.name,
            excerpts=excerpts,
        )

        return {
            "mode": "diagram",
            "nodes": result.get("nodes", []),
            "edges": result.get("edges", []),
        }


visualization_service = VisualizationService()
