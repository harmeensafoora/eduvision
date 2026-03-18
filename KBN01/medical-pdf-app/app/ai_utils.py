import base64
import json
import os
from typing import List, Dict

from openai import AzureOpenAI, APIConnectionError
from .config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
)

# -------------------------------------------------------------------
# Azure OpenAI client
# -------------------------------------------------------------------
client = AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
)

# -------------------------------------------------------------------
# 1) Summarize PDF text
# -------------------------------------------------------------------
def summarize_text(text: str) -> str:
    # Truncate very long text just to be safe with context limits
    if len(text) > 12000:
        text = text[:12000]

    prompt = (
    "You are an educational content summarization system.\n\n"

    "Your task is to analyze the text and identify ALL major topics discussed in it.\n\n"

    "CRITICAL RULES:\n"
    "- Detect separate topics or concepts in the text.\n"
    "- Create a separate summary section for EACH topic.\n"
    "- NEVER merge unrelated topics into one heading.\n"
    "- NEVER create combined titles like 'Sensory and Digestive Systems'.\n"
    "- If the text discusses Eye and Mouth separately, create TWO sections.\n"
    "- Each section must describe only that specific topic.\n\n"

    "OUTPUT FORMAT (Markdown):\n"
    "For EACH topic use the following structure:\n\n"
    "### <Topic Name>\n\n"
    "Create 3–5 sections depending on what the content actually includes.\n"
    "Section names must come from the material itself.\n\n"

    "Example section types (use only if relevant):\n"
    "- Overview\n"
    "- Structure\n"
    "- Components\n"
    "- Mechanism\n"
    "- Characteristics\n"
    "- Types\n"
    "- Examples\n"
    "- Importance\n\n"

    "IMPORTANT STRUCTURE RULES:\n"
    "- Do NOT force sections like 'Functions' or 'Advantages'.\n"
    "- Only create sections supported by the text.\n"
    "- Use bullet points under each section.\n"
    "- Do NOT mention other topics inside a section.\n\n"

    "TEXT:\n"
    f"{text}"
)

    try:
        resp = client.chat.completions.create(
    model=AZURE_OPENAI_DEPLOYMENT,
    messages=[{"role": "user", "content": prompt}],
)
        return resp.choices[0].message.content.strip()
    except APIConnectionError as e:
        print("Azure OpenAI connection error in summarize_text:", e)
        return "Error: unable to contact Azure OpenAI for summary. Please check endpoint / network."
    except Exception as e:
        print("Unexpected error in summarize_text:", e)
        return "Error: summarization failed."


# -------------------------------------------------------------------
# 2) Translate summary to another language
# -------------------------------------------------------------------
def translate_summary(summary: str, language: str) -> str:
    prompt = (
        f"You are an academic translator specializing in scholarly content. Translate the following "
        f"educational summary into {language} while maintaining the highest standards of academic "
        f"accuracy and intellectual rigor.\n\n"
        f"Translation Guidelines:\n"
        f"- Preserve all discipline-specific terminology using internationally recognized terms in {language}\n"
        f"- Maintain the professional academic tone and educational structure\n"
        f"- Ensure conceptual descriptions remain intellectually precise and theoretically sound\n"
        f"- Use formal academic register appropriate for university-level instruction\n"
        f"- Keep all theoretical frameworks and practical applications accurate\n"
        f"- Retain the original formatting and sectional organization\n\n"
        f"Educational summary to translate:\n\n"
        f"{summary}"
    )
    try:
        resp = client.chat.completions.create(
    model=AZURE_OPENAI_DEPLOYMENT,
    temperature=0.2,
    messages=[{"role": "user", "content": prompt}],
)
        return resp.choices[0].message.content.strip()
    except APIConnectionError as e:
        print("Azure OpenAI connection error in translate_summary:", e)
        return f"Error: unable to contact Azure OpenAI for translation to {language}."
    except Exception as e:
        print("Unexpected error in translate_summary:", e)
        return "Error: translation failed."


