import { NOCTALIA_IDENTITY_MATRIX } from './matrix';
import { APP_PRODUCTS, IDENTITY_ENVIRONMENTS } from './types';
import type { AppProduct, IdentityEnvironment, NoctaliaIdentity } from './types';
import { assertValidNoctaliaIdentityMatrix } from './validation';

assertValidNoctaliaIdentityMatrix(NOCTALIA_IDENTITY_MATRIX);

function isAppProduct(value: unknown): value is AppProduct {
  return (APP_PRODUCTS as readonly string[]).includes(String(value));
}

function isIdentityEnvironment(value: unknown): value is IdentityEnvironment {
  return (IDENTITY_ENVIRONMENTS as readonly string[]).includes(String(value));
}

export function getNoctaliaIdentity(
  product: AppProduct,
  environment: IdentityEnvironment
): NoctaliaIdentity {
  if (!isAppProduct(product)) {
    throw new Error(`[NoctaliaIdentity] unsupported product: ${String(product)}`);
  }
  if (!isIdentityEnvironment(environment)) {
    throw new Error(
      `[NoctaliaIdentity] unsupported environment: ${String(environment)}`
    );
  }

  return NOCTALIA_IDENTITY_MATRIX[product][environment];
}
