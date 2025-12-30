## Sentinel Journal

Only add entries for CRITICAL security learnings.

Format:

## YYYY-MM-DD - [Title]
**Vulnerability:** [What you found]
**Learning:** [Why it existed]
**Prevention:** [How to avoid next time]

## 2025-12-30 - Guest Session Error Reason Leakage
**Vulnerability:** `requireGuestSession` returned detailed verification reasons (e.g., expired vs bad signature) in 401 responses, enabling guest session probing and reducing attacker guesswork.
**Learning:** Debug-friendly error messages can accidentally become a token oracle when they encode verification outcomes.
**Prevention:** Keep auth/session failures generic for clients; log structured reasons server-side only (behind secure logs), and avoid echoing verifier internals in API responses.