# -------------------------------------------------------------------
# 3) Extra detailed explanation
# -------------------------------------------------------------------
def generate_detailed_text(summary: str, full_text: str) -> str:
    if len(full_text) > 12000:
        full_text = full_text[:12000]

    prompt = (
    "You are generating detailed educational explanations from the provided summary and text.\n\n"

    "TASK:\n"
    "Expand the material while keeping each topic completely separate.\n\n"

    "STRICT RULES:\n"
    "- Identify each topic from the summary.\n"
    "- Write a detailed explanation for EACH topic separately.\n"
    "- Do NOT merge or connect unrelated topics.\n"
    "- Do NOT create interdisciplinary explanations unless the text explicitly describes them.\n\n"

    "OUTPUT STRUCTURE:\n"
    "For EACH topic use:\n\n"
    "### <Topic Name>\n\n"
    "Create 5–8 sections depending on the content.\n"
    "Use **bold headings** for sections.\n\n"

    "Possible section types (use only if relevant):\n"
    "- Background\n"
    "- Structure\n"
    "- Components\n"
    "- Mechanism\n"
    "- Characteristics\n"
    "- Types\n"
    "- Examples\n"
    "- Significance\n\n"

    "IMPORTANT:\n"
    "- Only include sections supported by the text.\n"
    "- Do NOT force sections.\n"
    "- Do NOT connect separate topics together.\n"
    "- Each topic explanation should stand alone.\n\n"

    f"SUMMARY:\n{summary}\n\n"
    f"FULL TEXT:\n{full_text}"
)
    try:
        resp = client.chat.completions.create(
    model=AZURE_OPENAI_DEPLOYMENT,
    temperature=0.2,
    messages=[{"role": "user", "content": prompt}],
)
        return resp.choices[0].message.content.strip()
    except APIConnectionError as e:
        print("Azure OpenAI connection error in generate_detailed_text:", e)
        return "Error: unable to contact Azure OpenAI for detailed explanation."
    except Exception as e:
        print("Unexpected error in generate_detailed_text:", e)
        return "Error: details generation failed."


# -------------------------------------------------------------------
# 4) Suggest reference links
# -------------------------------------------------------------------
def generate_references(summary: str) -> List[str]:
    prompt = (
    "You are an academic research assistant.\n\n"

    "Generate 5–8 high-quality academic references related to the provided educational content.\n\n"

    "STRICT FORMAT RULES:\n"
    "- Only include the citation and URL.\n"
    "- Do NOT add descriptions or explanations.\n"
    "- Use a clean numbered list.\n"
    "- Each reference must be on ONE line.\n"
    "- Use this format exactly:\n\n"

    "1. Author(s). (Year). Title. URL\n"
    "2. Author(s). (Year). Title. URL\n\n"

    "Prefer sources from:\n"
    "- Springer\n"
    "- PubMed\n"
    "- Google Scholar\n"
    "- Nature\n"
    "- ScienceDirect\n"
    "- NIH\n\n"

    "SUMMARY:\n"
    f"{summary}"
)
    try:
        resp = client.chat.completions.create(
    model=AZURE_OPENAI_DEPLOYMENT,
    temperature=0.2,
    messages=[{"role": "user", "content": prompt}],
)
        text = resp.choices[0].message.content.strip()
        return [
    line.strip()
    for line in text.split("\n")
    if line.strip() and line.strip()[0].isdigit()
]
    except APIConnectionError as e:
        print("Azure OpenAI connection error in generate_references:", e)
        return ["Error: unable to contact Azure OpenAI for references."]
    except Exception as e:
        print("Unexpected error in generate_references:", e)
        return ["Error: reference generation failed."]


# -------------------------------------------------------------------
# Helper: safely extract JSON object from model output
# -------------------------------------------------------------------
def _extract_json_object(text: str) -> str:
    """
    Try to pull out the first {...} JSON object from a string.
    This lets us handle responses like ```json { ... } ``` or
    explanations around the JSON.
    """
    if not text:
        return text

    text = text.strip()

    # Remove leading/trailing markdown code fences
    if text.startswith("```"):
        parts = text.split("```", 2)
        if len(parts) >= 2:
            text = parts[1].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]

    return text


# -------------------------------------------------------------------
# 5) Identify organ from image using vision (chat with image input)
# -------------------------------------------------------------------
def identify_organ(image_path: str) -> Dict:
    try:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        print("Error reading image in identify_organ:", e)
        return {"organ": "unknown", "labels": []}

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "You are an expert analyst examining visual content from educational materials. "
                        "Analyze this image and provide a detailed academic assessment.\n\n"
                        "Task Requirements:\n"
                        "1. Identify the primary subject, concept, or system depicted in this educational image\n"
                        "2. List key components, elements, or features visible (maximum 10 most significant items)\n"
                        "3. Use precise terminology appropriate for university-level education\n"
                        "4. Prioritize academically relevant and pedagogically significant elements\n\n"
                        "Response Format:\n"
                        "Respond ONLY as pure JSON (no markdown, no code blocks, no additional text) "
                        "in exactly this format:\n"
                        "{\"organ\": \"primary subject or system name\", "
                        "\"labels\": [\"component 1\", \"component 2\", ...]}\n\n"
                        "Note: The field name 'organ' is maintained for technical compatibility, but should contain "
                        "the main subject of the image (e.g., 'solar system', 'cell structure', 'circuit diagram', "
                        "'heart', 'economic model', etc.)\n\n"
                        "Example: {\"organ\": \"photosynthesis process\", "
                        "\"labels\": [\"chloroplast\", \"sunlight\", \"carbon dioxide\", \"glucose\", \"oxygen\"]}"
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                },
            ],
        }
    ]

    try:
        resp = client.chat.completions.create(
    model=AZURE_OPENAI_DEPLOYMENT,
    temperature=0.2,
    messages=[{"role": "user", "content": prompt}],
)

        content = resp.choices[0].message.content

        if isinstance(content, list):
            content_text = "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and "text" in part
            )
        else:
            content_text = content or ""

        content_text = _extract_json_object(content_text)

        try:
            data = json.loads(content_text)
        except Exception as e:
            print("JSON parse error in identify_organ, content was:", repr(content_text))
            print("Error:", e)
            return {"organ": "unknown", "labels": []}

        if "organ" not in data:
            data["organ"] = "unknown"
        if "labels" not in data:
            data["labels"] = []

        return data

    except APIConnectionError as e:
        print("Azure OpenAI connection error in identify_organ:", e)
        return {"organ": "unknown", "labels": []}
    except Exception as e:
        print("Unexpected error in identify_organ:", e)
        return {"organ": "unknown", "labels": []}


