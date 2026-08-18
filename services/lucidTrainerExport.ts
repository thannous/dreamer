import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { LucidTrainerState } from '@/lib/lucid/model';
import { exportLucidTrainerCsv, exportLucidTrainerJson } from '@/services/lucidTrainerStorage';

export type LucidExportFormat = 'json' | 'csv';

export async function shareLucidTrainerExport(
  state: LucidTrainerState,
  format: LucidExportFormat
): Promise<{ uri: string; shared: boolean }> {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `noctalia-lucid-export-${stamp}.${format}`);
  file.create({ overwrite: true, intermediates: true });
  file.write(format === 'json' ? exportLucidTrainerJson(state) : exportLucidTrainerCsv(state));
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Noctalia Lucid Trainer export',
      mimeType: format === 'json' ? 'application/json' : 'text/csv',
      UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
    });
  }
  return { uri: file.uri, shared: canShare };
}
