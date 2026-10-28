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
  identities?: { provider: string }[];
  privateAppleToken?: string | null;
  privateAppleTokenError?: { message: string } | null;
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
      rpc: (name: string, args: { p_user_id: string }) => {
        calls.push(`rpc:${name}:${args.p_user_id}`);
        return Promise.resolve({ data: results.privateAppleToken ?? null, error: results.privateAppleTokenError ?? null });
      },
      auth: {
        admin: {
          getUserById: (id: string) => {
            calls.push(`auth.getUserById:${id}`);
            return Promise.resolve({
              data: {
                user: {
                  id,
                  identities: results.identities ?? [],
                  app_metadata: {},
                },
              },
              error: null,
            });
          },
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

Deno.test('/account deletion removes storage, prepared paintings included, quota rows, then the auth user', async () => {
  const { factory, calls } = fakeAdminClient();
  const res = await handleDeleteAccount(context() as never, factory);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(calls, [
    'factory',
    `storage.list:dream-images:${USER_ID}/`,
    `storage.remove:${USER_ID}/dream.png`,
    `storage.list:dream-images:${USER_ID}/`,
    // The paintings of prepared analyses, kept out of the account's own prefix.
    `storage.list:dream-images:previews/${USER_ID}/`,
    `db.delete:quota_usage.user_id=${USER_ID}`,
    `auth.getUserById:${USER_ID}`,
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

Deno.test('/account deletion revokes Apple tokens before deleting an Apple user', async () => {
  const { factory, calls } = fakeAdminClient({
    identities: [{ provider: 'apple' }],
    privateAppleToken: 'apple-refresh',
  });
  const revokeCalls: { refreshToken?: string | null }[] = [];
  const res = await handleDeleteAccount(context() as never, factory, async (input) => {
    revokeCalls.push(input);
    calls.push('apple.revoke');
  });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(revokeCalls, [{ refreshToken: 'apple-refresh' }]);
  assertEquals(calls.includes(`auth.getUserById:${USER_ID}`), true);
  assertEquals(calls.includes(`auth.deleteUser:${USER_ID}`), true);
  assertEquals(calls.indexOf(`rpc:read_apple_refresh_token:${USER_ID}`) < calls.indexOf('apple.revoke'), true);
  assertEquals(calls.indexOf('apple.revoke') < calls.indexOf(`auth.deleteUser:${USER_ID}`), true);
});

Deno.test('/account deletion skips Apple revoke for non-Apple users', async () => {
  const { factory } = fakeAdminClient({ identities: [{ provider: 'google' }] });
  let revoked = false;
  const res = await handleDeleteAccount(context() as never, factory, async () => {
    revoked = true;
  });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(revoked, false);
});

Deno.test('/account deletion fails honestly when Apple revoke fails', async () => {
  const { factory, calls } = fakeAdminClient({
    identities: [{ provider: 'apple' }],
    privateAppleToken: 'apple-refresh',
  });
  const res = await handleDeleteAccount(context() as never, factory, async () => {
    throw new Error('Apple token revocation is not configured');
  });
  assertEquals(res.status, 503);
  assertEquals(await res.json(), { error: 'Apple token revocation failed' });
  assertEquals(calls.includes(`auth.deleteUser:${USER_ID}`), false);
});

// Isolation gap: real Apple provider failures cannot be safely forced by a local
// Auth journey. These cases protect fail-closed deletion without provider calls.
for (const results of [
  { privateAppleToken: null },
  { privateAppleTokenError: { message: 'private storage unavailable' } },
]) {
  Deno.test(`/account preserves the Apple user when private credentials are unavailable (${JSON.stringify(results)})`, async () => {
    const { factory, calls } = fakeAdminClient({ identities: [{ provider: 'apple' }], ...results });
    let revoked = false;
    const res = await handleDeleteAccount(context() as never, factory, async () => { revoked = true; });
    assertEquals(res.status, 503);
    assertEquals(await res.json(), { error: 'Apple token revocation failed' });
    assertEquals(revoked, false);
    assertEquals(calls.includes(`auth.deleteUser:${USER_ID}`), false);
  });
}

// A bucket that lists one folder level at a time, like Supabase Storage:
// files carry an id, folders have a null id and vanish once emptied.
function storageTree(paths: string[]) {
  const objects = new Set(paths);
  const listed: string[] = [];
  const storage = {
    from: (_bucket: string) => ({
      list: (prefix: string, _options: unknown) => {
        listed.push(prefix);
        const entries = new Map<string, { id: string | null; name: string }>();
        for (const path of objects) {
          if (!path.startsWith(prefix)) continue;
          const [name, ...rest] = path.slice(prefix.length).split('/');
          entries.set(name, { id: rest.length ? null : `id:${path}`, name });
        }
        return Promise.resolve({ data: [...entries.values()], error: null });
      },
      remove: (removed: string[]) => {
        removed.forEach((path) => objects.delete(path));
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { storage, objects, listed };
}

Deno.test('/account deletion removes objects nested in folders under the user prefix', async () => {
  const otherUserObject = '00000000-0000-4000-8000-0000000000bb/kept.png';
  const tree = storageTree([
    `${USER_ID}/dream.png`,
    `${USER_ID}/nested/a.png`,
    `${USER_ID}/nested/deeper/b.png`,
    `${USER_ID}/nested/deeper/c.png`,
    `previews/${USER_ID}/painting.png`,
    `previews/${USER_ID}/drafts/older.png`,
    otherUserObject,
  ]);
  const { factory, calls } = fakeAdminClient();
  const res = await handleDeleteAccount(
    context() as never,
    (url, key) => ({ ...factory(url, key), storage: tree.storage })
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals([...tree.objects], [otherUserObject]);
  assertEquals(tree.listed.includes(`${USER_ID}/nested/deeper/`), true);
  assertEquals(calls.includes(`auth.deleteUser:${USER_ID}`), true);
});

Deno.test('/account deletion keeps the auth user when nesting exceeds the folder depth cap', async () => {
  const tree = storageTree([`${USER_ID}/${'f/'.repeat(10)}deep.png`]);
  const { factory, calls } = fakeAdminClient();
  const res = await handleDeleteAccount(
    context() as never,
    (url, key) => ({ ...factory(url, key), storage: tree.storage })
  );
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'Deletion failed' });
  assertEquals(tree.objects.size, 1);
  assertEquals(calls.includes(`auth.deleteUser:${USER_ID}`), false);
});