# -------------------------------------------------------------------
# 6) Use static organ images from /static/organs
# -------------------------------------------------------------------
def get_static_organ_image(organ: str) -> str | None:
    if not organ:
        return None

    name = organ.lower().strip()

    mapping = {
        # --- Heart & Circulatory ---
        "heart": "heart.jpg",
        "left ventricle": "heart.jpg",
        "right ventricle": "heart.jpg",
        "left atrium": "heart.jpg",
        "right atrium": "heart.jpg",
        "aorta": "heart.jpg",
        "myocardium": "heart.jpg",
        "valve": "heart.jpg",
        "pulmonary artery": "heart.jpg",

        # --- Lungs & Respiratory ---
        "lung": "lungs.jpg",
        "lungs": "lungs.jpg",
        "alveoli": "lungs.jpg",
        "bronchus": "lungs.jpg",
        "bronchi": "lungs.jpg",
        "bronchiole": "lungs.jpg",
        "trachea": "lungs.jpg",
        "pleura": "lungs.jpg",

        # --- Brain & Nervous System ---
        "brain": "brain.jpg",
        "cerebrum": "brain.jpg",
        "cerebellum": "brain.jpg",
        "brainstem": "brain.jpg",
        "frontal lobe": "brain.jpg",
        "medulla": "brain.jpg",
        "pons": "brain.jpg",

        # --- Liver & Gallbladder ---
        "liver": "liver.jpg",
        "hepatic": "liver.jpg",
        "gallbladder": "liver.jpg",
        "bile duct": "liver.jpg",

        # --- Kidneys & Urinary ---
        "kidney": "kidney.jpg",
        "kidneys": "kidney.jpg",
        "renal": "kidney.jpg",
        "nephron": "kidney.jpg",
        "glomerulus": "kidney.jpg",
        "ureter": "kidney.jpg",

        # --- Eye ---
        "eye": "eye.jpg",
        "eyes": "eye.jpg",
        "retina": "eye.jpg",
        "cornea": "eye.jpg",
        "iris": "eye.jpg",
        "pupil": "eye.jpg",
        "optic nerve": "eye.jpg",
        "sclera": "eye.jpg",

        # --- Mouth & Oral ---
        "mouth": "mouth.jpg",
        "teeth": "mouth.jpg",
        "tooth": "mouth.jpg",
        "tongue": "mouth.jpg",
        "palate": "mouth.jpg",
        "gum": "mouth.jpg",

        # --- Stomach & Digestive ---
        "stomach": "stomach.jpg",
        "gastric": "stomach.jpg",
        "intestine": "intestines.jpg",
        "intestines": "intestines.jpg",
        "colon": "intestines.jpg",
        "duodenum": "intestines.jpg",
        "ileum": "intestines.jpg",
        "rectum": "intestines.jpg",

        # --- Pancreas ---
        "pancreas": "pancreas.jpg",
        "pancreatic": "pancreas.jpg",

        # --- Skeleton & Bones ---
        "bone": "skeleton.jpg",
        "bones": "skeleton.jpg",
        "skull": "skeleton.jpg",
        "spine": "skeleton.jpg",
        "vertebra": "skeleton.jpg",
        "rib": "skeleton.jpg",
        "femur": "skeleton.jpg",

        # --- Ear ---
        "ear": "ear.jpg",
        "ears": "ear.jpg",
        "cochlea": "ear.jpg",
        "tympanic": "ear.jpg"
    }
    

    filename = None

    if name in mapping:
        filename = mapping[name]
    else:
        for key, value in mapping.items():
            if key in name:
                filename = value
                break

    if not filename:
        return None

    path = os.path.join("D:\\8th Sem\\eduvison\\eduvision-code\\KBN01\\KBN01\\medical-pdf-app\\static\\organs\\", filename)
    return path if os.path.exists(path) else None


# -------------------------------------------------------------------
# 7) Convenience: identify organ AND get static detailed image
# -------------------------------------------------------------------
def identify_organ_with_static_image(image_path: str) -> Dict:
    organ_info = identify_organ(image_path)
    organ = organ_info.get("organ", "unknown")
    labels = organ_info.get("labels", [])

    static_image_path = get_static_organ_image(organ)

    return {
        "organ": organ,
        "labels": labels,
        "static_image_path": static_image_path,
    }