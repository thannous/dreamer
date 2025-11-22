import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('subscriptionServiceMock', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('initialization behavior', () => {
    it('given uninitialized service when initializing then sets initialized flag and returns free status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When
      const status = await service.initialize();

      // Then
      expect(status.tier).toBe('free');
      expect(status.isActive).toBe(false);
      expect(status.expiryDate).toBeNull();
      expect(status.productId).toBeNull();
      expect(service.isInitialized()).toBe(true);
    });

    it('given already initialized service when initializing again then returns existing status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.initialize();

      // Then
      expect(status.tier).toBe('free');
      expect(service.isInitialized()).toBe(true);
    });

    it('given uninitialized service when checking initialization then returns false', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When
      const initialized = service.isInitialized();

      // Then
      expect(initialized).toBe(false);
    });
  });

  describe('status management', () => {
    it('given uninitialized service when getting status then returns null', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When
      const status = await service.getStatus();

      // Then
      expect(status).toBeNull();
    });

    it('given initialized service with no current status when getting status then returns default free status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.getStatus();

      // Then
      expect(status?.tier).toBe('free');
      expect(status?.isActive).toBe(false);
      expect(status?.expiryDate).toBeNull();
      expect(status?.productId).toBeNull();
    });

    it('given initialized service with existing status when getting status then returns current status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();
      await service.purchasePackage('mock_monthly');

      // When
      const status = await service.getStatus();

      // Then
      expect(status?.tier).toBe('premium');
      expect(status?.isActive).toBe(true);
      expect(status?.productId).toBe('mock_monthly');
    });
  });

  describe('offerings loading', () => {
    it('given uninitialized service when loading offerings then returns empty array', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When
      const offerings = await service.loadOfferings();

      // Then
      expect(offerings).toHaveLength(0);
    });

    it('given initialized service when loading offerings then returns mock packages', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const offerings = await service.loadOfferings();

      // Then
      expect(offerings).toHaveLength(2);
      const ids = offerings.map((item) => item.id);
      expect(ids).toContain('mock_monthly');
      expect(ids).toContain('mock_annual');
      
      const monthlyPackage = offerings.find((o) => o.id === 'mock_monthly');
      expect(monthlyPackage?.interval).toBe('monthly');
      expect(monthlyPackage?.priceFormatted).toBe('$4.99');
      expect(monthlyPackage?.currency).toBe('USD');
      expect(monthlyPackage?.title).toBe('Monthly');
      
      const annualPackage = offerings.find((o) => o.id === 'mock_annual');
      expect(annualPackage?.interval).toBe('annual');
      expect(annualPackage?.priceFormatted).toBe('$39.99');
      expect(annualPackage?.currency).toBe('USD');
      expect(annualPackage?.title).toBe('Annual');
    });
  });

  describe('package purchasing', () => {
    it('given uninitialized service when purchasing package then throws error', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When/Then
      await expect(service.purchasePackage('mock_monthly')).rejects.toThrow('Purchases not initialized');
    });

    it('given initialized service when purchasing valid package then upgrades to premium', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.purchasePackage('mock_annual');

      // Then
      expect(status.tier).toBe('premium');
      expect(status.isActive).toBe(true);
      expect(status.expiryDate).toBeNull();
      expect(status.productId).toBe('mock_annual');
    });

    it('given initialized service when purchasing invalid package then uses first mock package', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.purchasePackage('invalid_package_id');

      // Then
      expect(status.tier).toBe('premium');
      expect(status.isActive).toBe(true);
      expect(status.productId).toBe('mock_monthly'); // Falls back to first package
    });

    it('given initialized service when purchasing monthly package then sets correct product ID', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.purchasePackage('mock_monthly');

      // Then
      expect(status.tier).toBe('premium');
      expect(status.productId).toBe('mock_monthly');
    });
  });

  describe('purchase restoration', () => {
    it('given uninitialized service when restoring purchases then throws error', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When/Then
      await expect(service.restorePurchases()).rejects.toThrow('Purchases not initialized');
    });

    it('given initialized service with no current status when restoring purchases then returns default free status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.restorePurchases();

      // Then
      expect(status.tier).toBe('free');
      expect(status.isActive).toBe(false);
      expect(status.expiryDate).toBeNull();
      expect(status.productId).toBeNull();
    });

    it('given initialized service with premium status when restoring purchases then returns current premium status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();
      await service.purchasePackage('mock_annual');

      // When
      const status = await service.restorePurchases();

      // Then
      expect(status.tier).toBe('premium');
      expect(status.isActive).toBe(true);
      expect(status.productId).toBe('mock_annual');
    });
  });

  describe('status refresh', () => {
    it('given uninitialized service when refreshing status then throws error', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When/Then
      await expect(service.refreshStatus()).rejects.toThrow('Purchases not initialized');
    });

    it('given initialized service with no current status when refreshing status then returns default free status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();

      // When
      const status = await service.refreshStatus();

      // Then
      expect(status.tier).toBe('free');
      expect(status.isActive).toBe(false);
      expect(status.expiryDate).toBeNull();
      expect(status.productId).toBeNull();
    });

    it('given initialized service with premium status when refreshing status then returns current premium status', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');
      await service.initialize();
      await service.purchasePackage('mock_monthly');

      // When
      const status = await service.refreshStatus();

      // Then
      expect(status.tier).toBe('premium');
      expect(status.isActive).toBe(true);
      expect(status.productId).toBe('mock_monthly');
    });
  });

  describe('integration scenarios', () => {
    it('given full user flow when initializing then purchasing then restoring then refreshing then maintains correct state', async () => {
      // Given
      const service = await import('./subscriptionServiceMock');

      // When - Initialize
      const initialStatus = await service.initialize();
      expect(initialStatus.tier).toBe('free');

      // When - Purchase
      const purchasedStatus = await service.purchasePackage('mock_annual');
      expect(purchasedStatus.tier).toBe('premium');

      // When - Get status
      const currentStatus = await service.getStatus();
      expect(currentStatus?.tier).toBe('premium');

      // When - Restore purchases
      const restoredStatus = await service.restorePurchases();
      expect(restoredStatus.tier).toBe('premium');

      // When - Refresh status
      const refreshedStatus = await service.refreshStatus();
      expect(refreshedStatus.tier).toBe('premium');

      // Then - All statuses should be consistent
      expect(purchasedStatus.productId).toBe(restoredStatus.productId);
      expect(refreshedStatus.productId).toBe(currentStatus?.productId);
    });
  });
});
