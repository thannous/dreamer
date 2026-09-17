import type { AppProduct } from './types';

/** Frozen production identities. Local QA/dev rows must not reuse these IDs, hosts, or OTA. */
export const PRODUCTION_IDENTITIES = {
  dream: {
    product: 'dream',
    name: 'Noctalia',
    slug: 'noctalia',
    androidApplicationId: 'com.tanuki75.noctalia',
    iosBundleIdentifier: 'com.tanuki75.noctalia',
    scheme: 'noctalia',
    host: 'dream.noctalia.app',
    easProjectId: 'cfd1b275-9dad-40d7-9d9a-147c7bb38415',
    otaUpdatesUrl: 'https://u.expo.dev/cfd1b275-9dad-40d7-9d9a-147c7bb38415',
  },
  lucid: {
    product: 'lucid',
    name: 'Noctalia Lucid Trainer',
    slug: 'noctalia-lucid-trainer',
    androidApplicationId: 'com.tanuki75.noctalia.lucid',
    iosBundleIdentifier: 'com.tanuki75.noctalia.lucid',
    scheme: 'noctalia-lucid',
    host: 'lucid.noctalia.app',
    easProjectId: 'd210576f-5dc4-4f7a-a5e1-a407c209c3a2',
  },
  meditation: {
    product: 'meditation',
    name: 'Noctalia Meditation',
    slug: 'noctalia-meditation',
    androidApplicationId: 'com.noctalia.meditation',
    iosBundleIdentifier: 'com.noctalia.meditation',
    scheme: 'noctaliameditation',
    host: null,
    easProjectId: '8bd251b4-f3ed-4ae4-a73b-e2cc6c9d30c7',
  },
} as const satisfies Record<
  AppProduct,
  {
    product: AppProduct;
    name: string;
    slug: string;
    androidApplicationId: string;
    iosBundleIdentifier: string;
    scheme: string;
    host: string | null;
    easProjectId: string;
    otaUpdatesUrl?: string;
  }
>;

export const PRODUCTION_HOSTS = [
  PRODUCTION_IDENTITIES.dream.host,
  PRODUCTION_IDENTITIES.lucid.host,
] as const;
