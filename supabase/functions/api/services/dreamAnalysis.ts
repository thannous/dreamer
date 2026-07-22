import { ANALYZE_DREAM_SCHEMA } from '../lib/schemas.ts';
import {
  callGeminiWithFallback,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_MODEL,
  resolveTextModel,
} from './gemini.ts';

const ANALYSIS_LANG_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
};

const ANALYSIS_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  en: 'You are an expert, empathetic dream analyst. Return ONLY valid JSON.',
  fr: 'Tu es un analyste de rêves expert et bienveillant. Retourne UNIQUEMENT du JSON valide.',
  es: 'Eres un analista de sueños experto y empático. Devuelve SOLO JSON válido.',
  de: 'Du bist ein erfahrener, einfühlsamer Traumanalyst. Gib NUR gültiges JSON zurück.',
  it: 'Sei un analista di sogni esperto ed empatico. Restituisci SOLO JSON valido.',
};

const buildAnalysisPrompt = (transcript: string, langName: string): string =>
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

export type DreamAnalysisDetails = {
  symbols: { name: string; meaning: string }[];
  emotions: { name: string; insight: string }[];
  reflectionQuestions: string[];
};

export type StructuredDreamAnalysis = {
  title: string;
  interpretation: string;
  shareableQuote: string;
  theme: string;
  dreamType: string;
  imagePrompt: string;
} & DreamAnalysisDetails;

const sanitizeNamedInsights = (
  value: unknown,
  detailKey: 'meaning' | 'insight',
  maxItems: number
): { name: string; [key: string]: string }[] => {
  if (!Array.isArray(value)) return [];
  const items: { name: string; [key: string]: string }[] = [];
  for (const entry of value) {
    const name = typeof (entry as any)?.name === 'string' ? (entry as any).name.trim() : '';
    const detail =
      typeof (entry as any)?.[detailKey] === 'string' ? (entry as any)[detailKey].trim() : '';
    if (!name || !detail) continue;
    items.push({ name, [detailKey]: detail });
    if (items.length >= maxItems) break;
  }
  return items;
};

export const sanitizeAnalysisDetails = (analysis: unknown): DreamAnalysisDetails => {
  const source = (analysis ?? {}) as Record<string, unknown>;
  const reflectionQuestions = Array.isArray(source.reflectionQuestions)
    ? source.reflectionQuestions
        .filter((question): question is string => typeof question === 'string' && !!question.trim())
        .map((question) => question.trim())
        .slice(0, 3)
    : [];

  return {
    symbols: sanitizeNamedInsights(source.symbols, 'meaning', 6) as DreamAnalysisDetails['symbols'],
    emotions: sanitizeNamedInsights(source.emotions, 'insight', 4) as DreamAnalysisDetails['emotions'],
    reflectionQuestions,
  };
};

export const runDreamAnalysis = async (options: {
  apiKey: string;
  transcript: string;
  lang: string;
  route: string;
}): Promise<StructuredDreamAnalysis> => {
  const { apiKey, transcript, lang, route } = options;
  const langName = ANALYSIS_LANG_NAMES[lang] ?? ANALYSIS_LANG_NAMES.en;
  const systemInstruction = ANALYSIS_SYSTEM_INSTRUCTIONS[lang] ?? ANALYSIS_SYSTEM_INSTRUCTIONS.en;

  const { text } = await callGeminiWithFallback(
    apiKey,
    resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL),
    resolveTextModel('GEMINI_FALLBACK_MODEL', GEMINI_FLASH_LITE_MODEL),
    [{ role: 'user', parts: [{ text: buildAnalysisPrompt(transcript, langName) }] }],
    systemInstruction,
    {
      responseMimeType: 'application/json',
      responseJsonSchema: ANALYZE_DREAM_SCHEMA,
      thinkingLevel: 'low',
      maxOutputTokens: 4096,
    }
  );

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Never log a model response: it can contain dream content.
    console.error(`[api] ${route}: model returned invalid JSON`, { responseLength: text.length });
    throw new Error('Failed to parse model response');
  }
  if (!analysis.title || !analysis.interpretation) {
    throw new Error('Missing required fields in model response');
  }

  const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(String(analysis.theme))
    ? String(analysis.theme)
    : 'surreal';

  return {
    title: String(analysis.title ?? ''),
    interpretation: String(analysis.interpretation ?? ''),
    shareableQuote: String(analysis.shareableQuote ?? ''),
    theme,
    dreamType: String(analysis.dreamType ?? 'Symbolic Dream'),
    imagePrompt: String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere'),
    ...sanitizeAnalysisDetails(analysis),
  };
};
