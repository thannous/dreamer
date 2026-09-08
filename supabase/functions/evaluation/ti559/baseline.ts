// Exact pre-TI559 prompt snapshot at d2bc25936. Evaluation only.
import type { AiLanguage } from "../../api/lib/aiLanguage.ts";
export const ANALYSIS_SYSTEM_INSTRUCTIONS: Record<AiLanguage, string> = {
  en: 'You are an expert, empathetic dream analyst. Return ONLY valid JSON.',
  fr: 'Tu es un analyste de rêves expert et bienveillant. Retourne UNIQUEMENT du JSON valide.',
  es: 'Eres un analista de sueños experto y empático. Devuelve SOLO JSON válido.',
  de: 'Du bist ein erfahrener, einfühlsamer Traumanalyst. Gib NUR gültiges JSON zurück.',
  it: 'Sei un analista di sogni esperto ed empatico. Restituisci SOLO JSON valido.',
  pt: 'Você é um analista de sonhos experiente e acolhedor. Retorne APENAS JSON válido.',
};

export const buildAnalysisPrompt = (transcript: string, langName: string): string =>
  `Analyze the user's dream and return JSON with exactly these keys:
- "title": an evocative title (3-6 words).
- "interpretation": a detailed interpretation of 3 to 5 paragraphs (at least 180 words) separated by blank lines: open with the dream's narrative arc and overall meaning, then explore its symbolism, then the emotional landscape, and close with how it may connect to the dreamer's waking life. Warm and insightful, never clinical or alarmist; no medical claims.
- "shareableQuote": one poetic sentence capturing the dream's essence.
- "theme": the dream's visual atmosphere, one of "surreal", "mystical", "calm", "noir".
- "dreamType": the single most fitting of "Lucid Dream", "Recurring Dream", "Nightmare", "Symbolic Dream".
- "symbols": 3-6 key symbols appearing in this dream, each with "name" and a 1-2 sentence "meaning" tied to this specific dream, not a generic dictionary definition.
- "emotions": 2-4 dominant emotions in the dream, each with "name" and a 1-2 sentence "insight" into what it may reveal.
- "reflectionQuestions": 2-3 gentle open questions inviting the dreamer to reflect on the dream.
- "imagePrompt": a vivid artistic prompt (max 40 words) to visualize the dream, ALWAYS written in English.

Everything except imagePrompt MUST be written in ${langName}.
Dream transcript:
${transcript}`;

