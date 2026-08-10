import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleDeleteAccount } from './account.ts';

function context(overrides: Record<string, unknown> = {}) {
  return {
    req: new Request('https://example.supabase.co/api/account', { method: 'DELETE' }),
    user: { id: '00000000-0000-4000-8000-0000000000aa' },
    supabase: {},
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-test-key',
    storageBucket: 'dream-images',
    ...overrides,
  };
}

Deno.test('/account deletion requires an authenticated user', async () => {
  const res = await handleDeleteAccount(context({ user: null }) as never);
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'Unauthorized' });
});

Deno.test('/account deletion is unavailable without a service role key', async () => {
  const res = await handleDeleteAccount(context({ supabaseServiceRoleKey: null }) as never);
  assertEquals(res.status, 503);
  assertEquals(await res.json(), { error: 'Service unavailable' });
});

type FakeAdminResults = {
  listError?: { message: string } | null;
  removeError?: { message: string } | null;
  quotaError?: { code: string } | null;
  deleteUserError?: { message: string } | null;
};

function fakeAdminClient(results: FakeAdminResults = {}) {
  const calls: string[] = [];
  let listCalls = 0;
  const factory = (_url: string, _key: string) => {
    calls.push('factory');
    return {
      storage: {
        from: (bucket: string) => ({
          list: (prefix: string, _options: unknown) => {
            listCalls += 1;
            calls.push(`storage.list:${bucket}:${prefix}`);
            if (results.listError) return Promise.resolve({ data: null, error: results.listError });
            // First page holds one object, second page is empty: deletion terminates.
            const data = listCalls === 1 ? [{ id: 'obj-1', name: 'dream.png' }] : [];
            return Promise.resolve({ data, error: null });
          },
          remove: (paths: string[]) => {
            calls.push(`storage.remove:${paths.join(',')}`);
            return Promise.resolve({ error: results.removeError ?? null });
          },
        }),
      },
      from: (table: string) => ({
        delete: () => ({
          eq: (column: string, value: string) => {
            calls.push(`db.delete:${table}.${column}=${value}`);
            return Promise.resolve({ error: results.quotaError ?? null });
          },
        }),
      }),
      auth: {
        admin: {
          deleteUser: (id: string) => {
            calls.push(`auth.deleteUser:${id}`);
            return Promise.resolve({ error: results.deleteUserError ?? null });
          },
        },
      },
    };
  };
  return { factory, calls };
}

const USER_ID = '00000000-0000-4000-8000-0000000000aa';

Deno.test('/account deletion removes storage, quota rows, then the auth user', async () => {
  const { factory, calls } = fakeAdminClient();
  const res = await handleDeleteAccount(context() as never, factory);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(calls, [
    'factory',
    `storage.list:dream-images:${USER_ID}/`,
    `storage.remove:${USER_ID}/dream.png`,
    `storage.list:dream-images:${USER_ID}/`,
    `db.delete:quota_usage.user_id=${USER_ID}`,
    `auth.deleteUser:${USER_ID}`,
  ]);
});

Deno.test('/account deletion stops before touching the auth user when storage fails', async () => {
  const { factory, calls } = fakeAdminClient({ listError: { message: 'boom' } });
  const res = await handleDeleteAccount(context() as never, factory);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Deletion failed' });
  assertEquals(calls.includes('auth.deleteUser:' + USER_ID), false);
  assertEquals(calls.some((call) => call.startsWith('db.delete:')), false);
});

Deno.test('/account deletion stops before the auth user when quota deletion fails', async () => {
  const { factory, calls } = fakeAdminClient({ quotaError: { code: 'XX000' } });
  const res = await handleDeleteAccount(context() as never, factory);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Deletion failed' });
  assertEquals(calls.includes('auth.deleteUser:' + USER_ID), false);
});

Deno.test('/account deletion reports a failure when the auth deletion fails', async () => {
  const { factory } = fakeAdminClient({ deleteUserError: { message: 'nope' } });
  const res = await handleDeleteAccount(context() as never, factory);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Deletion failed' });
});
