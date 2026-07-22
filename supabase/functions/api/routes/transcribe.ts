import { corsHeaders } from "../lib/constants.ts";
import { requireGuestSession } from "../lib/guards.ts";
import { AI_REQUEST_LIMITS } from "../lib/aiRequestPolicy.ts";
import { admitSynchronousAiRequest } from "../services/aiAdmission.ts";
import type { ApiContext } from "../types.ts";

const ALLOWED_ENCODINGS = new Set(["LINEAR16", "AMR_WB", "WEBM_OPUS"]);
const LANGUAGE_CODE_PATTERN =
  /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|\d{3}))?$/;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MIN_SAMPLE_RATE_HERTZ = 8000;
const MAX_SAMPLE_RATE_HERTZ = 48000;

export const MAX_TRANSCRIPTION_BASE64_CHARS = 8 * 1024 * 1024;

type TranscribeBody = {
  contentBase64?: unknown;
  encoding?: unknown;
  languageCode?: unknown;
  sampleRateHertz?: unknown;
};

type SpeechProviderResponse = {
  results?: {
    alternatives?: { transcript?: unknown }[];
  }[];
};

type TranscribeDependencies = {
  apiKey?: string;
  fetch?: typeof fetch;
  admitRequest?: typeof admitSynchronousAiRequest;
};

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const invalidRequest = (error: string): Response =>
  jsonResponse({ error }, 400);
const providerUnavailable = (status = 502): Response =>
  jsonResponse({ error: "Transcription service unavailable" }, status);

const readTranscribeBody = async (
  req: Request,
): Promise<TranscribeBody | Response> => {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return invalidRequest("Invalid request body");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return invalidRequest("Invalid request body");
  }

  return parsed as TranscribeBody;
};

export async function handleTranscribe(
  ctx: ApiContext,
  dependencies: TranscribeDependencies = {},
): Promise<Response> {
  const { req, user } = ctx;

  const sessionCheck = await requireGuestSession(req, null, user);
  if (sessionCheck instanceof Response) {
    return sessionCheck;
  }

  const body = await readTranscribeBody(req);
  if (body instanceof Response) {
    return body;
  }

  if (typeof body.contentBase64 !== "string" || !body.contentBase64) {
    return invalidRequest("Invalid audio content");
  }
  if (body.contentBase64.length > MAX_TRANSCRIPTION_BASE64_CHARS) {
    return jsonResponse({ error: "Audio payload too large" }, 413);
  }
  if (
    body.contentBase64.length % 4 !== 0 ||
    !BASE64_PATTERN.test(body.contentBase64)
  ) {
    return invalidRequest("Invalid audio content");
  }

  const encoding = typeof body.encoding === "undefined"
    ? "LINEAR16"
    : typeof body.encoding === "string"
    ? body.encoding.trim().toUpperCase()
    : "";
  if (!ALLOWED_ENCODINGS.has(encoding)) {
    return invalidRequest("Unsupported audio encoding");
  }

  const languageCode = typeof body.languageCode === "undefined"
    ? "fr-FR"
    : typeof body.languageCode === "string"
    ? body.languageCode.trim()
    : "";
  if (!LANGUAGE_CODE_PATTERN.test(languageCode)) {
    return invalidRequest("Invalid language code");
  }

  const sampleRateHertz = body.sampleRateHertz;
  if (
    typeof sampleRateHertz !== "undefined" &&
    (typeof sampleRateHertz !== "number" ||
      !Number.isInteger(sampleRateHertz) ||
      sampleRateHertz < MIN_SAMPLE_RATE_HERTZ ||
      sampleRateHertz > MAX_SAMPLE_RATE_HERTZ)
  ) {
    return invalidRequest("Invalid sample rate");
  }

  const admission = await (dependencies.admitRequest ?? admitSynchronousAiRequest)({
    ctx,
    capability: "transcribe",
    guestFingerprint: sessionCheck.fingerprint,
  });
  if (admission instanceof Response) {
    return admission;
  }

  const apiKey = dependencies.apiKey?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_STT_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_API_KEY")?.trim();
  if (!apiKey) {
    console.error("[api] /transcribe provider configuration unavailable");
    return providerUnavailable(503);
  }

  const config: Record<string, unknown> = {
    encoding,
    languageCode,
    enableAutomaticPunctuation: true,
  };
  if (typeof sampleRateHertz === "number") {
    config.sampleRateHertz = sampleRateHertz;
  }

  const providerUrl = new URL(
    "https://speech.googleapis.com/v1/speech:recognize",
  );
  providerUrl.searchParams.set("key", apiKey);

  let providerResponse: Response;
  try {
    providerResponse = await (dependencies.fetch ?? fetch)(providerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, audio: { content: body.contentBase64 } }),
    });
  } catch {
    console.error("[api] /transcribe provider request failed");
    return providerUnavailable();
  }

  if (!providerResponse.ok) {
    console.error("[api] /transcribe provider rejected request", {
      status: providerResponse.status,
    });
    return providerUnavailable();
  }

  let providerBody: SpeechProviderResponse;
  try {
    providerBody = (await providerResponse.json()) as SpeechProviderResponse;
  } catch {
    console.error("[api] /transcribe provider returned invalid response");
    return providerUnavailable();
  }

  const candidate = providerBody.results?.[0]?.alternatives?.[0]?.transcript;
  const transcript = typeof candidate === "string"
    ? candidate.trim().slice(0, AI_REQUEST_LIMITS.transcriptChars)
    : "";
  return jsonResponse({ transcript }, 200);
}
