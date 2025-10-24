Backend proxy integration

Configure API base URL
- Use env var at start time: `EXPO_PUBLIC_API_URL=http://localhost:3000`
- Or set `extra.apiUrl` in `app.json`
- Default fallback if unset: `http://localhost:3000`

Supabase Edge Functions
- You can deploy a single function named `api` and route inside it. Then set:
  - `EXPO_PUBLIC_API_URL=https://<project-ref>.functions.supabase.co/api`
  - Requests will go to `/api/analyzeDream`, `/api/generateImage`, etc.
  - See `supabase/functions/api/index.ts` and `docs/supabase-setup.md`.

Expected endpoints
- POST `/analyzeDream`
  - Request JSON: `{ "transcript": string }`
  - Response JSON: `{ "title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string }`

- POST `/generateImage`
  - Request JSON: `{ "prompt": string }`
  - Response JSON: either `{ "imageUrl": string }` or `{ "imageBytes": base64-string }`

- POST `/chat`
  - Request JSON: `{ "history": [{ "role": "user"|"model", "text": string }], "message": string, "lang": string }`
  - Response JSON: `{ "text": string }`

- POST `/tts`
  - Request JSON: `{ "text": string }`
  - Response JSON: `{ "audioBase64": base64-string }`

Minimal Express stub (for local testing)
```ts
import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/analyzeDream', (req, res) => {
  const transcript = String(req.body?.transcript || '');
  res.json({
    title: transcript ? `On ${transcript.slice(0,40)}…` : 'A Journey Through Sleep',
    interpretation: 'Your dream reflects inner thoughts seeking balance.\n\nSymbols suggest transformation and curiosity.',
    shareableQuote: 'Between starlight and silence, a truth softly emerges.',
    theme: 'surreal',
    dreamType: 'Lucid Dream',
    imagePrompt: 'A surreal nocturne with floating lights over a still sea.',
  });
});

app.post('/generateImage', (_req, res) => {
  res.json({ imageUrl: 'https://picsum.photos/800/1200' });
});

app.post('/chat', (req, res) => {
  const message = String(req.body?.message || '');
  res.json({ text: `Let’s unpack that: “${message}”. What feelings stood out most?` });
});

app.post('/tts', (req, res) => {
  // Return silent PCM or any base64; client expects base64 string
  res.json({ audioBase64: '' });
});

app.listen(3000, () => console.log('API on http://localhost:3000'));
```
