import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { WORLD_SOUND_BY_ID } from '@/content/worldSounds';
import type { WorldId } from '@/constants/worlds';
import * as audio from '@/services/audioService';

/** A focused surface owns its players and releases them when its world changes. */
export function useWorldSoundscape(worldId: WorldId, active: boolean) {
  const isFocused = useIsFocused();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [readyToken, setReadyToken] = useState(0);
  const layersRef = useRef<audio.PlayerHandle[]>([]);
  const cueRef = useRef<audio.PlayerHandle | null>(null);
  const cuePlayedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const profile = WORLD_SOUND_BY_ID[worldId];
    const layers = [profile.primary, profile.secondary].filter(
      (layer): layer is NonNullable<typeof layer> => layer !== null
    );

    audio.configureAudioSession().catch(() => {});
    cuePlayedRef.current = false;

    void (async () => {
      try {
        const resolvedLayers = await Promise.all(
          layers.map(async (layer) => ({
            ...layer,
            source: await audio.resolvePlayableSource(layer.source),
          }))
        );
        const cueSource = profile.cue
          ? await audio.resolvePlayableSource(profile.cue)
          : null;
        if (cancelled) return;

        layersRef.current = resolvedLayers.map((layer) => {
          const player = audio.createPlayer(layer.source, 1_000);
          audio.setLoop(player, true);
          audio.setRate(player, layer.rate);
          audio.setVolume(player, layer.volume);
          return player;
        });

        if (cueSource) {
          const cue = audio.createPlayer(cueSource, 1_000);
          audio.setVolume(cue, profile.cueVolume);
          cueRef.current = cue;
        }
        if (cancelled) {
          layersRef.current.forEach(audio.release);
          layersRef.current = [];
          if (cueRef.current) audio.release(cueRef.current);
          cueRef.current = null;
          return;
        }
        setReadyToken((token) => token + 1);
      } catch {
        if (cancelled) return;
        layersRef.current.forEach(audio.release);
        layersRef.current = [];
        cueRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      layersRef.current.forEach(audio.release);
      layersRef.current = [];
      if (cueRef.current) audio.release(cueRef.current);
      cueRef.current = null;
    };
  }, [worldId]);

  useEffect(() => {
    const shouldPlay = active && isFocused && soundEnabled;
    layersRef.current.forEach((player) => {
      if (shouldPlay) audio.play(player);
      else audio.pause(player);
    });

    if (!shouldPlay) {
      if (cueRef.current) audio.pause(cueRef.current);
      return;
    }

    const cue = cueRef.current;
    if (!cue || cuePlayedRef.current) return;
    cuePlayedRef.current = true;
    audio.seekTo(cue, 0).then(() => audio.play(cue)).catch(() => audio.play(cue));
  }, [active, isFocused, readyToken, soundEnabled, worldId]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => !enabled);
  }, []);

  return { soundEnabled, toggleSound };
}
