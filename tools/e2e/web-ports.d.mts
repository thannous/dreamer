export const FIXED_WEB_PORTS: Readonly<{ backend: number; branch: number }>;
export function webPort(product: string, env: Record<string, string | undefined>): number;
export function sameServedOrigin(declared: string, served: unknown): boolean;
