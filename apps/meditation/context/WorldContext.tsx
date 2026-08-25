import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_WORLD_ID,
  isWorldId,
  type MeditationWorld,
  type WorldId,
  WORLD_BY_ID,
} from '@/constants/worlds';
import { readJson, StorageKey, writeJson } from '@/services/storageService';

type WorldContextValue = {
  loaded: boolean;
  worldId: WorldId;
  world: MeditationWorld;
  previewWorldId: WorldId | null;
  presentationWorldId: WorldId;
  presentationWorld: MeditationWorld;
  setWorld: (worldId: WorldId) => Promise<void>;
  setPreviewWorld: (worldId: WorldId | null) => void;
};

const WorldContext = createContext<WorldContextValue | null>(null);

export const WorldProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [worldId, setWorldId] = useState<WorldId>(DEFAULT_WORLD_ID);
  const [previewWorldId, setPreviewWorldId] = useState<WorldId | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    readJson<unknown>(StorageKey.world, DEFAULT_WORLD_ID)
      .then((stored) => {
        if (mounted && isWorldId(stored)) setWorldId(stored);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setWorld = useCallback(async (nextWorldId: WorldId) => {
    setPreviewWorldId(null);
    setWorldId(nextWorldId);
    await writeJson(StorageKey.world, nextWorldId);
  }, []);

  const setPreviewWorld = useCallback((nextWorldId: WorldId | null) => {
    setPreviewWorldId(nextWorldId);
  }, []);

  const presentationWorldId = previewWorldId ?? worldId;

  const value = useMemo<WorldContextValue>(
    () => ({
      loaded,
      worldId,
      world: WORLD_BY_ID[worldId],
      previewWorldId,
      presentationWorldId,
      presentationWorld: WORLD_BY_ID[presentationWorldId],
      setWorld,
      setPreviewWorld,
    }),
    [loaded, worldId, previewWorldId, presentationWorldId, setWorld, setPreviewWorld]
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
};

const FALLBACK_VALUE: WorldContextValue = {
  loaded: false,
  worldId: DEFAULT_WORLD_ID,
  world: WORLD_BY_ID[DEFAULT_WORLD_ID],
  previewWorldId: null,
  presentationWorldId: DEFAULT_WORLD_ID,
  presentationWorld: WORLD_BY_ID[DEFAULT_WORLD_ID],
  setWorld: async () => {},
  setPreviewWorld: () => {},
};

export const useWorld = (): WorldContextValue => useContext(WorldContext) ?? FALLBACK_VALUE;
