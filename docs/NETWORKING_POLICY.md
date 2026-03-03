# Networking Policy

Source of truth: [`lib/networkPolicy.ts`](/C:/Users/thann/WebstormProjects/dreamer/lib/networkPolicy.ts)

`fetchJSON` defaults remain:
- timeout: `30000ms`
- retries: `0`
- retry delay: `2000ms`

Endpoint-level overrides:

| Endpoint / Operation | Timeout | Retries | Retry Delay | Notes |
| --- | ---: | ---: | ---: | --- |
| `POST /guest/session` | 10000ms | 1 | 750ms | Session bootstrap should fail fast but tolerate transient network issues. |
| `POST /auth/mark-upgrade` | 10000ms | 2 | 1000ms | Important post-signup sync; safe to retry. |
| `POST /quota/status` | 10000ms | 1 | 750ms | Fast quota checks; fallback exists when unavailable. |
| `POST /subscription/sync` | 10000ms | 1 | 1000ms | Startup sync with a single retry window. |
| `POST /analyzeDream` | 45000ms | 1 | 1200ms | LLM latency can spike; one retry for transient failures. |
| `POST /categorizeDream` | 30000ms | 1 | 1200ms | Shorter analysis path, still network-volatile. |
| `POST /analyzeDreamFull` | 60000ms | 1 | 1200ms | Combined analysis + image often needs longer budget. |
| `POST /generateImage` | 60000ms | 2 | 1200ms | Image generation has higher transient failure rate. |
| `POST /generateImageWithReference` | 90000ms | 1 | 1500ms | Heaviest image path (reference processing). |
| `POST /chat` | 45000ms | 0 | 1200ms | No auto-retry to reduce duplicate-send risk. |
| `POST /tts` | 60000ms | 1 | 1200ms | Audio synthesis can be slow but is idempotent. |
| `POST /transcribe` | 60000ms | 1 | 1200ms | Speech transcription is long-running and retryable. |

