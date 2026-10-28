/** Whose local state this is: the signed-out guest or one signed-in account. */
export type AccountScope = 'guest' | `user:${string}`;

export const toAccountScope = (userId: string | null | undefined): AccountScope =>
  userId ? `user:${userId}` : 'guest';
