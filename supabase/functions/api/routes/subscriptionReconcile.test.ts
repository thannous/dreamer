import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import { handleSubscriptionReconcile } from './subscription.ts';

const SECRET = 'reconcile-test-secret';
const ENV: Record<string, string> = {
  REVENUECAT_RECONCILE_SECRET: SECRET,
  REVENUECAT_SECRET_API_KEY: 'sk_test_only',
  REVENUECAT_PROJECT_ID: 'proj_test_only',
};

async function withEnv(run: () => Promise<void>): Promise<void> {
  const previous = Object.fromEntries(Object.keys(ENV).map((name) => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(ENV)) Deno.env.set(name, value);
  try {
    await run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value == null) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

const context = (body: Record<string, unknown> = {}, secret = SECRET): ApiContext => ({
  req: new Request('https://example.test/functions/v1/api/subscription/reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  }),
  user: null,
  supabase: {} as ApiContext['supabase'],
  supabaseUrl: 'https://example.test',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
});

type Options = {
  cursor?: string | null;
  pages?: { id: string }[][];
  listingError?: boolean;
};

/** A service-role client that only knows the three things the route asks for. */
function adminClient(options: Options) {
  const listings: { p_after: string | null; p_limit: number }[] = [];
  const cursorWrites: (string | null)[] = [];
  const pages = [...(options.pages ?? [])];
  const client = {
    rpc: async (name: string, args: { p_after: string | null; p_limit: number }) => {
      assertEquals(name, 'list_subscription_reconcile_users');
      listings.push(args);
      if (options.listingError) return { data: null, error: { message: 'function not found' } };
      return { data: pages.shift() ?? [], error: null };
    },
    from: (table: string) => {
      if (table === 'subscription_reconcile_cursor') {
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { last_user_id: options.cursor ?? null }, error: null }),
          }),
          upsert: async (row: { last_user_id: string | null }) => {
            cursorWrites.push(row.last_user_id);
            return { error: null };
          },
        };
      }
      assertEquals(table, 'subscription_state');
      return {
        select: () => ({
          // Every account was reconciled a moment ago, so none needs RevenueCat here.
          in: async (_column: string, ids: string[]) => ({
            data: ids.map((user_id) => ({ user_id, updated_at: new Date().toISOString() })),
            error: null,
          }),
        }),
      };
    },
  };
  return { client, listings, cursorWrites };
}

const reconcile = (options: Options, body: Record<string, unknown> = {}) => {
  const admin = adminClient(options);
  return handleSubscriptionReconcile(context(body), {
    createAdminClient: () => admin.client as never,
  }).then(async (response) => ({ response, body: await response.json(), ...admin }));
};

Deno.test('/subscription/reconcile says so when it cannot list accounts, instead of reporting an empty success', async () => {
  await withEnv(async () => {
    const { response, cursorWrites } = await reconcile({ listingError: true });
    assertEquals(response.status, 503);
    assertEquals(cursorWrites, []);
  });
});

Deno.test('/subscription/reconcile pages accounts after the stored cursor and starts over at the end', async () => {
  await withEnv(async () => {
    const { response, body, listings, cursorWrites } = await reconcile({
      cursor: 'user-0100',
      pages: [[{ id: 'user-0101' }, { id: 'user-0102' }], []],
    });
    assertEquals(response.status, 200);
    assertEquals(listings.map((call) => call.p_after), ['user-0100', 'user-0102']);
    assertEquals({ processed: body.processed, skipped: body.skipped, reachedEnd: body.reachedEnd }, {
      processed: 2, skipped: 2, reachedEnd: true,
    });
    // The last account was reached: the next run begins with the first one again.
    assertEquals(cursorWrites, [null]);
  });
});

Deno.test('/subscription/reconcile remembers where a run that hit its limit stopped', async () => {
  await withEnv(async () => {
    const { body, cursorWrites } = await reconcile(
      { pages: [[{ id: 'user-0001' }, { id: 'user-0002' }]] },
      { batchSize: 2, maxTotal: 2 },
    );
    assertEquals({ processed: body.processed, reachedEnd: body.reachedEnd }, { processed: 2, reachedEnd: false });
    assertEquals(cursorWrites, ['user-0002']);
  });
});

Deno.test('/subscription/reconcile refuses a wrong secret', async () => {
  await withEnv(async () => {
    const admin = adminClient({});
    const response = await handleSubscriptionReconcile(context({}, 'wrong'), {
      createAdminClient: () => admin.client as never,
    });
    assertEquals(response.status, 401);
    assertEquals(admin.listings, []);
  });
});
