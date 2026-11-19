import { createContext } from 'react';

export const OfflineModelCheckContext = createContext<((locale: string) => Promise<boolean>) | undefined>(undefined);
