import type { DreamAnalysis } from '@/lib/types';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export interface UseDreamShareCompositeReturn {
  shareImageRef: React.RefObject<View | null>;
  shareComposite: (dream: DreamAnalysis) => Promise<void>;
  isGenerating: boolean;
}

export function useDreamShareComposite(): UseDreamShareCompositeReturn {
  const shareImageRef = useRef<View>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const shareComposite = useCallback(async (dream: DreamAnalysis): Promise<void> => {
    if (!shareImageRef.current) {
      if (__DEV__) {
        console.warn('[useDreamShareComposite] shareImageRef is not set');
      }
      return;
    }

    let tempUri: string | null = null;

    try {
      setIsGenerating(true);

      tempUri = await captureRef(shareImageRef, {
        result: 'tmpfile',
        quality: 0.9,
        format: 'jpg',
        width: 1080,
        height: 1350,
      });

      await Sharing.shareAsync(tempUri, {
        mimeType: 'image/jpeg',
        dialogTitle: dream.title,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[useDreamShareComposite] Error sharing composite:', error);
      }
      throw error;
    } finally {
      // Clean up temporary file
      if (tempUri) {
        try {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        } catch (cleanupError) {
          if (__DEV__) {
            console.warn('[useDreamShareComposite] Failed to clean up temp file:', cleanupError);
          }
        }
      }

      setIsGenerating(false);
    }
  }, []);

  return {
    shareImageRef,
    shareComposite,
    isGenerating,
  };
}
