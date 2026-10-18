import type React from 'react';

// Native-only telemetry: Jest records nothing.
export const Observe = {
  reportError: (_error: unknown) => {},
  markInteractive: () => {},
};

export const ObserveRoot = {
  wrap: <P extends object>(Component: React.ComponentType<P>) => Component,
};

export default Observe;
