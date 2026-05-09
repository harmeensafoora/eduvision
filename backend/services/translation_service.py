"""
Translation service.
- If AZURE_TRANSLATOR_KEY is set: calls Azure Cognitive Translator REST API
- Otherwise: returns original text unchanged (translated=False)
- Cultural post-processing (example replacement) runs via GPT-4o-mini when AI is configured.
"""
import json
import uuid
from typing import Any

import httpx

from backend.config import settings

# ISO 639-1 codes with display names (50+)
SUPPORTED_LANGUAGES = [
    {"code": "en", "name": "English", "rtl": False},
    {"code": "hi", "name": "Hindi", "rtl": False},
    {"code": "es", "name": "Spanish", "rtl": False},
    {"code": "fr", "name": "French", "rtl": False},
    {"code": "de", "name": "German", "rtl": False},
    {"code": "pt", "name": "Portuguese", "rtl": False},
    {"code": "it", "name": "Italian", "rtl": False},
    {"code": "nl", "name": "Dutch", "rtl": False},
    {"code": "pl", "name": "Polish", "rtl": False},
    {"code": "ru", "name": "Russian", "rtl": False},
    {"code": "tr", "name": "Turkish", "rtl": False},
    {"code": "ar", "name": "Arabic", "rtl": True},
    {"code": "he", "name": "Hebrew", "rtl": True},
    {"code": "ur", "name": "Urdu", "rtl": True},
    {"code": "fa", "name": "Persian", "rtl": True},
    {"code": "zh", "name": "Chinese (Simplified)", "rtl": False},
    {"code": "zh-TW", "name": "Chinese (Traditional)", "rtl": False},
    {"code": "ja", "name": "Japanese", "rtl": False},
    {"code": "ko", "name": "Korean", "rtl": False},
    {"code": "vi", "name": "Vietnamese", "rtl": False},
    {"code": "th", "name": "Thai", "rtl": False},
    {"code": "id", "name": "Indonesian", "rtl": False},
    {"code": "ms", "name": "Malay", "rtl": False},
    {"code": "bn", "name": "Bengali", "rtl": False},
    {"code": "ta", "name": "Tamil", "rtl": False},
    {"code": "te", "name": "Telugu", "rtl": False},
    {"code": "mr", "name": "Marathi", "rtl": False},
    {"code": "gu", "name": "Gujarati", "rtl": False},
    {"code": "pa", "name": "Punjabi", "rtl": False},
    {"code": "ml", "name": "Malayalam", "rtl": False},
    {"code": "kn", "name": "Kannada", "rtl": False},
    {"code": "sw", "name": "Swahili", "rtl": False},
    {"code": "am", "name": "Amharic", "rtl": False},
    {"code": "yo", "name": "Yoruba", "rtl": False},
    {"code": "ha", "name": "Hausa", "rtl": False},
    {"code": "uk", "name": "Ukrainian", "rtl": False},
    {"code": "cs", "name": "Czech", "rtl": False},
    {"code": "sk", "name": "Slovak", "rtl": False},
    {"code": "hu", "name": "Hungarian", "rtl": False},
    {"code": "ro", "name": "Romanian", "rtl": False},
    {"code": "sv", "name": "Swedish", "rtl": False},
    {"code": "no", "name": "Norwegian", "rtl": False},
    {"code": "da", "name": "Danish", "rtl": False},
    {"code": "fi", "name": "Finnish", "rtl": False},
    {"code": "el", "name": "Greek", "rtl": False},
    {"code": "bg", "name": "Bulgarian", "rtl": False},
    {"code": "hr", "name": "Croatian", "rtl": False},
    {"code": "sr", "name": "Serbian", "rtl": False},
    {"code": "lt", "name": "Lithuanian", "rtl": False},
    {"code": "lv", "name": "Latvian", "rtl": False},
    {"code": "et", "name": "Estonian", "rtl": False},
]

_RTL_CODES = {l["code"] for l in SUPPORTED_LANGUAGES if l["rtl"]}


class TranslationService:
    def translate_text(self, text: str, target_lang: str) -> dict[str, Any]:
        """
        Translate text. Returns:
          { "text": "...", "translated": bool, "rtl": bool }
        Uses Azure Translator when configured, falls back to AI translation.
        """
        if not text or target_lang == "en":
            return {"text": text, "translated": False, "rtl": False}

        if settings.USE_TRANSLATION:
            translated = self._azure_translate(text, target_lang)
            if settings.ai_ready:
                translated = self._cultural_adapt(translated, target_lang)
        elif settings.ai_ready:
            translated = self._ai_translate(text, target_lang)
        else:
            return {"text": text, "translated": False, "rtl": target_lang in _RTL_CODES}

        return {
            "text": translated,
            "translated": True,
            "rtl": target_lang in _RTL_CODES,
        }

    def translate_summary(self, content: dict, target_lang: str) -> dict[str, Any]:
        """Translate a summary content dict ({headline, sections})."""
        if not content:
            return content
        translated_content = dict(content)
        translated_content["headline"] = self.translate_text(
            content.get("headline", ""), target_lang
        )["text"]
        translated_sections = []
        for section in content.get("sections", []):
            t_section = dict(section)
            t_section["content"] = self.translate_text(section.get("content", ""), target_lang)["text"]
            t_section["title"] = self.translate_text(section.get("title", ""), target_lang)["text"]
            translated_sections.append(t_section)
        translated_content["sections"] = translated_sections
        return translated_content

    def _ai_translate(self, text: str, target_lang: str) -> str:
        """AI-based translation fallback when Azure Translator is not configured."""
        from backend.services.ai_service import ai_service
        lang_name = next((l["name"] for l in SUPPORTED_LANGUAGES if l["code"] == target_lang), target_lang)
        prompt = (
            f"Translate the following educational text to {lang_name}. "
            f"Return ONLY the translated text with no explanation or commentary.\n\n{text[:3000]}"
        )
        try:
            return ai_service.complete(prompt, max_tokens=1500)
        except Exception:
            return text

    def _azure_translate(self, text: str, target_lang: str) -> str:
        endpoint = f"{settings.AZURE_TRANSLATOR_ENDPOINT}/translate"
        params = {"api-version": "3.0", "to": target_lang}
        headers = {
            "Ocp-Apim-Subscription-Key": settings.AZURE_TRANSLATOR_KEY,
            "Ocp-Apim-Subscription-Region": "eastus",
            "Content-Type": "application/json",
            "X-ClientTraceId": str(uuid.uuid4()),
        }
        body = [{"text": text[:5000]}]  # Translator API limit
        try:
            r = httpx.post(endpoint, params=params, headers=headers, json=body, timeout=15)
            r.raise_for_status()
            return r.json()[0]["translations"][0]["text"]
        except Exception as exc:
            print(f"[translation] Azure Translator error: {exc}")
            return text

    def _cultural_adapt(self, text: str, target_lang: str) -> str:
        from backend.services.ai_service import ai_service
        lang_name = next((l["name"] for l in SUPPORTED_LANGUAGES if l["code"] == target_lang), target_lang)
        prompt = (
            f"Review this translated educational text for a {lang_name}-speaking audience. "
            f"If any examples, analogies, or cultural references are unfamiliar in that culture, "
            f"replace them with culturally equivalent ones. Return only the revised text, nothing else.\n\n"
            f"Text: {text[:1500]}"
        )
        try:
            return ai_service.complete(prompt, max_tokens=600)
        except Exception:
            return text


translation_service = TranslationService()
