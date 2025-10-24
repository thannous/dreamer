# Speech-to-Text Integration Guide

## Current Implementation

The recording screen (`app/recording.tsx`) currently supports audio recording using `expo-av`, but speech-to-text transcription is not yet implemented. The audio is successfully captured and stored, but requires a third-party service to convert speech to text.

## Recommended Integration Options

### Option 1: OpenAI Whisper API (Recommended)
OpenAI's Whisper is highly accurate for transcription and supports multiple languages.

```typescript
import { Audio } from 'expo-av';

async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'dream-recording.m4a',
  } as any);
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const result = await response.json();
  return result.text;
}
```

### Option 2: Google Cloud Speech-to-Text
Google Cloud provides highly accurate transcription with support for many languages.

```typescript
async function transcribeWithGoogle(audioUri: string): Promise<string> {
  // Convert audio to base64
  const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.EXPO_PUBLIC_GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
        audio: { content: audioBase64 },
      }),
    }
  );

  const result = await response.json();
  return result.results?.[0]?.alternatives?.[0]?.transcript || '';
}
```

### Option 3: Azure Speech Service
Microsoft Azure offers robust speech-to-text capabilities.

```typescript
async function transcribeWithAzure(audioUri: string): Promise<string> {
  const audioData = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav',
      },
      body: audioData,
    }
  );

  const result = await response.json();
  return result.DisplayText;
}
```

## Integration Steps

1. Choose a speech-to-text service provider
2. Add API key to `.env` file:
   ```
   EXPO_PUBLIC_OPENAI_API_KEY=your_key_here
   # or
   EXPO_PUBLIC_GOOGLE_API_KEY=your_key_here
   # or
   EXPO_PUBLIC_AZURE_SPEECH_KEY=your_key_here
   ```

3. Update the `stopRecording` function in `app/recording.tsx`:
   ```typescript
   const stopRecording = async () => {
     if (!recording) return;

     try {
       setIsRecording(false);
       await recording.stopAndUnloadAsync();
       const uri = recording.getURI();
       setRecording(null);

       if (uri) {
         // Add transcription here
         const transcribedText = await transcribeAudio(uri);
         setTranscript(prevTranscript =>
           prevTranscript ? `${prevTranscript}\n${transcribedText}` : transcribedText
         );
       }
     } catch (err) {
       console.error('Failed to stop recording:', err);
       Alert.alert('Error', 'Failed to process recording.');
     }
   };
   ```

4. Create a service file `services/speechToText.ts` to centralize transcription logic

## Cost Considerations

- **OpenAI Whisper**: $0.006 per minute of audio
- **Google Cloud**: First 60 minutes free per month, then $0.006-$0.024 per 15 seconds
- **Azure**: First 5 hours free per month, then $1.00 per audio hour

## Notes

- Audio quality affects transcription accuracy
- Consider adding a loading indicator during transcription
- Handle network errors gracefully
- May want to cache/store recordings for retry scenarios
