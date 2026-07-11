import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import type { ApiContext } from "../types.ts";
import {
  handleTranscribe,
  MAX_TRANSCRIPTION_BASE64_CHARS,
} from "./transcribe.ts";

const TEST_API_KEY = "test-provider-key";
const VALID_AUDIO_BASE64 = "YXVkaW8=";

const createContext = (
  body: Record<string, unknown>,
  user: unknown | null,
): ApiContext => ({
  req: new Request("https://example.test/functions/v1/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  supabase: {},
  user,
  supabaseUrl: "https://example.test",
  supabaseServiceRoleKey: null,
  storageBucket: "test-bucket",
});

const validBody = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  contentBase64: VALID_AUDIO_BASE64,
  encoding: "LINEAR16",
  languageCode: "fr-FR",
  sampleRateHertz: 16000,
  ...overrides,
});

Deno.test("/transcribe rejects unauthenticated requests before provider work", async () => {
  let providerCalls = 0;
  const providerFetch: typeof fetch = () => {
    providerCalls += 1;
    return Promise.resolve(Response.json({ results: [] }));
  };

  const response = await handleTranscribe(createContext(validBody(), null), {
    apiKey: TEST_API_KEY,
    fetch: providerFetch,
  });

  assertEquals(response.status, 401);
  assertEquals(providerCalls, 0);
});

Deno.test("/transcribe accepts an authenticated request and returns the transcript", async () => {
  let providerCalls = 0;
  const providerFetch: typeof fetch = async (input, init) => {
    providerCalls += 1;
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    assertEquals(
      url.origin + url.pathname,
      "https://speech.googleapis.com/v1/speech:recognize",
    );
    assertEquals(url.searchParams.get("key"), TEST_API_KEY);

    const requestBody = JSON.parse(String(
      (init as { body?: BodyInit } | undefined)?.body,
    )) as {
      config: Record<string, unknown>;
      audio: { content: string };
    };
    assertEquals(requestBody.config.encoding, "LINEAR16");
    assertEquals(requestBody.config.languageCode, "fr-FR");
    assertEquals(requestBody.config.sampleRateHertz, 16000);
    assertEquals(requestBody.audio.content, VALID_AUDIO_BASE64);

    return Response.json({
      results: [{ alternatives: [{ transcript: "une forêt sous la lune" }] }],
    });
  };

  const response = await handleTranscribe(
    createContext(validBody(), { id: "user-1" }),
    {
      apiKey: TEST_API_KEY,
      fetch: providerFetch,
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { transcript: "une forêt sous la lune" });
  assertEquals(providerCalls, 1);
});

Deno.test("/transcribe rejects an oversized audio payload with 413", async () => {
  let providerCalls = 0;
  const providerFetch: typeof fetch = () => {
    providerCalls += 1;
    return Promise.resolve(Response.json({ results: [] }));
  };

  const response = await handleTranscribe(
    createContext(
      validBody({
        contentBase64: "A".repeat(MAX_TRANSCRIPTION_BASE64_CHARS + 1),
      }),
      {
        id: "user-1",
      },
    ),
    { apiKey: TEST_API_KEY, fetch: providerFetch },
  );

  assertEquals(response.status, 413);
  assertEquals(await response.json(), { error: "Audio payload too large" });
  assertEquals(providerCalls, 0);
});

Deno.test("/transcribe rejects an unsupported encoding with 400", async () => {
  let providerCalls = 0;
  const providerFetch: typeof fetch = () => {
    providerCalls += 1;
    return Promise.resolve(Response.json({ results: [] }));
  };

  const response = await handleTranscribe(
    createContext(validBody({ encoding: "MP3" }), { id: "user-1" }),
    { apiKey: TEST_API_KEY, fetch: providerFetch },
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Unsupported audio encoding" });
  assertEquals(providerCalls, 0);
});

Deno.test("/transcribe hides provider failure details", async () => {
  const providerFetch: typeof fetch = () =>
    Promise.resolve(
      new Response("provider-secret-diagnostic", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }),
    );

  const response = await handleTranscribe(
    createContext(validBody(), { id: "user-1" }),
    {
      apiKey: TEST_API_KEY,
      fetch: providerFetch,
    },
  );
  const body = await response.json();

  assertEquals(response.status, 502);
  assertEquals(body, { error: "Transcription service unavailable" });
  assertFalse(JSON.stringify(body).includes("provider-secret-diagnostic"));
});
