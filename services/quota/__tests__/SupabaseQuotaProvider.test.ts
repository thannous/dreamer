import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseQuotaProvider } from '../SupabaseQuotaProvider';

const freeUser = { id: 'free-user', user_metadata: { tier: 'free' } } as unknown as User;
const premiumUser = { id: 'premium-user', user_metadata: { tier: 'premium' } } as unknown as User;

describe('SupabaseQuotaProvider – free tier monthly analysis quotas', () => {
  it('allows analyses within initial and monthly limits', async () => {
    const provider = new SupabaseQuotaProvider();
    const p = provider as any;

    p.getUsedAnalysisCount = vi.fn().mockResolvedValue(4);
    p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(0);
    await expect(provider.canAnalyzeDream(freeUser)).resolves.toBe(true);

    p.getUsedAnalysisCount = vi.fn().mockResolvedValue(5);
    p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
    await expect(provider.canAnalyzeDream(freeUser)).resolves.toBe(true);

    p.getUsedAnalysisCount = vi.fn().mockResolvedValue(10);
    p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(2);
    await expect(provider.canAnalyzeDream(freeUser)).resolves.toBe(false);
  });
});

describe('SupabaseQuotaProvider – free tier monthly exploration quotas', () => {
  it('applies initial then monthly limits for explorations', async () => {
    const provider = new SupabaseQuotaProvider();
    const p = provider as any;

    p.resolveDream = vi.fn().mockResolvedValue(undefined);

    p.getUsedExplorationCount = vi.fn().mockResolvedValue(1);
    p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
    await expect(provider.canExploreDream({ dreamId: 1 }, freeUser)).resolves.toBe(true);

    p.getUsedExplorationCount = vi.fn().mockResolvedValue(2);
    p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(0);
    await expect(provider.canExploreDream({ dreamId: 2 }, freeUser)).resolves.toBe(true);

    p.getUsedExplorationCount = vi.fn().mockResolvedValue(5);
    p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(1);
    await expect(provider.canExploreDream({ dreamId: 3 }, freeUser)).resolves.toBe(false);
  });

  it('always allows continuing exploration on already explored dreams', async () => {
    const provider = new SupabaseQuotaProvider();
    const p = provider as any;

    const exploredDream = { id: 42, explorationStartedAt: Date.now() };
    p.resolveDream = vi.fn().mockResolvedValue(exploredDream);
    p.getUsedExplorationCount = vi.fn().mockResolvedValue(100);
    p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(10);

    await expect(provider.canExploreDream({ dreamId: exploredDream.id }, freeUser)).resolves.toBe(true);
  });
});

describe('SupabaseQuotaProvider – free tier quota status view', () => {
  it('uses initial limits first then monthly for free tier', async () => {
    const provider = new SupabaseQuotaProvider();
    const p = provider as any;

    p.getUsedAnalysisCount = vi.fn().mockResolvedValue(3);
    p.getUsedExplorationCount = vi.fn().mockResolvedValue(1);
    p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
    p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(1);
    p.getUsedMessagesCount = vi.fn().mockResolvedValue(0);

    let status = await provider.getQuotaStatus(freeUser);
    expect(status.usage.analysis.limit).toBe(5);
    expect(status.usage.analysis.used).toBe(3);
    expect(status.usage.exploration.limit).toBe(2);
    expect(status.usage.exploration.used).toBe(1);

    p.getUsedAnalysisCount = vi.fn().mockResolvedValue(5);
    p.getUsedExplorationCount = vi.fn().mockResolvedValue(2);
    p.getMonthlyAnalysisCount = vi.fn().mockResolvedValue(1);
    p.getMonthlyExplorationCount = vi.fn().mockResolvedValue(1);

    status = await provider.getQuotaStatus(freeUser);
    expect(status.usage.analysis.limit).toBe(2);
    expect(status.usage.analysis.used).toBe(1);
    expect(status.usage.exploration.limit).toBe(1);
    expect(status.usage.exploration.used).toBe(1);
  });
});

describe('SupabaseQuotaProvider – premium tier', () => {
  it('does not enforce analysis or exploration limits', async () => {
    const provider = new SupabaseQuotaProvider();
    const p = provider as any;

    p.getUsedAnalysisCount = vi.fn().mockResolvedValue(1000);
    p.getUsedExplorationCount = vi.fn().mockResolvedValue(1000);

    await expect(provider.canAnalyzeDream(premiumUser)).resolves.toBe(true);
    await expect(provider.canExploreDream(undefined, premiumUser)).resolves.toBe(true);

    const status = await provider.getQuotaStatus(premiumUser);
    expect(status.usage.analysis.limit).toBeNull();
    expect(status.usage.exploration.limit).toBeNull();
  });
});
