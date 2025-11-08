# Mock Data

This directory contains mock data and generators for development mode.

## Files

### `predefinedDreams.ts`
Contains 8 curated, realistic dream entries with:
- Detailed transcripts (what the user "dreamed")
- AI-generated interpretations
- Shareable quotes
- Themes (surreal, mystical, calm, noir)
- Dream types (Lucid, Recurring, Nightmare, etc.)
- Some dreams include chat histories to showcase the chat feature

These dreams are automatically pre-loaded when the app starts in mock mode.

### `generators.ts`
Provides functions to generate random dream content:
- `generateRandomDream()` - Creates a complete random dream entry
- `generateAnalysisResult(transcript)` - Generates analysis for a given transcript
- `generateChatResponse(userMessage, dreamContext)` - Creates contextual chat responses

Use these when you want to add new dreams in mock mode without hardcoding them.

### `assets.ts`
Manages placeholder images for dreams:
- Uses picsum.photos for realistic placeholder images
- Different image sets for each theme (surreal, mystical, calm, noir)
- `getRandomImageForTheme(theme)` - Get a random image for a specific theme
- `getThumbnailUrl(imageUrl)` - Generate thumbnail version of an image

## Usage

### Adding New Predefined Dreams

Edit `predefinedDreams.ts` and add to the `PREDEFINED_DREAMS` array:

```typescript
{
  title: 'Your Dream Title',
  transcript: 'Full dream description...',
  interpretation: 'What the dream means...',
  shareableQuote: 'An inspiring quote',
  theme: 'surreal', // or 'mystical', 'calm', 'noir'
  dreamType: 'Lucid Dream',
  imageUrl: 'https://picsum.photos/seed/your-seed/800/600',
  thumbnailUrl: 'https://picsum.photos/seed/your-seed/400/300',
  chatHistory: [], // or add example chat messages
  isFavorite: false,
  imageGenerationFailed: false,
}
```

### Generating Random Dreams

In your mock service or tests:

```typescript
import { generateRandomDream } from '@/mock-data/generators';

const newDream = {
  id: Date.now().toString(),
  ...generateRandomDream()
};
```

### Customizing Image Sources

If you want to use different placeholder images, edit the `MOCK_IMAGES` object in `assets.ts`.

## Notes

- Images are from picsum.photos (free, no attribution required)
- All mock data is designed to showcase app features realistically
- Dreams cover various themes and emotions for comprehensive testing
- Chat histories demonstrate the AI conversation feature
