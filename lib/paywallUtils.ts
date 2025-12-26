import type { PurchasePackage } from '@/lib/types';

export function sortPackages(packages: PurchasePackage[]): PurchasePackage[] {
  return [...packages].sort((a, b) => {
    if (a.interval === b.interval) return 0;
    if (a.interval === 'monthly') return -1;
    return 1;
  });
}

export function calculateAnnualDiscount(packages: PurchasePackage[]): number | null {
  const monthly = packages.find((p) => p.interval === 'monthly');
  const annual = packages.find((p) => p.interval === 'annual');
  if (!monthly || !annual || monthly.price <= 0 || annual.price <= 0) {
    return null;
  }
  const yearlyFromMonthly = monthly.price * 12;
  const savings = ((yearlyFromMonthly - annual.price) / yearlyFromMonthly) * 100;
  return Math.round(savings);
}

