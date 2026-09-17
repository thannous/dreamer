import {
  LUCID_PLUS_CURRENT_BENEFIT_IDS,
  LUCID_PLUS_FEATURE_IDS,
  LUCID_PLUS_FEATURE_MATRIX,
  LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS,
  canStartLucidDreamRehearsal,
  getLucidPlusFeatureAccess,
  isLucidPlusFeatureAlwaysFree,
  listLucidPlusPaywallItems,
  resolveLucidAdditionalDreamRehearsalAccess,
} from '@/lib/lucid/plusEntitlements';

describe('Lucid Plus entitlement matrix', () => {
  it('keeps safety, night stop, export, delete and accessibility always free', () => {
    expect(getLucidPlusFeatureAccess('safety')).toBe('always_free');
    expect(getLucidPlusFeatureAccess('night_stop')).toBe('always_free');
    expect(getLucidPlusFeatureAccess('export')).toBe('always_free');
    expect(getLucidPlusFeatureAccess('delete')).toBe('always_free');
    expect(getLucidPlusFeatureAccess('accessibility')).toBe('always_free');
    for (const id of ['safety', 'night_stop', 'export', 'delete', 'accessibility'] as const) {
      expect(isLucidPlusFeatureAlwaysFree(id)).toBe(true);
    }
  });

  it('never gates the atlas, its grouping, sources or deletion', () => {
    expect(LUCID_PLUS_FEATURE_MATRIX.dream_atlas).toBe('always_free');
    expect(LUCID_PLUS_FEATURE_MATRIX.dream_atlas_grouping).toBe('always_free');
    expect(LUCID_PLUS_FEATURE_MATRIX.dream_atlas_sources).toBe('always_free');
    expect(LUCID_PLUS_FEATURE_MATRIX.dream_atlas_delete).toBe('always_free');
  });

  it('gates only additional immersive rehearsal among Lucid scene work', () => {
    expect(LUCID_PLUS_FEATURE_MATRIX.first_immersive_rehearsal).toBe('always_free');
    expect(LUCID_PLUS_FEATURE_MATRIX.additional_immersive_rehearsal).toBe('plus_only');
  });

  it('lists the same current Plus benefits for every locale via shared IDs', () => {
    expect([...LUCID_PLUS_CURRENT_BENEFIT_IDS]).toEqual([
      'additional_immersive_rehearsal',
      'expanded_trends_comparisons',
      'premium_interpretation',
      'shared_account_entitlement',
    ]);
    expect(LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS).toContain('first_immersive_rehearsal');
    expect(LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS).not.toContain('additional_immersive_rehearsal');
    const labels = listLucidPlusPaywallItems(LUCID_PLUS_CURRENT_BENEFIT_IDS, {
      additional_immersive_rehearsal: 'More rehearsals',
      expanded_trends_comparisons: 'Trends',
      premium_interpretation: 'Interpretation',
      shared_account_entitlement: 'Shared',
    });
    expect(labels.map((item) => item.id)).toEqual([...LUCID_PLUS_CURRENT_BENEFIT_IDS]);
    expect(LUCID_PLUS_FEATURE_IDS).toHaveLength(21);
  });
});

describe('additional dream rehearsal access', () => {
  const base = {
    subscriptionStatus: { tier: 'free' as const, isActive: false },
    loading: false,
    requiresAuth: true,
    completionCount: 0,
    currentSession: null,
  };

  it('allows a guest preview when no rehearsal has been completed', () => {
    expect(resolveLucidAdditionalDreamRehearsalAccess(base)).toEqual({
      status: 'allowed',
      reason: 'preview',
    });
    expect(
      canStartLucidDreamRehearsal(resolveLucidAdditionalDreamRehearsalAccess(base))
    ).toBe(true);
  });

  it('allows the first scene even when authenticated status is unknown', () => {
    expect(
      resolveLucidAdditionalDreamRehearsalAccess({
        ...base,
        requiresAuth: false,
        loading: true,
        subscriptionStatus: null,
        completionCount: 0,
      })
    ).toEqual({ status: 'allowed', reason: 'preview' });
  });

  it('never starts a second free rehearsal from a completed guest or known-free account', () => {
    expect(
      resolveLucidAdditionalDreamRehearsalAccess({
        ...base,
        completionCount: 1,
        currentSession: { status: 'completed' },
      })
    ).toEqual({ status: 'upgrade_required' });

    expect(
      resolveLucidAdditionalDreamRehearsalAccess({
        ...base,
        requiresAuth: false,
        completionCount: 1,
      })
    ).toEqual({ status: 'upgrade_required' });
  });

  it('lets Plus start after the preview', () => {
    const access = resolveLucidAdditionalDreamRehearsalAccess({
      ...base,
      requiresAuth: false,
      completionCount: 1,
      subscriptionStatus: { tier: 'plus', isActive: true },
    });
    expect(access).toEqual({ status: 'allowed', reason: 'plus' });
    expect(canStartLucidDreamRehearsal(access)).toBe(true);
  });

  it('always resumes an in-progress session even if the right later changes', () => {
    for (const status of ['active', 'paused', 'interrupted'] as const) {
      expect(
        resolveLucidAdditionalDreamRehearsalAccess({
          ...base,
          completionCount: 4,
          currentSession: { status },
          subscriptionStatus: { tier: 'free', isActive: false },
        })
      ).toEqual({ status: 'allowed', reason: 'resume' });
    }
  });

  it('checks instead of assuming Plus when authenticated status is unresolved', () => {
    expect(
      resolveLucidAdditionalDreamRehearsalAccess({
        ...base,
        requiresAuth: false,
        loading: true,
        completionCount: 1,
        subscriptionStatus: { tier: 'plus', isActive: true },
      })
    ).toEqual({ status: 'checking' });

    expect(
      resolveLucidAdditionalDreamRehearsalAccess({
        ...base,
        requiresAuth: false,
        loading: false,
        completionCount: 1,
        subscriptionStatus: null,
      })
    ).toEqual({ status: 'checking' });
  });

  it('asks for an upgrade when Plus is expired or inactive', () => {
    expect(
      resolveLucidAdditionalDreamRehearsalAccess({
        ...base,
        requiresAuth: false,
        completionCount: 1,
        subscriptionStatus: { tier: 'plus', isActive: false },
      })
    ).toEqual({ status: 'upgrade_required' });
  });
});
